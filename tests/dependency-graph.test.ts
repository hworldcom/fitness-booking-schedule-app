import assert from "node:assert/strict";
import test from "node:test";
import { createDependencyGraph } from "./helpers/dependency-graph";
import {
  dependencyViolations,
  importSpecifiers,
} from "./helpers/dependency-policy";
import type { DependencyException } from "./helpers/dependency-exceptions";

const check = (
  sources: Record<string, string>,
  exceptions: readonly DependencyException[] = [],
) => dependencyViolations(createDependencyGraph(sources), exceptions);
const exception = (
  kind: "runtime" | "type" = "runtime",
): DependencyException => ({
  source: "src/server/read.ts",
  target: "src/features/events/contract.ts",
  kind,
  owner: "MOV-70",
  issue: "https://linear.app/movx/issue/MOV-70",
  reason: "Shared Events result still belongs to the frontend model.",
});

test("syntax reader separates type-only edges from every runtime module-load form", () => {
  const source = `
    // import { fake } from "not-a-module";
    const text = 'require("also-not-a-module")';
    import type { A } from "./a";
    import { type B } from "./b";
    import Value, { type C } from "./c";
    import {} from "./empty";
    import "./effect";
    export type * from "./type-barrel";
    export { type D } from "./d";
    export { type E, value } from "./e";
    export * from "./barrel";
    type Result = typeof import("./result");
    import legacy = require("./legacy");
    import type LegacyType = require("./legacy-type");
    const lazy = import(\`./lazy\`);
    const required = require("./required");
  `;
  const edges = createDependencyGraph({ "src/example.ts": source }).get(
    "src/example.ts",
  )!.imports;
  assert.deepEqual(
    edges.map((edge) => [edge.specifier, edge.kind]),
    [
      ["./a", "type"],
      ["./b", "type"],
      ["./c", "runtime"],
      ["./empty", "runtime"],
      ["./effect", "runtime"],
      ["./type-barrel", "type"],
      ["./d", "type"],
      ["./e", "runtime"],
      ["./barrel", "runtime"],
      ["./result", "type"],
      ["./legacy", "runtime"],
      ["./legacy-type", "type"],
      ["./lazy", "runtime"],
      ["./required", "runtime"],
    ],
  );
  assert.equal(importSpecifiers(edges).length, 14);
});

test("alias, relative, index and JS extension imports resolve to the same real source", () => {
  const graph = createDependencyGraph({
    "src/reader.ts": `import "@/shared"; import "./shared/index.js"; import "./shared/index.ts";`,
    "src/shared/index.ts": `export type X = string;`,
  });
  assert.deepEqual(
    graph.get("src/reader.ts")!.imports.map((edge) => edge.target),
    Array(3).fill("src/shared/index.ts"),
  );
  assert.deepEqual(dependencyViolations(graph), []);
});

test("server-to-feature imports fail for aliases, relatives, barrels and literal loaders", () => {
  for (const source of [
    `import { value } from "@/features/events/contract";`,
    `export { value } from "../features/events/contract.js";`,
    `export * from "@/features/events";`,
    `const load = () => import("@/features/events/contract");`,
    `const value = require("../features/events/contract");`,
    `import value = require("../features/events/contract");`,
    `import type { Value } from "@/features/events/contract";`,
    `type Value = import("@/features/events/contract").Value;`,
  ]) {
    const errors = check({
      "src/server/read.ts": source,
      "src/features/events/index.ts": `export * from "./contract";`,
      "src/features/events/contract.ts": `export const value = 1; export type Value = string;`,
    });
    assert.ok(
      errors.some((error) => error.startsWith("[reverse]")),
      source,
    );
  }
});

