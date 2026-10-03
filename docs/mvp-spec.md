# MovX Club — Coach-first private-class MVP specification

Last updated: 4 October 2026.

This is the single current product contract for the MovX Club hackathon MVP. MovX connects clients with martial-arts coaches through discoverable profiles, optional fictional gym associations or independent public training locations, capacity-one availability for the coming week, private-class booking, one-session or ten-session passes purchased with test USDC on Solana Devnet, verifiable remaining-session balances and a lightweight coach-led social feed.

The former multi-gym membership, group-class reservation, gym check-in, membership-card collectible and membership-pool payment product is superseded. Reusable foundation/cleanup records, additive migration files and Git history retain the evidence needed by the current implementation; pruned legacy ticket identifiers remain permanently reserved and do not define current behavior.

## 1. Product status and document authority

This specification defines the target behavior. It does not claim that the complete target is implemented.

The repository already contains reusable Next.js, Supabase/PostgreSQL, email identity, Wallet Standard and Cloudflare staging foundations. Personal-wallet linking is implemented locally under DEV0047, but its required real-Phantom and signed-in responsive-keyboard completion evidence remains pending. DEV0101 removed the legacy multi-gym mutation runtime while preserving additive migrations and historical evidence. DEV0109 completed a forward cleanup of its dormant membership/class/check-in schema while preserving simple fictional gym locations. DEV0096 adds persistent self-declared coach profiles, optional fictional-gym affiliations or independent public locations, and list-based public discovery. DEV0104 completes explicit weekly availability and the protected coach workspace, while DEV0100 completes coach follows, public recent posts and the chronological Following feed. Mapbox discovery, on-chain offers, test-USDC pass purchase, private-class booking and completed-session redemption remain unfinished under COR0009 until their owning tickets record implementation and validation evidence.

Retained completed/cancelled records and the compact pruned-identifier register in [the ticket index](../tickets/README.md) identify current work and recoverable history; no ticket or blueprint overrides this specification.

<a id="confirmed-target-and-decisions"></a>

## 2. Confirmed target and decisions

