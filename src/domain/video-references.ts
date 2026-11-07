export type VideoReference = Readonly<{ label: string; url: string }>;
export type VideoReferenceErrors = Readonly<{ label?: string; url?: string }>;

const cleanText = (s: string) => s.replace(/\r\n?/g, "\n").trim();
function normalizeVideoUrl(value: string): string {
  const raw = value.trim();
  if (!raw) throw Error("Paste a YouTube video or Instagram post/Reel URL.");
  if (raw.length > 2048)
    throw Error("Use a video URL of up to 2,048 characters.");
  if (/[\p{Cc}\p{Cs}]/u.test(raw))
    throw Error("Remove line breaks or unsupported characters from this URL.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw Error("Paste the full video URL, starting with https://.");
  }
  if (u.protocol !== "https:")
    throw Error("Use an HTTPS YouTube or Instagram video link.");
  if (u.username || u.password)
    throw Error("Remove login details from the video URL.");
  if (u.port) throw Error("Remove the custom port from the video URL.");
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
      throw Error(
        "Paste a YouTube video or Shorts URL. Channel and playlist links cannot be saved.",
      );
    const t = u.searchParams.get("t");
    if (t && !/^\d{1,6}s?$/.test(t))
      throw Error("Use a YouTube timestamp in seconds, for example t=90.");
    return `https://www.youtube.com/watch?v=${id}${t ? `&t=${parseInt(t, 10)}` : ""}`;
  }
  if (["instagram.com", "www.instagram.com"].includes(u.hostname)) {
    const match = /^\/(reel|reels|p)\/([A-Za-z0-9_-]+)\/?$/.exec(u.pathname);
    if (!match)
      throw Error(
        "Paste an Instagram post or Reel URL. Profile links cannot be saved.",
      );
    return `https://www.instagram.com/${match[1] === "p" ? "p" : "reel"}/${match[2]}/`;
  }
  throw Error(
    "Use a YouTube video/Shorts or Instagram post/Reel URL. Other websites are not supported.",
  );
}

/** Field diagnostics use the same normalization rules as saved references. */
export function videoReferenceErrors(
  video: VideoReference,
): VideoReferenceErrors {
  const label = cleanText(video.label);
  const errors: { label?: string; url?: string } = {};
  if (!label) errors.label = "Add a title for this video.";
  else if (Array.from(label).length > 80)
    errors.label = "Shorten the video title to 80 characters or fewer.";
  else if (/[\p{Cc}\p{Cs}]/u.test(label))
    errors.label =
      "Remove line breaks or unsupported characters from the video title.";
  try {
    normalizeVideoUrl(video.url);
  } catch (error) {
    errors.url = (error as Error).message;
  }
  return errors;
}

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
    const errors = videoReferenceErrors(v);
    if (errors.label || errors.url) throw Error(errors.label ?? errors.url);
    return { label: cleanText(v.label), url: normalizeVideoUrl(v.url) };
  });
}
