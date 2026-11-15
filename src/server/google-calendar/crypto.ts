import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export const challenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");
const keyId = (key: Buffer) =>
  createHash("sha256").update(key).digest("hex").slice(0, 16);
export function seal(value: string, aad: string, keys: readonly Buffer[]) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys[0], iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    keyId(keys[0]),
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}
export function unseal(value: string, aad: string, keys: readonly Buffer[]) {
  try {
    if (value.length > 16000) throw Error();
    const [version, id, iv, tag, data, extra] = value.split(".");
    const key = keys.find((k) => keyId(k) === id);
    if (version !== "v1" || !key || extra || !iv || !tag || !data)
      throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Calendar credential unavailable.");
  }
}
