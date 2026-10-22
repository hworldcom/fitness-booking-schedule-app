import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  createDependencyGraph,
  resolveSourceImport,
  sourcePath,
} from "./helpers/dependency-graph";
import { dependencyExceptions } from "./helpers/dependency-exceptions";
import {
  dependencyViolations,
  importSpecifiers,
} from "./helpers/dependency-policy";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [target] : [];
  });
}

const graph = createDependencyGraph(
  Object.fromEntries(
    sourceFiles(src).map((file) => [
      sourcePath(path.relative(root, file)),
      readFileSync(file, "utf8"),
    ]),
  ),
);
const graphFiles = new Set(graph.keys());

function imports(file: string): string[] {
  return importSpecifiers(
    graph.get(sourcePath(path.relative(root, file)))!.imports,
  );
}

function resolveImport(file: string, specifier: string): string | undefined {
  const target = resolveSourceImport(
    sourcePath(path.relative(root, file)),
    specifier,
    graphFiles,
  );
  return target ? path.join(root, target) : undefined;
}

function within(target: string, directory: string) {
  return target === directory || target.startsWith(`${directory}${path.sep}`);
}

test("Auth SDK imports and calls stay inside documented Auth adapters", () => {
  const adapters = new Set([
    "src/auth/client/supabase-auth-adapter.ts",
    "src/server/auth/client.ts",
    "src/server/auth/proxy.ts",
    "src/server/auth/session.ts",
    "src/server/auth/supabase-operations.ts",
  ]);
  for (const file of sourceFiles(src)) {
    const relative = path.relative(root, file);
    if (adapters.has(relative)) continue;
    for (const specifier of imports(file)) {
      assert.doesNotMatch(specifier, /^@supabase\//, relative);
      if (
        relative.startsWith("src/features/") ||
        relative.startsWith("src/components/")
      ) {
        assert.doesNotMatch(
          specifier,
          /supabase-auth-adapter|browser-client/,
          relative,
        );
      }
    }
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /\.auth\.(?:signIn|signUp|signOut|verifyOtp|onAuthStateChange|resetPassword|updateUser)/,
      relative,
    );
  }
});

