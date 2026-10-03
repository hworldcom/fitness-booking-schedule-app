# Ticket DEV0097: Create coach package offers on Devnet

- Status: In progress
- Created: 2026-10-02
- Last updated: 2026-10-03
- Milestone: Coach-first M2 one-session/ten-session offers
- Coordination: [COR0009 — Coach-first private-class booking MVP](../organisatory/COR0009-coach-first-training-package-mvp.md)
- Related records: depends on [DEV0094](../../archive/organisatory/DEV0094-adopt-coach-first-training-package-mvp.md), applicable coach identity from [DEV0096](../backend/DEV0096-persist-coach-profiles-and-discovery.md) and linked-wallet authority from [DEV0047](../backend/DEV0047-personal-wallet-linking-and-replacement.md); supplies authoritative one-session/ten-session terms to DEV0098 and booking eligibility to DEV0105

## Objective and context

Create the smallest Solana program boundary in which a coach publishes or deactivates a one-session or ten-session private-training offer with immutable commercial terms. The current membership-card program is a non-authoritative public projection and must not be repurposed as the pass authority without an explicit replacement review.

## Scope and non-goals

- In scope: a dedicated reviewed coach-pass program; a stable CoachAuthority PDA and bounded wallet-recovery instruction; coach-scoped Offer PDA derivation with repeat-safe nonce; immutable Devnet test-USDC price, session count restricted to exactly one or ten, validity, optional restricted-client wallet and immutable payment recipient; active/deactivated state; `initialize_coach_authority`, `rotate_coach_authority`, `create_offer` and `deactivate_offer`; client codecs; coach create/deactivate interface; offchain title/description/service/image metadata bound to offer address; local validator/Surfpool and Devnet tests.
- Out of scope: purchase/TrainingPass creation, redemption, offer editing in place, payment splitting, refunds, availability or booking state, transfers, subscriptions, wallet-visible NFTs or production deployment.

## Expected behavior and edge cases

Only the linked and connected current wallet in the coach's indexed CoachAuthority account can create or deactivate its offer. Session count must be exactly `1` or `10`, price must be positive, validity must be either no-expiry or within the reviewed bounds, the configured mint/network contract must be explicit, and a restricted client must be a valid address. The payment recipient is the creating current wallet, proving recipient control in the same transaction. Deactivation blocks future purchases but does not alter already purchased passes or confirmed bookings.

Commercial fields cannot be edited after creation; a coach replaces an offer by deactivating it and creating another nonce. A wallet rotation requires the configured recovery authority and replacement wallet to sign, increments the CoachAuthority epoch and makes every earlier-epoch offer ineligible for later purchase even if it has not yet been explicitly deactivated. The replacement wallet can still deactivate those offers and will control redemption of already-issued passes through the stable CoachAuthority address. Offchain metadata cannot change price, session count, validity, recipient, restriction or active state. A failed or rejected transaction creates no published active offer.

## Assumptions, decisions, and dependencies

Public UI says **coach**. Onchain state stores wallet authorities. `Offer` is a program-owned account whose fields are authoritative; the payment recipient is frozen into the offer so later application-profile or wallet changes cannot redirect it.

The authority contract adopted for this slice is a stable `CoachAuthority` PDA seeded by the application dataset UUID, coach-profile UUID and originally linked wallet. Initialization requires the original wallet and configured application recovery authority to sign; the application indexes only the authority address created for its authenticated coach/profile binding. The account stores the current wallet, immutable recovery authority and monotonically increasing authority epoch. Recovery/replacement requires both the recovery authority and replacement wallet, but not the lost old wallet, matching DEV0047's email-reauthenticated replacement contract. Offers store the CoachAuthority address and creation epoch. A later wallet replacement therefore preserves pass/redemption authority, while DEV0098 must reject purchase from any offer whose stored epoch/recipient no longer matches the current CoachAuthority wallet. New offers always pay the current wallet. This intentionally introduces a trusted recovery co-signer for hackathon wallet recovery; it cannot create, deactivate or redeem without a coach wallet signature.

Offer validity adopts `0` as no expiry and otherwise accepts 1 day through 365 days, inclusive. Price is stored as positive test-USDC base units. Offer nonce is a coach-chosen `u64` encoded little-endian in the PDA seeds; a duplicate nonce deterministically collides instead of overwriting state. The initial program is separate from the removed `movx-membership-card` prototype.

## Implementation plan

