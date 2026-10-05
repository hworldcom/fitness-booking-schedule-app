import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function cssRule(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return source.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "u"),
  )?.[1];
}

test("secondary buttons own a readable foreground on their white surface", () => {
  const globals = readFileSync(resolve("src/app/globals.css"), "utf8");
  const secondary = cssRule(globals, ".button.secondary");

  assert.ok(secondary, "Expected the shared secondary-button rule.");
  assert.match(secondary, /background:\s*white;/u);
  assert.match(secondary, /color:\s*var\(--ink\);/u);
  assert.match(secondary, /border:\s*1px solid #dfe3d6;/u);

  const workspace = readFileSync(
    resolve("src/app/coach-workspace.css"),
    "utf8",
  );
  assert.match(
    workspace,
    /\.coach-workspace-header \.button\.secondary\s*\{[^}]*color:\s*#304629;/u,
  );
});
