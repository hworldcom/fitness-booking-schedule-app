# MovX Club — Hackathon MVP specification

Last updated: 28 September 2026.

This is the single current product contract for the MovX Club hackathon MVP. MovX Club is testing one focused product: a membership that gives a member included access to four selected participating gyms, with visible usage accounting for the member and the gyms. A small social layer lets people follow one another and explicitly share verified participation.

The MVP no longer includes membership transfers, standalone class passes or pass resale, ordinary or sponsored events, challenges, reactions, comments or messaging. Those ideas remain only in historical records.

## 1. Product status and document authority

This specification defines the target behavior. It does not claim that the target has already been implemented.

Home and How it works present the focused four-gym membership concept. Explore, Search, membership setup and My Membership use one read-only server projection of the persistent published Basic/Classic terms, seven fictional participating gyms and explicit plan eligibility. Setup saves a browser-local four-gym draft before any payment. The current DEV0081 implementation can turn that draft into one active fixed period through an authoritative operation, exact simulated-before-signing official test-EURC transfer, finalized server verification and recoverable reference; its required real funded-Phantom rehearsal is still outstanding. DEV0086 and DEV0087 add the private selected-gym class schedule plus persistent reserve/cancel behavior with atomic capacity and shared daily-access holds. Database failure, empty publication and inconsistent data are shown honestly without fixture fallback. Staff-confirmed included check-ins, allocation and non-core visit payment are not implemented yet.

Completed and cancelled tickets are preserved as historical evidence. They explain previous choices but do not override this document. [The ticket index](../tickets/README.md) records current delivery work.

<a id="confirmed-target-and-decisions"></a>

## 2. Confirmed target and decisions

The identifiers below remain stable so tickets can cite product decisions precisely.

| ID  | Confirmed decision                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | The target is a focused hackathon demonstration on Solana Devnet, not a production-ready commercial service.                                                                                                                                                                                                                                                                                             |
| C09 | A visit becomes participation only after an authorized venue representative confirms the member's presence. Membership payment, plan selection, reservation, check-in, settlement accounting and social sharing are separate states.                                                                                                                                                                     |
| C10 | The MVP does not issue non-fungible tokens (NFTs), badges or collectibles.                                                                                                                                                                                                                                                                                                                               |
| C11 | A verified check-in is private by default and appears socially only after the member explicitly shares it.                                                                                                                                                                                                                                                                                               |
| C12 | A person starts with an email-backed account. A personal wallet can be linked later. Each gym uses a distinct authorized business wallet; no shared gym login is permitted.                                                                                                                                                                                                                              |
| C13 | Devnet EURC is the only demonstrated payment asset. It is used for membership activation and member-priced non-core visits.                                                                                                                                                                                                                                                                              |
| C14 | Personal funds, gym funds and pooled membership funds are distinct. A UI balance must name the holder and source rather than presenting unrelated funds as one total.                                                                                                                                                                                                                                    |
| C15 | Financial states must be honest. Pool balance, provisional usage allocation and finalized or claimable payout are different concepts and must not be labeled interchangeably.                                                                                                                                                                                                                            |
| C17 | Guests may browse participating gyms and the available membership plans without signing in.                                                                                                                                                                                                                                                                                                              |
| C18 | The public How it works guide must explain the member journey, the gym value proposition, the four-gym selection and the role of Devnet without presenting the concept as already production-ready.                                                                                                                                                                                                      |
| C19 | The social MVP is one-way follows plus a chronological feed of explicitly shared verified check-ins. It has no reactions, comments, direct messages, notifications, rankings or general-purpose posts.                                                                                                                                                                                                   |
| C20 | The demo has two configurable plan variants. Basic includes ten check-ins per membership period for an illustrative €80. Classic has no numerical monthly check-in allowance and costs an illustrative €150. Both permit at most one included check-in across the membership per venue-local service date.                                                                                               |
| C21 | A member selects exactly four distinct, active and plan-eligible core gyms for a membership period. Four is a configurable MVP hypothesis, not a permanent infrastructure limit.                                                                                                                                                                                                                         |
| C22 | Challenges and reactions are outside the MVP.                                                                                                                                                                                                                                                                                                                                                            |
| C23 | The multi-gym membership is the only paid product family in the current MVP. Membership transfers, standalone passes, pass resale, ordinary events and sponsored events are outside scope.                                                                                                                                                                                                               |
| C24 | An active member may visit an eligible participating gym outside their four core gyms for an illustrative €15 Devnet-EURC member price paid directly to that gym. This visit does not consume a Basic check-in and does not enter the membership pool.                                                                                                                                                   |
| C25 | Member and gym interfaces must show predictable amounts and states without hidden platform surcharges or invented payout claims.                                                                                                                                                                                                                                                                         |
| C26 | There is no membership transfer, transfer fee, recipient flow, resale listing or transferred entitlement in the current MVP.                                                                                                                                                                                                                                                                             |
| C27 | Included check-ins produce a transparent provisional usage allocation for gyms. The MVP must not make a final payout claim until unused value, refunds, reserves, taxes, aggregation and settlement timing are decided.                                                                                                                                                                                  |
| C28 | MovX pays the Solana network fee for the Devnet membership-activation demonstration. The member still explicitly authorizes the exact EURC transfer; the sponsor key remains server-only and may sign only a server-constructed actor-owned activation transaction.                                                                                                                                      |
| C29 | A member may reserve an eligible scheduled class at one of the four selected gyms before arrival. Reservation atomically holds a seat and an exclusive daily-access claim; for Basic, that claim also holds one available included use. It does not prove attendance or change allocation. Cancellation before start and a reconciled no-show release the holds without an MVP fee or allowance penalty. |
| C30 | Arrival is separate from reservation. A member presents a short-lived 15-minute opaque code bound to the selected venue and optional reservation; only an email-authenticated actor with active same-venue staff authority may confirm presence. Open-gym arrival may omit a class reservation.                                                                                                          |

