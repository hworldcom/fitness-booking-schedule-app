import "server-only";

import { withDatabaseConnection } from "../client";

type ApplicationIdentityRow = Readonly<{
  identity_profile_id: string;
  identity_profile_slug: string;
  identity_display_name: string;
  identity_run_id: string;
  identity_run_slug: string;
  identity_run_name: string;
  identity_role: string;
}>;

export type ApplicationIdentityRecord = Readonly<{
  profileId: string;
  profileSlug: string;
  displayName: string;
  runId: string;
  runSlug: string;
  runName: string;
  role: string;
}>;

export class ApplicationIdentityConflictError extends Error {
  constructor() {
    super("Application profile enrollment conflicts with existing state.");
    this.name = "ApplicationIdentityConflictError";
  }
}

function mapIdentity(row: ApplicationIdentityRow): ApplicationIdentityRecord {
  return Object.freeze({
    profileId: row.identity_profile_id,
    profileSlug: row.identity_profile_slug,
    displayName: row.identity_display_name,
    runId: row.identity_run_id,
    runSlug: row.identity_run_slug,
    runName: row.identity_run_name,
    role: row.identity_role,
  });
}

function isIdentityConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P0001"
  );
}

async function oneIdentity(
  work: () => Promise<ApplicationIdentityRow[]>,
): Promise<ApplicationIdentityRecord | null> {
  try {
    const rows = await work();
    if (rows.length > 1) throw new ApplicationIdentityConflictError();
    return rows[0] ? mapIdentity(rows[0]) : null;
  } catch (error) {
    if (isIdentityConflict(error)) {
      throw new ApplicationIdentityConflictError();
    }
    throw error;
  }
}

export function enrollApplicationProfile(
  authUserId: string,
  displayName: string,
) {
  return withDatabaseConnection(({ queryClient }) =>
    oneIdentity(
      () => queryClient<ApplicationIdentityRow[]>`
        select *
        from app.enroll_application_identity(
          ${authUserId}::uuid,
          ${displayName}::text
        )
      `,
    ),
  );
}

export function currentApplicationProfile(authUserId: string) {
  return withDatabaseConnection(({ queryClient }) =>
    oneIdentity(
      () => queryClient<ApplicationIdentityRow[]>`
        select *
        from app.current_application_identity(${authUserId}::uuid)
      `,
    ),
  );
}
