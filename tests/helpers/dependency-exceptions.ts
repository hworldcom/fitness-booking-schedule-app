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
    source: "src/server/group-sessions/directory-service.ts",
    target: "src/features/events/event-contract.ts",
    kind: "runtime",
    owner: "MOV-70",
    issue: "https://linear.app/movx/issue/MOV-70",
    reason:
      "Directory filter/query contract still belongs to the Events feature model.",
  },
  {
    source: "src/server/group-sessions/directory-service.ts",
    target: "src/features/events/directory-contract.ts",
    kind: "runtime",
    owner: "MOV-70",
    issue: "https://linear.app/movx/issue/MOV-70",
    reason:
      "Directory page/query identity still shares a frontend transport/presentation module.",
  },
  {
    source: "src/server/group-sessions/banner-service.ts",
    target: "src/features/events/event-contract.ts",
    kind: "runtime",
    owner: "MOV-70",
    issue: "https://linear.app/movx/issue/MOV-70",
    reason:
      "The shared event slug parser still belongs to the Events feature model.",
  },
  {
    source: "src/server/group-sessions/participation-action.ts",
    target: "src/features/events/event-contract.ts",
    kind: "runtime",
    owner: "MOV-70",
    issue: "https://linear.app/movx/issue/MOV-70",
    reason:
      "The participation input parser still belongs to the Events feature model.",
  },
  {
    source: "src/server/group-sessions/owner-service.ts",
    target: "src/features/coach-events/contract.ts",
    kind: "type",
    owner: "MOV-70",
    issue: "https://linear.app/movx/issue/MOV-70",
    reason:
      "Owner context and command types still belong to the coach Events feature contract.",
  },
  {
    source: "src/server/coaches/calendar-service.ts",
    target: "src/features/coaches/coach-calendar-model.ts",
    kind: "type",
    owner: "MOV-71",
    issue: "https://linear.app/movx/issue/MOV-71",
    reason:
      "Calendar service results still belong to the frontend layout/access model.",
  },
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
