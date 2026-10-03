# Ticket DEV0049: Rename platform to MovX Club

- Status: Completed
- Created: 2026-09-22
- Last updated: 2026-09-22
- Milestone: Product branding maintenance
- Coordination: None — independent development ticket
- Related records: updates the current product contract in [the MVP specification](../../../docs/mvp-spec.md); retains the visual system delivered by [DEV0043](../../archive/frontend/DEV0043-playful-club-ui-redesign.md), [DEV0044](../../archive/frontend/DEV0044-club-illustration-and-brand-polish.md) and [DEV0045](../../archive/frontend/DEV0045-navigation-and-header-simplification.md)

## Objective and context

Rename the current platform brand from RepX Club to MovX Club everywhere a user, browser, email recipient or current contributor encounters the product name. Keep the accepted logo composition, abstract icon, typography, colours, imagery and layout unchanged so this is a naming change rather than a visual redesign.

## Scope and non-goals

- In scope: visible wordmarks, accessible labels, interface copy, page metadata, authentication email copy, current product/setup documentation, active work records, package metadata and affected automated expectations.
- Out of scope: regenerating photographs or the abstract icon; changing the tagline; renaming historical archived ticket filenames/titles or rewriting their completed implementation evidence; changing stable database-role or browser-storage identifiers solely for cosmetic reasons; selecting or migrating a public domain, Supabase project name or third-party account.

## Expected behavior and edge cases

Every current rendered brand surface says `MovX` or `MovX Club` with the same stacked logo treatment and responsive behavior previously used for RepX Club. Browser metadata, accessible home-link labels, sign-in copy and the local/hosted OTP email template use MovX Club consistently. Current documentation names MovX Club while links to archived records keep their historical filenames.

Historical records and opaque compatibility identifiers may retain `repx` where changing them would falsify history, discard browser state or break an existing database login. Those strings must not render as the current product brand.

## Assumptions, decisions, and dependencies

The user selected `MovX Club` on 2026-09-22 and explicitly asked to retain the existing logo designs. The four-character `MovX` wordmark fits the existing logo structure without new assets or CSS. The existing icon and raster images contain no RepX text, so they remain unchanged. This independent maintenance ticket does not alter DEV0047's wallet-linking behavior or sequence.

## Implementation plan

1. Replace current user-facing brand text and wordmark content while preserving existing logo markup and styling.
2. Align browser metadata, authentication email copy, package metadata, the current specification, README/setup documentation and active work records.
3. Update affected automated expectations and add a repository scan that distinguishes permitted historical/compatibility references from stale current branding.
4. Run focused browser checks at desktop/mobile widths plus unit, lint, type, format and production-build validation; visually inspect the retained wordmark and icon.

## Acceptance criteria

- [x] AC1: All current interface, accessibility, metadata and authentication-email brand surfaces use MovX Club, with no rendered RepX Club text.
- [x] AC2: The stacked wordmark, abstract icon, typography, colours, imagery and responsive layout retain their existing design.
- [x] AC3: README, the current MVP specification and active work records use MovX Club while completed archives remain truthful historical records.
- [x] AC4: Relevant automated browser/unit checks, lint, type checking, formatting and production build pass; current-source scans find no unintended old-brand copy.

## Validation plan

Search current runtime code, current documentation and active records for old-brand strings, allowing only explicitly documented opaque compatibility identifiers and historical links. Run focused responsive browser checks for the shared shell, modal, guide and sign-in surfaces, then the relevant full unit/browser suites, lint, typecheck, formatting and a production build. Inspect the rendered desktop and mobile wordmark and favicon; no database, wallet-signature or payment rehearsal is required because behavior and authority do not change.

## Implementation record

Implementation started and completed on 2026-09-22 after reviewing the request as one focused cross-surface branding slice.

### Changes and rationale