test("Storage I/O, request client and provider URLs stay behind the image adapter", () => {
  const adapter = "src/server/storage/supabase-profile-images.ts";
  for (const file of sourceFiles(src)) {
    const relative = path.relative(root, file);
    if (relative === adapter) continue;
    const contents = readFileSync(file, "utf8");
    assert.doesNotMatch(
      contents,
      /\.storage\s*(?:\.|\[)|\[\s*["']storage["']\s*\]/,
      relative,
    );
    for (const specifier of imports(file)) {
      assert.doesNotMatch(specifier, /^@supabase\/storage-js/, relative);
      if (!relative.startsWith("src/server/auth/")) {
        const target = resolveImport(file, specifier);
        assert.notEqual(
          target,
          path.join(src, "server/auth/client.ts"),
          relative,
        );
        if (
          relative.startsWith("src/server/") &&
          relative !== "src/server/authorization/config.ts"
        )
          assert.notEqual(target, path.join(src, "auth/config.ts"), relative);
        if (relative !== "src/server/storage/profile-images.ts")
          assert.notEqual(
            target,
            path.join(src, "server/storage/supabase-profile-images.ts"),
            relative,
          );
      }
    }
    // The domain retains its explicit existing-URL compatibility allowlist.
    if (relative !== "src/domain/profile-images.ts")
      assert.doesNotMatch(
        contents,
        /\/storage\/v1\/object\/public\//,
        relative,
      );
  }
  for (const relative of [
    adapter,
    "src/server/storage/contracts.ts",
    "src/server/storage/profile-images.ts",
    "src/server/profile-images/store-and-attach.ts",
  ])
    assert.match(
      readFileSync(path.join(root, relative), "utf8"),
      /^import "server-only";/,
    );
});

test("source imports respect domain, client, server and feature boundaries", () => {
  const config = ts.readConfigFile(
    path.join(root, "tsconfig.json"),
    ts.sys.readFile,
  );
  assert.equal(config.error, undefined);
  assert.equal(
    config.config.extends,
    undefined,
    "Resolve inherited aliases before extending tsconfig",
  );
  assert.deepEqual(
    config.config.compilerOptions.paths,
    { "@/*": ["./src/*"] },
    "Update the dependency resolver when the repository's source aliases change",
  );
  assert.deepEqual(dependencyViolations(graph, dependencyExceptions), []);
});

test("availability service and shared contracts preserve their dependency boundaries", () => {
  const service = path.join(
    src,
    "server/coaches/availability-editor-service.ts",
  );
  for (const specifier of imports(service)) {
    const target = resolveImport(service, specifier);
    assert.ok(
      !target || !within(target, path.join(src, "features")),
      `availability service imports ${specifier} from src/features`,
    );
  }

  const contracts = path.join(src, "availability/contracts.ts");
  for (const specifier of imports(contracts)) {
    const target = resolveImport(contracts, specifier);
    assert.ok(
      target && within(target, path.join(src, "domain")),
      `availability contracts import ${specifier} outside src/domain`,
    );
  }
});

test("Events services cannot restore any of their former frontend dependencies", () => {
  for (const entry of dependencyExceptions) {
    assert.ok(
      !entry.source.startsWith("src/server/group-sessions/"),
      `Events services must not regain a feature exception: ${entry.source}`,
    );
  }
  for (const [file, source] of graph) {
    if (!file.startsWith("src/server/group-sessions/")) continue;
    for (const edge of source.imports)
      assert.ok(!edge.target?.startsWith("src/features/"), file);
  }

  // Mutate only the in-memory graph. Each former edge must independently fail
  // against the actual source and remaining non-Events exceptions.
  const formerEdges = [
    ["directory-service", "events/event-contract", "runtime"],
    ["directory-service", "events/directory-contract", "runtime"],
    ["banner-service", "events/event-contract", "runtime"],
    ["participation-action", "events/event-contract", "runtime"],
    ["owner-service", "coach-events/contract", "type"],
  ] as const;
  for (const [service, feature, kind] of formerEdges) {
    const file = `src/server/group-sessions/${service}.ts`;
    const target = `src/features/${feature}.ts`;
    const changed = new Map(graph);
    const source = graph.get(file)!;
    changed.set(file, {
      ...source,
      imports: [
        ...source.imports,
        {
          specifier: `@/features/${feature}`,
          target,
          kind,
          syntax: "import",
          line: 1,
          external: false,
          asset: false,
        },
      ],
    });
    assert.deepEqual(dependencyViolations(changed, dependencyExceptions), [
      `[reverse] ${file}:1 imports unapproved ${file} -> ${target} (${kind})`,
    ]);
  }
});

test("Calendar contracts stay type-only and its service cannot regain feature dependencies", () => {
  const file = "src/server/coaches/calendar-service.ts";
  const target = "src/features/coaches/coach-calendar-model.ts";
  const service = graph.get(file)!;
  assert.ok(service);
  assert.ok(!dependencyExceptions.some((entry) => entry.source === file));
  assert.ok(
    service.imports.every((edge) => !edge.target?.startsWith("src/features/")),
  );

  const contracts = "src/calendar/contracts.ts";
  const source = ts.createSourceFile(
    contracts,
    readFileSync(path.join(root, contracts), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const statement of source.statements) {
    assert.ok(
      ts.isTypeAliasDeclaration(statement) ||
        (ts.isImportDeclaration(statement) &&
          statement.importClause?.isTypeOnly),
      "Calendar contracts may only contain type declarations and type imports",
    );
  }
  for (const edge of graph.get(contracts)!.imports) {
    assert.equal(edge.kind, "type");
    assert.ok(edge.target?.startsWith("src/domain/"));
  }

  const changed = new Map(graph);
  changed.set(file, {
    ...service,
    imports: [
      ...service.imports,
      {
        specifier: "@/features/coaches/coach-calendar-model",
        target,
        kind: "type",
        syntax: "import",
        line: 1,
        external: false,
        asset: false,
      },
    ],
  });
  assert.deepEqual(dependencyViolations(changed, dependencyExceptions), [
    `[reverse] ${file}:1 imports unapproved ${file} -> ${target} (type)`,
  ]);
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

test("blockchain, wallet, legacy funding and social runtime surfaces are absent", () => {
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
    // DEV0240's nonfinancial M7 Events routes use the scheduling backend;
    // the retired group-events funding module remains forbidden below.
    "src/app/following",
    // DEV0239 owns the adopted nonfinancial coach Events interface.
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
