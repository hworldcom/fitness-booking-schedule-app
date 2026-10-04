# MovX Club — Coach-pass and group-funded marketplace MVP specification

Last updated: 4 October 2026.

MovX is a two-sided marketplace where clients discover martial-arts coaches and pay for coach-led training. The first hackathon loop is intentionally simple: a coach publishes a one-session or ten-session offer, a client buys credits with test USDC and uses one credit to reserve a session from that coach's calendar. The second loop is conditional group funding: participants fund seats, a program-controlled vault pays the coach only when the published minimum is reached, and an underfunded event gives every contributor an individually enforceable refund.

Coach profiles, public locations, availability, calendar occurrences, booking records, cancellation decisions, client requests, coach proposals, event descriptions and social content remain in the application layer. Solana owns immutable coach offers, exact pass payment, aggregate coach-client credits and group-funding value movement. The superseded multi-gym membership remains historical context and does not define current behavior.

## 1. Product status and document authority

This is the single current product contract for the MovX Club hackathon MVP. It defines the target and does not claim that every target flow is implemented.

The repository already contains reusable Next.js, Supabase/PostgreSQL, email identity, Wallet Standard and Cloudflare staging foundations. Persistent coach profiles, fictional-gym or independent public locations, list discovery, recurring one-hour availability, the responsive coach calendar, follows, chronological coach posts and the PostgreSQL credit-backed booking/client-card projection workflow are implemented. The local `CoachAuthority`/`Offer` program contains a coach-client credit ledger, exact first/subsequent purchase instructions and deterministic per-booking reserve/return/consume receipts, with passing source, generated-client and adversarial compiled-SBF Surfpool checks; its platform-payer revision and Devnet evidence remain open. Mapbox operational validation and personal-wallet rehearsal also remain open. The client-card interface, client requests, coach proposals, group events, conditional funding and the hosted integrated rehearsal remain unfinished under [COR0010](../tickets/current/organisatory/COR0010-group-funded-coach-marketplace-mvp.md).

Completed and cancelled tickets are historical evidence. Neither a ticket, external brief nor prototype overrides this specification. [DEV0117](../tickets/archive/organisatory/DEV0117-adopt-group-funded-coach-marketplace-mvp.md) records the earlier group-funding-only decision; [DEV0126](../tickets/archive/organisatory/DEV0126-adopt-coach-pass-and-group-funding-contract.md) records the later user decision that restored a new, smaller pass implementation without rewriting that history.

<a id="confirmed-target-and-decisions"></a>

## 2. Confirmed target and decisions

