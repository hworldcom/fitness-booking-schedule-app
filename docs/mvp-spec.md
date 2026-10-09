# MovX Club — Scheduling-only MVP specification

Last updated: 9 October 2026.

MovX is a focused scheduling product for martial-arts coaching. Guests discover platform-approved coaches or clearly labelled fictional demo coaches and their real published availability. Email-authenticated clients reserve one capacity-one private session directly. Approved coaches manage their public profile, training locations, location-aware recurring one-hour availability and booked schedule.

This standalone project intentionally has no blockchain, wallet, token, pass, credit, payment, group-funding, event-marketplace, follow, post or feed behavior. Completed and archived records for those features are historical evidence only and do not define current product behavior. Solana hackathon development belongs to the separate `fitness-booking-social-app` repository.

## 1. Product status and document authority

This document is the single current product contract for the standalone scheduling repository. It defines target behavior and does not claim every target is already implemented.

The repository contains reusable Next.js, Supabase/PostgreSQL, email identity, coach profile/location, list-first discovery, recurring availability, responsive calendar and Vercel foundations. Direct scheduling-only booking and the removal of obsolete runtime were delivered under completed [COR0011](../tickets/archive/organisatory/COR0011-scheduling-only-product.md).

Tickets record implementation scope and evidence; they do not override this specification. Archived tickets remain immutable history. [DEV0140](../tickets/archive/organisatory/DEV0140-adopt-scheduling-only-contract.md) records the decision to create this focused product split.

## 2. Confirmed target and decisions

The following constraints are confirmed for this scheduling project:

| ID  | Confirmed decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | MovX is a coach-discovery and private-session scheduling product, not a payment, financial, membership, social-network or event-funding product.                                                                                                                                                                                                                                                                                                                                                                      |
| C02 | Guests can browse visible coaches, confirmed public locations and open dated availability without signing in.                                                                                                                                                                                                                                                                                                                                                                                                         |
| C03 | Email-backed MovX accounts are the only client and coach identity authority. No wallet connection or signature is required.                                                                                                                                                                                                                                                                                                                                                                                           |
| C04 | A client books one exact future one-hour occurrence directly; no pass, credit balance, token or payment is required.                                                                                                                                                                                                                                                                                                                                                                                                  |
| C05 | One occurrence has capacity one. Database constraints and a single atomic mutation prevent two active bookings for the same occurrence.                                                                                                                                                                                                                                                                                                                                                                               |
| C06 | A client cannot book their own coach occurrence. Hidden coaches, withdrawn/elapsed slots and cross-dataset identifiers are unavailable.                                                                                                                                                                                                                                                                                                                                                                               |
| C07 | The client or owning coach may cancel a confirmed future booking. Cancellation reopens the occurrence while it is still future.                                                                                                                                                                                                                                                                                                                                                                                       |
| C08 | The owning coach may mark an elapsed confirmed booking completed. Completed and cancelled bookings are terminal.                                                                                                                                                                                                                                                                                                                                                                                                      |
| C09 | Client and coach onboarding are visibly separate paths into one email-backed account model. Client capability is the default; coach authority requires a platform-approved application.                                                                                                                                                                                                                                                                                                                               |
| C10 | Interactive maps use a provider-neutral application boundary backed by MapLibre GL JS and OpenFreeMap, while optional Geoapify search finds storage-permitted gyms and public places. The server-backed coach/time list and manual location entry remain usable when map or search services are unavailable.                                                                                                                                                                                                          |
| C11 | There are no group events, passes, credits, payments, wallets, follows, posts, feeds, messages, waitlists or external calendar synchronization in this MVP.                                                                                                                                                                                                                                                                                                                                                           |
| C12 | Native Next.js on Vercel with Supabase Auth/PostgreSQL is the hosted target. Secrets remain server-only environment values.                                                                                                                                                                                                                                                                                                                                                                                           |
| C13 | A real approved coach displays a `Verified coach` badge meaning MovX reviewed the account holder's identity and coach application; it does not guarantee licensing, competence or safety.                                                                                                                                                                                                                                                                                                                             |
| C14 | Primary account navigation is capability-aware: every authorized account sees `My sessions`, and approved, demo and suspended coaches additionally see `Coach workspace`. For approved/demo coaches the main `Profile` item defaults to coach Profile, while the account-avatar controls retain personal account Profile access. Signed-out navigation shows neither private destination.                                                                                                                             |
| C15 | Profile pictures are optional. An account avatar is private account presentation; a coach portrait is a separate explicitly public coach-profile asset. Signed-in account surfaces, including both navigation icons and Profile, prefer the private avatar and otherwise use the owner's public coach portrait as a display-only fallback. A client's `My sessions` cards show the booked coach's current public portrait and link the complete identity to the public coach profile. Missing images retain initials. |
| C16 | A coach may maintain multiple confirmed training locations and chooses exactly one active location as primary before the profile can be visible. The primary location is the coach's public training base; it grants no gym authority and never represents live tracking.                                                                                                                                                                                                                                             |
| C17 | Explore has no date selector in this delivery and pins every approved/demo visible coach once at the coach-selected primary location regardless of today's availability. The marker stays at that primary location; today's open times, when shown, identify their actual venues separately, and a coach with no open time today remains discoverable with an explicit state.                                                                                                                                         |
| C18 | Every recurring availability hour belongs to exactly one active location owned by that coach. The coach assigns multiple calendar cells locally and explicitly saves the complete location-aware draft once. The first delivery uses one coach scheduling timezone; dated occurrences and bookings retain immutable snapshots of their actual assigned locations.                                                                                                                                                     |