| ID  | Confirmed decision                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C01 | The target is a focused Solana Devnet hackathon demonstration, not a production financial or general-purpose scheduling service.                                                                                                                                                                                                     |
| C02 | The initial supply side is martial-arts coaches offering private training. A coach may be independent or optionally associated with one fictional gym location. Public product terminology remains **coach**, not trainer, gym or club operator.                                                                                     |
| C03 | A coach publishes explicit capacity-one private-class slots for the coming seven days. PostgreSQL is authoritative for availability, temporary holds and bookings; no live availability is fabricated from fixtures after a database failure.                                                                                        |
| C04 | A coach can publish a public or client-specific one-session or ten-session pass offer with an immutable test-USDC price, validity policy and payment recipient. To change commercial terms, deactivate the offer and create a new one.                                                                                               |
| C05 | A guest may discover coaches, profiles, public offers and open slots without signing in. Following and booking require an application account; purchasing also requires the account's linked and connected personal wallet.                                                                                                          |
| C06 | The configured official Devnet test-USDC mint is the only payment asset in the hackathon flow. Test SOL is used only for transaction fees and account deposits. No production value is accepted.                                                                                                                                     |
| C07 | Purchase transfers the exact on-chain Offer price to the Offer's immutable coach recipient and creates one non-transferable TrainingPass atomically. A purchase nonce permits intentional repeat purchases of the same offer by one client.                                                                                          |
| C08 | The TrainingPass program-derived account (PDA) is authoritative for coach, client, offer, amount paid, initial and remaining sessions, purchase time, expiry and lifecycle status. It is not an NFT and does not need to appear as a wallet collectible.                                                                             |
| C09 | A confirmed future booking reserves one pass session off-chain. Bookable sessions equal the latest verified finalized on-chain remaining balance minus active confirmed or completion-pending bookings that have not produced a matching redemption. PostgreSQL cannot increase entitlement.                                         |
| C10 | Client or coach cancellation before the scheduled start releases the reservation while preserving the full on-chain pass balance. A client-cancelled, still-valid slot reopens; a coach-cancelled slot is withdrawn. A one-session pass remains reusable with the same coach; cancellation does not create an automatic USDC refund. |
| C11 | The coach authority alone redeems one completed booked session for the hackathon. Redemption requires the coach signature, an active unexpired pass and a positive balance; it decrements exactly once and emits an indexable event tied to a bounded booking reference.                                                             |
| C12 | The application indexes purchases and redemptions for fast views and recovery, but PostgreSQL must not override the authoritative on-chain remaining balance. Retries are idempotent and ambiguous RPC results are reconciled from chain state.                                                                                      |
| C13 | Email-backed application identity and linked-wallet ownership remain separate. Connecting a wallet alone grants no profile, coach role, pass, booking or payment authority.                                                                                                                                                          |
| C14 | MovX may sponsor bounded Devnet network fees, but sponsorship does not grant coach or client authority. The reviewed transaction must still contain the required user signer and exact on-chain terms.                                                                                                                               |
| C15 | Coach profiles, availability, bookings, media, follows and posts are authoritative off-chain. The feed contains coach posts only, ordered newest first, with required text and an optional image.                                                                                                                                    |
| C16 | Recurring calendars, group capacity, waitlists, external calendar sync, transfers, resale, subscriptions, automatic refunds, no-show charges, disputes, client posts, reactions, comments, direct messages, reviews and recommendation ranking are deferred.                                                                         |
| C17 | A coach/gym payment split is a stretch goal only after the complete single-recipient flow is stable. The current MVP must not require a venue or gym account.                                                                                                                                                                        |
| C18 | Mapbox is the P0 map provider because implementation speed is the current priority. Each coach explicitly chooses the public discovery location; MovX does not collect live/device location.                                                                                                                                         |
| C19 | The accessible coach list remains primary and usable without Mapbox. P0 stores one provider-neutral confirmed coach location, new slots snapshot it so profile edits cannot move existing classes, and persisted Mapbox-derived results use a storage-permitted permanent-geocoding flow.                                            |
| C20 | Retain gyms only as simple fictional public location records that coaches may optionally select. Gyms have no account, wallet, membership, class schedule, booking, access-claim or check-in authority; independent coaches remain supported.                                                                                        |
| C21 | P0 availability uses explicit slots rather than recurring rules. Slots start on 15-minute boundaries, last 30–180 minutes in 15-minute increments and must end within the exact rolling seven-day publication horizon; the coach interface defaults new slots to 60 minutes.                                                         |
| C22 | All users register through one email-code account flow. After creating the ordinary application profile, a user may immediately activate coaching without administrator approval; activation is a persistent owner-scoped capability, remains separate from public profile visibility and does not remove client capabilities.       |

### Proposed defaults that are not yet confirmed implementation contracts

- Offer validity may use `0` for no expiry and otherwise store a positive duration in seconds.
- A purchase-time slot hold may expire after ten minutes; DEV0105 must adopt or replace the exact duration.
- MovX may offer an explicit, reversible follow prompt after a successful booking; purchase or booking must not silently follow a coach.
- Redemption history may be represented by structured program events indexed off-chain rather than one paid account per redeemed session.
- Images may initially use the existing application media/storage path; permanent or content-addressed media is not required for the hackathon.

An owning development ticket must adopt or replace a proposed default before implementation.

## 3. Actors and authority

### Guest

A guest can browse the coach directory, optional fictional gym labels, coach profiles, public pass offers, open private-class slots and public posts. A guest cannot hold or book a slot, follow, purchase, create offers or see client-specific package state.

### Client

A client has an email-backed MovX account and may link one personal wallet through an explicit signed-message proof. The client signs pass purchases, books an eligible open slot using an unreserved pass session, sees bookings and passes associated with the account's wallet history, and follows or unfollows coaches.

