# MovX Club — Scheduling-only MVP specification

Last updated: 8 October 2026.

MovX is a focused scheduling product for martial-arts coaching. Guests discover fictional coaches and their real published availability. Email-authenticated clients reserve one capacity-one private session directly. Coaches manage their public profile, location, recurring one-hour availability and booked schedule.

This branch intentionally has no blockchain, wallet, token, pass, credit, payment, group-funding, event-marketplace, follow, post or feed behavior. Completed and archived records for those features are historical evidence only and do not define current product behavior.

## 1. Product status and document authority

This document is the single current product contract for the scheduling-only branch. It defines target behavior and does not claim every target is already implemented.

The repository contains reusable Next.js, Supabase/PostgreSQL, email identity, coach profile/location, list-first discovery, recurring availability, responsive calendar and Vercel foundations. Direct scheduling-only booking and the removal of obsolete runtime were delivered under completed [COR0011](../tickets/archive/organisatory/COR0011-scheduling-only-product.md).

Tickets record implementation scope and evidence; they do not override this specification. Archived tickets remain immutable history. [DEV0140](../tickets/archive/organisatory/DEV0140-adopt-scheduling-only-contract.md) records the decision to create this focused branch.

## 2. Confirmed target and decisions

The following constraints are confirmed for this branch:

| ID  | Confirmed decision                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | MovX is a coach-discovery and private-session scheduling product, not a payment, financial, membership, social-network or event-funding product.                                                |
| C02 | Guests can browse visible coaches, confirmed public locations and open dated availability without signing in.                                                                                   |
| C03 | Email-backed MovX accounts are the only client and coach identity authority. No wallet connection or signature is required.                                                                     |
| C04 | A client books one exact future one-hour occurrence directly; no pass, credit balance, token or payment is required.                                                                            |
| C05 | One occurrence has capacity one. Database constraints and a single atomic mutation prevent two active bookings for the same occurrence.                                                         |
| C06 | A client cannot book their own coach occurrence. Hidden coaches, withdrawn/elapsed slots and cross-dataset identifiers are unavailable.                                                         |
| C07 | The client or owning coach may cancel a confirmed future booking. Cancellation reopens the occurrence while it is still future.                                                                 |
| C08 | The owning coach may mark an elapsed confirmed booking completed. Completed and cancelled bookings are terminal.                                                                                |
| C09 | Coaches activate coaching explicitly, publish one public profile/location and manage recurring one-hour availability without administrator approval. Activation is not credential verification. |
| C10 | Mapbox is optional. The server-backed coach/time list remains usable when the map or token is unavailable.                                                                                      |
| C11 | There are no group events, passes, credits, payments, wallets, follows, posts, feeds, messages, waitlists or external calendar synchronization in this MVP.                                     |
| C12 | Native Next.js on Vercel with Supabase Auth/PostgreSQL is the hosted target. Secrets remain server-only environment values.                                                                     |

### Proposed implementation defaults

The following are implementation defaults rather than additional user decisions:

- Availability is materialized as dated one-hour occurrences for a rolling seven-day window from recurring weekly rules.
- Repeating the same booking request from the same client for the same active occurrence returns the existing booking rather than creating a duplicate.
- A coach or client cancellation records who cancelled and when; P0 does not require a reason field or notification delivery.
- Historical migrations may retain unused wallet/payment/event tables for safe forward compatibility. Current code does not read or expose them.

## 3. Actors and authority

### Guest

A guest can browse the public story, coach list, coach profiles, confirmed locations and future open times. A guest cannot reserve or mutate schedule state.

### Client

A client has a verified email-backed MovX account and application profile. The client can book one future occurrence with another coach, view only their own bookings and cancel their own future confirmed booking.

### Coach

A coach is also a client. After explicit coaching activation, the owner can edit their coach profile/location, publish recurring availability, inspect bookings for their own schedule, cancel a future confirmed booking and mark an elapsed confirmed booking completed. A coach cannot see unrelated client bookings or private identity data.

### MovX service

MovX verifies the Supabase session, establishes transaction-local actor context, enforces row-level authorization and performs bounded database mutations. It does not invent coaches, availability or bookings when configuration/database access is unavailable.

## 4. Primary user flows

### 4.1 Register and activate coaching

1. A visitor requests a one-time email code and verifies it through Supabase Auth.
2. MovX creates or restores the same minimal application profile.
3. The user continues as a client or explicitly activates coaching.
4. Coaching activation opens owner-only profile and availability setup; it does not automatically publish a profile.

### 4.2 Discover a coach and time