1. Freeze account layout, PDA seeds, instruction data, recipient-control rule, wallet-replacement behavior, error surface, size/rent and upgrade authority.
2. Implement and test create/deactivate authorization and field invariants locally.
3. Add typed application clients plus server/read/index boundary for authoritative offers and approved metadata.
4. Add accessible coach offer controls with simulation, wallet approval, pending/success/error and reload recovery.
5. Deploy/rehearse on Devnet only after local tests and record addresses/signatures without secrets.

## Acceptance criteria

- [ ] AC1: An authorized coach creates one one-session or ten-session offer whose authoritative price, sessions, validity, restriction and payment recipient match the reviewed input.
- [ ] AC2: Unauthorized, malformed, unsupported-session-count, duplicate-nonce and invalid-term attempts fail without an active offer.
- [ ] AC3: Deactivation is coach-only, prevents later purchase eligibility and does not mutate existing passes.
- [ ] AC4: Offchain metadata cannot override chain terms, and reload recovers submitted offer state without duplicate creation.
- [ ] AC5: Program, client, local lifecycle, Devnet rehearsal, static and build validation pass with recorded fee/rent behavior.
- [ ] AC6: A recovery-authority plus replacement-wallet rotation preserves control of the stable CoachAuthority account, invalidates old-recipient offers for future purchase and does not require the lost wallet.

## Validation plan

Use Rust unit/integration tests plus Surfpool/local lifecycle coverage for valid creation, authorization failures, bounds, nonce collision and deactivation. Test application codecs and metadata joins. Rehearse one create/deactivate flow with a funded Devnet coach wallet and record explorer evidence. Run relevant lint/clippy/type/build checks.

## Implementation record

Implementation started on 2026-10-03 after re-reading the current specification, DEV0047 wallet replacement contract, the in-progress DEV0096 coach identity shape and the installed Solana toolchain. Program work is isolated from DEV0096's dirty application/schema files; application integration will consume its stable `(run_id, profile_id)` identity only after that contract settles.

### Changes and rationale

The design review selected a new Anchor 1.1.2 program on the repository's pinned Solana CLI 3.1.10 toolchain. It adds a stable authority indirection so email-recovered wallet replacement does not strand later TrainingPass redemption. Offer recipients remain immutable: rotating the wallet invalidates prior-epoch offers for future purchase rather than silently redirecting them.

The first implementation slice now provides program-owned `CoachAuthority` and `Offer` accounts; initialization, recovery rotation, create and one-way deactivate instructions; structured self-CPI events; canonical PDA helpers; an Anchor-generated interface description language (IDL); a Codama-generated Solana Kit client; and focused application helpers for metadata validation and purchase-eligibility projection. The offer account hard-codes the official Devnet test-USDC mint and validates positive base-unit prices, exactly one or ten sessions, no expiry or one-to-365-day validity, non-default client restrictions, coach authorization and duplicate prevention through deterministic nonce PDAs.

### Affected files

- [`Cargo.toml`](../../../Cargo.toml), [`Cargo.lock`](../../../Cargo.lock), [`Anchor.toml`](../../../Anchor.toml) and [`programs/movx-coach-pass`](../../../programs/movx-coach-pass) define the isolated Anchor workspace, program address, account layouts, instructions, errors, events and Rust invariant tests.
- [`idl/movx_coach_pass.json`](../../../idl/movx_coach_pass.json) and [`clients/js/src/generated`](../../../clients/js/src/generated) are the checked-in Anchor/Codama contracts used by application code. [`clients/js/package.json`](../../../clients/js/package.json) records the generated client's runtime peer/dependency boundary.
- [`src/solana/coach-pass.ts`](../../../src/solana/coach-pass.ts) derives UUID-bound authority and nonce-bound offer PDAs, checks current authority epoch/recipient/mint eligibility and accepts only bounded non-authoritative display metadata. [`tests/coach-pass-client.test.ts`](../../../tests/coach-pass-client.test.ts) verifies those helpers and the generated account/instruction codecs.
- [`.env.example`](../../../.env.example) declares the eventual public Devnet program-address input. [`package.json`](../../../package.json) and [`package-lock.json`](../../../package-lock.json) pin the Codama renderer and generated-client runtime; [`.gitignore`](../../../.gitignore) excludes Codama's machine-local working state; [`eslint.config.mjs`](../../../eslint.config.mjs) excludes reproducible generated source from hand-written-source lint while TypeScript still compiles it.
- [`docs/mvp-spec.md`](../../../docs/mvp-spec.md) records the stable authority/epoch and immutable-recipient behavior. The ticket index and COR0009 work map reflect the in-progress state.