### Superseded decisions retained as history

Previous versions used C07/C08 for class-pass purchase and refunds, C16 for events, C20/C21 for a single-gym transferable membership, C23 for sponsored events, C24 for a broader access-product family, C26 for a €10 transfer fee and C27 for pass resale. DEV0069 supersedes those behaviors. Archived specifications and completed tickets remain unchanged as historical context.

<a id="proposed-defaults-to-resolve"></a>

### Proposed implementation and business defaults

These are working defaults, not confirmed production policy.

| ID  | Proposed default                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P07 | Count at most one included check-in for a membership on a venue-local calendar date. A separately paid non-core visit is a different transaction and attendance record.                                                                                                 |
| P13 | Production network-fee policy, platform pricing and the platform's long-term revenue model remain unresolved; C28 applies only to the bounded Devnet membership-activation demonstration.                                                                               |
| P15 | The demo creates one fixed monthly membership period beginning at verified activation and ending at the same instant one calendar month later, with no automatic renewal or overlapping period. Production billing term, renewal and cancellation behavior remain open. |
| P16 | Calculate a provisional pro-rata allocation for the demonstrated period. Keep zero-use and partially used value in the test pool and display it as unresolved rather than treating it as MovX revenue or a gym payout.                                                  |
| P17 | The four core gyms are frozen after period activation. The member may choose a different eligible set for a later period.                                                                                                                                               |
| P18 | €80 Basic, €150 Classic and €15 non-core access are illustrative demo values stored as configuration or versioned plan data.                                                                                                                                            |
| P19 | Production cancellations, cooling-off rights, refunds, chargebacks and gym closure handling are unresolved. Paid but undelivered access must be treated as an obligation, never as automatic platform revenue.                                                          |

Earlier P01 and P09–P12/P14 described removed challenges, passes, events or transfers and are retired from the current contract.

### Business validation required before production

- Confirm that four core gyms is understandable and attractive to members and workable for gyms.
- Model high-frequency Classic use. Its effective value per check-in may become unsustainably low without a fair-use or allocation rule.
- Decide whether allocation is calculated per member, per plan cohort or across a wider pool.
- Decide how unused and partially used membership value is handled.
- Agree final payout timing, reserves, taxes, refunds, failed venues and dispute handling with participating gyms.
- Validate prices and the non-core member rate through venue and member interviews; the demo values are not market claims.