| ID  | Confirmed decision                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C01 | The target is a focused Solana Devnet hackathon demonstration, not a production escrow, financial, ticketing or general-purpose scheduling service.                                                                                                                                                          |
| C02 | MovX is a two-sided marketplace: clients discover coaches, buy coach-specific credits, book calendar sessions and may publish training requests; coaches publish profiles, pass offers, availability, proposals and group events.                                                                            |
| C03 | Public terminology uses **coach**, **client**, **pass credit**, **booking**, **training request**, **proposal**, **group event**, **seat funding** and **refund**. A coach may be independent or associated with one fictional gym location.                                                                 |
| C04 | One email-code account may act as a client and may self-activate coaching. Email identity, coaching activation, public-profile visibility and personal-wallet ownership remain separate authority boundaries.                                                                                                |
| C05 | Profiles, locations, availability, bookings, cancellation decisions, requests, proposals, event descriptions/media, follows and posts are authoritative off-chain. They never manufacture on-chain credits, contributions, payouts or refunds.                                                               |
| C06 | A coach publishes immutable public or wallet-restricted offers for exactly one or ten credits. The offer freezes exact test-USDC price, current recipient, purchase window and authority epoch; purchased P0 credits do not expire.                                                                          |
| C07 | The official configured Devnet test-USDC mint is the only payment asset. Test SOL is used only for transaction fees and account deposits, all of which the MovX platform funds for MVP transactions. No production asset or real-money claim is supported.                                                   |
| C08 | One stable `CoachAuthority` PDA represents each coach. One bounded `CoachClientCredits` PDA per coach/client pair stores aggregate available/reserved credits, purchase totals and the next purchase nonce; there is no unbounded client map inside the coach account.                                       |
| C09 | A pass purchase atomically transfers the offer's exact test-USDC price to a token account owned by the current coach recipient and adds exactly one or ten credits. Lost responses recover from the pair ledger and nonce rather than blind resubmission.                                                    |
| C10 | Test USDC is transferred into a token vault controlled by the program, not the coach or MovX. The vault may pay only the immutable coach recipient after successful settlement or refund eligible contributors after failed settlement.                                                                      |
| C11 | After the immutable funding deadline, settlement is permissionless and deterministic: participant count at or above the minimum produces `Succeeded`; a lower count produces `Failed`. No caller, coach or MovX administrator chooses the result.                                                            |
| C12 | Solana programs do not execute automatically at a deadline. A participant, coach, other caller or bounded MovX reconciler submits settlement, payout or refund transactions; retries converge on existing state.                                                                                             |
| C13 | A succeeded pool permits one coach payout of the vault's funded seat total. A failed pool prohibits coach payout and lets each contributor claim exactly one refund. Refunds are pull-based per contribution rather than an unbounded all-participant loop.                                                  |
| C14 | Coach no-show, attendance proof, service-quality disputes, chargebacks and post-payout reversals are deliberately outside the hackathon contract. The UI must not imply that the chain proves a private session or group event occurred.                                                                     |
| C15 | Guests may browse public coaches, pass offers, availability, requests where permitted, selected proposals, group events and posts. Sign-in is required to buy/book/cancel, create a request/proposal/event, follow or fund; value movement also requires the linked connected wallet.                        |
| C16 | The accessible coach/event lists remain usable without Mapbox. Mapbox pins represent confirmed public locations, not live tracking, current presence, verification or guaranteed event availability.                                                                                                         |
| C17 | Gyms remain simple fictional public locations. They have no account, wallet, payout, event-administration, membership, access-claim or check-in authority. Independent coaches remain supported.                                                                                                             |
| C18 | MovX funds all MVP Solana transaction fees and rent-exempt account deposits through a bounded platform payer, so clients, coaches and participants need no test SOL. They still sign their actions and transfer the exact required test USDC; sponsorship grants no business, recovery or upgrade authority. |
| C19 | The existing recurring one-hour coach calendar supplies capacity-one private booking occurrences. One available coach credit is reserved for one booking. A group event has its own schedule/capacity and remains a separate flow.                                                                           |
| C20 | One-way coach follows, coach-authored posts and the chronological Following feed remain a lightweight network loop. Funding never silently follows a coach.                                                                                                                                                  |
| C21 | Each coach publishes an early-cancellation cutoff, such as 24 hours. Cancellation before it automatically returns one reserved credit; a later request returns it only when that coach approves, otherwise the credit remains spent.                                                                         |
| C22 | A coach may create a scheduled group event with immutable full-seat test-USDC price, minimum/maximum participants, deadline and payout recipient. This second feature uses one exact seat payment rather than a partial deposit plus another rail.                                                           |
| C23 | Each confirmed booking has one bounded deterministic `CreditReservation` PDA. Reserve moves one credit from available to reserved; exactly one authorized terminal transition either returns it to available or consumes it at/after the session start. The retained receipt prevents replay.                |
| C24 | Coach/gym splitting, attendance proofs, referrals, funded requests, waitlists, pass transfer/resale, subscriptions, reactions, comments, direct messages, reviews and rankings are deferred.                                                                                                                 |

### Proposed implementation defaults

- P0 pass purchases use separate first/subsequent instructions rather than `init_if_needed`; the platform payer funds pair-account rent and the transaction fee while the client remains the payment/credit authority and supplies the exact test USDC.
- P0 bookings use one credit and one exact one-hour occurrence. PostgreSQL owns schedule/cancellation workflow, while program instructions must make reserve/consume/return transitions atomic and replay-safe.
- P0 group events should use one seat per wallet, reject a second contribution from the same wallet/event pair and use small bounded capacities suitable for a deterministic demo; DEV0121 must adopt or replace that cardinality rule and freeze exact minimum/maximum limits before implementation.
- Funding must close before the scheduled event begins. DEV0121 must freeze timestamp bounds and overflow-safe amount/capacity calculations.
- A successful coach payout may become claimable immediately after settlement because post-funding delivery disputes are out of scope.
- Any account may call deterministic settlement so the flow does not depend on a privileged scheduler. The application may also reconcile on page load or through a bounded job.
- Event images may use the existing application media path; permanent or content-addressed media is not required for the hackathon.