### Coach

A coach uses the same email-backed account as a client and explicitly activates coaching through a self-service owner-only action; P0 has no administrator approval. Activation permits coach-profile setup but is not credential verification and does not itself make the profile public. The profile owner chooses one public location at which to appear in discovery, either by selecting one eligible fictional gym association or confirming an independent training location, and publishes open capacity-one slots that snapshot that location. The linked personal wallet—not the activation flag—is the authority for creating/deactivating offers and redeeming completed bookings. A selected gym receives no authority. The offer's payment recipient is fixed when the offer is created.

### MovX service

The service stores profiles, simplified fictional gym locations, coach-gym affiliations, availability, holds, bookings, offer display metadata, follows, posts and indexed chain projections. It atomically prevents double booking and off-chain over-reservation against verified pass state. It may coordinate a bounded Devnet fee sponsor and reconciliation jobs. It cannot create a client purchase or coach redemption without the required wallet authority and cannot manufacture pass sessions in PostgreSQL.

## 4. Primary user flows

### 4.0 Register and activate coaching

1. A new user verifies one email code and creates the ordinary MovX application profile used for both client and coach behavior.
2. The interface asks whether the user wants to find a coach or offer coaching.
3. Find a coach proceeds to Explore without activating coaching. Offer coaching immediately records owner-scoped activation and proceeds to coach-profile setup; no administrator approval or wallet is required.
4. An activated account remains able to use client features. Public discovery begins only after the separate coach profile is complete and visible.

### 4.1 Discover a coach and an open class

1. A guest opens Explore and sees an accessible list of seeded fictional coach profiles rather than an empty followed feed.
2. Search/filtering may narrow by discipline, optional fictional gym/public location and authoritative open availability.
3. When Mapbox is configured and available, one lazy-loaded map shows the same filtered coaches as pins synchronized with the list. A pin is a coach-chosen public training location, which may be a selected fictional gym; it is not a separate gym-marketplace result, live tracking, current presence or proof of availability.
4. A coach profile shows display name, disciplines, short biography, optional fictional gym name, public location label, public one-session/ten-session offers, open private slots for the coming seven days and recent posts.
5. Client-specific offers and private booking state are visible only to the intended signed-in client.
6. Database failure shows discovery/availability as unavailable; Mapbox failure preserves list discovery; fixture coaches or slots never masquerade as live inventory.

### 4.2 Coach publishes weekly availability

1. The coach signs in and opens the Coach Dashboard.
2. The coach creates explicit future start/end intervals in the profile's reviewed timezone. Each slot snapshots the coach's confirmed public location and optional fictional gym identity/name.
3. The service rejects malformed, overlapping, past or out-of-horizon intervals atomically.
4. Open slots appear on the public profile with capacity one.
5. The coach may edit or withdraw an open slot but cannot silently move, relocate or delete a held or confirmed slot. Changing the profile or selected gym location does not rewrite existing slots.

### 4.3 Coach creates pass offers

1. The coach links/connects the authority wallet and opens offer controls.
2. The coach creates a one-session or ten-session offer with title, service/discipline, test-USDC price, validity and public or client-specific visibility.
3. The UI shows the fixed recipient and exact commercial terms before wallet approval.
4. The coach signs `create_offer`; the application stores non-authoritative display metadata keyed by Offer address.
5. Published commercial terms are immutable. The coach can deactivate future purchases but existing TrainingPasses and bookings remain valid.

### 4.4 Client books with an existing pass

1. The signed-in client selects an open coach slot.
2. MovX reads the latest finalized eligible TrainingPass balance and its active booking reservations; the pass must remain valid through the selected slot.
3. One database transaction verifies the slot is still open, verifies one unreserved session and creates one confirmed booking.
4. The slot closes to other clients and the booking reserves one future session without decrementing the on-chain pass.
5. Reload shows the same confirmed booking time, location and optional fictional gym name to client and coach.

