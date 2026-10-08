# Scheduling database operations

This directory contains MovX Club's checked-in Supabase PostgreSQL history. Files under `migrations/` are the only applied migration source of truth. Drizzle mirrors current runtime tables for typed server queries and does not own a second migration journal.

Historical migrations intentionally remain replayable even when they create wallet, payment, social or event tables that the scheduling-only runtime no longer reads. Do not remove or rewrite an applied migration. Use a new reviewed forward migration for corrections.

## Local workflow

Prerequisites are Node.js 24.21.x, the locked npm dependencies and a running Docker-compatible container runtime. This repository uses PostgreSQL port `55322`.

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:runtime
npm run db:test
npm run test:db
npm run db:lint
```

`db:reset` is destructive only to this repository's disposable local database. It replays every migration and then runs `seed.sql`. `db:runtime` provisions the loopback-only `repx_runtime_login`, which inherits the restricted `app_runtime` role. Local application routes use:

```dotenv
DATABASE_URL=postgresql://repx_runtime_login:postgres@127.0.0.1:55322/postgres
```

The local integration suite connects as the disposable PostgreSQL administrator so it can create and clean fixtures, then exercises application repositories through the restricted runtime login. Browser code never receives `DATABASE_URL`.

## Local email Auth

Switch from the database-only profile to the Auth-enabled profile before rehearsing sign-in:

```sh
npm run db:stop
npm run auth:start
npm run auth:status
npm run db:runtime
```

Copy the printed public API URL and publishable key into the variables documented in `.env.example`. The command deliberately omits secret/service-role keys. Open `http://localhost:3100/sign-in`, request a one-time code, and read it from Mailpit at `http://127.0.0.1:55324`.

With the application running on port `3100`, `npm run test:auth` rehearses account creation, invalid-code handling, isolated profiles, sign-out and returning-account login. `npm run test:coach-availability` rehearses recurring availability. Neither flow requires payment or external identity tooling.

## Runtime authority

- Supabase Auth establishes email identity.
- Transaction-local actor context binds an Auth user to one application profile and demo run.
- Every enrolled account retains client capability. `app.submit_owned_coach_application()` records coach intent but cannot grant coach authority.
- Pending or rejected applicants may own only a hidden coach-profile draft. Current `approved` state is required to publish, manage availability or receive new bookings.
- `app.review_coach_application(uuid,text,text,text,text,text)` is owner-only, expected-state guarded and appends immutable review evidence atomically. It is never executable by `app_runtime` or browser roles.
- `app.coach_trust_kind(uuid,boolean)` derives the bounded public trust label: current real approvals are `verified`; fictional seed profiles are `demo`.
- `app.replace_owned_coach_availability_rules(jsonb, jsonb)` atomically replaces one coach's complete working week after checking the editor's persisted baseline, then synchronizes dated occurrences once.
- `app.book_direct_private_session(uuid)` atomically creates or recovers one confirmed booking and marks its occurrence booked.
- `app.cancel_direct_private_booking(uuid)` allows the booking client or coach to cancel a future confirmed booking and reopen its occurrence.
- `app.complete_direct_private_booking(uuid)` allows only the owning coach to complete an elapsed confirmed booking.
- `app.current_direct_private_bookings()` returns the bounded private projection only to the booking client or coach.
- Capacity-one enforcement and lifecycle constraints live in PostgreSQL, not browser state.

The migration connection owns objects through the `NOLOGIN` role `app_owner`. The `NOLOGIN` role `app_runtime` cannot bypass row-level security (RLS), cannot write scheduling tables directly and can execute only bounded functions. Browser-facing `anon`, `authenticated` and `service_role` roles have no `app` schema usage.

The interim `npm run coach:review` command uses a separate `COACH_REVIEW_DATABASE_URL` owner connection, defaults to dry-run and requires `--apply --confirm <exact-profile-id>` before changing state. Its policy checklist and examples are documented in the root README. This credential is an operator secret, not a runtime deployment variable. Historical `coaching_activated_at` values remain for continuity but no longer authorize coaching.

## Hosted runtime login

Hosted environments use a dedicated generated login that inherits only `app_runtime`. Store its password in the deployment provider's encrypted server-only settings; do not put it in a migration or prefix it with `NEXT_PUBLIC_`.

Use the Supabase transaction pooler on port `6543`. The username must include the project-reference suffix required by the shared pooler. Verify the assembled URL without printing it:

```sh
npm run db:verify:hosted-runtime
```

The verifier checks pooler use, role attributes, `app_runtime` membership, absence of `app_owner` membership, direct-write restrictions, direct-booking function access and browser-role isolation. It loads an ignored `.env.staging.local` when present and otherwise supports the project's existing macOS Keychain item.

The guarded Vercel build requires the complete database/Auth group whenever hosted runtime mode is enabled. Keep the Vercel function region close to the Supabase project and measure hosted connection behavior before changing the request-owned connection model in `src/server/db/client.ts`.

## Hosted changes and recovery

Review `npx supabase db push --linked --dry-run` before applying a hosted migration. Never run a linked reset against a project with user or booking data. Confirm a restorable provider backup before a risky forward migration, apply it in a bounded maintenance window, and rerun database/runtime verification afterward.

The scheduling-only migrations are additive: historical rows and tables remain, while new bookings leave the historical credit reference null. The coach-application migration retains historical activation/profile/booking data, marks known fictional coaches as demo records and moves prior user-created coach profiles to hidden pending state rather than silently verifying them. Rollback is application rollback plus a reviewed forward correction; do not delete historical provider or review data merely because the current runtime no longer reads it.
