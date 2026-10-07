import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [target] : [];
  });
}

function imports(file: string): string[] {
  const contents = readFileSync(file, "utf8");
  const pattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g;
  return Array.from(
    contents.matchAll(pattern),
    (match) => match[1] || match[2],
  );
}

function resolveImport(file: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) return path.resolve(src, specifier.slice(2));
  if (specifier.startsWith("."))
    return path.resolve(path.dirname(file), specifier);
  return undefined;
}

function within(target: string, directory: string) {
  return target === directory || target.startsWith(`${directory}${path.sep}`);
}

test("source imports respect domain, client, server and feature boundaries", () => {
  const domain = path.join(src, "domain");
  const components = path.join(src, "components");
  const features = path.join(src, "features");
  const server = path.join(src, "server");
  const database = path.join(server, "db");
  const violations: string[] = [];

  for (const file of sourceFiles(src)) {
    const contents = readFileSync(file, "utf8");
    const isClientModule = /^\s*["']use client["'];/m.test(contents);
    for (const specifier of imports(file)) {
      const target = resolveImport(file, specifier);
      const relativeFile = path.relative(root, file);
      if (
        !within(file, database) &&
        [
          "postgres",
          "drizzle-orm",
          "drizzle-orm/pg-core",
          "drizzle-orm/postgres-js",
        ].includes(specifier)
      ) {
        violations.push(
          `${relativeFile} imports database package ${specifier} outside src/server/db`,
        );
      }
      if (!target) continue;
      if (isClientModule && within(target, server)) {
        violations.push(
          `${relativeFile} is a client module importing ${specifier} from src/server`,
        );
      }
      if (within(file, domain) && !within(target, domain)) {
        violations.push(
          `${relativeFile} imports ${specifier} outside src/domain`,
        );
      }
      if (
        within(file, components) &&
        (within(target, features) || within(target, server))
      ) {
        violations.push(
          `${relativeFile} imports ${specifier} from a feature/server module`,
        );
      }
      if (within(file, features) && within(target, server)) {
        violations.push(`${relativeFile} imports ${specifier} from src/server`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("privileged scheduling entry points carry the server-only marker", () => {
  for (const relative of [
    "src/server/db/client.ts",
    "src/server/db/env.ts",
    "src/server/db/schema/index.ts",
    "src/server/db/identity/repository.ts",
    "src/server/db/authorization/repository.ts",
    "src/server/db/coaches/repository.ts",
    "src/server/db/coaches/availability-repository.ts",
    "src/server/db/coaches/booking-repository.ts",
    "src/server/auth/client.ts",
    "src/server/auth/session.ts",
    "src/server/authorization/service.ts",
    "src/server/identity/service.ts",
    "src/server/coaches/service.ts",
    "src/server/coaches/booking-service.ts",
  ]) {
    assert.match(
      readFileSync(path.join(root, relative), "utf8"),
      /^import ["']server-only["'];/,
    );
  }
});

test("application repositories own database connections per request", () => {
  const client = readFileSync(
    path.join(root, "src/server/db/client.ts"),
    "utf8",
  );
  assert.doesNotMatch(client, /let connection\s*:/);
  assert.match(client, /connection \?\? createDatabaseConnection\(\)/);
  assert.match(
    client,
    /finally\s*{[\s\S]*queryClient\.end\(\{ timeout: 1 \}\)/,
  );
  for (const relative of [
    "src/server/db/identity/repository.ts",
    "src/server/db/authorization/repository.ts",
    "src/server/db/coaches/repository.ts",
    "src/server/db/coaches/availability-repository.ts",
  ]) {
    assert.match(
      readFileSync(path.join(root, relative), "utf8"),
      /withDatabaseConnection/,
    );
  }
});

test("blockchain, wallet, group-event and social runtime surfaces are absent", () => {
  for (const relative of ["Anchor.toml", "Cargo.toml"]) {
    assert.equal(existsSync(path.join(root, relative)), false, relative);
  }
  for (const relative of [
    "programs",
    "clients",
    "idl",
    "src/solana",
    "src/server/solana",
    "src/server/wallet",
    "src/app/api/solana",
    "src/app/api/wallet",
    "src/app/events",
    "src/app/following",
    "src/app/coach/events",
    "src/app/coach/posts",
    "src/app/devnet-bootstrap",
  ]) {
    const directory = path.join(root, relative);
    assert.equal(
      existsSync(directory) && sourceFiles(directory).length > 0,
      false,
      relative,
    );
  }
  const packageJson = readFileSync(path.join(root, "package.json"), "utf8");
  assert.doesNotMatch(packageJson, /@solana|@codama|surfpool|anchor build/iu);
  for (const file of sourceFiles(src)) {
    for (const specifier of imports(file)) {
      assert.doesNotMatch(
        specifier,
        /solana|wallet|group-events|coach-social/iu,
        `${path.relative(root, file)} -> ${specifier}`,
      );
    }
  }
});