An owning development ticket must adopt or replace each proposed default before implementation.

## 3. Actors and authority

### Guest

A guest can browse fictional coaches, their selected public locations, public pass offers, availability, group events and posts. Public training requests expose only the bounded fields deliberately published by their author. A guest cannot buy, book, cancel, fund, request, propose, create, settle through a protected application action or see private proposal state.

### Client

A client has an email-backed MovX account and may link one personal wallet through explicit signed-message proof. The client can buy one or ten credits from a coach, reserve a capacity-one calendar occurrence, request cancellation, create a training request, receive proposals, fund one group-event seat and recover that contribution when its pool fails. The application account does not replace the wallet signature required for value or credit authority.

### Coach

A coach is also a client and explicitly activates coaching without administrator approval. Activation permits profile setup but is not credential verification. The coach chooses one public discovery location, manages recurring availability, publishes one/ten-credit offers and a cancellation cutoff, sees authorized cards for clients who bought from them, decides late cancellation requests, responds to training requests and creates group events. The linked current wallet authorizes pass terms, receives pass payments and signs EventPool creation; a selected gym receives no financial authority.

### MovX service

MovX stores and authorizes off-chain marketplace data, indexes finalized credit/pool/contribution state for responsive views, constructs bounded transactions, pays their SOL fees and rent deposits through the platform payer, and reconciles ambiguous RPC responses. It cannot invent pass credits, spend or return them outside reviewed authority, withdraw a vault, invent a contribution, change an EventPool result, mark an unrefunded contribution refunded or sign for a coach/client.

## 4. Primary user flows

### 4.0 Register and activate coaching

1. A user verifies one email code and receives the ordinary MovX profile.
2. The user chooses whether to start by finding a coach or offering coaching.
3. Offer coaching records the owner-scoped capability and opens profile setup; it does not verify or publish the coach automatically.
4. An activated coach retains all client capabilities.

### 4.1 Discover coaches and marketplace activity

1. Explore renders an accessible server-backed list of fictional coach profiles, offers and upcoming group events.
2. Search may narrow by discipline, coach, location, offer, event date and funding state.
3. When Mapbox is configured, synchronized pins show the same confirmed public locations; provider failure leaves the lists usable.
4. A coach profile shows disciplines, biography, chosen public location, pass options, recurring availability, upcoming events and recent posts.
5. Database or RPC failure produces an honest unavailable/pending state; fixtures never masquerade as live funding.

### 4.2 Client buys coach credits

1. A signed-in client opens a public one-credit or ten-credit offer, or a wallet-restricted offer created for that client.
2. MovX reads the finalized offer, current coach authority, pair-ledger state and token accounts. The screen shows Solana Devnet, test USDC, exact price, credits, recipient and the MovX platform payer before approval.
3. The client signs one transaction. The platform pays its SOL fee and any account rent; on a first purchase it creates the deterministic coach-client ledger and later purchases reuse it. The same atomic transaction transfers the exact offer price from the client and adds exactly one or ten available credits.
4. Finalized state is verified and indexed. Rejection, wrong account/mint/client, expired or stale offer, insufficient balance, replay or RPC ambiguity cannot invent credits or trigger a blind retry.
5. A restricted offer implements a custom client price on a public chain. It does not make the price confidential.

### 4.3 Client books and cancels a private session

1. A client with an available credit selects one open one-hour occurrence from that coach's calendar.
2. One idempotent operation reserves one credit and the capacity-one occurrence. Concurrent attempts cannot oversubscribe the time or spend the same credit twice.
3. When the client cancels before the coach's published cutoff, the booking is cancelled and one credit returns automatically.
4. A later cancellation becomes `CancellationRequested`. The coach explicitly approves a credit return or denies it; denial keeps the credit spent. Retries and reload recover the same decision.
5. PostgreSQL owns the booking, occurrence and human-readable cancellation workflow. The program owns aggregate available/reserved credit transitions; neither layer fabricates the other's state.