### Proposed implementation defaults

The following are implementation defaults rather than additional user decisions:

- Availability is materialized as dated one-hour occurrences for a rolling seven-day window from recurring weekly rules.
- Repeating the same booking request from the same client for the same active occurrence returns the existing booking rather than creating a duplicate.
- A coach or client cancellation records who cancelled and when; P0 does not require a reason field or notification delivery.
- Historical migrations may retain unused wallet/payment/event tables for safe forward compatibility. Current code does not read or expose them.
- Referenced training locations are deactivated rather than destructively deleted; changing the primary location is one atomic replacement.
- A location selected from optional provider search becomes bounded coach-owned profile data. It does not silently create a global gym or point-of-interest catalogue record.
- The location-aware calendar uses stable text cues in addition to color so every assigned venue remains understandable without color perception.

## 3. Actors and authority

### Guest

A guest can browse the public story, coach list, coach profiles, confirmed locations and future open times. A guest cannot reserve or mutate schedule state.

### Client

A client has a verified email-backed MovX account and application profile. The client can book one future occurrence with another coach, view only their own upcoming sessions and retained history in `My sessions`, cancel their own future confirmed booking and optionally manage a private account avatar. Ordinary clients plus pending and rejected coach applicants receive `My sessions` as their private primary-navigation destination and no `Coach workspace` item. An account avatar does not become public coach media merely because the account later applies to coach.

### Coach

A coach retains client capability, so approved and fictional demo coaches keep `My sessions` and additionally receive `Coach workspace` in desktop and mobile navigation. Their main `Profile` item opens coach Profile by default, while the bottom-left and upper-right account controls continue to open the personal account Profile. Coach Profile, Schedule and Bookings share one Profile-first sub-navigation at a stable top position, followed by the green view-specific hero and then that view's content; Schedule contains location-aware recurring availability and dated capacity status, while Bookings alone contains the detailed booked schedule, client identity/avatar and booking actions. After platform approval, the owner can publish their coach profile, manage multiple confirmed training locations, select one active primary location, optionally manage a separate public coach portrait, assign recurring availability to actual locations, inspect bookings for their own schedule, cancel a future confirmed booking and mark an elapsed confirmed booking completed. A pending or rejected applicant may prepare a private draft but has no public coach or scheduling authority. A suspended coach receives the same two private destinations, with bounded Bookings access needed to resolve existing sessions, but accepts no new bookings or public-media changes. A coach cannot see unrelated client bookings or private identity data.

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
2. Search and filters narrow the list. OpenFreeMap-backed discovery shows each visible coach once at that coach's confirmed active primary location without an application map key; map failure leaves the complete list usable.
3. The primary marker describes the coach's public training base, not live presence or today's venue. Explore has no date selector and keeps the coach visible when there is no open time today; any today summary labels the actual occurrence locations or reports `No availability today`.
4. A coach profile shows bounded public details, an optional public portrait, every confirmed active training location with the primary one labelled, and future open dated one-hour occurrences grouped or labelled by actual location. Missing portraits use initials rather than a fabricated image.
5. No placeholder time is shown when persistent availability is unavailable.

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

### 4.6 Manage locations and publish availability

1. An approved coach adds or confirms one or more provider-neutral training locations and selects exactly one active location as primary before publishing the profile.
2. The coach chooses an active location in Schedule, assigns one or more weekly cells to it locally and may switch locations to continue composing the complete working-week draft.
3. One explicit authorized save validates ownership, active-location state, the expected baseline and per-coach time overlap before replacing the complete recurring rule set and synchronizing dated occurrences once.
4. Every dated occurrence copies the actual assigned location snapshot. Changing the primary location never moves an existing occurrence or booking.
5. Deactivating a location stops new availability there and withdraws eligible future open occurrences while preserving booked and terminal history.