Offer read/index persistence and the coach create/deactivate interface have not started. They intentionally wait for DEV0096's still-in-progress identity/schema contract. No DEV0096 implementation file is owned by this ticket.

### Decisions and deviations

The payment recipient is restricted to the current coach wallet at creation instead of accepting an arbitrary address. Stable CoachAuthority indirection plus recovery-authority/replacement-wallet co-signing is used instead of forcing a lost old wallet to approve replacement. Old-epoch offers remain immutable and readable but become purchase-ineligible; the current wallet may deactivate them. This is the narrowest model found that satisfies DEV0047 recovery without giving the MovX service unilateral coach action authority.

### Contracts, configuration, and operations

The local-only program address is `DfpqcSwSer4MrPehwFk2Jota3yJVhqobWWD2Aq1crARB`; it was derived without creating a private key and must not be treated as a deployable identity. Devnet requires a user-managed deployment identity and a real `NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID`. The authoritative Devnet test-USDC mint is `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` in both Rust and TypeScript. Account allocations including the Anchor discriminator are 200 bytes for `CoachAuthority` and 232 bytes for `Offer`.

The application still needs an expected recovery-authority address and custody procedure before it can initialize a coach authority. The recovery signer and any deployment/upgrade key remain server/operator secrets and must not enter the repository or browser bundle. During build validation Anchor created an ignored disposable program keypair despite `--ignore-keys`; it was deleted immediately without being read or used, and a final search confirmed that no generated keypair remains under `target/`.

## Validation results

- Passed `NO_DNA=1 cargo test -p movx-coach-pass`: 9/9 Rust tests cover identifiers/authorities, rotation, offer bounds, immutable terms, one-way deactivation, stale-recipient eligibility and exact account sizes.
- Passed `NO_DNA=1 cargo clippy -p movx-coach-pass --all-targets -- -D warnings`.
- Passed `npx --no-install tsx --test tests/coach-pass-client.test.ts`: 4/4 focused PDA, codec, authority-epoch and metadata tests.
- Passed `npm test`: 51/51 repository unit tests, including the four new client tests.
- Passed `npm run typecheck`, Prettier checks for the new contract/client files, `cargo fmt --all -- --check` and `git diff --check`.
- Passed `npm run lint` with no errors. One pre-existing/in-progress DEV0096 unused-import warning remains in `src/server/db/coaches/repository.ts`; this ticket did not modify it.
- Passed an isolated `NO_DNA=1 anchor idl build -p movx_coach_pass`: the generated JSON is semantically identical to the checked-in IDL. The same command in the main worktree is blocked by ignored Cargo artifacts that still reference the retired `programs/movx-membership-card`; those shared caches were not broadly deleted.
- `NO_DNA=1 cargo build-sbf --manifest-path programs/movx-coach-pass/Cargo.toml` exits successfully and emits the program binary, but the installed SDK has a zero-byte `sbf/syscalls.txt`; post-processing therefore reports every ordinary Solana syscall as unknown. Runtime SBF validation remains required after repairing or replacing that local toolchain installation.
- `npm audit --omit=dev` reports eight existing production-tree advisories (seven high, one critical), including the repository's pinned Next.js 16.3.5; the full audit reports fourteen. No forced or out-of-scope dependency upgrade was applied.
- Not run: local instruction lifecycle, Surfpool integration, rent/fee measurement, coach browser controls and Devnet rehearsal. No transaction was signed or sent and no deployment occurred.

## Risks, limitations, and follow-ups

Recovery-authority compromise could rotate coach control when paired with an attacker-controlled replacement wallet, so its custody is a deployment blocker rather than an incidental sponsor setting. Program rent/fees, a deployable program ID, SBF runtime behavior, upgrade authority and recovery-key custody need explicit evidence before deployment. DEV0096 is still in progress; this ticket must not bind UI/metadata persistence to an unstable schema. Repository dependency advisories require a separate scoped upgrade rather than an unsafe `npm audit fix --force` during this ticket.

## Completion and review references

- Completed: Not completed.
- Commit: `[DEV0097] Establish coach offer program foundation` (this commit).
- Review: Planning self-review only.
- Deployment or release: None.