The current product now renders and describes itself as MovX Club. The shared `Brand` component keeps the same stacked two-line markup and CSS while replacing its four-character wordmark, so every desktop/mobile logo instance updates consistently without new image assets. Shared navigation, footer, preview modal, graphic-card microcopy, How it works, wallet/session boundaries, sign-in screens, page metadata and accessible labels use the new name.

The npm package, local Auth email subject/template, setup messages, README, MVP specification and active work records now use MovX Club. The email rehearsal additionally verifies Mailpit's subject and body before accepting the code, protecting the hosted-template handoff from silently reverting to the old name.

Completed archives, historical filenames and verbatim asset-generation provenance remain unchanged. The opaque `repx-club-preview-v1`, `repx-club:phantom-wallet` and `repx_runtime_login` identifiers remain compatibility contracts: changing them would discard browser selections or invalidate existing runtime credentials without improving a rendered brand surface.

### Affected files

| File or component                                                                                                                                                                                                                                               | Change and purpose                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/components/ui.tsx`](../../../src/components/ui.tsx), [`src/components/shell.tsx`](../../../src/components/shell.tsx)                                                                                                                                      | Replace the reusable wordmark, graphic labels, modal label, accessible home labels and footer/about copy without changing their markup or styling. |
| [`src/app/layout.tsx`](../../../src/app/layout.tsx), [`src/app/sign-in/page.tsx`](../../../src/app/sign-in/page.tsx)                                                                                                                                            | Rename document titles, descriptions and the sign-in route metadata.                                                                               |
| [`src/features/auth/sign-in.tsx`](../../../src/features/auth/sign-in.tsx), [`src/auth/client/auth-status-link.tsx`](../../../src/auth/client/auth-status-link.tsx)                                                                                              | Rename account, profile, safety, status and accessible sign-in text.                                                                               |
| `src/features/discovery/how-it-works.tsx` (historical path `src/features/discovery/how-it-works.tsx`), [`src/solana/client/wallet-connection.tsx`](../../../src/solana/client/wallet-connection.tsx)                                                            | Rename public guidance and the explicit wallet-versus-account boundary.                                                                            |
| [`supabase/templates/email-otp.html`](../../../supabase/templates/email-otp.html), [`supabase/config.toml`](../../../supabase/config.toml), [`scripts/rehearse-local-email-auth.mjs`](../../../scripts/rehearse-local-email-auth.mjs)                           | Rename the OTP subject/body and verify the captured email carries the new brand before using its code.                                             |
| [`package.json`](../../../package.json), [`package-lock.json`](../../../package-lock.json), [`scripts/prepare-local-runtime-database.mjs`](../../../scripts/prepare-local-runtime-database.mjs)                                                                 | Rename package metadata and the human-readable local setup result.                                                                                 |
| [`README.md`](../../../README.md), [`docs/mvp-spec.md`](../../../docs/mvp-spec.md), [`supabase/README.md`](../../../supabase/README.md), [`docs/design/DEV0043-assets.md`](../../../docs/design/DEV0043-assets.md)                                              | Adopt MovX Club in current product/setup documentation and explain the preserved compatibility/provenance strings.                                 |
| Active work records and [`tickets/README.md`](../../README.md)                                                                                                                                                                                                  | Align current plans with the selected brand and index this change without rewriting completed history.                                             |
| `tests/browser/redesign.spec.ts` (historical path `tests/browser/redesign.spec.ts`), `tests/browser/discovery.spec.ts` (historical path `tests/browser/discovery.spec.ts`), [`tests/supabase-auth-config.test.ts`](../../../tests/supabase-auth-config.test.ts) | Assert the MovX wordmark, accessible label, metadata, guide copy, package name and OTP template.                                                   |

### Decisions and deviations

On 2026-09-22 the implementation deliberately retained completed archives, historical filenames, the verbatim image-generation prompt and stable opaque compatibility identifiers rather than rewriting history or invalidating existing local data. The originally planned current-source scan therefore excludes negative test assertions, those documented identifiers and historical links/provenance. No other deviations occurred.

### Contracts, configuration, and operations

No data schema, authorization, environment-variable name, wallet authority, browser-state shape or payment contract changed. The npm package name changed from `repx-club` to `movx-club`; no dependency changed. The existing favicon and raster assets are byte-for-byte unchanged. Hosted Supabase does not ingest the checked-in template automatically: its Magic Link/OTP subject and body must be updated to the checked-in MovX version after custom SMTP unlocks template editing. No credential is part of this ticket.

## Validation results

Validation completed on 2026-09-22 with Node.js 24.21.0, Next.js 16.3.5, installed Google Chrome, local Supabase Auth/PostgreSQL/Mailpit and the user's unchanged hosted `.env.local` values. The local Auth rehearsal used explicit process-only local overrides; the normal configured build and server were restored afterward.

- `npm test`: 38/38 passed, including package and OTP-template branding assertions. The sandboxed attempt could not create tsx's IPC socket; the permitted rerun passed.
- `npm run lint`, `npm run typecheck` and `npm run format:check`: passed.
- `npx next build --webpack`: passed in configured mode, configuration-free preview mode and again after restoring the normal configured environment. Webpack is the established restricted-environment build path.
- Focused Playwright branding/navigation run: 6/6 passed on desktop/mobile after rebuilding the initially stale production output. Screenshots at 320, 600, 820 and 1100 pixels plus the desktop/mobile sign-in and How it works pages were inspected; `MovX Club` fits the existing wordmark/layout with no overflow or visual regression.
- Configuration-free `npm run test:e2e`: 40 passed and 4 configured-only authorization checks skipped as expected. A first sandboxed attempt could not bind port 3101; the permitted rerun passed.
- A configured full-suite diagnostic produced 33 passes and 11 preview-only private-action failures because configured mode correctly redirects those actions to sign-in. The focused configured public/auth/authorization/branding coverage passed, and the complete preview suite was rerun in its required configuration-free mode above.
- `npm run test:auth`: passed for two new accounts, one returning account, invalid/replayed-code recovery, isolated profiles and sign-out; the new mail assertions confirmed `Your MovX Club sign-in code` and MovX body copy. Initial attempts were not product failures: Chrome was sandbox-blocked, then the normal `.env.local` was confirmed to target non-local Supabase so no local Mailpit message could exist. Restarting local Auth and using process-only local overrides produced the passing result without modifying `.env.local`.
- Current-runtime/document scans found no unintended old-brand copy. `git diff --check` passed before record completion.

| Criterion | Evidence                                                                                                                                      | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1       | Source scan, metadata/browser assertions, responsive screenshots and local captured OTP email all show MovX Club.                             | Passed |
| AC2       | Responsive screenshots at four widths and unchanged icon/image files preserve the accepted visual system.                                     | Passed |
| AC3       | README, current specification, setup docs and active records were reviewed; archives and provenance remain explicit history.                  | Passed |
| AC4       | Unit, lint, types, format, configured/preview builds, focused browser checks, full preview suite and Auth rehearsal passed as recorded above. | Passed |

## Risks, limitations, and follow-ups

External project names, domains and third-party dashboard labels are not changed automatically. The hosted Supabase OTP template must be updated manually from the checked-in template. Historical archives and documented opaque compatibility identifiers continue to mention RepX Club or `repx` where that is necessary for truthful provenance or continuity; none renders as the current product brand.

## Completion and review references

- Completed: 2026-09-22 — current product surfaces, wordmark, metadata, email copy, package metadata and current documentation renamed to MovX Club with the visual system retained.
- Commit: Included in this commit — `[DEV0049] [DEV0050] Rename platform and add contact email`.
- Review: Self-reviewed against the acceptance criteria with automated, responsive screenshot and real local-email evidence; no independent review.
- Deployment or release: Restored local configured production process at `http://localhost:3100`; no hosted deployment or external-dashboard change.