## 5. Scheduling state model

### Application profile

One profile belongs to one verified Supabase Auth identity inside a dataset. It stores the bounded display identity used for authorization and presentation.

### Coach application and review

One current coach application belongs to one application profile. Absence means not applied; submitted applications move through `pending`, `approved`, `rejected` or `suspended`. Review events are append-only evidence of platform decisions. Historical self-service activation may remain stored for continuity but grants no current coach authority.

### Coach profile and training locations

One owner-scoped coach profile contains public name, slug, biography, disciplines, visibility, one scheduling timezone and an optional public portrait reference. It owns one or more confirmed provider-neutral training-location records; each record has stable identity, kind, public label, coordinates, provenance and active/inactive lifecycle, and may optionally reference a reviewed gym. Exactly one active location is primary while the profile is visible. That primary record supplies the coach's single Explore marker and public training-base label, but it does not establish live presence, choose an occurrence venue or grant gym/account authority.

Pending/rejected applicants may keep only a private draft; a user-created profile enters public discovery only while its application is approved, its owner selects visible and one confirmed active primary location exists. Provider-search selection stores only the bounded coach-owned location the coach explicitly confirms and does not populate a global point-of-interest catalogue. Referenced locations are deactivated rather than destructively deleted so scheduling history remains resolvable.

### Profile images

Image bytes live in Supabase Storage rather than PostgreSQL or the Vercel deployment filesystem. PostgreSQL stores only bounded source/path/version metadata. Private account avatars and public coach portraits use separate storage/access contracts; attaching an image never grants account or coach authority. Signed-in account presentation—including the desktop bottom-left account control, upper-right header control and Profile—prefers its private avatar and otherwise may display the owner's already-public coach portrait as a read-only fallback. A regular account therefore shows its private avatar or initials, while a coach can additionally fall back to the public portrait. Client `My sessions` cards may project the booked coach's current public portrait and link its complete visible identity to the existing public coach profile; a missing, removed or unreadable portrait retains initials. The owning coach of a confirmed direct booking may also retrieve that booking client's current private avatar through a booking-scoped authenticated application route; cancellation or completion ends that additional access, public and unrelated actors receive no image bytes, and the browser never receives the private Storage object path. These fallbacks and bounded reads do not copy media between buckets or change which endpoint removes each image.

JPEG, PNG and WebP source selections are accepted for the first release. The browser corrects orientation, square-crops and downsizes before upload; the server treats that output as untrusted, validates and re-encodes one canonical 512 × 512 WebP at quality 82, strips metadata and retains no original. The selected source is limited to 8 MiB and the canonical upload to 512 KiB. Replacement writes a new immutable object path before retiring the prior owned object so content-delivery-network caches do not retain an overwritten image. Removal restores the initials fallback.

### Recurring availability and dated occurrence

A recurring weekly rule belongs to exactly one active training location owned by the same coach and creates deterministic dated one-hour occurrences in the coach's single scheduling timezone. One weekday/time cell belongs to at most one location. An occurrence is `open`, `booked` or `withdrawn`, carries the immutable snapshot of the rule's actual location and belongs to exactly one coach. Overlapping rules/occurrences are rejected across all of the coach's locations. Changing which location is primary does not change a rule or occurrence.

### Private booking

A private booking binds one occurrence, coach profile and client profile. Its current lifecycle is:

```text
Confirmed -> Cancelled
Confirmed -> Completed
```

Minimum projection fields are booking ID, occurrence ID, coach/client IDs, scheduled start/end, actual occurrence-location snapshot, status, creation/update timestamps, cancellation actor/time and completion time. It contains no wallet, pass, credit, token, price, transaction signature or chain reference.

## 6. Application and infrastructure boundaries

- Browser code receives only public configuration and bounded projections.
- Next.js server code verifies sessions and owns authorization/database calls.
- Supabase Auth establishes email identity; editable profile fields do not establish authority.
- PostgreSQL is authoritative for profiles, coach applications/reviews, locations, availability, occurrences and bookings.
- Supabase Storage owns normalized image objects. Private account-avatar access and public coach-portrait delivery remain separate; PostgreSQL stores only their bounded references.
- The location module isolates MapLibre/OpenFreeMap rendering and optional Geoapify gym/place search; stored provider-neutral coach-location and occurrence snapshots remain application authority, and legacy provider snapshots remain readable without calling their former provider. The module does not decide primary status, schedule assignment or coach authority.
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