test("exact exceptions permit only the owned edge and fail when stale or type-kind changes", () => {
  const sources = {
    "src/server/read.ts": `import type { Value } from "@/features/events/contract";`,
    "src/features/events/contract.ts": `export type Value = string;`,
  };
  assert.deepEqual(check(sources, [exception("type")]), []);
  const changed = check(
    {
      ...sources,
      "src/server/read.ts": `import "@/features/events/contract";`,
    },
    [exception("type")],
  );
  assert.ok(changed.some((error) => error.startsWith("[reverse]")));
  assert.ok(changed.some((error) => error.includes("Stale exception")));
  assert.ok(
    check({ ...sources, "src/server/read.ts": "export {};" }, [
      exception("type"),
    ]).some((error) => error.includes("Stale exception")),
  );
  assert.ok(
    check(
      { ...sources, "src/server/other.ts": sources["src/server/read.ts"] },
      [exception("type")],
    ).some((error) => error.includes("src/server/other.ts")),
  );
});

test("exceptions require exact edges, unique entries, owner links and rationale", () => {
  const sources = {
    "src/server/read.ts": `import "@/features/events/contract";`,
    "src/features/events/contract.ts": "export {};",
  };
  assert.deepEqual(check(sources, [exception()]), []);
  assert.ok(
    check(sources, [exception(), exception()]).some((error) =>
      error.includes("Duplicate exception"),
    ),
  );
  for (const change of [
    { source: "src/server/*" },
    { reason: "" },
    { owner: "P-MOV-12" },
    { issue: "https://linear.app/another/issue/MOV-70" },
    { source: "src/domain/rule.ts" },
  ])
    assert.ok(
      check(sources, [{ ...exception(), ...change }]).some((error) =>
        error.includes("Invalid exact edge"),
      ),
    );
});

test("domain and neutral capabilities reject framework, feature, server and other neutral imports", () => {
  for (const root of [
    "src/domain",
    "src/availability",
    "src/calendar",
    "src/events",
    "src/coaches",
  ]) {
    for (const statement of [
      `import type { ReactNode } from "react";`,
      `export * from "next/headers";`,
      `const api = require("@/server/api");`,
      `import "@/features/screen";`,
      `import type { Account } from "@/account/contracts";`,
      `import "./style.css";`,
    ]) {
      const errors = check({
        [`${root}/contract.ts`]: statement,
        "src/server/api.ts": "export {};",
        "src/features/screen.ts": "export {};",
        "src/account/contracts.ts": "export type Account = string;",
      });
      assert.ok(
        errors.some((error) =>
          error.startsWith(root === "src/domain" ? "[domain]" : "[neutral]"),
        ),
        `${root}: ${statement}`,
      );
    }
  }
  assert.ok(
    check({
      "src/events/contract.ts": `import type { T } from "@/calendar/contract";`,
      "src/calendar/contract.ts": "export type T = string;",
    }).some((error) => error.startsWith("[neutral]")),
  );
});

test("pure domain/neutral dependencies and standard language APIs remain permitted", () => {
  assert.deepEqual(
    check({
      "src/domain/time.ts": `export const time = new Intl.DateTimeFormat('en-GB');`,
      "src/domain/rule.ts": `import {time} from './time'; export const text = time.format(new Date());`,
      "src/events/contract.ts": `import {text} from '@/domain/rule'; export {text};`,
      "src/events/query.ts": `import {text} from './contract'; export const query = new URLSearchParams({text});`,
    }),
    [],
  );
  assert.deepEqual(
    check({
      "src/domain/rule.ts": `import type { Value } from './types'; import './time.v1';`,
      "src/domain/types.d.ts": "export type Value = string;",
      "src/domain/time.v1.ts": "export {};",
    }),
    [],
  );
});

test("database package subpaths and shared-component feature coupling stay forbidden", () => {
  assert.ok(
    check({
      "src/server/read.ts": `const sql = require("drizzle-orm/pg-core");`,
    }).some((error) => error.startsWith("[database]")),
  );
  assert.deepEqual(
    check({ "src/server/db/read.ts": `import { sql } from "drizzle-orm";` }),
    [],
  );
  assert.ok(
    check({
      "src/components/button.ts": `export * from '@/features/screen';`,
      "src/features/screen.ts": "export {};",
    }).some((error) => error.startsWith("[component]")),
  );
});

