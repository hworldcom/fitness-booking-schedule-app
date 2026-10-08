export type SeededCoachAccount = Readonly<{
  authUserId: string;
  profileId: string;
  slug: string;
  displayName: string;
  email: string;
  seedParticipantRole: "member" | "operator";
}>;

export const SEEDED_COACH_ACCOUNTS = Object.freeze([
  Object.freeze({
    authUserId: "90000000-0000-4000-8000-000000000002",
    profileId: "10000000-0000-4000-8000-000000000002",
    slug: "daniel-park",
    displayName: "Daniel Park",
    email: "daniel.park@coaches.movx.test",
    seedParticipantRole: "member",
  }),
  Object.freeze({
    authUserId: "90000000-0000-4000-8000-000000000005",
    profileId: "10000000-0000-4000-8000-000000000005",
    slug: "sam-lee",
    displayName: "Sam Lee",
    email: "sam.lee@coaches.movx.test",
    seedParticipantRole: "operator",
  }),
  Object.freeze({
    authUserId: "90000000-0000-4000-8000-000000000007",
    profileId: "10000000-0000-4000-8000-000000000007",
    slug: "nora-klein",
    displayName: "Nora Klein",
    email: "nora.klein@coaches.movx.test",
    seedParticipantRole: "operator",
  }),
  Object.freeze({
    authUserId: "90000000-0000-4000-8000-000000000008",
    profileId: "10000000-0000-4000-8000-000000000008",
    slug: "idris-malik",
    displayName: "Idris Malik",
    email: "idris.malik@coaches.movx.test",
    seedParticipantRole: "operator",
  }),
  Object.freeze({
    authUserId: "90000000-0000-4000-8000-000000000009",
    profileId: "10000000-0000-4000-8000-000000000009",
    slug: "elif-demir",
    displayName: "Elif Demir",
    email: "elif.demir@coaches.movx.test",
    seedParticipantRole: "operator",
  }),
]) satisfies readonly SeededCoachAccount[];

export type LocalSupabaseStatus = Readonly<{
  apiUrl: string;
  databaseUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
}>;

function unquote(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

export function parseLocalSupabaseStatus(output: string): LocalSupabaseStatus {
  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;
    values.set(key, unquote(line.slice(separator + 1).trim()));
  }

  const apiUrl = values.get("API_URL");
  const databaseUrl = values.get("DB_URL");
  const publishableKey =
    values.get("PUBLISHABLE_KEY") ?? values.get("ANON_KEY");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!apiUrl || !databaseUrl || !publishableKey || !serviceRoleKey) {
    throw new Error(
      "The local Supabase status is missing API_URL, DB_URL, a publishable key or SERVICE_ROLE_KEY.",
    );
  }
  return Object.freeze({
    apiUrl,
    databaseUrl,
    publishableKey,
    serviceRoleKey,
  });
}

function isLoopbackHostname(hostname: string) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

export function assertLoopbackSupabaseTargets(
  status: Pick<LocalSupabaseStatus, "apiUrl" | "databaseUrl">,
) {
  let api: URL;
  let database: URL;
  try {
    api = new URL(status.apiUrl);
    database = new URL(status.databaseUrl);
  } catch {
    throw new Error("The local Supabase status contains an invalid URL.");
  }

  if (
    api.protocol !== "http:" ||
    !api.port ||
    !isLoopbackHostname(api.hostname) ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.port ||
    !isLoopbackHostname(database.hostname)
  ) {
    throw new Error(
      "Local Supabase operations are allowed only against loopback Auth and PostgreSQL endpoints.",
    );
  }
}

export type AuthUserSummary = Readonly<{
  id: string;
  email?: string;
  email_confirmed_at?: string;
  app_metadata?: Record<string, unknown>;
}>;

export function assertReusableCoachAuthUser(
  coach: SeededCoachAccount,
  user: AuthUserSummary,
) {
  if (
    user.id !== coach.authUserId ||
    user.email?.toLowerCase() !== coach.email ||
    !user.email_confirmed_at ||
    user.app_metadata?.movx_local_demo !== true ||
    user.app_metadata?.movx_coach_profile_id !== coach.profileId ||
    user.app_metadata?.movx_coach_slug !== coach.slug
  ) {
    throw new Error(
      `The local Auth identity reserved for ${coach.displayName} conflicts with existing state.`,
    );
  }
}

export type SeededCoachDatabaseState = Readonly<{
  profile_id: string;
  profile_slug: string;
  profile_display_name: string;
  profile_record_source: string;
  auth_user_id: string | null;
  claimed_at: Date | string | null;
  coaching_activated_at: Date | string | null;
  run_id: string;
  run_slug: string;
  run_status: string;
  run_catalogue_visibility: string;
  participant_role: string;
  participant_status: string;
  public_slug: string;
  coach_visibility: string;
  coach_record_source: string;
  coach_is_demo: boolean;
  discipline_count: string | number;
}>;

export function assertSeededCoachDatabaseState(
  rows: readonly SeededCoachDatabaseState[],
  expectedState: "seeded-or-provisioned" | "provisioned",
) {
  if (rows.length !== SEEDED_COACH_ACCOUNTS.length) {
    throw new Error("The five expected seeded coach records are unavailable.");
  }

  const rowsByProfile = new Map(rows.map((row) => [row.profile_id, row]));
  for (const coach of SEEDED_COACH_ACCOUNTS) {
    const row = rowsByProfile.get(coach.profileId);
    if (
      !row ||
      row.profile_slug !== coach.slug ||
      row.profile_display_name !== coach.displayName ||
      row.public_slug !== coach.slug ||
      row.run_id !== "20000000-0000-4000-8000-000000000001" ||
      row.run_slug !== "local-foundation-2030" ||
      row.run_status !== "active" ||
      row.run_catalogue_visibility !== "public" ||
      row.participant_status !== "active" ||
      row.coach_visibility !== "visible" ||
      row.coach_is_demo !== true ||
      Number(row.discipline_count) < 1 ||
      row.coaching_activated_at === null
    ) {
      throw new Error(
        `The seeded database record for ${coach.displayName} conflicts with the provisioning allowlist.`,
      );
    }

    const isSeeded =
      row.profile_record_source === "fixture" &&
      row.auth_user_id === null &&
      row.claimed_at === null &&
      row.participant_role === coach.seedParticipantRole &&
      row.coach_record_source === "fixture";
    const isProvisioned =
      row.profile_record_source === "user" &&
      row.auth_user_id === coach.authUserId &&
      row.claimed_at !== null &&
      row.participant_role === "member" &&
      row.coach_record_source === "user";

    if (
      !isProvisioned &&
      !(expectedState === "seeded-or-provisioned" && isSeeded)
    ) {
      throw new Error(
        `The identity state for ${coach.displayName} is neither an untouched fixture nor its expected local account.`,
      );
    }
  }
}