- Public coach discovery includes visible approved user profiles and explicitly labelled visible fictional fixtures, each with exactly one confirmed active primary marker and all active locations available on its public profile.
- Explore keeps every otherwise visible coach on the map at the primary location regardless of today's availability. It has no date selector in this delivery; today's actual session venues or `No availability today` are presentation details and never move or remove the primary marker.
- A pending or rejected applicant may edit only a private coach-profile draft. Only an approved coach owner publishes that profile, manages public training locations or edits recurring availability.
- A verified account owner may replace/remove only their private account avatar. Only an approved coach owner may replace/remove their separately public coach portrait; image ownership never substitutes for coach approval.
- A visible coach has exactly one confirmed active primary location. Replacing primary is atomic, and the current primary cannot be deactivated without a valid replacement.
- A coach composes recurring availability as a local location-aware working-week draft: the selected active location is assigned to empty cells, every selected cell exposes its location through text as well as any color cue, and one explicit authorized save replaces the complete rule set and synchronizes dated occurrences once.
- Deactivating a location removes its active recurring rules and withdraws eligible future open occurrences without moving or deleting booked/terminal snapshots.
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
- Cross-run/cross-coach location identifiers, hidden coaches, self-booking, elapsed/non-open occurrences and invalid lifecycle transitions fail closed.
- PostgreSQL enforces one active primary location for a visible coach and prevents overlapping active occurrences across all of that coach's locations; browser colors, selectors and marker state are not authority.
- Mutation errors return bounded messages without database/Auth internals.
- Browser inputs are normalized and bounded; server/domain validation is authoritative.
- Uploaded images reject unsupported types and oversized/malformed data, are decoded and re-encoded server-side with metadata removed, and use immutable owner-scoped object paths. Browser-reported names, types and dimensions are not trusted.
- Private booking queries are actor-scoped and reveal only necessary display/time/location fields.
- Hosted builds reject loopback/incomplete database/Auth configuration without printing values.

## 11. Definition of done

The scheduling-only MVP is complete when:

- guests can browse a truthful list of fictional coaches and future open times, with every visible coach pinned once at the confirmed primary training location, truthful today/no-availability presentation and a usable list fallback when the map fails;
- one verified email account can enter through the client or coach-application path while retaining the same underlying identity and client capability;
- a pending applicant cannot self-approve, publish, manage availability or receive new bookings;
- a guarded platform review can approve/reject/suspend an application with immutable evidence, and only current real approval produces the bounded verified badge;
- an approved coach can publish/edit a visible profile with multiple confirmed training locations, exactly one active primary location and recurring one-hour availability assigned to actual locations;
- a coach can compose multiple location assignments locally and save the complete working week once, while cross-location overlap or stale/inactive location input fails without partial replacement;
- every authorized account receives `My sessions` in primary navigation while approved, demo and suspended coaches additionally receive `Coach workspace`; approved/demo coach Profile defaults to coach Profile while account-avatar controls retain personal Profile access;
- an account may optionally upload/remove a private normalized avatar, and an approved coach may separately upload/remove a public normalized portrait; all missing/failed image states retain initials;
- a client's `My sessions` cards show the booked coach's current public portrait or initials and link the complete identity to the public coach profile;
- an owning coach can recognize the client on a confirmed booking by that client's current private avatar or stable initials without receiving public or terminal-history access to the image;
- a different signed-in client can reserve one open occurrence and reload the same confirmed booking;
- primary-location or training-location changes cannot move the actual location snapshot of an existing occurrence or booking;
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
4. **M3 — Scheduling interface:** present primary-location discovery, direct booking, client history, multiple coach locations and location-aware schedule management responsively.
5. **M4 — Hosted rehearsal:** deploy to Vercel with hosted Supabase and repeat the core scheduling flow with two accounts.

Payments, subscriptions, passes, wallets, group classes/events, waitlists, messaging, reviews, attendance disputes, external calendar synchronization and notification delivery require separately reviewed future contracts.

## 13. Acceptance matrix