### 4.4 Client publishes a training request and coaches propose

1. A signed-in client creates a bounded request describing discipline, experience, goal, preferred area/times, desired private or group format, optional participant target/budget and expiry.
2. The client controls request visibility and may close it. Sensitive contact data is not published.
3. Eligible coaches respond with a bounded proposal containing format, session/event concept, location, schedule, capacity or sessions, price indication and an optional message.
4. Only the request owner and proposing coach can see private proposal details. Choosing a proposal records an off-chain marketplace decision; it does not move funds.
5. A coach may use an accepted group proposal as the basis for creating one immutable EventPool, but browser-supplied proposal fields are never on-chain authority.

### 4.5 Coach creates a group event

1. The coach creates off-chain event details: title, discipline, description, location, start/end and optional image.
2. The coach chooses the exact full-seat test-USDC price, minimum/maximum participants and funding deadline.
3. The application validates identity, linked wallet and bounded terms, derives the EventPool/vault addresses, simulates the complete Devnet transaction and shows network, price, capacity, deadline, recipient and accounts before approval.
4. The coach signs once. Finalized chain state is verified before the event is presented as fundable; metadata is keyed to the EventPool address.
5. Financial terms are immutable. A failed or rejected creation produces no fundable event.

### 4.6 Client funds one seat

1. A signed-in client opens an active event and sees the coach, schedule, location, exact test-USDC price, participant progress, minimum/maximum, deadline, refund rule, network and vault-backed funding status.
2. MovX reads finalized EventPool state and the client's token account; it never trusts a browser-supplied amount, mint or recipient.
3. The transaction is simulated and summarized before approval.
4. The client signs one transaction that transfers exactly one seat price into the vault and creates exactly one Contribution PDA.
5. Finalized state is indexed. Wallet rejection, wrong mint/amount, expired funding, full capacity, duplicate contribution or RPC ambiguity produces a bounded failure/recovery state and no invented participation.

### 4.7 Settle a successfully funded event and pay the coach

1. At or after the funding deadline, any caller submits settlement.
2. The program compares finalized participant count with the immutable minimum and records `Succeeded` when the threshold was reached.
3. Only the frozen coach authority can claim, and only the immutable payout recipient receives the exact funded vault amount.
4. One payout changes the pool to `Paid`; replay or a different recipient cannot pay twice.
5. MovX refreshes event and contribution projections from finalized chain state.

### 4.8 Settle an underfunded event and refund participants

1. At or after the deadline, settlement records `Failed` when participant count is below the immutable minimum.
2. Coach payout is permanently unavailable.
3. Each contributor may submit a refund for their Contribution PDA. The program returns exactly the original amount to that participant's valid token account and marks the contribution refunded.
4. One participant's refund does not require or block another's. A replay, unrelated wallet or altered destination cannot refund twice.
5. MovX pays the transaction fee and any account rent and may submit it, but the participant still authorizes the refund and the program decides eligibility and amount.

### 4.9 Follow and feed

1. A signed-in client follows or unfollows a coach explicitly.
2. A coach publishes a bounded text post with an optional image.
3. The public recent-post view and signed-in Following feed remain reverse chronological and survive reload.

<a id="marketplace-state-model"></a>

## 5. State model

### CoachAuthority PDA

One stable account identifies the application dataset and coach profile, original/current wallet, recovery authority and authority epoch. Wallet rotation preserves the coach identity while making earlier-recipient offers ineligible for new purchases. It does not rewrite historical payments or grant MovX unilateral coach authority.

### Offer PDA

One immutable coach-scoped offer stores its nonce, exact positive test-USDC base-unit price, session count restricted to `1 | 10`, payment recipient, configured mint, authority epoch, creation time, optional purchase-window duration, optional restricted client and `Active | Deactivated` status. A zero duration means purchasable until deactivation or authority rotation; a positive duration is measured from creation and controls purchase eligibility, not expiry of credits already bought.

### CoachClientCredits PDA