<a id="2-screens-and-actions"></a>
<a id="discovery-and-how-it-works"></a>
<a id="visual-design-direction--21-september-2026"></a>

## 3. Public explanation and visual direction

The public page should lead with the product rather than the chain:

1. Discover participating gyms and compare Basic and Classic.
2. Choose four core gyms.
3. Activate one membership period.
4. Check in at a selected gym, subject to capacity and daily/plan limits.
5. See usage and transparent provisional gym allocation.
6. Visit another participating gym at the clearly stated member price when eligible.
7. Optionally share a verified check-in with followers.

The current How it works page communicates an earlier transferable-access concept and therefore requires a separate frontend ticket. Until it is replaced, it must not be treated as evidence that the new product is delivered.

<a id="public-browsing-and-sign-in-boundaries"></a>

Public users can browse gym and plan information. Selecting gyms, activating a membership, reserving, checking in, viewing private access or financial state, managing gym operations and sharing socially require an authenticated, authorized actor as appropriate.

## 4. MVP scope

### In scope

- Public discovery of fictional participating gyms and Basic/Classic plan terms.
- Email-backed member identity, optional personal wallet linking and separate gym-wallet authorization.
- Selection of exactly four eligible core gyms for one membership period.
- Basic allowance and Classic daily-limit enforcement.
- A real Devnet-EURC activation payment into a clearly identified membership pool or program-controlled payment account.
- Authorized, unique and idempotent included check-ins.
- Transparent provisional gym allocation derived from valid included check-ins.
- A real Devnet-EURC member-price payment for an eligible non-core gym visit.
- Member and gym views of the states each actor is allowed to see.
- One-way follows and explicitly shared verified check-ins.
- Persistent demonstration evidence and recovery from interrupted operations.

### Out of scope

- Membership transfer, reassignment, transfer fees and secondary-market listing.
- Standalone class passes, pass bundles and pass resale.
- Ordinary events, event tickets, sponsored events and sponsorship balances.
- Challenges, prize pools, reactions, comments, messaging, notifications and rankings.
- Automatic renewal, production card or fiat payments, production legal terms and production tax handling.
- Final or claimable gym payout before settlement economics are confirmed.
- NFTs, tokens representing access and speculative asset behavior.

<a id="3-demo-fixtures-and-account-model"></a>

## 5. Roles, screens and fixtures

<a id="authentication-and-data-access-recommendation"></a>

### Roles

- **Guest:** browses public gym and plan information and reads the guide.
- **Member:** selects gyms, activates and uses a membership, purchases eligible non-core visits, follows accounts and controls sharing.
- **Gym staff:** confirms attendance and sees only the gym's operational and provisional allocation data.
- **Gym administrator:** has staff capabilities plus authorized gym-wallet and configuration responsibilities.

Authorization comes from server-derived identity and persisted role bindings, never from a client-supplied account, gym or wallet identifier.

### Minimum screens

- **Home:** concise current proposition and route to discovery.
- **Explore:** participating gyms and the two membership variants.
- **Membership setup:** compare plans, choose exactly four eligible gyms, review terms and activate.
- **My Membership:** draft selection in the frontend preview, then verified period, selected gyms, eligible selected-gym classes, reservations and held Basic uses, arrival code, remaining Basic allowance or Classic policy, daily availability, payment state and private check-in history after activation exists. The compatibility route remains `/my-access` until a separately reviewed route migration.
- **Profile / Feed:** follows and explicitly shared verified participation.
- **How it works:** member and gym explanations plus honest Devnet status.
- **Gym workspace:** staff confirmation, gym-scoped attendance and provisional allocation.
- **Coming soon / waitlist:** honest fallback for product actions that have not been implemented; it must not collect an email without a real storage and consent path.

### Demonstration fixtures

- At least two ordinary member accounts are required to prove private state and social permissions.
- Seven fictional participating gyms are served from the current persistent demonstration catalogue so a member can compare routines, choose four core gyms and demonstrate one non-core visit. Catalogue rules must support at least five without treating seven as an infrastructure limit.
- Gym wallets and staff authority must remain distinct from personal wallets and from one another.
- Fixtures must not use an actual gym's name, logo, address, pricing or partnership claim without permission. Inspiration may be transformed into clearly fictional data.
- The deterministic database seed uses the same seven fictional gym identities as the preview and retains no real-gym-inspired name, address, price or partnership claim.
- Demo class schedules may transform broad cadence and duration patterns from public research, but their trainer identities, titles, descriptions, times and capacities remain original fictional data. They are not live availability or a partnership claim.

