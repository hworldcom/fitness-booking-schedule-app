import {
  within,
  type DependencyGraph,
  type SourceImport,
} from "./dependency-graph";
import type { DependencyException } from "./dependency-exceptions";

// These capability roots contain shared code, not their browser/server adapters.
const neutralRoots = [
  "src/availability",
  "src/calendar",
  "src/events",
  "src/coaches",
];
const availabilityAction = "src/app/coach/availability-actions.ts";
const key = (source: string, target: string, kind: string) =>
  `${source} -> ${target} (${kind})`;
const reverseFeatureEdge = (source: string, target: string) =>
  (within(source, "src/server") || source === availabilityAction) &&
  within(target, "src/features");
const databasePackage = (name: string) =>
  name === "postgres" ||
  name.startsWith("postgres/") ||
  name === "drizzle-orm" ||
  name.startsWith("drizzle-orm/");

/** Static source policy; it does not execute modules or traverse third-party package internals. */
export function dependencyViolations(
  graph: DependencyGraph,
  exceptions: readonly DependencyException[] = [],
): string[] {
  const violations: string[] = [];
  const allowed = new Set<string>();
  const used = new Set<string>();
  for (const entry of exceptions) {
    const id = key(entry.source, entry.target, entry.kind);
    if (allowed.has(id))
      violations.push(`[exception] Duplicate exception: ${id}`);
    allowed.add(id);
    const issue = `https://linear.app/movx/issue/${entry.owner}`;
    if (
      !/^MOV-[1-9]\d*$/.test(entry.owner) ||
      !(entry.issue === issue || entry.issue.startsWith(`${issue}/`)) ||
      !entry.reason.trim() ||
      !["runtime", "type"].includes(entry.kind) ||
      /[*?]/.test(entry.source + entry.target) ||
      !reverseFeatureEdge(entry.source, entry.target)
    ) {
      violations.push(`[exception] Invalid exact edge/owner/rationale: ${id}`);
    }
  }

  for (const [file, module] of graph) {
    if (module.client && module.serverAction)
      violations.push(
        `[directive] ${file} cannot be both use client and use server`,
      );
    for (const edge of module.imports) {
      const location = `${file}:${edge.line}`;
      if (edge.specifier === null) {
        violations.push(
          `[unresolved] ${location} has a nonliteral ${edge.syntax} module load`,
        );
        continue;
      }
      if (!edge.external && !edge.target) {
        violations.push(
          `[unresolved] ${location} cannot resolve ${edge.specifier}`,
        );
        continue;
      }
      if (!within(file, "src/server/db") && databasePackage(edge.specifier))
        violations.push(
          `[database] ${location} imports ${edge.specifier} outside src/server/db`,
        );

      const neutralRoot = neutralRoots.find((root) => within(file, root));
      if (
        within(file, "src/domain") &&
        (!edge.target || edge.asset || !within(edge.target, "src/domain"))
      ) {
        violations.push(
          `[domain] ${location} imports ${edge.specifier} outside domain source`,
        );
      }
      if (
        neutralRoot &&
        (!edge.target ||
          edge.asset ||
          !(
            within(edge.target, "src/domain") ||
            within(edge.target, neutralRoot)
          ))
      ) {
        violations.push(
          `[neutral] ${location} imports ${edge.specifier} outside domain/${neutralRoot}`,
        );
      }
      if (!edge.target) continue;
      if (reverseFeatureEdge(file, edge.target)) {
        const id = key(file, edge.target, edge.kind);
        if (allowed.has(id)) used.add(id);
        else violations.push(`[reverse] ${location} imports unapproved ${id}`);
      }
      const actionReference =
        edge.kind === "runtime" && graph.get(edge.target)?.serverAction;
      if (
        (within(file, "src/features") || module.client) &&
        within(edge.target, "src/server") &&
        !actionReference
      ) {
        violations.push(
          `[server] ${location} imports ${edge.target} from frontend/client code`,
        );
      }
      if (
        within(file, "src/components") &&
        (within(edge.target, "src/features") ||
          (within(edge.target, "src/server") && !actionReference))
      ) {
        violations.push(
          `[component] ${location} imports feature/server module ${edge.target}`,
        );
      }
    }
  }
  for (const id of allowed)
    if (!used.has(id)) violations.push(`[exception] Stale exception: ${id}`);

  // A top-level use-server module is an RPC boundary, not code shipped to the browser.
  // Its imports were still checked above; Next.js validates its exported functions.
  for (const [root, entry] of graph) {
    if (!entry.client) continue;
    const queue: string[][] = [[root]];
    const seen = new Set<string>([root]);
    for (let index = 0; index < queue.length; index++) {
      const route = queue[index];
      const file = route.at(-1)!;
      const source = graph.get(file);
      if (!source) continue; // CSS/other assets do not have a source import graph.
      if (source.serverAction && file !== root) continue;
      if (within(file, "src/server") || source.serverOnly) {
        violations.push(
          `[client-path] ${root} reaches server code: ${route.join(" -> ")}`,
        );
        continue;
      }
      for (const edge of source.imports) {
        if (edge.kind === "runtime" && edge.target && !seen.has(edge.target)) {
          seen.add(edge.target);
          queue.push([...route, edge.target]);
        }
      }
    }
  }
  return violations.sort();
}

/** Shared with the retained Auth/Storage checks, including type-only/package imports. */
export function importSpecifiers(imports: readonly SourceImport[]) {
  return imports.flatMap((edge) =>
    edge.specifier === null ? [] : [edge.specifier],
  );
}
