import type { ImportKind } from "./dependency-graph";

export type DependencyException = Readonly<{
  source: string;
  target: string;
  kind: ImportKind;
  owner: string;
  issue: string;
  reason: string;
}>;

/** Exact temporary edges. Extraction owners delete their entries; unused entries fail. */
export const dependencyExceptions: readonly DependencyException[] = [
  {
    source: "src/server/coaches/public-website-page.ts",
    target: "src/features/coaches/website/public-website-model.ts",
    kind: "runtime",
    owner: "MOV-72",
    issue: "https://linear.app/movx/issue/MOV-72",
    reason:
      "Shared identity and server group orchestration remain in the mixed website model.",
  },
  {
    source: "src/app/coach/availability-actions.ts",
    target: "src/features/coaches/availability-editor-model.ts",
    kind: "runtime",
    owner: "MOV-73",
    issue: "https://linear.app/movx/issue/MOV-73",
    reason:
      "Untrusted action-command parsing still belongs to the frontend draft model.",
  },
];
