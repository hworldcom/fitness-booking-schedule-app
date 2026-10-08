# Coordination COR0012: Profile images

- Status: Completed
- Created: 2026-10-08
- Last updated: 2026-10-08
- Milestone: Scheduling-only account and coach presentation
- Converted from: Not applicable — created as a coordination record
- Tracked development tickets: [DEV0154 — Adopt the profile-image contract](DEV0154-adopt-profile-image-contract.md), [DEV0155 — Store normalized profile images](../backend/DEV0155-store-normalized-profile-images.md), [DEV0156 — Upload and present profile images](../frontend/DEV0156-upload-and-present-profile-images.md), [DEV0157 — Provision the persistent local test user](../backend/DEV0157-provision-persistent-local-test-user.md)
- Related records: [DEV0147 — Separate client onboarding and verified coach access](../backend/DEV0147-separate-client-onboarding-and-verified-coach-access.md), [DEV0153 — Separate client and coach navigation](../frontend/DEV0153-separate-client-and-coach-navigation.md)

## Objective and boundaries

Coordinate optional profile pictures for the scheduling-only product without merging private account identity with public coach presentation. Ordinary accounts receive a private avatar; approved coaches may separately manage a public coach portrait. Uploaded images are normalized once before storage, while initials remain the fallback. Preserve one stable local account at `hoang@users.movx.test` for manual upload checks and add only one generated fictional coach portrait, for Daniel Park.

This coordination record owns sequencing and integration only. It does not authorize runtime implementation or duplicate the evidence maintained by its development tickets.

## Direct development work

| Implementation part                 | Development ticket                                                                                               | Owned deliverable                                                                                                                  | Start condition or dependency              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Product, privacy and media contract | [DEV0154 — Adopt the profile-image contract](DEV0154-adopt-profile-image-contract.md)                            | Specify optionality, visibility, normalization, fallback and demo/test boundaries.                                                 | Completed 2026-10-08.                      |
| Storage and mutation foundation     | [DEV0155 — Store normalized profile images](../backend/DEV0155-store-normalized-profile-images.md)               | Add bounded database references, Supabase Storage buckets/policies, normalization and owner-authorized mutations.                  | Completed 2026-10-08 after DEV0154.        |
| Upload and presentation interface   | [DEV0156 — Upload and present profile images](../frontend/DEV0156-upload-and-present-profile-images.md)          | Add accessible account/coach upload controls, responsive rendering, initials fallback and the single Daniel Park fixture portrait. | Completed 2026-10-08 after DEV0155.        |
| Stable local client fixture         | [DEV0157 — Provision the persistent local test user](../backend/DEV0157-provision-persistent-local-test-user.md) | Idempotently preserve `hoang@users.movx.test` across normal local startup/reset recovery for manual avatar testing.                | Completed 2026-10-08; integration used it. |

All required implementation parts have direct development tickets. No nested development-ticket hierarchy is needed.

## Other relationships

- DEV0147 is the historical identity/coach-capability boundary: one account may act as a client and an approved coach, but private account presentation and public coach presentation remain distinct.
- DEV0153 is the current navigation baseline and does not deliver image behavior.
- Hosted Supabase/Vercel configuration remains downstream operational work. Local completion must not claim a hosted Storage bucket, policy or deployment exists.

## Delivery sequence and completion conditions

1. Complete DEV0154 before runtime changes.
2. Implement DEV0155 and DEV0157 independently after the contract is fixed.
3. Implement DEV0156 against DEV0155, then use the DEV0157 account for the ordinary-user upload rehearsal.
4. Complete this coordination record only when all four direct DEV tickets are Completed or explicitly cancelled/replaced, database/storage and application tests pass, Daniel alone has a generated fixture portrait, the remaining coaches retain initials, and desktop/mobile integration proves private account avatar and public coach portrait behavior.

## Progress and integration record

- 2026-10-08: Adopted the user's correction that a portrait is not required for every coach. Daniel Park is the sole generated demo portrait; missing images remain a supported state.
- 2026-10-08: Adopted private account avatars and separately public coach portraits as the working privacy boundary. Compression happens once at upload; PostgreSQL stores bounded references rather than image bytes.
- 2026-10-08: Completed the four direct tickets. Real local Storage rehearsals proved private Hoang upload/preservation/removal and separate public Daniel upload/removal; cleanup left Hoang image-free for the user and restored Daniel's fixture.

## Validation results

- All four direct development tickets are Completed with their own implementation evidence.
- `npm test` passed 79 general and 2 server tests; `npm run test:db` passed 34 database integration tests; `npm run db:test` passed 152 pgTAP checks; database lint, TypeScript, ESLint, formatting and the production build passed.
- Account and coach browser rehearsals passed independently against local Storage. Final state query showed a null Hoang avatar, Daniel's fixture path, and null portraits for Sam, Nora, Idris and Elif.
- Hosted Storage/deployment was not exercised and remains downstream operational evidence rather than part of this coordination completion.

## Risks, limitations, and follow-ups

Public coach portraits and private account avatars intentionally retain different access policies despite shared visual components. Hosted Storage provisioning and lifecycle cleanup need explicit evidence before release. Best-effort deletion can leave an owner-scoped orphan if a process fails after reference removal; it cannot create an intentional dangling application reference.

## Completion and review references

- Completed: 2026-10-08.
- Direct development tickets: DEV0154, DEV0155, DEV0156 and DEV0157 Completed.
- Commit: Not applicable — coordination-record IDs are not used in commit subjects.
- Review: No integration review created.
- Deployment or release: Not deployed or released.
