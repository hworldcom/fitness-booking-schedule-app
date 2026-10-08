# MovX Club — Scheduling-only MVP specification

Last updated: 8 October 2026.

MovX is a focused scheduling product for martial-arts coaching. Guests discover platform-approved coaches or clearly labelled fictional demo coaches and their real published availability. Email-authenticated clients reserve one capacity-one private session directly. Approved coaches manage their public profile, location, recurring one-hour availability and booked schedule.

This standalone project intentionally has no blockchain, wallet, token, pass, credit, payment, group-funding, event-marketplace, follow, post or feed behavior. Completed and archived records for those features are historical evidence only and do not define current product behavior. Solana hackathon development belongs to the separate `fitness-booking-social-app` repository.

## 1. Product status and document authority

This document is the single current product contract for the standalone scheduling repository. It defines target behavior and does not claim every target is already implemented.

The repository contains reusable Next.js, Supabase/PostgreSQL, email identity, coach profile/location, list-first discovery, recurring availability, responsive calendar and Vercel foundations. Direct scheduling-only booking and the removal of obsolete runtime were delivered under completed [COR0011](../tickets/archive/organisatory/COR0011-scheduling-only-product.md).

Tickets record implementation scope and evidence; they do not override this specification. Archived tickets remain immutable history. [DEV0140](../tickets/archive/organisatory/DEV0140-adopt-scheduling-only-contract.md) records the decision to create this focused product split.

## 2. Confirmed target and decisions

The following constraints are confirmed for this scheduling project:

| ID  | Confirmed decision                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | MovX is a coach-discovery and private-session scheduling product, not a payment, financial, membership, social-network or event-funding product.                                                                                                                                                                                                                           |
| C02 | Guests can browse visible coaches, confirmed public locations and open dated availability without signing in.                                                                                                                                                                                                                                                              |
| C03 | Email-backed MovX accounts are the only client and coach identity authority. No wallet connection or signature is required.                                                                                                                                                                                                                                                |
| C04 | A client books one exact future one-hour occurrence directly; no pass, credit balance, token or payment is required.                                                                                                                                                                                                                                                       |
| C05 | One occurrence has capacity one. Database constraints and a single atomic mutation prevent two active bookings for the same occurrence.                                                                                                                                                                                                                                    |
| C06 | A client cannot book their own coach occurrence. Hidden coaches, withdrawn/elapsed slots and cross-dataset identifiers are unavailable.                                                                                                                                                                                                                                    |
| C07 | The client or owning coach may cancel a confirmed future booking. Cancellation reopens the occurrence while it is still future.                                                                                                                                                                                                                                            |
| C08 | The owning coach may mark an elapsed confirmed booking completed. Completed and cancelled bookings are terminal.                                                                                                                                                                                                                                                           |
| C09 | Client and coach onboarding are visibly separate paths into one email-backed account model. Client capability is the default; coach authority requires a platform-approved application.                                                                                                                                                                                    |
| C10 | Mapbox is optional. The server-backed coach/time list remains usable when the map or token is unavailable.                                                                                                                                                                                                                                                                 |
| C11 | There are no group events, passes, credits, payments, wallets, follows, posts, feeds, messages, waitlists or external calendar synchronization in this MVP.                                                                                                                                                                                                                |
| C12 | Native Next.js on Vercel with Supabase Auth/PostgreSQL is the hosted target. Secrets remain server-only environment values.                                                                                                                                                                                                                                                |
| C13 | A real approved coach displays a `Verified coach` badge meaning MovX reviewed the account holder's identity and coach application; it does not guarantee licensing, competence or safety.                                                                                                                                                                                  |
| C14 | Primary account navigation is capability-aware: every authorized account sees `My sessions`, and approved, demo and suspended coaches additionally see `Coach workspace`. For approved/demo coaches the main `Profile` item defaults to coach Profile, while the account-avatar controls retain personal account Profile access. Signed-out navigation shows neither private destination. |
| C15 | Profile pictures are optional. An account avatar is private account presentation; a coach portrait is a separate explicitly public coach-profile asset. Signed-in account surfaces, including both navigation icons and Profile, prefer the private avatar and otherwise use the owner's public coach portrait as a display-only fallback. Missing images retain initials. |

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

A client has a verified email-backed MovX account and application profile. The client can book one future occurrence with another coach, view only their own upcoming sessions and retained history in `My sessions`, cancel their own future confirmed booking and optionally manage a private account avatar. Ordinary clients plus pending and rejected coach applicants receive `My sessions` as their private primary-navigation destination and no `Coach workspace` item. An account avatar does not become public coach media merely because the account later applies to coach.

### Coach