1. A guest opens Explore and receives a server-backed list of visible coaches.
2. Search and filters narrow the list. Configured Mapbox pins mirror the same confirmed locations; map failure leaves the list usable.
3. A coach profile shows bounded public details, one confirmed location and future open dated one-hour occurrences.
4. No placeholder time is shown when persistent availability is unavailable.

### 4.3 Book a private session

1. A signed-in client selects one future open occurrence belonging to another visible coach.
2. One authorized database operation locks the occurrence, checks actor/run/coach/time/status boundaries, creates or recovers the client's booking and marks the occurrence booked.
3. A concurrent different client loses the race and receives a conflict without a second booking.
4. Reload shows the same confirmed booking from PostgreSQL.

### 4.4 Cancel a booking

1. The owning client or coach selects a future confirmed booking.
2. One authorized operation records the cancellation actor/time and reopens the future occurrence.
3. Repeating the same cancellation returns the same terminal outcome; a different or unauthorized actor cannot mutate it.

### 4.5 Complete a session

1. After the scheduled start, the owning coach can mark a confirmed booking completed.
2. Completion is terminal and idempotent. Clients and unrelated coaches cannot complete it.
3. P0 does not claim independent attendance proof or resolve service disputes.

## 5. Scheduling state model

### Application profile

One profile belongs to one verified Supabase Auth identity inside a dataset. It stores the bounded display identity used for authorization and presentation.

### Coach profile and public location

One owner-scoped coach profile contains public name, slug, biography, disciplines, visibility, timezone and one confirmed provider-neutral location snapshot. A fictional gym association grants no account authority.

### Recurring availability and dated occurrence

A recurring weekly rule creates deterministic dated one-hour occurrences in the coach timezone. An occurrence is `open`, `booked` or `withdrawn`, carries its immutable time/location snapshot and belongs to exactly one coach. Overlapping rules/occurrences are rejected.

### Private booking

A private booking binds one occurrence, coach profile and client profile. Its current lifecycle is:

```text
Confirmed -> Cancelled
Confirmed -> Completed
```

Minimum projection fields are booking ID, occurrence ID, coach/client IDs, scheduled start/end, location snapshot, status, creation/update timestamps, cancellation actor/time and completion time. It contains no wallet, pass, credit, token, price, transaction signature or chain reference.

## 6. Application and infrastructure boundaries

- Browser code receives only public configuration and bounded projections.
- Next.js server code verifies sessions and owns authorization/database calls.
- Supabase Auth establishes email identity; editable profile fields do not establish authority.
- PostgreSQL is authoritative for profiles, locations, availability, occurrences and bookings.
- Mapbox renders/searches locations only; stored provider-neutral snapshots remain application authority.
- Vercel runs the native Next.js application. Hosted secrets are encrypted server-only environment values.
- Historical blockchain/social tables may remain in migration history but are not current runtime dependencies.

## 7. Booking and recovery

Booking, cancellation and completion are atomic database operations with stable UUID identity and explicit actor context. The active-slot uniqueness rule prevents double booking even under concurrent requests.

A repeated same-client booking request for an already active occurrence returns that booking. A different client receives a conflict. Reload always derives state from PostgreSQL rather than browser storage. Database failure returns an unavailable result and never displays a successful mutation.

Cancellation locks the booking/occurrence together, records the authorized actor and reopens only a future occurrence. Completion locks the booking and requires the owning coach plus an elapsed scheduled start. Terminal transitions are idempotent and cannot be reversed in P0.

## 8. Identity, data and demo integrity

- Public fictional coaches and venues are demonstration data and are not real endorsements or verified professionals.
- A `demo run` is an isolated demonstration dataset, not a fitness activity or login session.
- Public pages never expose Auth identifiers, email addresses, database credentials or private client records.
- Only the booking's client and coach may read its private projection; coach discovery exposes no client schedule.
- Empty and unavailable states remain explicit. Fixture-only bookings or times must not masquerade as persisted runtime state.
- No screen claims payment, wallet verification, blockchain finality or financial protection.

## 9. Scheduling behavior and permissions

- Public coach discovery includes only visible profiles and confirmed locations.
- Only the coach owner edits that coach profile, location or recurring availability.
- A coach composes recurring availability as a local working-week draft and explicitly saves the complete selection; one authorized atomic operation replaces the active rule set and synchronizes dated occurrences once.
- Only a verified signed-in client books, and never against their own coach profile.
- Only the booking client or coach cancels a future confirmed booking.
- Only the booking coach completes an elapsed confirmed booking.
- Unrelated accounts receive no booking identity or mutation capability.
- Removing a recurring rule does not silently delete terminal booking history.

