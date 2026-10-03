# Ticket DEV0050: Add public contact email

- Status: Completed
- Created: 2026-09-22
- Last updated: 2026-09-22
- Milestone: Product branding maintenance
- Coordination: None — independent development ticket
- Related records: follows completed DEV0049 — Rename platform to MovX Club

## Objective and context

Make the confirmed MovX Club contact address, `hello@movx.club`, easy to find from every website route. The shared footer currently contains the product name, tagline and Devnet status but no contact method.

## Scope and non-goals

- In scope: show `hello@movx.club` in the shared footer, link it with the standard `mailto:` scheme, preserve the existing footer hierarchy and verify responsive and keyboard behavior.
- Out of scope: a contact form, support workflow, service-level promise, additional addresses, mailbox configuration, newsletter signup or a dedicated contact page.

## Expected behavior and edge cases

Every route rendered inside the application shell displays the address. Activating it opens the visitor's configured email client through `mailto:hello@movx.club`. The address remains readable and focusable at mobile and desktop widths without horizontal overflow. A device without a configured email client may not complete the external handoff; the address remains visible for copying.

## Assumptions, decisions, and dependencies

The user supplied and confirmed `hello@movx.club` on 2026-09-22. The shared footer is used because it provides consistent visibility without introducing navigation or a new route. This interface change does not configure or test the externally hosted mailbox.

## Implementation plan

1. Add a labelled `mailto:hello@movx.club` link beside the MovX Club copyright in the shared footer.
2. Extend existing footer styling only as needed to keep the address legible, focus-visible and responsive.
3. Add browser assertions for visible link text, the exact mailto target, keyboard focus and lack of horizontal overflow.

## Acceptance criteria

- [x] AC1: Every application-shell route exposes a visible `hello@movx.club` link whose target is exactly `mailto:hello@movx.club`.
- [x] AC2: The link is keyboard focusable and the shared footer remains usable without horizontal overflow at the project's tested mobile and desktop widths.
- [x] AC3: Focused browser checks, lint, type checking and formatting pass, with results recorded here.

## Validation plan

Extend the existing responsive layout browser test to assert visible link text, exact `href`, keyboard focus and viewport containment at 320, 600, 820 and 1100 pixels. Run the focused desktop/mobile browser test plus lint, type checking and formatting. No database, authentication, wallet or mailbox delivery check applies because this ticket changes only a static public link.

## Implementation record

Implementation and validation are complete.

### Changes and rationale

The shared application footer now presents `hello@movx.club` beside the MovX Club copyright. It is an ordinary underlined email link with the exact `mailto:hello@movx.club` target, so it remains visible and copyable even when a visitor has no local email application configured.

The existing footer layout was extended with a small wrapping contact group rather than adding a route or navigation item. This keeps the address present on every page using the shell while preserving the tagline and Devnet disclosure.

### Affected files

| File or component                                                                   | Change and purpose                                                                                                                             |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/components/shell.tsx`](../../../src/components/shell.tsx)                     | Adds the visible shared-footer email address and exact `mailto:` target.                                                                       |
| [`src/app/globals.css`](../../../src/app/globals.css)                               | Keeps the copyright/contact group wrapping, readable and visually consistent with existing footer styling.                                     |
| `tests/browser/redesign.spec.ts` (historical path `tests/browser/redesign.spec.ts`) | Verifies link text and target, keyboard focus, viewport visibility and absence of horizontal overflow at four widths in both browser projects. |

### Decisions and deviations

No deviations. The contact link uses the planned shared-footer placement and does not claim a support response time or introduce a separate contact workflow.

### Contracts, configuration, and operations

The only new public contract is the `mailto:hello@movx.club` target. No dependency, environment variable, data shape, schema, migration or deployment operation changes.

## Validation results

Validation ran on 2026-09-22 against the configured local production build.

The first sandboxed `npm test` attempt could not create the `tsx` IPC socket and stopped with `listen EPERM`; the same unchanged command was rerun with permission to create the local socket and all 38 tests passed. This was an execution-environment restriction rather than a test failure.

| Criterion | Evidence                                                                                                                                                                                                                                                         | Result |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1–AC2   | `npm run test:e2e -- --grep "club layout remains usable"` passed 2 desktop/mobile browser-project checks. Each project verified the exact link and `href`, keyboard focus, viewport presence and no horizontal overflow at 320, 600, 820 and 1100 pixels.        | Passed |
| AC1–AC2   | `npm run test:e2e -- --grep "home discovery links preserve"` passed 2 desktop/mobile browser-project checks. Full-page screenshots were inspected at 1440×1040 and 393×852; the footer address remained readable and balanced with the tagline and Devnet badge. | Passed |
| AC3       | `npm run format:check`, `npm run lint` and `npm run typecheck` passed. `npm test` passed all 38 tests after the sandbox-only IPC retry.                                                                                                                          | Passed |
| AC3       | `npx next build --webpack` completed successfully with all 12 static pages generated and dynamic routes compiled. Webpack was used because it is the established build validation in this restricted environment.                                                | Passed |

## Risks, limitations, and follow-ups

The application cannot determine whether the visitor has configured a local email client, and this ticket does not verify externally hosted mailbox delivery. Keeping the address visible allows it to be copied when the `mailto:` handoff is unavailable. Porkbun/Supabase SMTP setup remains an operational task outside this static-link change.

## Completion and review references

- Completed: 2026-09-22 — added and responsively verified the shared public contact link.
- Commit: Included in this commit — `[DEV0049] [DEV0050] Rename platform and add contact email`.
- Review: Self-reviewed through automated assertions and desktop/mobile screenshot inspection; no independent review.
- Deployment or release: Validated locally; not deployed.