A coach retains client capability, so approved and fictional demo coaches keep `My sessions` and additionally receive `Coach workspace` in desktop and mobile navigation. Their main `Profile` item opens coach Profile by default, while the bottom-left and upper-right account controls continue to open the personal account Profile. Coach Profile, Schedule and Bookings share one Profile-first sub-navigation at a stable top position, followed by the green view-specific hero and then that view's content; Schedule contains recurring availability and dated capacity status, while Bookings alone contains the detailed booked schedule, client identity/avatar and booking actions. After platform approval, the owner can publish their coach profile/location, optionally manage a separate public coach portrait, manage recurring availability, inspect bookings for their own schedule, cancel a future confirmed booking and mark an elapsed confirmed booking completed. A pending or rejected applicant may prepare a private draft but has no public coach or scheduling authority. A suspended coach receives the same two private destinations, with bounded Bookings access needed to resolve existing sessions, but accepts no new bookings or public-media changes. A coach cannot see unrelated client bookings or private identity data.

### Platform reviewer

Until the internal admin panel exists, an authorized operator uses a guarded owner-only command to approve, reject or suspend an exact coach application. Every decision records the expected prior state, reviewer/source, bounded reason, verification-policy version and immutable audit event. Ordinary application/runtime roles cannot review applications or grant coach authority.

### MovX service

MovX verifies the Supabase session, establishes transaction-local actor context, enforces row-level authorization and performs bounded database mutations. It does not invent coaches, availability or bookings when configuration/database access is unavailable.

## 4. Primary user flows

### 4.1 Register as a client or apply to coach

1. A visitor requests a one-time email code and verifies it through Supabase Auth.
2. MovX creates or restores the same minimal application profile.
3. The visitor follows the `Find a coach` path and can use client behavior immediately, or follows `Become a coach` and submits a coach application.
4. A pending applicant may prepare a hidden coach-profile draft but cannot publish availability or receive new bookings.
5. A guarded platform review approves, rejects or suspends the application atomically with audit evidence.
6. Approval unlocks coach publication and scheduling without removing client capability, and primary navigation adds `Coach workspace` alongside `My sessions`. Approval does not automatically make the profile visible.
7. The account may manage a private avatar from Account Profile. An approved coach separately chooses whether to add a public portrait to the coach profile.

### 4.2 Discover a coach and time

1. A guest opens Explore and receives a server-backed list of visible coaches.
2. Search and filters narrow the list. Configured Mapbox pins mirror the same confirmed locations; map failure leaves the list usable.
3. A coach profile shows bounded public details, an optional public portrait, one confirmed location and future open dated one-hour occurrences. Missing portraits use initials rather than a fabricated image.
4. No placeholder time is shown when persistent availability is unavailable.

### 4.3 Book a private session

1. A signed-in client selects one future open occurrence belonging to another visible coach.
2. One authorized database operation locks the occurrence, checks actor/run/coach/time/status boundaries, creates or recovers the client's booking and marks the occurrence booked.
3. A concurrent different client loses the race and receives a conflict without a second booking.
4. Reload shows the same confirmed booking from PostgreSQL.
5. The client can return to `My sessions` for upcoming bookings and retained terminal history.

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

### Coach application and review

One current coach application belongs to one application profile. Absence means not applied; submitted applications move through `pending`, `approved`, `rejected` or `suspended`. Review events are append-only evidence of platform decisions. Historical self-service activation may remain stored for continuity but grants no current coach authority.

### Coach profile and public location

One owner-scoped coach profile contains public name, slug, biography, disciplines, visibility, timezone, an optional public portrait reference and one confirmed provider-neutral location snapshot. Pending/rejected applicants may keep only a private draft; a user-created profile enters public discovery only while its application is approved and its owner selects visible. A fictional gym association grants no account authority.

### Profile images

Image bytes live in Supabase Storage rather than PostgreSQL or the Vercel deployment filesystem. PostgreSQL stores only bounded source/path/version metadata. Private account avatars and public coach portraits use separate storage/access contracts; attaching an image never grants account or coach authority. Signed-in account presentation—including the desktop bottom-left account control, upper-right header control and Profile—prefers its private avatar and otherwise may display the owner's already-public coach portrait as a read-only fallback. A regular account therefore shows its private avatar or initials, while a coach can additionally fall back to the public portrait. The owning coach of a confirmed direct booking may also retrieve that booking client's current private avatar through a booking-scoped authenticated application route; cancellation or completion ends that additional access, public and unrelated actors receive no image bytes, and the browser never receives the private Storage object path. These fallbacks and bounded reads do not copy media between buckets or change which endpoint removes each image.