### 4.5 Client purchases a pass and books

1. A client without an eligible pass selects an open slot and chooses the coach's one-session or ten-session offer.
2. MovX places one bounded temporary hold on that capacity-one slot before wallet approval.
3. The client sees coach, selected time, stable location label and optional fictional gym name, sessions, validity, recipient, exact test-USDC amount and network.
4. The server/client read authoritative terms from the Offer account and validate the configured Devnet mint; browser-supplied price or recipient is never trusted.
5. Readiness checks identify the client test-USDC token account and explain insufficient funds before an avoidable signature request.
6. The complete transaction is simulated and summarized with cluster, token amount, recipient, fee payer and accounts to be created.
7. The client approves one transaction in which the exact token transfer and TrainingPass creation succeed or fail together.
8. Finalized chain state is verified and indexed, then the still-valid hold becomes one confirmed booking and reservation.
9. A rejected/failed purchase releases or expires the hold. If payment succeeds but booking confirmation is interrupted, reconciliation confirms the intended booking when possible or leaves the full pass available for another eligible slot; it never charges again.

### 4.6 Client or coach cancels a future booking

1. Either party opens a confirmed booking before its scheduled start and chooses Cancel.
2. One idempotent database operation marks it cancelled and releases the pass reservation. A still-valid slot reopens after client cancellation; coach cancellation withdraws the slot because the coach is no longer offering that time.
3. The TrainingPass balance is unchanged. A one-session pass remains `1 / 1`; a ten-session pass loses no session.
4. Completed, redemption-pending or redeemed bookings cannot be cancelled.

### 4.7 Coach completes and redeems a class

1. After the booked class, the coach opens the confirmed booking in the Coach Dashboard and attests that it was completed.
2. The UI identifies client, scheduled slot, offer, authoritative balance and expiry and asks the coach to confirm one redemption.
3. `redeem_session` verifies coach authority, active status, expiry and remaining balance and records a bounded booking reference in its event.
4. Finalized state decrements exactly one session and emits a structured event.
5. The booking reconciles to completed and no longer counts as a future reservation. Coach and client views converge on the same remaining balance and history; retry cannot decrement twice.

### 4.8 Follow and feed

1. A signed-in client follows or unfollows a coach from the public profile.
2. A coach publishes a short text post and may attach one image.
3. The client's feed contains posts from followed coaches in reverse chronological order.
4. Discovery and weekly availability remain available independently of following so the product has a cold-start path.

## 5. Data and state model

### 5.1 On-chain accounts

**Offer PDA**

- stable CoachAuthority reference, authority epoch and immutable payment recipient;
- coach-scoped offer identifier;
- configured test-USDC price in base units;
- session count of exactly `1` or `10`;
- validity duration (`0` may represent no expiry if adopted by DEV0097);
- optional restricted client wallet;
- active/deactivated flag.

Illustrative seeds: `['offer', coach_pubkey, offer_id]`.

**CoachAuthority PDA**

- stable application coach identity and originally linked wallet seed;
- current linked coach wallet, immutable recovery authority and monotonically increasing authority epoch;
- replacement requires the recovery authority plus the replacement wallet, never the lost old wallet;
- wallet replacement makes earlier-epoch offers ineligible for new purchases without redirecting their immutable recipient, while existing passes continue to use the stable CoachAuthority reference.

**TrainingPass PDA**

- pass identifier or purchase nonce;
- Offer address, coach and client;
- initial and remaining sessions (`1` or `10` initially);
- paid test-USDC amount;
- purchase and optional expiry timestamps;
- `Active` or `Exhausted` status. `Cancelled` is not valid unless a future ticket defines the authority and instruction.

Illustrative seeds: `['pass', offer_pubkey, client_pubkey, purchase_nonce]`. The nonce is required because one client may buy the same offer more than once.

### 5.2 Off-chain records