| Scenario                        | Expected result                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest opens Explore             | Every visible approved/demo coach loads once at the confirmed primary training location whether or not today has an open time; today/no-availability presentation names actual venues, there is no date selector and map failure leaves the complete list usable.                           |
| Guest opens coach profile       | All active training locations, the labelled primary location and persisted open times with their actual venues load without private booking/client data.                                                                                                                                    |
| Guest attempts booking          | Sign-in is required; no booking mutation occurs.                                                                                                                                                                                                                                            |
| New client completes onboarding | The account can browse and book without receiving coach capability.                                                                                                                                                                                                                         |
| Client opens My sessions        | Only that account's upcoming bookings and retained history load; each coach identity shows its current public portrait or initials and links to the public profile; ordinary, pending and rejected accounts receive this primary-navigation destination.                                    |
| User applies to coach           | One pending application is created; a private draft is available but public coach/scheduling authority remains denied.                                                                                                                                                                      |
| Platform approves coach         | The exact pending application becomes approved with immutable review evidence; primary navigation adds `Coach workspace` while retaining `My sessions`.                                                                                                                                     |
| Public approved coach is shown  | The profile displays `Verified coach` with the bounded MovX review explanation; fictional fixtures display `Demo coach` instead.                                                                                                                                                            |
| Coach is suspended              | Discovery, new availability and new bookings are blocked while existing history and permitted terminal booking actions remain intact.                                                                                                                                                       |
| Coach opens primary navigation  | Approved/demo coaches see Profile → Schedule → Bookings consistently inside coach views; main Profile opens coach Profile, while account-avatar controls retain personal Profile. Suspended coaches retain My sessions, Coach workspace and personal Profile without coach-profile editing. |
| Client manages account avatar   | A valid image becomes private account presentation after canonical normalization; replacement/removal is owner-only and missing/failure keeps initials.                                                                                                                                     |
| Coach manages public portrait   | An approved coach explicitly uploads/removes public coach media without exposing the private account avatar or changing coach authority.                                                                                                                                                    |
| Coach manages locations         | An approved coach can maintain multiple confirmed training locations and atomically choose exactly one active primary; a pending/rejected draft stays private, and a suspended/unrelated account cannot publish changes.                                                                    |
| Coach changes primary location  | The Explore marker moves to the new primary training base, while recurring assignments, dated occurrences and bookings keep their actual locations.                                                                                                                                         |
| Coach deactivates a location    | The primary requires a valid replacement; active rules and eligible future open occurrences at the deactivated location stop, while booked/terminal snapshots remain intact.                                                                                                                |
| Guest views coach without photo | The public card/profile renders stable initials; only Daniel Park has the first generated fictional fixture portrait.                                                                                                                                                                       |
| Coach views booked client       | Bookings shows a confirmed booking's client name and current private avatar or initials only to its owning coach; Schedule shows only occupied-slot status, while terminal, unrelated and public requests get no image bytes.                                                               |
| Coach publishes availability    | Multiple location-assigned draft selections persist together on explicit save; each cell has one owned active location, cross-location overlap fails atomically and valid one-hour occurrences appear with actual immutable location snapshots.                                             |
| Client books open time          | One confirmed booking is created and the occurrence becomes booked atomically with the occurrence's actual venue rather than the coach's primary-location fallback.                                                                                                                         |
| Same client retries booking     | The existing active booking is returned; no duplicate row is created.                                                                                                                                                                                                                       |
| Different client races          | Exactly one client succeeds; the other receives a conflict.                                                                                                                                                                                                                                 |
| Coach books own time            | Request fails without mutation.                                                                                                                                                                                                                                                             |
| Client cancels future booking   | Booking becomes cancelled, cancellation identity/time are recorded and the occurrence reopens.                                                                                                                                                                                              |
| Coach cancels future booking    | Same terminal/reopen behavior applies only to that coach's booking.                                                                                                                                                                                                                         |
| Coach completes elapsed booking | Booking becomes completed once; client/unrelated coach cannot complete it.                                                                                                                                                                                                                  |
| Database/Auth unavailable       | UI shows bounded unavailable/signed-out state and fabricates no booking or time.                                                                                                                                                                                                            |
| Removed URL is requested        | Wallet, Solana, event and social/feed routes are unavailable and cannot mutate state.                                                                                                                                                                                                       |

## 14. Demo

1. A guest opens Explore, sees each visible coach once at the labelled primary training location and opens a fictional coach whose today status names the actual availability venue or explicitly reports none.
2. The guest signs in by email, selects an open time and receives one confirmed booking without wallet or payment prompts.
3. A second client attempts the same occurrence and receives a conflict.
4. The first client cancels; the time reopens and remains available after reload.
5. A coach maintains two training locations, chooses one primary map base, assigns recurring hours to actual venues in one saved draft, views a prepared elapsed booking and marks it completed without moving its stored location.

The demonstration proves scheduling authority and concurrency only. It makes no claim about payment, attendance, professional credentials or dispute resolution.