## 10. Security and failure invariants

- Actor context is derived from a verified session and set transaction-locally.
- Direct table permissions remain least privilege; security-definer functions validate actor context and exact identifiers.
- Capacity-one enforcement exists in PostgreSQL, not only in browser button state.
- Cross-run identifiers, hidden coaches, self-booking, elapsed/non-open occurrences and invalid lifecycle transitions fail closed.
- Mutation errors return bounded messages without database/Auth internals.
- Browser inputs are normalized and bounded; server/domain validation is authoritative.
- Private booking queries are actor-scoped and reveal only necessary display/time/location fields.
- Hosted builds reject loopback/incomplete database/Auth configuration without printing values.

## 11. Definition of done

The scheduling-only MVP is complete when:

- guests can browse a truthful list of fictional coaches and future open times, with an optional synchronized map and usable list fallback;
- one verified email account can use client behavior and explicitly activate coaching;
- a coach can publish/edit a visible profile, confirmed location and recurring one-hour availability;
- a different signed-in client can reserve one open occurrence and reload the same confirmed booking;
- concurrent clients cannot both reserve the same occurrence;
- the booking client or coach can cancel a future confirmed booking and the occurrence becomes open again;
- the owning coach can complete an elapsed confirmed booking;
- unauthorized/self/cross-run/invalid-state mutations fail without partial state;
- removed wallet, blockchain, pass/payment, group-event and social/feed routes are unavailable;
- relevant unit, database, authorization, static, build and responsive browser checks pass;
- a hosted Vercel/Supabase rehearsal completes the discovery-book-cancel and coach availability/complete flows without manual database repair.

## 12. Delivery milestones

1. **M0 — Scheduling contract:** adopt this specification and reconcile obsolete marketplace work.
2. **M1 — Direct booking core:** persist authorized capacity-one booking, cancellation and completion without chain state.
3. **M2 — Runtime retirement:** remove blockchain, wallet, payment/event and social runtime/tooling/dependencies.
4. **M3 — Scheduling interface:** present discovery, direct booking, client history and coach schedule management responsively.
5. **M4 — Hosted rehearsal:** deploy to Vercel with hosted Supabase and repeat the core scheduling flow with two accounts.

Payments, subscriptions, passes, wallets, group classes/events, waitlists, messaging, reviews, attendance disputes, external calendar synchronization and notification delivery require separately reviewed future contracts.

## 13. Acceptance matrix

| Scenario                        | Expected result                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest opens Explore             | Visible fictional coaches and confirmed locations load; map failure leaves the list usable.                                                           |
| Guest opens coach profile       | Public profile and persisted open times load without private booking/client data.                                                                     |
| Guest attempts booking          | Sign-in is required; no booking mutation occurs.                                                                                                      |
| New user activates coaching     | Owner gains coach setup capability while retaining client behavior; no public visibility is inferred.                                                 |
| Coach publishes availability    | Multiple draft selections persist together on explicit save; valid one-hour occurrences then appear publicly with stable timezone/location snapshots. |
| Client books open time          | One confirmed booking is created and the occurrence becomes booked atomically.                                                                        |
| Same client retries booking     | The existing active booking is returned; no duplicate row is created.                                                                                 |
| Different client races          | Exactly one client succeeds; the other receives a conflict.                                                                                           |
| Coach books own time            | Request fails without mutation.                                                                                                                       |
| Client cancels future booking   | Booking becomes cancelled, cancellation identity/time are recorded and the occurrence reopens.                                                        |
| Coach cancels future booking    | Same terminal/reopen behavior applies only to that coach's booking.                                                                                   |
| Coach completes elapsed booking | Booking becomes completed once; client/unrelated coach cannot complete it.                                                                            |
| Database/Auth unavailable       | UI shows bounded unavailable/signed-out state and fabricates no booking or time.                                                                      |
| Removed URL is requested        | Wallet, Solana, event and social/feed routes are unavailable and cannot mutate state.                                                                 |

## 14. Demo

1. A guest opens Explore, filters the list and opens a fictional coach with real published availability.
2. The guest signs in by email, selects an open time and receives one confirmed booking without wallet or payment prompts.
3. A second client attempts the same occurrence and receives a conflict.
4. The first client cancels; the time reopens and remains available after reload.
5. A coach edits recurring availability, views a prepared elapsed booking and marks it completed.

The demonstration proves scheduling authority and concurrency only. It makes no claim about payment, attendance, professional credentials or dispute resolution.
