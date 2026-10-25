import "server-only";
import {
  createHmac,
  createPrivateKey,
  sign,
  timingSafeEqual,
} from "node:crypto";
import { isCanonicalUuid } from "@/domain/coach-bookings";
import { isCoachMediaVideoUploadUrl } from "@/domain/coach-media";

function setting(value: string | undefined) {
  return value?.trim() && !/[<>]/.test(value) ? value.trim() : null;
}
export function muxVideoConfigured() {
  return [
    process.env.MUX_TOKEN_ID,
    process.env.MUX_TOKEN_SECRET,
    process.env.MUX_SIGNING_KEY_ID,
    process.env.MUX_SIGNING_PRIVATE_KEY,
    process.env.MUX_WEBHOOK_SECRET,
    process.env.COACH_MEDIA_DATABASE_URL,
  ].every((v) => setting(v) !== null);
}
export type MuxAsset = Readonly<{
  id: string;
  passthrough: string;
  uploadId: string;
  status: "processing" | "ready" | "failed";
  playbackId: string | null;
  duration: number | null;
}>;
const providerId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9]{8,128}$/.test(v);
export function parseMuxAsset(value: unknown): MuxAsset {
  if (!value || typeof value !== "object")
    throw Error("Invalid provider asset.");
  const v = value as Record<string, unknown>;
  if (
    !providerId(v.id) ||
    !providerId(v.upload_id) ||
    typeof v.passthrough !== "string" ||
    !isCanonicalUuid(v.passthrough) ||
    !["preparing", "ready", "errored"].includes(String(v.status))
  )
    throw Error("Invalid provider asset.");
  const ids = Array.isArray(v.playback_ids)
    ? (v.playback_ids as { id: unknown; policy: unknown }[])
    : [];
  // A public playback ID, or mixed public/signed policies, would bypass visibility.
  if (ids.some((i) => i.policy !== "signed" || !providerId(i.id)))
    throw Error("Invalid provider playback policy.");
  const duration =
    typeof v.duration === "number" && Number.isFinite(v.duration)
      ? v.duration
      : null;
  const status =
    v.status === "errored"
      ? "failed"
      : v.status === "ready"
        ? "ready"
        : "processing";
  if (status === "ready" && (!ids[0] || duration === null || duration <= 0))
    throw Error("Incomplete provider readiness.");
  return {
    id: v.id,
    passthrough: v.passthrough,
    uploadId: v.upload_id,
    status,
    playbackId: (ids[0]?.id as string | undefined) ?? null,
    duration,
  };
}
export function createMuxVideoProvider(fetcher: typeof fetch = fetch) {
  async function request(path: string, init: RequestInit = {}) {
    const id = setting(process.env.MUX_TOKEN_ID),
      secret = setting(process.env.MUX_TOKEN_SECRET);
    if (!id || !secret) throw Error("Video service unavailable.");
    const response = await fetcher(`https://api.mux.com/video/v1/${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/json",
      },
    });
    if (init.method === "DELETE" || path.endsWith("/cancel")) {
      if (!response.ok && response.status !== 404)
        throw Error("Video service unavailable.");
      return null;
    }
    if (!response.ok) throw Error("Video service unavailable.");
    return ((await response.json()) as { data: unknown }).data;
  }
  return {
    async createUpload(id: string, origin: string) {
      const value = (await request("uploads", {
        method: "POST",
        body: JSON.stringify({
          timeout: 900,
          cors_origin: origin,
          new_asset_settings: {
            passthrough: id,
            playback_policies: ["signed"],
            video_quality: "basic",
            max_resolution_tier: "1080p",
            inputs: [
              {
                generated_subtitles: [
                  { language_code: "auto", name: "Automatic captions" },
                ],
              },
            ],
          },
        }),
      })) as { id?: unknown; url?: unknown };
      if (!providerId(value.id) || !isCoachMediaVideoUploadUrl(value.url))
        throw Error("Invalid provider upload.");
      return { id: value.id, url: value.url };
    },
    async readUpload(id: string) {
      if (!providerId(id)) throw Error("Invalid provider upload.");
      const upload = (await request(`uploads/${id}`)) as {
        asset_id?: unknown;
        status?: unknown;
      };
      if (!providerId(upload.asset_id)) return null;
      return parseMuxAsset(await request(`assets/${upload.asset_id}`));
    },
    async readAsset(id: string) {
      if (!providerId(id)) throw Error("Invalid provider asset.");
      return parseMuxAsset(await request(`assets/${id}`));
    },
    async remove(assetId: string | null, uploadId: string | null) {
      if (assetId) {
        if (!providerId(assetId)) throw Error("Invalid provider asset.");
        await request(`assets/${assetId}`, { method: "DELETE" });
      } else if (uploadId) {
        if (!providerId(uploadId)) throw Error("Invalid provider upload.");
        const upload = (await request(`uploads/${uploadId}`)) as {
          asset_id?: unknown;
          status?: unknown;
        };
        if (providerId(upload.asset_id))
          await request(`assets/${upload.asset_id}`, { method: "DELETE" });
        else if (upload.status === "waiting")
          await request(`uploads/${uploadId}/cancel`, { method: "PUT" });
      }
    },
  };
}
export const muxVideoProvider = createMuxVideoProvider();
export function muxPlaybackToken(
  playbackId: string,
  audience: "v" | "t",
  now = Date.now(),
) {
  const keyId = setting(process.env.MUX_SIGNING_KEY_ID),
    key = setting(process.env.MUX_SIGNING_PRIVATE_KEY);
  if (!providerId(playbackId) || !keyId || !key)
    throw Error("Video service unavailable.");
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: playbackId,
      aud: audience,
      kid: keyId,
      exp: Math.floor(now / 1000) + 300,
      ...(audience === "v"
        ? { max_resolution: "720p" }
        : { width: 960, fit_mode: "preserve" }),
    }),
  ).toString("base64url");
  const privateKey = createPrivateKey(
    key.includes("BEGIN")
      ? key.replaceAll("\\n", "\n")
      : Buffer.from(key, "base64"),
  );
  return `${header}.${payload}.${sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url")}`;
}
export function verifyMuxSignature(
  body: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header || header.length > 2048 || !secret) return false;
  const entries = header.split(",").map((s) => s.trim().split("="));
  const timestamps = entries.filter(([key]) => key === "t");
  if (timestamps.length !== 1 || !/^[0-9]{1,12}$/.test(timestamps[0][1] ?? ""))
    return false;
  const timestamp = timestamps[0][1];
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest();
  return entries.some(
    ([key, value]) =>
      key === "v1" &&
      /^[a-f0-9]{64}$/.test(value ?? "") &&
      timingSafeEqual(Buffer.from(value, "hex"), expected),
  );
}