One bounded account is derived from `(coach_authority, client_wallet)`. It stores version, coach/client keys, available credits, reserved credits, total purchased, purchase count, next purchase nonce, last offer, last purchase time and reserved layout space. First purchase creates it; later purchases update it. This replaces an unbounded coach-side client map and gives the application a deterministic chain record for each paying relationship.

### CreditReservation PDA

One fixed-size receipt is derived from `(coach_client_credits, booking_uuid)` for each actual booking. It snapshots the pair ledger, coach/client keys, application booking UUID, scheduled start and early-return cutoff, then moves through `Reserved` to exactly one of `Returned | Consumed`. Reserve moves one credit from available to reserved. Early client return or coach-authorized return restores it; coach-authorized consume removes it from reserved only at or after the scheduled start. A denied late cancellation remains reserved until then. The terminal receipt remains in P0 so the same booking cannot reserve or resolve twice. PostgreSQL still decides whether the referenced capacity-one occurrence and cancellation workflow are valid and confirms a booking only after the finalized receipt matches its prepared snapshot.

### Off-chain private booking

Minimum fields: client profile, coach profile, dated one-hour occurrence, chain credit operation/reference, cancellation cutoff snapshot and lifecycle such as `Pending | Confirmed | CancellationRequested | Cancelled | Completed | Denied`. Database uniqueness prevents capacity-one overlap. Final status and chain credit projection must reconcile after ambiguous operations; a database row alone cannot create or return a credit.

### Coach client-card projection

The coach workspace joins the public pair-ledger address/balances with coach-authorized client display identity and relevant booking history. It is a projection, not another chain account and not a permission to expose unrelated profile/contact data.

### Off-chain request

Minimum fields: owner, discipline, experience level, goal, preferred area, preferred days/times, private/group preference, optional participant/session target, optional budget, visibility, expiry and `Open | Closed | Matched` status. The exact schema and privacy projection belong to DEV0118.

### Off-chain proposal

Minimum fields: request, coach, format, bounded description/message, proposed schedule/location, capacity or sessions, price indication, expiry and `Pending | Selected | Declined | Withdrawn` status. Selection is not payment authority.

### Off-chain group event

Minimum fields: coach profile, EventPool address, title, discipline, description, confirmed public location snapshot, start/end, optional image and publication state. Finalized chain state supplies price, capacity, deadline, participant count and funding outcome.

### EventPool PDA

The implementation must freeze at least program version, coach authority, payout recipient, official test-USDC mint, vault, nonce, price per seat in base units, minimum/maximum participants, current count, funding deadline, event start/end, lifecycle status and bumps/reserved space. Candidate lifecycle:

```text
Funding -> Succeeded -> Paid
       \-> Failed
```

No off-chain edit may move an EventPool backward or override its financial state.

### Contribution PDA

The implementation binds one participant, EventPool and exact paid amount. Candidate state is `Funded | Refundable | Refunded | Successful`; the program may derive refundability from the pool rather than duplicate it. One wallet cannot create a second contribution for the same pool in P0.

### Vault

The vault is an SPL Token account for the configured official Devnet test-USDC mint whose authority is a PDA controlled by the reviewed program. Every transfer checks account owner, mint, token-program variant, authority, amount and destination. Vault balance and recorded liabilities must remain consistent.

## 6. Application and infrastructure boundaries

- Next.js/browser code renders, validates input, summarizes transactions and requests wallet signatures; it is not financial authority.
- Server code enforces application identity/authorization, builds authoritative operation records, applies the bounded platform-payer policy, uses credentialed RPC only server-side and reconciles finalized state.
- PostgreSQL stores marketplace content, bookings, cancellation decisions and indexed projections. It cannot create/return credits or mark a pool paid/refunded without finalized matching chain evidence.
- Supabase Auth establishes email identity; it does not prove wallet ownership.
- Wallet Standard establishes the connected signer; connection alone grants no application role.
- Mapbox is an optional client-side map adapter. The list and funding state do not depend on map availability.
- Cloudflare Workers serves staging but must not expose sponsor keys, credentialed RPC URLs or other secrets.

<a id="purchase-and-redemption"></a>
<a id="event-funding-and-recovery"></a>

## 7. Pass purchase, booking and event-funding recovery