<a id="5-architecture"></a>
<a id="5-architecture-and-storage"></a>
<a id="database-provider-recommendation--19-september-2026"></a>
<a id="migrations-environments-and-seed-boundaries"></a>

## 6. Architecture and delivery boundaries

The web application remains a Next.js application backed by PostgreSQL/Supabase and Drizzle. A bounded Anchor program owns only the Devnet state that materially benefits from shared, verifiable execution. Profiles, content, search, capacity, schedules and social graph remain off-chain.

The minimum on-chain or transaction-verifiable surface is membership-period activation, payment identity, included check-in identity where required for allocation integrity, and the direct non-core payment receipt. Exact state placement belongs to implementation tickets and must minimize duplication while preserving reconciliation.

The database provider remains Supabase PostgreSQL. The legacy HTML anchors above preserve links from historical tickets; they do not reintroduce superseded product requirements. Inspect the installed Anchor framework, Solana SDK and Next.js versions before integration changes.

DEV0067 is historical evidence for the first private catalogue schema. DEV0078 replaces its obsolete seeded plan drafts through an additive forward migration while preserving shared history. DEV0079 supplies the restricted read-only public projection and replaces plan/gym fixture adapters. COR0007 owns the membership lifecycle, usage, financial evidence, gym/member views and minimal social integration.

Every externally retried activation, payment, check-in and reconciliation operation needs a stable operation identifier. Store pending, submitted, confirmed and failed states where appropriate so a retry cannot silently double-charge or double-count.

## 7. Core multi-gym membership

### 7.1 Versioned plan contract

A plan version needs at least:

```text
price_eurc
period_policy
access_model
included_checkins
max_included_checkins_per_day
required_core_gym_count
non_core_member_price_eurc
effective_from / effective_to
```

Basic has `access_model = limited`, `included_checkins = 10` and `max_included_checkins_per_day = 1`. Classic has `access_model = daily_uncapped`, no numerical monthly allowance, and `max_included_checkins_per_day = 1`. Classic must not be represented by a fabricated large allowance.

Past purchases retain the plan terms accepted at activation even if later catalogue versions change.

For the hackathon, the catalogue is read-only at runtime. Reviewed migrations and deterministic seed data define participating gyms, plan versions and eligibility. Operator editing, catalogue write APIs and administration screens are deferred until platform-versus-gym management authority is designed.

### 7.2 Membership-period contract

A membership period needs at least:

```text
member_account
member_wallet used for payment
plan_version
selected_gym_ids[4]
starts_at / ends_at
included_checkins_used
last_included_service_date
payment_status
membership_status
activation_operation_id
```

The four gym identifiers must be distinct, active and eligible for the selected plan at activation. Draft selection can change before payment. Under P17, an activated selection cannot change during that period.

### 7.3 Activation

The member reviews the exact plan version, selected gyms, price, period and wallet before approving a Devnet-EURC transaction. The application records an intent before submission, verifies the confirmed transaction against the expected mint, amount, source, destination and operation, and then activates exactly one period. Cancellation or failure leaves no active membership. A retry reuses or safely reconciles the same operation rather than creating a second membership or payment. If a submitted payment was classified as `verification-failed`, reconciliation may recover it only after rerunning the complete finalized-chain verification against the same immutable quote and transaction signature; wallet cancellation, on-chain rejection and superseded operations remain terminal.

### 7.4 Included check-ins

An included check-in is valid only when:

- the membership period is active at the service time;
- the venue is one of the period's four selected gyms;
- capacity/reservation requirements are satisfied;
- authorized staff for that venue confirms the member's presence;
- the check-in identifier has not already been consumed;
- the plan's daily rule is satisfied; and
- Basic still has an included check-in remaining.

