import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectProject } from "../scripts/check-boundaries.mjs";

function fixture(t, files, dependencies = { react: "19.2.3" }) {
  const parent = mkdtempSync(path.join(tmpdir(), "movx-mobile-boundaries-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const mobile = path.join(parent, "mobile");
  mkdirSync(path.join(mobile, "src"), { recursive: true });
  writeFileSync(
    path.join(mobile, "package.json"),
    JSON.stringify({ dependencies }),
  );
  writeFileSync(
    path.join(mobile, "tsconfig.json"),
    JSON.stringify({
      extends: "expo/tsconfig.base",
      compilerOptions: { paths: { "@/*": ["./src/*"] } },
    }),
  );
  for (const [file, content] of Object.entries(files)) {
    const target = path.resolve(mobile, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return mobile;
}

test("local aliases, declared native dependencies, assets and type-only local imports pass", (t) => {
  const mobile = fixture(t, {
    "src/app.tsx":
      'import React from "react"; import type { Data } from "@/data"; import image from "../assets/sample.json"; export { value } from "./data";',
    "src/data.ts": "export type Data = string; export const value = 1;",
    "assets/sample.json": "{}",
  });
  assert.deepEqual(inspectProject(mobile).errors, []);
});

for (const statement of [
  'import value from "../../src/server/service";',
  'import type { Data } from "../../src/server/service";',
  'export type { Data } from "../../src/server/service";',
  'type Data = import("../../src/server/service").Data;',
  'const value = require("../../src/server/service");',
  'const value = import("../../src/server/service");',
])
  test("web source cannot be imported: " + statement, (t) => {
    const mobile = fixture(t, {
      "src/app.ts": statement,
      "../src/server/service.ts":
        "export type Data = string; export default 1;",
    });
    assert.match(inspectProject(mobile).errors.join("\n"), /escapes mobile/);
  });

test("a transitive local barrel cannot hide a forbidden type-only import", (t) => {
  const mobile = fixture(t, {
    "src/app.ts": 'export * from "./bridge";',
    "src/bridge.ts": 'export type { Data } from "../../src/server/service";',
    "../src/server/service.ts": "export type Data = string;",
  });
  assert.match(
    inspectProject(mobile).errors.join("\n"),
    /src.bridge.ts.*escapes mobile/,
  );
});

test("a source symlink cannot escape to the website", (t) => {
  const mobile = fixture(t, { "../src/server.ts": "export const secret = 1;" });
  symlinkSync(
    path.resolve(mobile, "../src/server.ts"),
    path.join(mobile, "src/bridge.ts"),
  );
  assert.match(inspectProject(mobile).errors.join("\n"), /symlink escapes/);
});

test("undeclared parent dependencies and declared forbidden native packages fail", (t) => {
  const mobile = fixture(
    t,
    { "src/app.ts": 'import x from "postgres"; import y from "undeclared";' },
    { postgres: "3.4.9" },
  );
  const result = inspectProject(mobile).errors.join("\n");
  assert.match(result, /Forbidden native dependency: postgres/);
  assert.match(result, /undeclared native dependency: undeclared/);
});

test("non-literal module loads and inherited web aliases fail", (t) => {
  const mobile = fixture(t, {
    "src/app.ts": "const target = './bridge'; import(target);",
  });
  writeFileSync(
    path.join(mobile, "tsconfig.json"),
    JSON.stringify({
      extends: "../tsconfig.json",
      compilerOptions: { paths: { "@/*": ["../src/*"] } },
    }),
  );
  const result = inspectProject(mobile).errors.join("\n");
  assert.match(result, /non-literal module load/);
  assert.match(result, /only its own Expo base/);
  assert.match(result, /aliases must resolve only/);
});

test("the real mobile project respects the boundary", () => {
  const mobile = path.resolve(import.meta.dirname, "..");
  const result = inspectProject(mobile);
  assert.ok(result.files >= 10);
  assert.deepEqual(result.errors, []);
});
