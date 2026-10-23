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
    source: "src/app/coach/availability-actions.ts",
    target: "src/features/coaches/availability-editor-model.ts",
    kind: "runtime",
    owner: "MOV-73",
    issue: "https://linear.app/movx/issue/MOV-73",
    reason:
      "Untrusted action-command parsing still belongs to the frontend draft model.",
  },
];
