# Ticket DEV0270: Remove retired local Supabase containers

- Status: Completed
- Created: 2026-10-16
- Last updated: 2026-10-16
- Milestone: Local infrastructure cleanup after hosted-dev adoption
- Coordination: None — independent development ticket
- Related records: completed hosted defaults [DEV0269](../../archive/backend/DEV0269-default-local-startup-to-hosted-dev.md) and hosted setup [DEV0267](../../archive/backend/DEV0267-connect-new-hosted-dev-environment.md); external environment coordination [COR0026](../../current/organisatory/COR0026-separate-hosted-dev-and-production.md); independent retained-data continuity [DEV0232](../../current/organisatory/DEV0232-restore-local-migration-continuity.md).

## Objective and context

The user explicitly authorizes stopping/removing this application's local Docker database/image after switching normal startup to hosted dev. Retire its associated local Supabase containers and images unused by other containers, preserving named database/upload volumes and unrelated projects. Follow the [hosted infrastructure arrangement](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries); no application or hosted database change is required.

## Scope and non-goals

- In scope: nonsecret Docker ownership/image/reference/volume inspection, graceful stop and removal of this app's five Supabase containers, removal of its two exclusive images, volume/unrelated-resource/port checks, actual hosted read-only verification and this operation record/index.
- Out of scope: deleting volumes/local records/uploads, pruning Docker globally, removing shared images, other projects, hosted/prod writes, applying calendar SQL, restarting existing app processes or changing product/runtime code.

## Expected behavior and edge cases

The five containers labelled `com.supabase.cli.project=fitness-booking-social-app` and `com.supabase.cli.workdir=/Users/hoangdeveloper/fitness-booking-schedule-app` stop and are removed by exact ID. Remove only the preflight image IDs that have no other container references. Recheck ownership/references immediately before mutation; skip unexpected/shared resources rather than force deletion. Keep named PostgreSQL and Storage volumes. Normal app commands continue using hosted dev. Explicit future Docker startup may download removed images/recreate containers; retained history still requires DEV0232's continuity review.

## Assumptions, decisions, and dependencies

Read-only inspection found PostgreSQL, Storage, Mailpit, Auth and Kong running for the exact project/workdir. PostgreSQL image `public.ecr.aws/supabase/postgres:17.11.0.004` and Storage image `public.ecr.aws/supabase/storage-api:v1.79.36` have no other container consumers. Mailpit `v1.31.3`, GoTrue `v2.197.0` and Kong `2.8.1` also support retained `merchants-payments-app` containers and must remain. Twenty-three unrelated containers are outside the operation. The new explicit removal request supersedes preserving this app's running Docker services from DEV0269; it does not authorize deleting their retained data. No additional confirmation is needed for this bounded authorized cleanup.

## Implementation plan

1. Capture only IDs, names, labels, image IDs/tags, state, mount names and ports in a private temporary manifest; never print container environments or credentials. Record initial named-volume identity and unrelated container states.
2. Revalidate exact ownership and mounted named volumes. Gracefully stop the four dependent services, then PostgreSQL, using bounded timeouts. Remove only the five stopped exact IDs without `--volumes` or force.
3. Recheck references for each exclusive image and remove it non-forcibly by exact image ID; retain all shared images. Do not run prune, volume deletion or network/global cleanup.
4. Verify project container absence, exclusive-image removal, unchanged named volumes/shared images/unrelated containers and closed former local service ports. Run the existing actual hosted runtime verifier and normal startup preflight without sending mail or changing data.
5. Finish evidence and archive the completed record, maintaining the index. No commit is implied by this new operation request.

## Acceptance criteria

- [x] AC1: Only this app's identified local Supabase containers are stopped/removed, and its unused PostgreSQL/Storage images are removed without force or broad pruning.
- [x] AC2: Named database/upload volumes and unrelated containers/shared images are preserved; unexpected resource reuse causes refusal rather than deletion.
- [x] AC3: Former local service ports are no longer served, hosted dev still passes runtime/startup checks, and exact outcome/recovery/limitations are recorded with passing documentation checks.

## Validation plan

Compare bounded Docker metadata before/after, verify volume identity/creation metadata without reading private content, inspect remaining image references, probe ports 55321/55322/55324 and run the existing 20-check hosted verifier plus `npm run dev -- --check`. Check local record links/index/IDs/status and formatting/whitespace. No app/source change means application tests, type/build, browser viewport and migrations are not applicable; the real hosted check verifies the relevant external-state transition.

## Implementation record

### Changes and rationale

Stopped and removed the five running Supabase containers owned by this exact repository/project, then removed the unshared PostgreSQL and Storage image IDs. Preserved the two named data volumes, three shared images and all 23 unrelated containers. This releases the retired local services after hosted-dev adoption without deleting retained database/upload data.

