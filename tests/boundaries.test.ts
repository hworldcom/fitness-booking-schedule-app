import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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
  const preview = path.join(features, "preview");
  const server = path.join(src, "server");
  const database = path.join(server, "db");
  const solanaClient = path.join(src, "solana", "client");
  const violations: string[] = [];

  for (const file of sourceFiles(src)) {
    const contents = readFileSync(file, "utf8");
    const isClientModule = /^\s*["']use client["'];/m.test(contents);

    for (const specifier of imports(file)) {
      const target = resolveImport(file, specifier);
      const relativeFile = path.relative(root, file);

      if (
        within(file, src) &&
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

      if (within(file, features)) {
        if (within(target, server)) {
          violations.push(
            `${relativeFile} imports ${specifier} from src/server`,
          );
          continue;
        }
        if (within(target, features)) {
          const sourceFeature = path
            .relative(features, file)
            .split(path.sep)[0];
          const targetFeature = path
            .relative(features, target)
            .split(path.sep)[0];
          if (sourceFeature !== targetFeature && targetFeature !== "preview") {
            violations.push(
              `${relativeFile} imports sibling feature ${targetFeature} via ${specifier}`,
            );
          }
        }
      }

      if (within(file, server) && within(target, preview)) {
        violations.push(
          `${relativeFile} imports preview-only data via ${specifier}`,
        );
      }

      if (within(file, solanaClient) && within(target, server)) {
        violations.push(
          `${relativeFile} imports trusted server code via ${specifier}`,
        );
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("privileged database entry points carry the Next.js server-only marker", () => {
  for (const relative of [
    "src/server/db/client.ts",
    "src/server/db/env.ts",
    "src/server/db/catalogue/repository.ts",
    "src/server/db/membership/repository.ts",
    "src/server/db/reservations/repository.ts",
    "src/server/db/schema/index.ts",
    "src/server/db/identity/repository.ts",
    "src/server/db/wallet/club-repository.ts",
    "src/server/db/wallet/repository.ts",
    "src/server/db/authorization/repository.ts",
    "src/server/auth/client.ts",
    "src/server/auth/session.ts",
    "src/server/authorization/contracts.ts",
    "src/server/authorization/env.ts",
    "src/server/authorization/page-access.ts",
    "src/server/authorization/service.ts",
    "src/server/identity/service.ts",
    "src/server/catalogue/service.ts",
    "src/server/membership/service.ts",
    "src/server/reservations/service.ts",
    "src/server/solana/membership-payment-config.ts",
    "src/server/solana/membership-fee-sponsor-config.ts",
    "src/server/solana/membership-payment-sponsorship.ts",
    "src/server/solana/membership-payment-reconciliation.ts",
    "src/server/wallet/signature.ts",
    "src/server/wallet/club-service.ts",
    "src/server/wallet/service.ts",
  ]) {
    const contents = readFileSync(path.join(root, relative), "utf8");
    assert.match(contents, /^import ["']server-only["'];/);
  }
});

test("application repositories own database connections per request", () => {
  const client = readFileSync(
    path.join(root, "src/server/db/client.ts"),
    "utf8",
  );
  assert.doesNotMatch(client, /let connection\s*:/);
  assert.match(client, /fetch_types:\s*false/);
  assert.match(
    client,
    /finally\s*{[\s\S]*queryClient\.end\(\{ timeout: 1 \}\)/,
  );

  for (const relative of [
    "src/server/db/catalogue/repository.ts",
    "src/server/db/identity/repository.ts",
    "src/server/db/authorization/repository.ts",
  ]) {
    const contents = readFileSync(path.join(root, relative), "utf8");
    assert.match(contents, /withDatabaseConnection/);
    assert.doesNotMatch(contents, /\bdatabaseConnection\s*\(/);
  }
});

test("verified membership completion is not exposed through an application route", () => {
  const app = path.join(src, "app");
  const violations = sourceFiles(app).filter((file) =>
    readFileSync(file, "utf8").includes("completeVerifiedMembershipActivation"),
  );

  assert.deepEqual(violations, []);
});

test("membership fee-sponsor secret has one server-only source consumer", () => {
  const consumers = sourceFiles(src)
    .filter((file) =>
      readFileSync(file, "utf8").includes("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64"),
    )
    .map((file) => path.relative(root, file));

  assert.deepEqual(consumers, [
    "src/server/solana/membership-fee-sponsor-config.ts",
  ]);
});

test("membership sponsorship route accepts only an operation identifier", () => {
  const route = readFileSync(
    path.join(root, "src/app/api/membership/activation/sponsor/route.ts"),
    "utf8",
  );

  assert.match(route, /Object\.keys\(record\)\.length !== 1/);
  assert.match(route, /"operationId" in record/);
  assert.doesNotMatch(
    route,
    /record\.(?:wireTransaction|transaction|amount|mint|destination|wallet|blockhash)/,
  );
});