test("client runtime checks follow indirect barrels and server-only helpers, including cycles", () => {
  const sources = {
    "src/features/screen.ts": `/* comment */ 'use client'; import '@/shared';`,
    "src/shared/index.ts": `export * from './cycle';`,
    "src/shared/cycle.ts": `import './index'; export * from '../server/read';`,
    "src/server/read.ts": "export const secret = 1;",
  };
  const errors = check(sources);
  assert.ok(
    errors.some(
      (error) =>
        error.includes("[client-path]") &&
        error.includes(
          "src/shared/index.ts -> src/shared/cycle.ts -> src/server/read.ts",
        ),
    ),
  );
  assert.ok(
    check({
      "src/features/screen.ts": `'use client'; import '@/shared/secret';`,
      "src/shared/secret.ts": `import 'server-only'; export const secret = 1;`,
    }).some((error) => error.startsWith("[client-path]")),
  );
});

test("type-only edges are checked for ownership but are not walked as client runtime code", () => {
  assert.deepEqual(
    check({
      "src/features/screen.ts": `'use client'; import type { View } from '@/shared/view';`,
      "src/shared/view.ts": `import '@/server/read'; export type View = string;`,
      "src/server/read.ts": "export {};",
    }),
    [],
  );
  assert.ok(
    check({
      "src/features/screen.ts": `'use client'; import type { View } from '@/server/read';`,
      "src/server/read.ts": "export type View = string;",
    }).some((error) => error.startsWith("[server]")),
  );
});

test("declared Server Actions stop the client walk without exempting their own dependencies", () => {
  const sources = {
    "src/features/screen.ts": `'use client'; import {save} from '@/app/actions';`,
    "src/app/actions.ts": `'use server'; import '@/server/write'; export async function save() {}`,
    "src/server/write.ts": `import 'server-only';`,
  };
  assert.deepEqual(check(sources), []);
  assert.deepEqual(
    check({
      "src/features/screen.ts": `'use client'; import '@/server/actions';`,
      "src/server/actions.ts": `'use server'; import '@/server/write'; export async function save() {}`,
      "src/server/write.ts": `import 'server-only';`,
    }),
    [],
  );
  assert.ok(
    check({
      ...sources,
      "src/app/actions.ts": `function local() {'use server';} import '@/server/write';`,
    }).some((error) => error.startsWith("[client-path]")),
  );
  assert.ok(
    check({
      "src/features/screen.ts": `'use client'; import '@/server/actions';`,
      "src/server/actions.ts": `'use server'; import '@/features/other';`,
      "src/features/other.ts": "export {};",
    }).some((error) => error.startsWith("[reverse]")),
  );
});

test("availability action parser dependency is scoped; page-to-UI composition remains valid", () => {
  const source = `import '@/features/coaches/model';`;
  assert.ok(
    check({
      "src/app/coach/availability-actions.ts": source,
      "src/features/coaches/model.ts": "export {};",
    }).some((error) => error.startsWith("[reverse]")),
  );
  assert.deepEqual(
    check({
      "src/app/page.tsx": source,
      "src/features/coaches/model.ts": "export {};",
    }),
    [],
  );
});

test("unresolved code and nonliteral loads are visible, while frontend assets are not code edges", () => {
  const errors = check({
    "src/shared/load.ts": `import './missing'; import(name); require(name);`,
  });
  assert.equal(
    errors.filter((error) => error.startsWith("[unresolved]")).length,
    3,
  );
  assert.deepEqual(
    check({
      "src/features/screen.ts": `'use client'; import './screen.css'; import icon from './icon.svg';`,
    }),
    [],
  );
});