- user/application profiles and explicit self-service coaching activation;
- simplified fictional gym locations without accounts, classes, memberships, access or check-in authority;
- coach profile, disciplines, biography, visibility, optional selected gym affiliation and one explicitly confirmed provider-neutral public location snapshot with bounded label, longitude, latitude, source and confirmation time;
- Offer display metadata keyed by Offer address;
- explicit timezone-aware capacity-one availability slots with stable provider-neutral public-location snapshots and optional gym identity/name;
- bounded temporary slot holds with expiry and idempotent operation identity;
- confirmed/cancelled/completion-pending/completed bookings linked to coach, client, slot and TrainingPass;
- active future-session reservations derived from bookings;
- follow edges;
- coach text/image posts;
- indexed TrainingPass snapshots and transaction references;
- indexed redemption events with booking reference and resulting remaining balance;
- idempotent purchase, booking, cancellation and reconciliation operations.

Large descriptions, bios and media do not belong in Solana accounts. Off-chain caches must be refreshable from expected program-owned accounts and finalized transactions. A booking or reservation row cannot create, restore or decrement on-chain entitlement.

## 6. Architecture and delivery boundaries

- `src/app/` contains thin Next.js App Router pages and route handlers.
- `src/features/` owns browser interaction and presentation by capability.
- `src/domain/` owns framework-independent validation and state rules.
- `src/server/` is the server-only authentication, authorization, PostgreSQL and RPC boundary.
- `src/solana/` contains shared chain contracts and browser-safe Wallet Standard clients; no private RPC credential or sponsor secret enters client code.
- `programs/` contains the bounded coach-package Solana program once DEV0097 creates it.
- Supabase PostgreSQL owns application identity, fictional gym locations, coach discovery/affiliation, availability, holds, bookings and social data. Solana owns commercial Offer terms, payment-coupled TrainingPass creation and remaining sessions.

The application uses `@solana/kit`, Wallet Standard and Phantom on Solana Devnet. Server reads validate expected program/token account owners, account lengths/discriminators, configured mint and transaction version. Transactions are simulated before wallet approval. Mainnet and production custody are outside scope.

The Explore map uses Mapbox GL JS through a client-only lazy boundary and a dedicated least-scope public token restricted to approved origins. Public Mapbox tokens are intentionally browser-visible; secret-scope tokens are prohibited from client bundles and committed configuration. The accessible server-rendered coach list does not require Mapbox. Temporary Search Box results remain ephemeral. Any Mapbox-derived label/coordinate persisted in PostgreSQL must be produced by a contemporaneously storage-permitted permanent Geocoding API flow, currently `permanent=true` with eligible billing, and Mapbox attribution remains visible.

Availability/booking database transactions prevent ordinary double booking and pass over-reservation, while idempotent operation records bridge the non-atomic boundary between finalized chain purchase/redemption and PostgreSQL confirmation. A successful payment is never discarded because a slot hold expires: the resulting pass remains valid and reusable with that coach.

<a id="core-coach-packages"></a>

## 7. Core coach passes and private classes

An offer is a coach-specific one-session or ten-session product. Its price must be positive, its recipient is the signing current coach wallet at creation, and an optional client restriction is enforced on chain. Deactivation prevents new purchases without invalidating existing passes or bookings. A wallet replacement advances the stable CoachAuthority epoch: earlier offers remain immutable/readable but cannot be purchased again, and the coach creates replacement offers for the new recipient. Existing passes continue to resolve coach actions through the stable CoachAuthority account.

A TrainingPass is non-transferable and client-associated. It can be active or exhausted and optionally expires. The client and coach see the same on-chain totals. Possession of an unrelated token, database row, screenshot, booking or indexed cache does not grant sessions.