JPEG, PNG and WebP source selections are accepted for the first release. The browser corrects orientation, square-crops and downsizes before upload; the server treats that output as untrusted, validates and re-encodes one canonical 512 × 512 WebP at quality 82, strips metadata and retains no original. The selected source is limited to 8 MiB and the canonical upload to 512 KiB. Replacement writes a new immutable object path before retiring the prior owned object so content-delivery-network caches do not retain an overwritten image. Removal restores the initials fallback.

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
- PostgreSQL is authoritative for profiles, coach applications/reviews, locations, availability, occurrences and bookings.
- Supabase Storage owns normalized image objects. Private account-avatar access and public coach-portrait delivery remain separate; PostgreSQL stores only their bounded references.
- Mapbox renders/searches locations only; stored provider-neutral snapshots remain application authority.
- Vercel runs the native Next.js application. Hosted secrets are encrypted server-only environment values.
- Historical blockchain/social tables may remain in migration history but are not current runtime dependencies.

## 7. Booking and recovery

Booking, cancellation and completion are atomic database operations with stable UUID identity and explicit actor context. The active-slot uniqueness rule prevents double booking even under concurrent requests.

A repeated same-client booking request for an already active occurrence returns that booking. A different client receives a conflict. Reload always derives state from PostgreSQL rather than browser storage. Database failure returns an unavailable result and never displays a successful mutation.

Cancellation locks the booking/occurrence together, records the authorized actor and reopens only a future occurrence. Completion locks the booking and requires the owning coach plus an elapsed scheduled start. Terminal transitions are idempotent and cannot be reversed in P0.

## 8. Identity, data and demo integrity

- Public fictional coaches and venues are demonstration data and are not real endorsements or verified professionals.
- Fictional fixtures display `Demo coach`, never the real platform-verification badge. Existing self-activation or profile presence does not silently become approval.
- `Verified coach` means MovX reviewed the account holder's identity and application under the recorded `movx-identity-application-v1` policy. It is not a licensing, background-check, competence or safety guarantee.
- A `demo run` is an isolated demonstration dataset, not a fitness activity or login session.
- Public pages never expose Auth identifiers, email addresses, database credentials or private client records.
- Private account avatars are not returned by public coach discovery. The owning coach receives only a booking-scoped avatar URL for a confirmed direct booking, while Storage paths remain server-only; a coach portrait is public only through the explicit coach-profile media path.
- Only the booking's client and coach may read its private projection; coach discovery exposes no client schedule.
- Empty and unavailable states remain explicit. Fixture-only bookings or times must not masquerade as persisted runtime state.
- Daniel Park is the only fictional coach seeded with a generated portrait in the first image slice. Other demo coaches intentionally prove the initials fallback; generated faces do not represent real professionals.
- `hoang@users.movx.test` is a persistent local passwordless test account for manual account-avatar validation. It is not a hosted seed, production identity or coach account.
- No screen claims payment, wallet verification, blockchain finality or financial protection.

## 9. Scheduling behavior and permissions

- Public coach discovery includes visible approved user profiles and explicitly labelled visible fictional fixtures, each with confirmed locations.
- A pending or rejected applicant may edit only a private coach-profile draft. Only an approved coach owner publishes that profile or edits recurring availability.
- A verified account owner may replace/remove only their private account avatar. Only an approved coach owner may replace/remove their separately public coach portrait; image ownership never substitutes for coach approval.
- A coach composes recurring availability as a local working-week draft and explicitly saves the complete selection; one authorized atomic operation replaces the active rule set and synchronizes dated occurrences once.
- A suspended coach is removed from discovery and cannot publish availability or receive new bookings; existing booking history and bounded terminal actions remain available to the owning parties.
- Only a verified signed-in client books, and never against their own coach profile.
- Only the booking client or coach cancels a future confirmed booking.
- Only the booking coach completes an elapsed confirmed booking.
- Unrelated accounts receive no booking identity or mutation capability.
- Removing a recurring rule does not silently delete terminal booking history.

## 10. Security and failure invariants

- Actor context is derived from a verified session and set transaction-locally.
- Direct table permissions remain least privilege; security-definer functions validate actor context and exact identifiers.
- Coach approval/rejection/suspension is unavailable to ordinary runtime roles. Decisions are expected-state guarded and atomically append immutable review evidence.
- Editable profile fields, Auth metadata, URL parameters and historical activation timestamps never establish approval or badge state.
- Capacity-one enforcement exists in PostgreSQL, not only in browser button state.
- Cross-run identifiers, hidden coaches, self-booking, elapsed/non-open occurrences and invalid lifecycle transitions fail closed.
- Mutation errors return bounded messages without database/Auth internals.
- Browser inputs are normalized and bounded; server/domain validation is authoritative.
- Uploaded images reject unsupported types and oversized/malformed data, are decoded and re-encoded server-side with metadata removed, and use immutable owner-scoped object paths. Browser-reported names, types and dimensions are not trusted.
- Private booking queries are actor-scoped and reveal only necessary display/time/location fields.
- Hosted builds reject loopback/incomplete database/Auth configuration without printing values.

