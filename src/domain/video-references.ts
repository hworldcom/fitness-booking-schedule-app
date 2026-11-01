export type VideoReference = Readonly<{ label: string; url: string }>;

const cleanText = (s: string) => s.replace(/\r\n?/g, "\n").trim();
export function normalizeVideoReferences(
  value: unknown,
): readonly VideoReference[] {
  if (!Array.isArray(value) || value.length > 5)
    throw Error("Add up to five video links.");
  return value.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      Object.keys(v).some((k) => !["label", "url"].includes(k)) ||
      typeof v.label !== "string" ||
      typeof v.url !== "string"
    )
      throw Error("Give each video a title and URL.");
    const label = cleanText(v.label),
      raw = v.url.trim();
    if (
      !label ||
      Array.from(label).length > 80 ||
      /[\p{Cc}\p{Cs}]/u.test(label) ||
      raw.length > 2048 ||
      /[\p{Cc}\p{Cs}]/u.test(raw)
    )
      throw Error("Use a video title of 1–80 characters and a valid URL.");
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port)
      throw Error("Use an HTTPS YouTube or Instagram video link.");
    let url: string;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        u.hostname,
      )
    ) {
      const id =
        u.hostname === "youtu.be"
          ? u.pathname.slice(1)
          : u.pathname === "/watch"
            ? u.searchParams.get("v")
            : u.pathname.startsWith("/shorts/")
              ? u.pathname.slice(8)
              : null;
      if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
        throw Error("Paste a YouTube video or Shorts URL.");
      const t = u.searchParams.get("t");
      if (t && !/^\d{1,6}s?$/.test(t))
        throw Error("Use a video timestamp in seconds.");
      url = `https://www.youtube.com/watch?v=${id}${t ? `&t=${parseInt(t, 10)}` : ""}`;
    } else if (
      ["instagram.com", "www.instagram.com"].includes(u.hostname) &&
      /^\/(reel|p)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
    ) {
      url = `https://www.instagram.com${u.pathname.replace(/\/$/, "")}/`;
    } else throw Error("Paste a YouTube video or Instagram post/Reel URL.");
    return { label, url };
  });
}