Every chain mutation uses an idempotent operation/reference boundary. The application simulates before signature, summarizes cluster/token/amount/authority/platform payer, persists no secret, verifies finalized account ownership/discriminators/state and treats RPC data as untrusted. The platform pays transaction fees and rent deposits, but the required user wallet still authorizes the marketplace action and any exact test-USDC movement.

Pass purchase uses a monotonic nonce stored in the coach-client ledger. The first-purchase instruction must fail when that PDA already exists; the subsequent instruction must reject any nonce other than the exact next value. This makes a lost response recoverable by reading the account. Payment and credit addition happen in one transaction and therefore both commit or both roll back.

Booking mutations use separate reviewed reserve, consume and return transitions rather than trusting a browser balance. PostgreSQL coordinates occurrence capacity and cancellation decisions through idempotent operations; finalized chain state supplies the credit projection. A coach client card is allowed to join those records for display but cannot alter either authority.

The deadline alone does not send a transaction. Settlement is safe for any caller because the program reads the on-chain clock and immutable pool terms. A bounded reconciler improves responsiveness but is not trusted with the outcome.

Payout and refund are mutually exclusive. Successful settlement disables refunds and failed settlement disables coach payout. A participant claims only their own contribution, allowing capacity to remain bounded without placing every contributor account in one transaction. An ambiguous submission is recovered from pool/contribution state and transaction reference before another mutation is offered.

The program does not prove attendance or satisfactory service. For the hackathon, successful threshold settlement is the complete financial rule; disputes, no-shows, post-payout reversal and production consumer protection require a later contract.

<a id="asset-wallet-and-demo-integrity"></a>

## 8. Asset, wallet and demo integrity

- Every pass-payment or funding screen says **Solana Devnet** and **test USDC**, and displays exact amount, credits or pool/outcome rule, recipient/vault and the MovX platform payer; it states that the user needs test USDC but no test SOL.
- Wallet connection, email identity and linked-wallet proof remain visibly distinct.
- Credentialed RPC URLs, sponsor keys and deployment/upgrade keys remain server/operator secrets.
- The demo uses fictional coaches, locations, requests and events and implies no real partnership.
- CoachAuthority, CoachClientCredits, EventPool and Contribution PDAs appear inside MovX and may link to Explorer; no NFT or Phantom collectible is promised.
- Prepared demo wallets, pools and contributions may be seeded through a documented bounded rehearsal process, but no primary-path outcome may require manual database or chain-account editing.
- The demo can be reset/reseeded without touching production or mainnet.

<a id="social-behavior-and-permissions"></a>

## 9. Social behavior and permissions

Guests can read public coach profiles and posts. Signed-in clients can follow/unfollow coaches. Only a coach can create/manage that coach's posts. The Following feed is reverse chronological and contains coach posts only.

Posts require bounded text and may reference one validated image. Reactions, comments, direct messages, stories, participant groups, client posts, recommendations and complex moderation are excluded. Social state never changes funding eligibility or vault state.

## 10. Security and failure invariants

- Only the authenticated linked coach wallet may publish/deactivate that coach's offers or create an event; only the EventPool's coach authority may claim its successful payout.
- The platform payer may fund fees and rent only. Its signature cannot replace a client, coach, participant, recovery or deployment/upgrade authority, and sponsor refusal cannot create partial product state.
- Only the configured official Devnet test-USDC mint and reviewed token program are accepted.
- Offer price, credit count, purchase window, recipient and restriction are immutable; group price, capacity, deadline, event time and recipient are immutable.
- First purchase creates exactly one pair ledger; subsequent purchase requires its exact next nonce. Wrong client, offer state/epoch/recipient, token authority, mint, decimals, destination or replay fails without payment.
- Pair-ledger arithmetic keeps `available + reserved` consistent with purchase and booking transitions; checked arithmetic rejects overflow.
- Capacity-one booking, cancellation cutoff snapshot and coach late-cancellation decision remain authorized/idempotent off-chain records and must reconcile to finalized credit state.
- Checked arithmetic prevents capacity and amount overflow.
- Funding after deadline, above maximum capacity or twice from one wallet fails without moving funds.
- Settlement before deadline fails; settlement after deadline is deterministic and idempotent.
- Success and failure are mutually exclusive terminal outcomes; payout and refund cannot both succeed.
- Wrong participant, amount, mint, vault, recipient, authority, contribution or replay fails without value loss.
- Final verification checks expected program/token account ownership, data length, discriminators and finalized state.
- RPC, index or browser failure never fabricates a credit, booking transition, contribution, outcome, payout or refund.

