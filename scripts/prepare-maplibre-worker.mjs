import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(
  require.resolve("maplibre-gl/package.json"),
);
const source = path.join(packageDirectory, "dist", "maplibre-gl-worker.mjs");
const targetDirectory = path.join(process.cwd(), "public", "vendor");
const target = path.join(targetDirectory, "maplibre-gl-worker.mjs");

await mkdir(targetDirectory, { recursive: true });
await copyFile(source, target);

console.log("Prepared the MapLibre worker for same-origin delivery.");