The venue's configured timezone determines the service date. The one-per-day rule applies across the membership's four gyms, not once per gym. A valid Basic check-in increments `included_checkins_used`; a valid Classic check-in records usage without decrementing a synthetic allowance. Invalid, duplicate, stale, wrong-venue, exhausted or second-same-day attempts do not change usage or allocation.

For arrival, the member creates or resumes one opaque request bound to the active membership, selected venue and optional reservation. The presentation code expires after 15 minutes and contains no personal or financial data; the server stores only its cryptographic hash. The code helps authorized same-venue staff retrieve the request; it is not proof of presence by itself. Staff authority comes from the email-authenticated actor's active `manager` or `check_in_staff` venue relation in the same demo dataset, not from a club-wallet signature.

### 7.5 Provisional allocation

For a stated demo period and distributable test pool, show:

```text
gym provisional share = distributable pool
                      × valid included check-ins at that gym
                      ÷ all valid included check-ins in the allocation scope
```

The UI must identify the period, pool and allocation scope and label the result **provisional**. Zero-check-in and partially used memberships remain visible as unresolved pool value under P16. No gym can claim or withdraw this figure in the MVP unless a later confirmed settlement decision and implementation ticket explicitly adds that capability.

### 7.6 No transfer lifecycle

A membership period belongs to the activating member for its duration. There is no sender, recipient, transfer eligibility, transfer fee, acceptance, resale price, transferred remainder or ownership mutation in the current contract.

## 8. Reservations and member-priced visits

Membership eligibility does not guarantee space in a class. A member may reserve a future scheduled class at one of the four selected gyms when the full session lies inside the active period. A reservation progresses from `reserved` to exactly one terminal state: `cancelled`, `checked_in` or `no_show`. A cancelled reservation records whether the member cancelled it or the underlying class session was cancelled. `expired` is not a reservation state; it applies only to the short-lived arrival request.

Reservation atomically holds one seat and creates a daily-access claim in `held` state for the membership and immutable venue-local service date. Only one `held` or `consumed` claim may exist for that membership/date across all four selected gyms. Basic also treats each held claim as one unavailable included use, so confirmed usage plus active holds cannot exceed ten. Classic has no numerical monthly hold but uses the same daily claim. Reserving does not create attendance or an allocation input.

For the hackathon, a member may cancel before the session begins; cancellation releases the seat and changes the daily-access claim to `released`. Cancelling the underlying class does the same with a session-cancellation reason. A reservation still unconfirmed when the class ends reconciles to `no_show` and releases its claim. These terminal states create no attendance, allocation input, fee or allowance penalty. Production cancellation/no-show economics remain unresolved.

A staff-confirmed reservation check-in atomically changes the existing claim from `held` to `consumed`, changes the reservation to `checked_in` and increments Basic confirmed usage exactly once. A venue-only open-gym arrival obtains the same kind of `held` claim through DEV0084 and either consumes it on confirmation or releases it when the arrival request is cancelled or expires. The shared claim is the serialization boundary between reservation and open-gym attendance; it is not itself proof of attendance.

An active member may purchase a visit at a participating gym that is not one of their four selected gyms when that venue supports the member price and has capacity. The illustrative €15 Devnet-EURC payment goes directly to the destination gym's authorized wallet. The system verifies the payment before confirming paid eligibility, uses an idempotent operation ID, and records the attendance separately from included usage. It does not decrement Basic, affect the daily included-check-in rule or enter the membership allocation pool.

There are no standalone pass, pass-bundle, resale, event or event-ticket objects in this flow.

<a id="8-asset-wallet-and-demo-integrity"></a>

## 9. Asset, wallet and demo integrity

- Use the configured Devnet EURC mint; do not treat arbitrary SPL tokens as EURC.
- Derive expected associated token accounts and verify mint, owner, amount, destination and finalized transaction outcome.
- Show balances with their owner and purpose: personal spendable balance, membership pool balance, direct gym receipt and provisional gym allocation are different values.
- A linked wallet proves control only through an explicit message-signing flow. A gym wallet also requires the authenticated user's stored gym role.
- Client-supplied wallet, actor or gym identifiers never grant authority.
- Persist transaction signatures, operation identifiers and reconciliation state needed to recover after a timeout or page reload.
- Use fictional gyms and clearly labeled demo values. Do not imply a real partnership, production payment, legal entitlement or finalized payout.