## 11. Definition of done

The scheduling-only MVP is complete when:

- guests can browse a truthful list of fictional coaches and future open times, with an optional synchronized map and usable list fallback;
- one verified email account can enter through the client or coach-application path while retaining the same underlying identity and client capability;
- a pending applicant cannot self-approve, publish, manage availability or receive new bookings;
- a guarded platform review can approve/reject/suspend an application with immutable evidence, and only current real approval produces the bounded verified badge;
- an approved coach can publish/edit a visible profile, confirmed location and recurring one-hour availability;
- every authorized account receives `My sessions` in primary navigation while approved, demo and suspended coaches additionally receive `Coach workspace`; approved/demo coach Profile defaults to coach Profile while account-avatar controls retain personal Profile access;
- an account may optionally upload/remove a private normalized avatar, and an approved coach may separately upload/remove a public normalized portrait; all missing/failed image states retain initials;
- an owning coach can recognize the client on a confirmed booking by that client's current private avatar or stable initials without receiving public or terminal-history access to the image;
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

| Scenario                        | Expected result                                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest opens Explore             | Visible fictional coaches and confirmed locations load; map failure leaves the list usable.                                                                     |
| Guest opens coach profile       | Public profile and persisted open times load without private booking/client data.                                                                               |
| Guest attempts booking          | Sign-in is required; no booking mutation occurs.                                                                                                                |
| New client completes onboarding | The account can browse and book without receiving coach capability.                                                                                             |
| Client opens My sessions        | Only that account's upcoming bookings and retained history load; ordinary, pending and rejected accounts receive this primary-navigation destination.           |
| User applies to coach           | One pending application is created; a private draft is available but public coach/scheduling authority remains denied.                                          |
| Platform approves coach         | The exact pending application becomes approved with immutable review evidence; primary navigation adds `Coach workspace` while retaining `My sessions`.         |
| Public approved coach is shown  | The profile displays `Verified coach` with the bounded MovX review explanation; fictional fixtures display `Demo coach` instead.                                |
| Coach is suspended              | Discovery, new availability and new bookings are blocked while existing history and permitted terminal booking actions remain intact.                           |
| Coach opens primary navigation  | Approved/demo coaches see Profile → Schedule → Bookings consistently inside coach views; main Profile opens coach Profile, while account-avatar controls retain personal Profile. Suspended coaches retain My sessions, Coach workspace and personal Profile without coach-profile editing. |
| Client manages account avatar   | A valid image becomes private account presentation after canonical normalization; replacement/removal is owner-only and missing/failure keeps initials.         |
| Coach manages public portrait   | An approved coach explicitly uploads/removes public coach media without exposing the private account avatar or changing coach authority.                        |
| Guest views coach without photo | The public card/profile renders stable initials; only Daniel Park has the first generated fictional fixture portrait.                                           |
| Coach views booked client       | Bookings shows a confirmed booking's client name and current private avatar or initials only to its owning coach; Schedule shows only occupied-slot status, while terminal, unrelated and public requests get no image bytes. |
| Coach publishes availability    | Multiple draft selections persist together on explicit save; valid one-hour occurrences then appear publicly with stable timezone/location snapshots.           |
| Client books open time          | One confirmed booking is created and the occurrence becomes booked atomically.                                                                                  |
| Same client retries booking     | The existing active booking is returned; no duplicate row is created.                                                                                           |
| Different client races          | Exactly one client succeeds; the other receives a conflict.                                                                                                     |
| Coach books own time            | Request fails without mutation.                                                                                                                                 |
| Client cancels future booking   | Booking becomes cancelled, cancellation identity/time are recorded and the occurrence reopens.                                                                  |
| Coach cancels future booking    | Same terminal/reopen behavior applies only to that coach's booking.                                                                                             |
| Coach completes elapsed booking | Booking becomes completed once; client/unrelated coach cannot complete it.                                                                                      |
| Database/Auth unavailable       | UI shows bounded unavailable/signed-out state and fabricates no booking or time.                                                                                |
| Removed URL is requested        | Wallet, Solana, event and social/feed routes are unavailable and cannot mutate state.                                                                           |

## 14. Demo

1. A guest opens Explore, filters the list and opens a fictional coach with real published availability.
2. The guest signs in by email, selects an open time and receives one confirmed booking without wallet or payment prompts.
3. A second client attempts the same occurrence and receives a conflict.
4. The first client cancels; the time reopens and remains available after reload.
5. A coach edits recurring availability, views a prepared elapsed booking and marks it completed.

The demonstration proves scheduling authority and concurrency only. It makes no claim about payment, attendance, professional credentials or dispute resolution.