Removed containers: `supabase_db_fitness-booking-social-app`, `supabase_storage_fitness-booking-social-app`, `supabase_inbucket_fitness-booking-social-app`, `supabase_auth_fitness-booking-social-app` and `supabase_kong_fitness-booking-social-app`. Removed images: `public.ecr.aws/supabase/postgres:17.11.0.004` and `public.ecr.aws/supabase/storage-api:v1.79.36`. No other app resource was selected by name alone: project/workdir labels, exact IDs, image IDs and named mounts were checked before mutation.

### Affected files

This ticket and [`tickets/README.md`](../../README.md) record the bounded local operation. Docker resources are external state; no app/SQL/credential file changes.

### Decisions and deviations

Used graceful 20-second stop timeouts for dependent services before PostgreSQL, then removed only stopped containers with no volume/force flag. Rechecked image consumers immediately before deleting each exclusive ID. Retained Mailpit, GoTrue and Kong images because another project's stopped containers still reference them. No global prune, force removal or network deletion. No deviation from the recorded plan.

### Contracts, configuration, and operations

No environment variable, data shape, dependency, migration, Auth setting or product contract changes. Current local fixture services become unavailable by user request. Recovery is explicit Docker image download/service recreation with retained volumes and a reviewed migration-continuity plan; hosted dev remains the normal app target.

## Validation results

- AC1: all five bounded Docker mutation commands exited 0. Exact commands are recorded below. Post-operation `docker ps -a -q --filter label=com.supabase.cli.project=fitness-booking-social-app` returned no containers. `docker image inspect` of both removed exclusive IDs failed as expected because the images are absent. No `-f`, `--volumes`, image/volume prune or global cleanup was used.
- AC2: `docker volume inspect supabase_db_fitness-booking-social-app supabase_storage_fitness-booking-social-app` confirms both volumes remain with identical Name/Driver/CreatedAt/Mountpoint/Scope/Labels metadata. All 23 unrelated container IDs/names/states/image IDs match preflight. Shared Mailpit/GoTrue/Kong image IDs and tags remain unchanged. Container environments, database rows and uploaded files were not read as part of removal verification.
- AC3: socket probes to `127.0.0.1:55321`, `:55322` and `:55324` refuse connections after removal. `node --env-file=.env.development.local scripts/verify-hosted-runtime-database.mjs --environment dev` passed all 20 actual hosted permission checks after Docker removal. `npm run dev -- --check` passed with the existing ignored dev configuration and map-worker hook, without creating a local database or starting an app process. No mail or hosted write was performed.
- Documentation validation: local link/anchor/unique-ID/next-ID/index/status/independent-membership checks passed (181 unique records, 207 local links, eight anchors); rechecked after archival. Installed targeted Prettier and `git diff --check` passed. App tests/types/build/browser/migration suites were not run because no runtime or SQL source changed; running the Docker suites would recreate the intentionally retired services.

### Exact removal commands

Recorded from the private operation journal; every command exited 0. The long IDs deliberately bind removal to the preflight resources rather than a later resource with the same name.

```sh
docker stop --time 20 9bb3f9f7a5dc58bebf3b7210291769b02d56e59f8fb08a4a8ab31a6ace26eb72 58953b08c320c0754ed4297865466a87d17c0b077d0f4b9b7eef9043ce960cb9 aff3b9509c7893f410a6780096885ea6f7e20f86cd76c4df634f283f9bee91d9 b64771aee2c0c6f2048fce6458c8f783d2e2d73f42d38d1e288f8a21c9f57d5e
docker stop --time 20 374a964d369942c516b2a794fa7def66975ed55fe64924dd6bb44823488b7f0d
docker rm 374a964d369942c516b2a794fa7def66975ed55fe64924dd6bb44823488b7f0d 58953b08c320c0754ed4297865466a87d17c0b077d0f4b9b7eef9043ce960cb9 9bb3f9f7a5dc58bebf3b7210291769b02d56e59f8fb08a4a8ab31a6ace26eb72 aff3b9509c7893f410a6780096885ea6f7e20f86cd76c4df634f283f9bee91d9 b64771aee2c0c6f2048fce6458c8f783d2e2d73f42d38d1e288f8a21c9f57d5e
docker image rm sha256:a013b49972d5a2264e86e44c72a1e3d51c47c5d436f2fe24a497a4b26fdf802b
docker image rm sha256:332ad0dfbb0a9d5906fc6d94a44fa6a530ed5a01083495d2631ac8b5ba608411
```

## Risks, limitations, and follow-ups

Docker-specific database/browser rehearsals cannot run until their services are explicitly recreated; calendar work must account for this new user-requested cleanup. Removing a container/image does not delete named database or Storage data. Existing app processes keep their original target until their owner restarts them. This does not retire DEV0232's retained-ledger issue or deploy/apply the new calendar migration.

## Completion and review references

- Completed: 2026-10-16; all three criteria passed with local-resource and actual hosted verification.
- Commit: Included in the user-authorized `[DEV0270] Record retired local Supabase cleanup` commit on 2026-10-16.
- Review: Ownership/operation self-review; no independent review.
- Deployment or release: No hosted deployment/mutation.
