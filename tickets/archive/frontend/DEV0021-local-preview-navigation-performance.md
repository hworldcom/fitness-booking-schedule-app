# Ticket DEV0021: Local preview navigation performance

- Status: Completed
- Created: 2026-09-20
- Last updated: 2026-09-20
- Milestone: M0 local frontend maintenance
- Coordination: None — independent development ticket
- Related tickets: DEV0020, DEV0008

## Objective and context

The user reports several-second navigation and a rendering indicator at localhost:3100. Investigate the actual running app, remove avoidable demo latency and document the appropriate local workflow. Product scope remains the [frontend preview](../../../docs/mvp-spec.md); this ticket changes local operation, not product behavior.

## Scope and non-goals

- In scope: development-server trace inspection, browser navigation measurements, an optimized build/preview on the existing port, and README guidance for preview versus editing.
- Out of scope: new application features, backend work, deployment, speculative caching or framework changes.

## Expected behavior and edge cases

The review/demo server serves the optimized build without compiling routes on demand. Existing localhost:3100 browser data remains intact. A browser refresh after switching replaces the old development client. Editing still uses `npm run dev`; the optimized preview requires rebuilding and restarting after source changes. Only one server can own port 3100.

## Assumptions, decisions, and dependencies

- Confirmed observation: Next.js 16.3.5 development trace includes an Explore request lasting 4,963 ms and route compilation lasting 4,844 ms. Other initial navigations include 3–4 second compilations. This strongly identifies compilation as the principal observed delay, not a measured database or wallet issue.
- Adopted engineering choice: use the existing `build` and `start` scripts for local review; preserve development mode for active editing. No new dependency is needed.
- Requires Node, installed Chrome for browser measurement, and local process/port access. Read the installed Next.js local-development and CLI documentation before changing the workflow.

## Implementation plan

1. Record representative development navigation timings and browser errors without altering the user's browser state.
2. Build the current app, then replace the verified project development server on port 3100 with the production preview.
3. Repeat desktop/mobile navigation and keyboard checks against the optimized server; check representative filter interactions and absence of development scripts.
4. Update README with the two workflows and record evidence here and in the ticket index.

## Acceptance criteria

- [x] AC1: The cause is supported by measured server/browser evidence, with cold compilation and warmed navigation distinguished.
- [x] AC2: localhost:3100 serves the optimized current build, with main routes and representative discovery interactions working at desktop/mobile widths and by keyboard.
- [x] AC3: README clearly explains preview versus editing, rebuild/restart requirements and the port conflict; browser storage and product behavior are unchanged.

## Validation plan

Capture browser timings in a separate fresh Playwright context before/after the server change. Confirm expected destination headings, successful responses, no browser errors, no development client in the optimized build, a keyboard navigation path, challenge filtering and mobile layout. Run a production build. Check documentation links and review the diff. No application source changes are planned, so new permanent logic tests and repeated domain/lint/type suites are unnecessary; the build includes type validation.

## Implementation record

### Changes and rationale

The running server on port 3100 was `next dev`, confirmed by the development scripts served to Chrome and the project's `.next/dev/trace`. That trace included Explore's 4,963 ms request/4,844 ms compilation, a 3,786 ms Challenges request/3,289 ms compilation, and a 1,575 ms guide request/1,374 ms compilation. These are observed historical requests, not a controlled fresh-start experiment. A later warmed development browser run completed navigation in 36–354 ms, supporting route compilation as the source of the intermittent multi-second delays.

Built the current source successfully, verified PID 90149 owned this project's port 3100, stopped that development process, and started the existing production command on the same port. Production browser checks found no development client. Twelve measured link navigations across desktop/mobile took 70–205 ms including Playwright click/visibility checks. No application code change was necessary. README now recommends the optimized preview for reviews/demos and explains when to use development mode.

### Affected files

| File or component               | Change and purpose                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [README](../../../README.md)    | Document build/start for review, dev for editing, rebuild/restart and refreshing when switching modes. |
| [Ticket index](../../README.md) | Track this investigation and its outcome.                                                              |
| Local server on port 3100       | Serve the freshly generated production build instead of compiling during navigation.                   |

### Decisions and deviations

