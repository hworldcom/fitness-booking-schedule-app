import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, generateKeyPairSync, verify } from "node:crypto";
import sharp from "sharp";
import {
  normalizeCoachMediaPhoto,
  InvalidCoachMediaPhoto,
} from "@/server/coaches/media-normalization";
import {
  createMuxVideoProvider,
  parseMuxAsset,
  verifyMuxSignature,
  muxPlaybackToken,
} from "@/server/coaches/mux-video";
import { POST as mediaPost } from "@/app/api/coach/media/route";
import { POST as muxPost } from "@/app/api/webhooks/mux/route";
import { projectCoachMediaAssets } from "@/server/coaches/media-service";
import type { MediaAsset } from "@/server/db/coaches/media-repository";
import { reconcileCoachMediaWebhook } from "@/server/coaches/media-webhook";
const id = "93290000-0000-4000-8000-000000000001";
test("gallery normalization preserves aspect, corrects orientation, bounds variants and strips metadata", async () => {
  const source = await sharp({
    create: { width: 1800, height: 1000, channels: 3, background: "#456654" },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Artist: "Private source owner" } },
    })
    .toBuffer();
  const result = await normalizeCoachMediaPhoto(source);
  for (const [variant, v] of Object.entries(result)) {
    const meta = await sharp(v.bytes).metadata();
    assert.equal(meta.format, "webp");
    assert.ok(meta.width! < meta.height!);
    assert.equal(meta.exif, undefined);
    assert.equal(meta.icc, undefined);
    assert.equal(meta.orientation, undefined);
    assert.ok(
      Math.max(meta.width!, meta.height!) <=
        (variant === "thumbnail" ? 640 : 1600),
    );
    assert.ok(v.bytes.length <= (variant === "thumbnail" ? 262144 : 1048576));
  }
});
test("invalid/oversized/animated/decompression-heavy sources are rejected before storage", async () => {
  const huge = await sharp({
    create: { width: 6000, height: 4100, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const tiny = await sharp({
    create: { width: 23, height: 100, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const animation = await sharp(
    Buffer.concat([
      Buffer.alloc(40 * 40 * 3, 40),
      Buffer.alloc(40 * 40 * 3, 190),
    ]),
    { raw: { width: 40, height: 80, channels: 3, pageHeight: 40 } },
  )
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animation).metadata()).pages, 2);
  for (const input of [
    new Uint8Array(),
    new Uint8Array(4194305),
    Buffer.from("not an image"),
    Buffer.from('<svg width="100" height="100"></svg>'),
    huge,
    tiny,
    animation,
  ])
    await assert.rejects(
      normalizeCoachMediaPhoto(input),
      InvalidCoachMediaPhoto,
    );
});
test("Mux callbacks require raw-body HMAC, bounded time and a valid signature during key rotation", () => {
  const now = 1760000000000,
    stamp = String(now / 1000),
    body = '{"type":"video.asset.ready"}',
    secret = "fixture-secret";
  const signature = createHmac("sha256", secret)
    .update(`${stamp}.${body}`)
    .digest("hex");
  assert.equal(
    verifyMuxSignature(body, `t=${stamp},v1=${signature}`, secret, now),
    true,
  );
  assert.equal(
    verifyMuxSignature(
      body,
      `t=${stamp},v1=${"0".repeat(64)},v1=${signature}`,
      secret,
      now,
    ),
    true,
  );
  for (const [payload, header, time] of [
    [body + " ", `t=${stamp},v1=${signature}`, now],
    [body, `t=${stamp},v1=${signature}`, now + 301000],
    [body, `t=${stamp},v1=${signature}`, now - 301000],
    [body, `t=${stamp},t=${stamp},v1=${signature}`, now],
    [body, `t=${stamp},v1=no`, now],
  ] as const)
    assert.equal(verifyMuxSignature(payload, header, secret, time), false);
});
test("provider direct upload is signed, origin-bound, captioned and uses supported resolution; public playback is rejected", async () => {
  process.env.MUX_TOKEN_ID = "fixture-token";
  process.env.MUX_TOKEN_SECRET = "fixture-secret";
  const calls: { url: string; init: RequestInit }[] = [];
  const provider = createMuxVideoProvider(async (input, init) => {
    calls.push({ url: String(input), init: init! });
    return Response.json({
      data: {
        id: "upload000001",
        url: "https://direct-uploads-oci-us-phoenix-1-vop1.mux.com/example?signature=opaque",
      },
    });
  });
  assert.match(
    (await provider.createUpload(id, "http://localhost:3100")).url,
    /^https:\/\/direct-uploads-oci-us-phoenix-1-vop1[.]mux[.]com\//,
  );
  const payload = JSON.parse(calls[0].init.body as string);
  assert.equal(payload.cors_origin, "http://localhost:3100");
  assert.deepEqual(payload.new_asset_settings.playback_policies, ["signed"]);
  assert.equal(payload.new_asset_settings.max_resolution_tier, "1080p");
  assert.equal(
    payload.new_asset_settings.inputs[0].generated_subtitles[0].language_code,
    "auto",
  );
  assert.equal(payload.new_asset_settings.passthrough, id);
  assert.equal(payload.new_asset_settings.meta, undefined);
  const asset = {
    id: "asset000001",
    upload_id: "upload000001",
    passthrough: id,
    status: "ready",
    duration: 60,
    playback_ids: [{ id: "playback000001", policy: "signed" }],
  };
  assert.equal(parseMuxAsset(asset).duration, 60);
  assert.throws(() =>
    parseMuxAsset({
      ...asset,
      playback_ids: [{ id: "playback000001", policy: "public" }],
    }),
  );
  assert.throws(() => parseMuxAsset({ ...asset, upload_id: "bad" }));
  const offline = createMuxVideoProvider(async () => {
    throw Error("Network uncertain");
  });
  await assert.rejects(offline.createUpload(id, "http://localhost:3100"));
  const spoofed = createMuxVideoProvider(async () =>
    Response.json({
      data: {
        id: "upload000001",
        url: "https://direct-uploads-us.mux.com.evil.test/upload",
      },
    }),
  );
  await assert.rejects(spoofed.createUpload(id, "http://localhost:3100"));
  delete process.env.MUX_TOKEN_ID;
  delete process.env.MUX_TOKEN_SECRET;
});
test("playback tokens verify with RSA, expire in five minutes and contain no user identity", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  process.env.MUX_SIGNING_KEY_ID = "fixture-key";
  process.env.MUX_SIGNING_PRIVATE_KEY = Buffer.from(
    privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  ).toString("base64");
  const now = 1760000000000,
    token = muxPlaybackToken("playback000001", "v", now),
    [header, payload, signature] = token.split(".");
  assert.equal(
    verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
    true,
  );
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  assert.deepEqual(claims, {
    sub: "playback000001",
    aud: "v",
    kid: "fixture-key",
    exp: now / 1000 + 300,
    max_resolution: "720p",
  });
  assert.equal(
    JSON.parse(
      Buffer.from(
        muxPlaybackToken("playback000001", "t", now).split(".")[1],
        "base64url",
      ).toString(),
    ).aud,
    "t",
  );
  delete process.env.MUX_SIGNING_KEY_ID;
  delete process.env.MUX_SIGNING_PRIVATE_KEY;
});
test("media routes reject forged origins, invalid schemas, oversized streams and forged callbacks without database access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3100";
  for (const [body, origin, type] of [
    ["{}", "https://evil.test", "application/json"],
    ["{broken", "http://localhost:3100", "application/json"],
    ["x".repeat(8193), "http://localhost:3100", "application/json"],
    [
      JSON.stringify({ action: "publish", revision: -1 }),
      "http://localhost:3100",
      "application/json",
    ],
    ["not-image", "http://localhost:3100", "image/svg+xml"],
  ]) {
    const result = await mediaPost(
      new Request("http://localhost:3100/api/coach/media", {
        method: "POST",
        headers: { origin, "content-type": type },
        body,
      }),
    );
    assert.equal(result.status, origin.includes("evil") ? 403 : 400);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
  }
  process.env.MUX_WEBHOOK_SECRET = "secret";
  process.env.COACH_MEDIA_DATABASE_URL =
    "postgresql://test:test@127.0.0.1:55322/unused";
  assert.equal(
    (
      await muxPost(
        new Request("http://localhost:3100/api/webhooks/mux", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    401,
  );
  delete process.env.MUX_WEBHOOK_SECRET;
  delete process.env.COACH_MEDIA_DATABASE_URL;
});
test("public projection never leaks private storage paths, dataset IDs or provider IDs", () => {
  const asset = {
    id,
    description: "Training",
    width: 800,
    height: 600,
    profile_id: id,
    run_id: id,
    fingerprint: "privatehash",
    full_path: "private/source",
    mux_asset_id: "privateprovider",
    status: "ready",
  } as MediaAsset;
  const projected = projectCoachMediaAssets([asset], null, "test-coach");
  assert.doesNotMatch(
    JSON.stringify(projected),
    /private|run_id|profile_id|mux_asset/,
  );
  assert.match(
    projected.photos[0].fullUrl,
    /\/api\/coaches\/test-coach\/media\/photos\//,
  );
});
test("callback recovery rejects identity substitution and safely repeats deletion after terminal states", async () => {
  const provider = {
    id: "asset000001",
    uploadId: "upload000001",
    passthrough: id,
    playbackId: "playback000001",
    status: "ready" as const,
    duration: 60,
  };
  let current = {
    id,
    mux_upload_id: provider.uploadId,
    mux_asset_id: null,
    status: "processing",
  } as MediaAsset;
  let reads = 0,
    applied = 0,
    removed = 0;
  const event = {
    type: "video.asset.ready",
    data: { id: provider.id, passthrough: id },
  };
  const deps = {
    assetById: async () => current,
    readAsset: async () => {
      reads++;
      return provider;
    },
    apply: async () => {
      applied++;
      current = { ...current, status: "failed", mux_asset_id: provider.id };
    },
    remove: async () => {
      removed++;
    },
  };
  await assert.rejects(
    reconcileCoachMediaWebhook(event, {
      ...deps,
      readAsset: async () => ({ ...provider, uploadId: "foreign00001" }),
    }),
    /identity mismatch/,
  );
  assert.equal(applied, 0);
  assert.equal(removed, 0);
  await reconcileCoachMediaWebhook(event, deps);
  await reconcileCoachMediaWebhook(event, deps);
  assert.equal(reads, 1);
  assert.equal(applied, 1);
  assert.equal(removed, 2);
  current = { ...current, status: "deleted" };
  await reconcileCoachMediaWebhook(event, deps);
  assert.equal(reads, 1);
  assert.equal(removed, 2);
  current = { ...current, status: "creating", mux_upload_id: null };
  await assert.rejects(
    reconcileCoachMediaWebhook(event, deps),
    /not yet reconciled/,
  );
  assert.equal(applied, 1);
});
