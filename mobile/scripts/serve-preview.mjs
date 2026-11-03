import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../dist/web");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
if (!fs.existsSync(path.join(root, "index.html")))
  throw new Error("Run npm run export:web first.");
const server = http.createServer((req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = path.resolve(root, "." + name);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(root, "index.html");
    res.writeHead(200, {
      "content-type": types[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(400).end();
  }
});
server.listen(
  Number(process.env.MOBILE_PREVIEW_PORT ?? 8082),
  "127.0.0.1",
  () => {
    console.log(
      "MovX sample preview: http://127.0.0.1:" + server.address().port,
    );
  },
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
