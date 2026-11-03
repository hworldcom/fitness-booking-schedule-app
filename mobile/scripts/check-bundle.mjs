import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist/ios");
function maps(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? maps(file)
      : file.endsWith(".map")
        ? [file]
        : [];
  });
}
const files = maps(output);
if (!files.length)
  throw new Error("iOS source maps are required to audit the bundle.");
let sources = 0;
for (const file of files) {
  const map = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const source of map.sources ?? []) {
    sources += 1;
    const normalized = source.replaceAll("\\", "/");
    // SDK57 emits paths relative to the app's served root, prefixed by '/'.
    // Reject fallback into a parent package, even if it is not a known server
    // package. Only Metro's synthetic polyfills have no corresponding file.
    if (!normalized.startsWith("\0polyfill:")) {
      const local = normalized.split("?")[0];
      if (!/^\/(?:src|node_modules)\//.test(local))
        throw new Error("Unexpected native bundle source: " + source);
      const resolved = path.resolve(root, "." + local);
      if (
        !fs.existsSync(resolved) ||
        !fs.realpathSync(resolved).startsWith(root + path.sep)
      )
        throw new Error("Native bundle source escapes the app: " + source);
    }
    if (
      /node_modules\/(next|server-only|postgres|pg|drizzle-orm|react-dom)\//.test(
        normalized,
      ) ||
      normalized.startsWith(
        path.resolve(root, "../src").replaceAll("\\", "/") + "/",
      )
    )
      throw new Error("Web/server dependency in native bundle: " + source);
  }
}
console.log(
  "iOS bundle dependency audit passed (" +
    sources +
    " sources, " +
    files.length +
    " source maps).",
);