<a id="9-social-behavior-and-permissions"></a>
<a id="source-evidence-sharing-and-privacy"></a>

## 10. Social behavior and permissions

The social graph uses one-way follows. Following is idempotent, self-follow is rejected and unfollowing removes only the actor's edge.

The only feed source in scope is a verified included or member-priced gym check-in that the participating member explicitly shares. A feed entry may identify the member, gym, activity label and verified time. It must not disclose payment details, plan price, remaining allowance, private wallet data or provisional allocation.

The Community feed is chronological shared activity visible under the product's public/profile rules. The Following feed is the chronological subset from accounts the viewer follows. A private or unshared check-in appears in neither feed. Revoking sharing removes it from social queries without deleting the underlying attendance evidence.

There are no reactions, comments, reposts, arbitrary text posts, messages, notifications, rankings, challenges or event activity in the MVP.

<a id="10-definition-of-done"></a>

## 11. Definition of done

The pivot is delivered only when all of the following are true:

1. Public positioning and How it works explain the four-gym membership and do not promote removed products.
2. Guests can browse fictional participating gyms and accurate versioned Basic/Classic terms.
3. Email identity, optional personal wallet and separate gym-wallet authority preserve existing security boundaries.
4. A member can select exactly four eligible gyms and activate one period with a verified real Devnet-EURC payment.
5. Authorized check-ins enforce Basic's ten-use allowance, Classic's uncapped monthly use and the shared one-included-check-in-per-day rule.
6. Member and gym views show correct private usage state and a clearly provisional allocation.
7. An eligible non-core member visit produces a verified direct Devnet-EURC gym payment without changing included allowance or pool allocation.
8. Capacity, duplicate submission, failed transaction, timeout and reload paths preserve recoverable, idempotent state.
9. Members can follow accounts and explicitly share verified check-ins; hidden/private activity does not leak.
10. Transfer, pass, resale, event, sponsorship, challenge and reaction controls are absent from the current product experience.
11. Automated checks cover authorization, state transitions, uniqueness/concurrency and reconciliation; responsive and keyboard flows are rehearsed.
12. The staged demo preserves durable evidence across reloads and uses fictional partners plus clearly labeled Devnet values.

<a id="11-delivery-milestones"></a>

## 12. Delivery milestones

<a id="m0--foundation-and-frozen-product-contracts"></a>

### M0 — Contract and truthful positioning

- Adopt this specification and flat delivery coordination.
- Rewrite public positioning around one multi-gym membership.
- Remove controls and promises for superseded products.

### M1 — Participating gym and plan catalogue

- Add versioned Basic/Classic plan data and plan-eligible fictional gyms.
- Expose public read models without leaking drafts or protected operations.
- Replace the legacy real-world fixture and obsolete Annual Unlimited/Flex 12 drafts.

### M2 — Membership period and activation

- Implement four-gym selection and immutable activated-period terms.
- Implement idempotent Devnet-EURC membership activation and reconciliation.
- Add the member access view.

### M3 — Check-ins, member-price access and allocation

- Implement capacity-aware reservation and authorized included check-ins.
- Enforce plan and daily rules under concurrency.
- Implement direct non-core payment and attendance.
- Show transparent provisional gym allocation and gym-scoped operations.

<a id="m4--social-loop-and-demo-delivery"></a>

### M4 — Minimal social and integrated demo

- Deliver follows and explicitly shared verified check-ins.
- Complete recovery, privacy, responsive, keyboard and persistent staging rehearsals.
- Record end-to-end Devnet evidence without claiming production readiness.

<a id="12-acceptance-matrix"></a>

## 13. Acceptance matrix