## 11. Definition of done

The MVP is complete only when:

- guests can discover fictional coaches, pass offers and public group events through accessible lists, with synchronized Mapbox pins when available and an honest list fallback when not;
- one email-backed account can act as a client and can self-activate coaching without conflating application and wallet authority;
- an authorized coach can publish one-credit and ten-credit offers, including one wallet-restricted custom-price example;
- a linked client wallet can buy a pass with exact test USDC and recover the same deterministic pair ledger after reload without duplicate payment;
- every demonstrated client, coach and participant chain action uses the platform payer for SOL fees and rent without granting it product authority or requiring test SOL in a user wallet;
- the same client can reserve one open calendar occurrence with one credit, receive an automatic early-cancellation return and submit a late cancellation for coach approval/denial;
- a coach can see one authorized client card whose available/reserved credits and bookings match chain/database authority;
- a client can publish one bounded training request and at least two coaches can respond with private authorized proposals;
- a selected proposal can lead to a coach-created public group event without making off-chain proposal fields financial authority;
- an authorized coach can create a fundable EventPool with exact immutable test-USDC price, minimum/maximum, deadline, schedule and recipient;
- a linked participant wallet can fund exactly one seat and receive exactly one matching Contribution PDA;
- a prepared pool below threshold settles to `Failed`, rejects coach payout and allows each demonstrated participant to reclaim exactly their contribution once;
- a prepared pool reaching threshold settles to `Succeeded` and pays the immutable coach recipient exactly once;
- wrong signer/client/mint/amount/token owner/recipient/nonce, duplicate credit operation/contribution, full capacity, early/duplicate settlement, payout/refund conflict and replay paths are tested;
- RPC ambiguity and reload recover existing finalized state rather than repeating value movement;
- booking/cancellation/request/proposal/event/profile/follow/post authorization and privacy survive reload;
- no legacy membership or fixture-only pass/group-funding state masquerades as current live state;
- relevant unit, database, authorization, program, Surfpool, static, build and responsive browser checks pass;
- one hosted 2–3 minute staging/Devnet rehearsal completes with public transaction/account evidence and no manual repair.

## 12. Delivery milestones

1. **M0 — Contract and truthful story:** adopt this specification and update public product language around coach passes first and group funding second.
2. **M1 — Reusable identity/discovery/network:** retain coach profiles, locations, recurring availability, list/Mapbox discovery, personal-wallet linking and coach social behavior.
3. **M2 — Local coach-pass purchase:** extend CoachAuthority/Offer with one pair ledger per paying relationship and exact atomic one/ten-credit test-USDC purchases.
4. **M3 — Credit-backed booking:** persist capacity-one bookings, coach cutoff policy, automatic early return, late coach decision and authorized client-card projection.
5. **M4 — Pass interface and demand:** present pass/payment/booking/client-card flows and persist optional client requests/coach proposals.
6. **M5 — Group-event catalogue and local pool:** persist group-event metadata and implement/test EventPool, Contribution, vault, settlement, payout and pull refunds.
7. **M6 — Devnet integration:** integrate simulation, wallet approvals, bounded sponsorship, finalized verification, indexing and lost-response recovery for both value loops.
8. **M7 — Hosted rehearsal:** deploy and prove one pass/booking/cancellation/client-card loop plus successful and failed group funding on staging with public Devnet evidence.

Gym accounts/payouts, coach/gym splitting, attendance proofs, production escrow/disputes, referrals, funded requests, multi-seat event wallets, waitlists, pass transfer/resale and group chat require separately reviewed later tickets.

## 13. Acceptance matrix