An availability slot is capacity-one private-class inventory with a snapshot of the coach's selected public location and optional fictional gym identity/name. A confirmed booking reserves but does not consume one pass session. The same pass can support no more active future reservations than its latest finalized remaining balance. Cancellation before start releases the reservation and preserves the pass credit. A client-cancelled, still-valid slot becomes bookable again; a coach-cancelled slot is withdrawn. Only completed-class redemption consumes the pass. A later coach-profile or gym-location change cannot silently relocate an existing slot or booking.

The coach-first MVP models only an optional selected fictional gym affiliation/location. It does not model gym accounts or administrators, gym-managed classes, group capacity, gym memberships, recurring calendar rules, waitlists, external calendar sync, included visits, access claims, venue check-ins, membership periods or pool allocation.

<a id="purchase-and-redemption"></a>

## 8. Purchase, booking and redemption

The purchase instruction accepts only the configured Devnet test-USDC mint and derives amount, session count, recipient and restriction from the Offer account. Token transfer and pass creation are atomic. Wrong mint, amount, recipient, authority, client restriction, inactive offer or reused pass address fails without creating entitlement.

Purchase operations retain a bounded public reference sufficient to recover after wallet approval or RPC ambiguity. Final verification reads finalized chain state; the browser response is never payment authority. The same submitted signature can be reconciled repeatedly, but one payment cannot create multiple indexed passes or bookings.

Booking confirmation atomically checks slot capacity and off-chain unreserved credit against a freshly verified pass projection. A temporary hold is not a booking or entitlement. Hold expiry after a failed purchase releases capacity. If chain purchase succeeds after the intended slot is no longer confirmable, the pass remains fully usable and the interface must explain that another eligible slot can be selected.

Only the recorded coach authority may redeem. The application exposes redemption for a confirmed booked class after its scheduled session and binds the operation/event to that booking reference. The on-chain program verifies coach/pass authority, expiry and balance; it does not independently prove that a real-world class occurred. Redemption rejects expired or exhausted passes, never underflows, decrements one session per accepted instruction and exposes a deterministic event for indexing. Database-only decrement is prohibited.

<a id="asset-wallet-and-demo-integrity"></a>

## 9. Asset, wallet and demo integrity

- Every payment screen names Solana Devnet, test USDC, recipient, amount and fee payer. It never calls test assets real money.
- Wallet connection, email identity and linked-wallet proof remain distinct states.
- Sponsor secrets and credentialed RPC endpoints remain server-only. A public browser RPC endpoint may be exposed intentionally.
- Fee sponsorship pays network/account costs only; it cannot substitute for the client purchase signature or coach authority.
- A TrainingPass PDA may be displayed inside MovX but is not promised as a Phantom collectible. The superseded membership-card Core asset experiment is historical evidence only.
- Fictional coach profiles, offers and slots are labeled as demonstration data and must not imply partnerships with real coaches, gyms or venues.
- Open-slot presentation comes from the authoritative booking database. Database failure cannot fall back to fabricated available times.
- The demo can be reset/reseeded without hand-editing production, hosted or chain records.

<a id="social-behavior-and-permissions"></a>

## 10. Social behavior and permissions

Guests can read public coach profiles and posts. Signed-in clients can follow/unfollow coaches. Only a coach can create or manage that coach's posts. The feed is reverse chronological and includes followed-coach posts only; discovery and weekly availability are separate.

Posts require bounded text and may reference one safely validated image. Reactions, comments, direct messages, stories, groups, client posts, ranking, notifications and complex moderation are excluded. Removing or hiding a post is an off-chain application action and never changes bookings or TrainingPass state.

## 11. Definition of done

The MVP is done only when:

- a guest can discover a fictional coach, inspect one-session/ten-session offers and see open private slots for the coming seven days;
- a coach may select one eligible fictional gym or remain independent, and the gym receives no membership, class, booking, wallet or check-in authority;
- a guest can use the same filtered coach results through an accessible list and Mapbox pins, while provider/configuration failure leaves the list usable and makes no live-location claim;
- a coach can explicitly confirm one public discovery location without device geolocation, and persisted Mapbox-derived results use an approved permanent-storage flow;
- an authorized coach can publish non-overlapping capacity-one availability and create/deactivate an Offer without database edits;
- each slot/booking preserves its public-location and optional gym snapshot when the coach or gym location later changes;
- a linked client wallet can purchase the exact Offer with official Devnet test USDC and receive one TrainingPass atomically;
- a client with an eligible unreserved session can book exactly one open slot and coach/client views reload the same booking;
- a purchase-time hold converges on one booking or leaves the purchased pass reusable without a second charge;
- the same client can intentionally repeat a purchase through a distinct nonce or the UI clearly blocks it by an adopted rule;
- concurrent clients cannot double-book one slot and one pass cannot reserve more future classes than its finalized remaining sessions;
- client or coach cancellation before start releases the reservation and preserves the full one-session or ten-session pass balance; client cancellation reopens a still-valid slot, while coach cancellation withdraws it;
- only the coach can redeem a completed booked class, and one redemption changes the balance from `N` to `N - 1` exactly once;
- wrong mint, amount, recipient, signer, restricted client, ineligible coach/pass, expired/exhausted pass, slot race, last-credit race and replay paths are tested;
- transaction rejection, RPC failure, ambiguous submission and purchase/booking/redemption reconciliation states are honest and recoverable;
- follow/unfollow and a chronological coach post survive reload;
- legacy membership, group-class, access-claim, arrival and check-in database mutation objects are absent while fictional gym locations and personal wallet linking remain intact;
- relevant unit/integration, authorization, concurrency, database, program, static, build and browser checks pass;
- one hosted 2–3 minute Devnet rehearsal completes without manual database or chain intervention.

## 12. Delivery milestones

1. **M0 — Contract and cleanup:** adopt this specification, retire the multi-gym mutation/runtime schema while preserving simple fictional gym locations, and present a truthful coach-first public story.
2. **M1 — Coach identity and discovery:** persist coach profiles, an optional fictional gym affiliation and one coach-selected public location, seed fictional coaches, and provide accessible list/Mapbox discovery plus profile views.
3. **M2 — Availability and offers:** publish capacity-one slots for the coming seven days and implement coach-authorized one-session/ten-session Offer accounts plus display metadata.
4. **M3 — Pass purchase:** atomically transfer test USDC and create/recover/index TrainingPass accounts.
5. **M4 — Private booking:** hold and confirm one slot against an eligible unreserved pass session; cancellation preserves the credit.
6. **M5 — Completion and redemption:** implement coach-authorized completed-booking redemption, history and consistent booking/pass dashboards.
7. **M6 — Network loop:** follow/unfollow coaches and publish/read chronological coach posts.
8. **M7 — Hosted rehearsal:** validate the complete discovery, purchase, booking, cancellation/rebooking and redemption flow on staging with public Devnet evidence.

Gym accounts/administration and coach/gym payment splitting, recurring calendars and group classes begin only as separately reviewed stretch tickets after M0–M7 are stable.

## 13. Acceptance matrix