| ID  | Scenario and expected result                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | A guest sees only published fictional gyms and accurate Basic/Classic terms; drafts and private operations are absent.                                                                               |
| A02 | Selecting fewer or more than four gyms, the same gym twice, an inactive gym or a plan-ineligible gym cannot activate a membership.                                                                   |
| A03 | A valid four-gym selection and verified Devnet-EURC payment creates exactly one active period with snapshotted terms.                                                                                |
| A04 | Cancelling or failing the wallet approval creates no active period and a safe retry cannot double-charge or duplicate access.                                                                        |
| A05 | A Basic member completes ten valid included check-ins; an eleventh attempt is rejected without usage or allocation mutation.                                                                         |
| A06 | A Classic member can continue checking in across the period without a monthly numerical allowance.                                                                                                   |
| A07 | Basic and Classic both reject a second included check-in on the same venue-local calendar day.                                                                                                       |
| A08 | A check-in at a gym outside the selected four cannot use included membership access.                                                                                                                 |
| A09 | Unauthorized staff, wrong-gym staff, stale/terminal reservations, expired arrival codes, duplicate identifiers and expired memberships cannot confirm included usage.                                |
| A10 | Concurrent attempts for the last Basic use, final class seat or same-day reservation/open-gym access produce at most one successful mutation; retries cannot duplicate a seat or daily-access claim. |
| A11 | Every valid included check-in changes the correct usage total and provisional allocation input exactly once.                                                                                         |
| A12 | The displayed provisional shares reconcile to the declared distributable pool and usage scope within explicit rounding rules.                                                                        |
| A13 | A zero-use or partially used membership leaves value labeled unresolved in the test pool and creates no invented MovX revenue or gym payout.                                                         |
| A14 | An active member pays the configured price at an eligible non-core gym; the verified payment reaches that gym and does not alter included usage or the pool.                                         |
| A15 | A non-member, inactive member, selected-core-gym attempt, unsupported venue, full session or failed direct payment cannot produce paid non-core eligibility.                                         |
| A16 | Gym staff see only their gym's attendees and provisional allocation; they cannot view or mutate another gym's private data.                                                                          |
| A17 | Following and unfollowing are idempotent, self-follow is rejected and one member cannot mutate another member's choices.                                                                             |
| A18 | Only an explicitly shared verified check-in appears in Community/Following queries, in chronological order and without private financial data.                                                       |
| A19 | Revoking sharing removes social visibility while preserving attendance and financial evidence.                                                                                                       |
| A20 | Current routes and controls contain no membership transfer, pass/resale, event/sponsorship, challenge or reaction action.                                                                            |
| A21 | Legacy records and migrations remain replayable while forward changes prevent obsolete drafts from becoming the published product.                                                                   |
| A22 | Home, Explore, setup, access, guide, social and gym workspace are usable at representative mobile/desktop widths and with keyboard navigation.                                                       |
| A23 | Every payment uses the configured Devnet EURC mint and verifies expected source, destination, amount and confirmed outcome.                                                                          |
| A24 | Reloading or retrying a submitted activation, reservation, direct payment or check-in reconciles the same operation without double effects.                                                          |
| A25 | Member/session cancellation before class start or reconciling a no-show releases the reserved seat and daily-access claim without attendance, allocation input, fee or allowance loss.               |

## 14. Demonstration path

1. A guest understands one product: choose four gyms and use one membership.
2. A member signs in, compares Basic and Classic, and selects four of seven fictional participating gyms.
3. The member activates Basic with a real Devnet-EURC payment and sees ten included check-ins.
4. The member reserves an eligible class at a selected gym; one seat and one Basic use are held without claiming attendance.
5. At arrival, the member presents the short-lived code and authorized same-venue staff confirm presence; the held use becomes confirmed, the member sees nine remaining and one allocation input exists.
6. A duplicate or second same-day included attempt is rejected without another decrement.
7. The member visits another participating gym outside the core set, approves the illustrative €15 direct payment and receives separately recorded attendance.
8. Gym staff see their scoped visits and provisional allocation, not another gym's or member's private financial state.
9. The member explicitly shares one verified check-in; a follower sees it chronologically and no reaction control appears.
10. A reload shows the same confirmed membership, payments, usage and sharing state.

## 15. Deferred work

The following require later product validation and new development tickets: production membership renewal and cancellation, refunds and chargebacks, finalized gym settlement or claims, legal and tax treatment, platform pricing, real partner onboarding, transfer or resale, standalone passes, events and sponsorship, richer social features, production wallets/payments and any collectible or tokenized access.