| Scenario                              | Expected result                                                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest opens Explore                   | Fictional coach, pass-offer and event lists load without sign-in; configured Mapbox pins match confirmed locations and failure leaves lists usable. |
| New user activates coaching           | The verified owner gains coach setup capability while retaining client behavior; no wallet or public visibility is inferred.                        |
| Coach publishes pass offer            | Immutable active offer contains current authority epoch/recipient, exact positive test-USDC price, `1                                               | 10` credits and optional client restriction. |
| Client makes first purchase           | Exact test USDC reaches a coach-owned token account and one deterministic pair PDA records the exact available credits and next nonce atomically.   |
| Client purchases again                | The same pair PDA accumulates credits/totals and advances one nonce; no second relationship account is created.                                     |
| Wrong/replayed pass purchase          | Wrong client/mint/decimals/source/destination/offer/nonce fails without payment or credit mutation.                                                 |
| Client books one open time            | Capacity-one occurrence becomes booked and exactly one coach-specific credit moves to the reviewed reserved/spent state.                            |
| Client cancels early                  | Booking is cancelled and exactly one credit returns automatically before the frozen coach cutoff.                                                   |
| Client cancels late                   | Request waits for the coach; approval returns one credit, denial leaves it spent, and retries cannot decide twice.                                  |
| Coach opens client cards              | Only that coach sees authorized client identity plus correct pair balance and relevant bookings; unrelated contact/profile data remains private.    |
| Client creates request                | One bounded request owned by that client persists with reviewed visibility and no public contact leakage.                                           |
| Coach proposes                        | Only an activated eligible coach creates a proposal; request owner and proposing coach see private details.                                         |
| Unrelated user reads private proposal | Access fails without exposing content.                                                                                                              |
| Coach creates valid pool              | EventPool/vault contain the expected immutable mint, price, minimum/maximum, deadline, schedule and recipient; metadata references its address.     |
| Unauthorized user creates pool        | Transaction/application mutation fails without a fundable event.                                                                                    |
| Participant funds seat                | Exact test USDC enters the expected vault and one Contribution PDA records the participant/amount.                                                  |
| Same wallet funds again               | Program rejects without a second transfer or contribution.                                                                                          |
| Funding is late or pool is full       | Program rejects without moving funds.                                                                                                               |
| Settlement is early                   | Program rejects and leaves `Funding` unchanged.                                                                                                     |
| Threshold is reached                  | Permissionless settlement records `Succeeded`; refund is unavailable and exact coach payout succeeds once.                                          |
| Threshold is missed                   | Settlement records `Failed`; coach payout fails and each contributor can refund exactly once.                                                       |
| Unrelated wallet requests refund      | Program rejects and leaves contribution/vault unchanged.                                                                                            |
| Payout/refund response is lost        | Reload/reconciliation finds the finalized existing operation and does not repeat the transfer.                                                      |
| Wallet merely connects                | No account, coach role, event, contribution, payout or refund authority is inferred.                                                                |
| Coach posts/client follows            | Authorized state survives reload and the coach post appears chronologically.                                                                        |
| Legacy membership URL is requested    | It is unavailable and cannot mutate current state.                                                                                                  |

## 14. Judge demo

1. A client opens a fictional boxing coach, selects the ten-credit offer and approves one Devnet test-USDC transaction. Reload shows the same `CoachClientCredits` PDA and ten available credits rather than repeating payment.
2. The client books one open calendar occurrence. The coach workspace gains one client card showing the human display identity, nine available credits, one relevant booking and the chain reference. An early cancellation example returns its credit; a prepared late request demonstrates the coach approval/denial rule.
3. The same coach opens a public event for three to six participants at `30` test USDC per seat. Its detail shows two prepared finalized contributions (`2 / 3`); a third live participant funds one seat and reload recovers the finalized Contribution PDA.
4. Any caller settles the prepared elapsed pool to `Succeeded`; the coach claims exactly `90` test USDC once. A second prepared underfunded event settles to `Failed`; one participant reclaims exactly `30` test USDC while payout and duplicate refund fail.
5. The client follows the coach and sees a new coach post. Explorer links expose the offer, pair ledger, EventPool, contributions, settlement, payout and refund evidence.

The demonstration prioritizes one live pass purchase and booking, then one live group contribution with prepared success/failure settlement state so it remains repeatable. It makes no claim that Solana proves real-world attendance or resolves service disputes.