| Scenario                                       | Expected result                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest opens Explore                            | Fictional coach cards load without sign-in; configured Mapbox pins represent the same filtered coaches and no legacy gym-membership mutation is offered.       |
| New user chooses Offer coaching                | The verified owner is immediately and idempotently activated for coach-profile setup without administrator approval; the account retains client capabilities.  |
| Mapbox is unavailable                          | Coach list, filters and profile navigation remain usable; a bounded map-unavailable state replaces the map without fabricated pins.                            |
| Coach confirms a public location               | One bounded provider-neutral label/coordinate snapshot is stored through an approved permanent-result flow; no device/live location is requested.              |
| Coach selects a fictional gym                  | One same-dataset active gym may supply the public label/location; the coach retains offer/slot/booking authority and may instead remain independent.           |
| Coach changes the profile location             | Discovery uses the new confirmed point, while existing slot and booking location snapshots remain unchanged.                                                   |
| Guest opens coach profile                      | Public biography, disciplines, chosen location label, public offers, open weekly slots and posts are readable; restricted offers/private bookings stay hidden. |
| Coach publishes valid availability             | Non-overlapping capacity-one slots appear for the coming seven days in the reviewed timezone.                                                                  |
| Coach overlaps or edits a booked slot          | Mutation fails without duplicating capacity or silently changing the client's booking.                                                                         |
| Unauthorized profile/offer/slot mutation       | Request fails without changing application or chain state.                                                                                                     |
| Coach creates valid 1x/10x offer               | Expected Offer PDA contains immutable terms and recipient; display metadata references its address.                                                            |
| Coach changes price                            | Existing offer cannot be edited; coach deactivates it and creates a new offer.                                                                                 |
| Client books with existing pass                | One open slot becomes one confirmed booking and one future credit reservation; chain balance is unchanged.                                                     |
| Two clients claim the same slot                | Exactly one booking succeeds; the other receives an honest unavailable result.                                                                                 |
| Client overbooks last pass credit              | Additional booking fails while all finalized remaining sessions are already reserved.                                                                          |
| Client buys public offer for selected slot     | Exact test USDC reaches the immutable recipient, one TrainingPass is created and the held slot becomes one booking.                                            |
| Wrong client buys restricted offer             | Program rejects the purchase and transfers no tokens.                                                                                                          |
| Wrong mint/amount/recipient                    | Program rejects the purchase and creates no pass.                                                                                                              |
| Purchase succeeds but booking response is lost | Retry reconciles the existing pass/booking or leaves the pass reusable; it creates no second payment, pass or booking.                                         |
| Client cancels before start                    | Booking/reservation release, the still-valid slot reopens and the full pass balance remains available.                                                         |
| Coach cancels before start                     | Booking/reservation release, the slot is withdrawn and the full pass balance remains available for another eligible slot.                                      |
| Same client books another slot after cancel    | The preserved one-session or ten-session credit confirms one new eligible booking without another purchase.                                                    |
| Same client buys again                         | A new nonce creates a distinct pass, unless an explicit adopted UI rule prevents the attempt before signing.                                                   |
| Coach redeems completed booking                | Remaining sessions decrement once and booking/history reconcile to the indexed event.                                                                          |
| Client or unrelated coach redeems              | Program rejects the instruction.                                                                                                                               |
| Exhausted or expired pass redeems              | Program rejects without underflow or balance change.                                                                                                           |
| Client follows coach                           | Relationship survives reload and the coach's posts appear newest first.                                                                                        |
| Wallet merely connects                         | No account, coach role, pass, booking or payment authority is inferred.                                                                                        |
| Legacy membership URL/API is requested         | It is unavailable/not found and cannot mutate stored membership state.                                                                                         |
| Legacy membership/class/check-in DB is queried | No current mutation object exists; fictional gym locations and personal wallet state remain available through their current restricted boundaries.             |

## 14. Judge demo

1. A coach selects one fictional Berlin gym as the public training location, publishes two capacity-one Boxing slots there for the coming week and creates public offers for **1 Boxing Session** at an illustrative `2` test USDC and **10 Boxing Sessions** at `10` test USDC, valid for 90 days.
2. A client discovers the coach through the synchronized Explore list/Mapbox pin, sees the fictional gym and stable location label, selects the first slot, follows the coach and buys the ten-session pass; the finalized purchase confirms one booking while My Pass shows `10 / 10` with one future class reserved.
3. The client cancels before the start. The slot reopens and My Pass remains `10 / 10`; the same pass then books the second slot without another payment.
4. After the demonstrated class is completed, the coach redeems it; both views refresh to `9 / 10` and show the matching booking/redemption history.
5. The coach publishes a short update; the client sees it at the top of the feed.

The demo tells this one product story. Multi-gym memberships, group classes, recurring schedules, transfer/resale, automatic refunds and wallet collectibles are not part of it.