No deviations. Do not add loading UI merely to conceal development compilation.

### Contracts, configuration, and operations

No product/data/API/schema/dependency/environment-variable changes. No migration. The origin and local-storage key remain unchanged. Return to live editing by stopping the preview and running `npm run dev`.

## Validation results

20 September 2026, local macOS, Next.js 16.3.5, installed Google Chrome, separate fresh Playwright contexts at desktop 1440×1040 and mobile 393×852. The user's in-app browser context was not modified or reset.

- `node /private/tmp/repx-0021-nav.cjs development` — passed before switching. This temporary diagnostic loads Challenges, clicks Explore → Profile → Feed → Challenges, filters Sponsored to one card, opens The show-up club, and opens How it works using keyboard Enter. It asserts URLs, destination headings, card count, no page errors/HTTP failures and no horizontal overflow at the final guide view. Timing is elapsed wall time from initiating the action until the destination assertion succeeds; it includes automation overhead and may include normal framework prefetching.
- `npm run build` — passed; compiled in 1,303 ms, TypeScript passed, all 11 static generation steps completed, expected dynamic routes included. No new source changes after the build.
- `lsof -nP -iTCP:3100 -sTCP:LISTEN` and `lsof -a -p 90149 -d cwd` — confirmed the targeted development server belonged to this repository immediately before replacement. `kill -TERM 90149` succeeded; `npm run start` reported ready in 149 ms at the same address.
- `node /private/tmp/repx-0021-nav.cjs production` — the same desktop/mobile checks passed after switching, without development scripts, page errors or HTTP failures. Filter updates took 50/45 ms. Keyboard navigation to the guide took 84/85 ms. No UI layout was changed.
- Inline Python local-link check over `README.md`, `tickets/README.md` and this ticket — all 44 file links resolved. Self-review confirmed the only maintained file changes are setup guidance and ticket records; the product contract is unchanged.
- Diagnostic script/output JSON live under `/private/tmp/repx-0021-*` and are disposable, not repository dependencies. Measurements are recorded below so the ticket does not depend on their retention.
- No failed checks. Domain tests, lint, format checks and the full browser regression suite were not repeated because no application/configuration/dependency files changed; ticket 0020 records their previous passing results. The current build and focused browser checks directly validate this operational change. This is not a hosted load test or proof of future database/wallet performance.

| Measured flow                         | Warm development desktop / mobile | Optimized preview desktop / mobile |
| ------------------------------------- | --------------------------------- | ---------------------------------- |
| Initial Challenges document and cards | 845 / 475 ms                      | 568 / 173 ms                       |
| Explore link                          | 300 / 264 ms                      | 205 / 144 ms                       |
| Profile link                          | 156 / 161 ms                      | 153 / 151 ms                       |
| Feed link                             | 197 / 232 ms                      | 134 / 142 ms                       |
| Challenges link                       | 189 / 157 ms                      | 162 / 130 ms                       |
| Sponsored challenge detail            | 36 / 66 ms                        | 72 / 70 ms                         |
| How it works via keyboard             | 354 / 169 ms                      | 84 / 85 ms                         |

The historical multi-second compilation and these warmed browser runs measure different conditions. Do not claim a fixed speedup ratio; the operational fix removes on-demand development compilation.

| Criterion | Evidence                                                                                                    | Result |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Historical compile/request trace plus separate warmed browser baseline                                      | Passed |
| AC2       | Fresh production build; desktop/mobile navigation, filter, detail and keyboard checks; no dev client/errors | Passed |
| AC3       | README and local-link review; same origin/storage code; no user-browser reset                               | Passed |

## Risks, limitations, and follow-ups

Local measurements apply to this small seeded frontend, not future hosted/database performance. Development compilation delays can recur when returning to `npm run dev`. Refresh the existing browser tab once after the switch to replace its development client. Future application edits require rebuilding/restarting the preview or explicitly switching back to development mode. No remaining acceptance work.

## Completion and review references

- Completed: 2026-09-20; compilation cause identified, optimized local preview running and browser comparison recorded.
- Commit: Not created; not requested.
- Review: Self-reviewed scope, setup instructions and acceptance evidence; no independent review.
- Deployment or release: Local preview only; no deployment.
