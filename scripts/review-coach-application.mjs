import postgres from "postgres";

const DEFAULT_POLICY = "movx-identity-application-v1";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function usage() {
  return [
    "Review one coach application with an owner-privileged database connection.",
    "",
    "Dry run (default):",
    '  npm run coach:review -- --profile-id <uuid> --expected pending --decision approved --reason "Reviewed identity and application" --reviewer <reference>',
    "",
    "Apply after checking the dry-run summary:",
    '  npm run coach:review -- --profile-id <uuid> --expected pending --decision approved --reason "Reviewed identity and application" --reviewer <reference> --apply --confirm <same-uuid>',
    "",
    "Set COACH_REVIEW_DATABASE_URL to a privileged direct PostgreSQL URL. The application runtime database login is intentionally insufficient.",
  ].join("\n");
}

function parseArguments(argv) {
  const values = new Map();
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      if (apply) throw new Error("--apply was provided more than once.");
      apply = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    if (values.has(argument)) {
      throw new Error(`${argument} was provided more than once.`);
    }
    values.set(argument, value);
    index += 1;
  }
  const allowed = new Set([
    "--profile-id",
    "--expected",
    "--decision",
    "--reason",
    "--reviewer",
    "--policy",
    "--confirm",
  ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new Error(`Unsupported option: ${key}`);
  }
  return Object.freeze({
    profileId: values.get("--profile-id") ?? "",
    expected: values.get("--expected") ?? "",
    decision: values.get("--decision") ?? "",
    reason: (values.get("--reason") ?? "").trim().replaceAll(/\s+/g, " "),
    reviewer: (values.get("--reviewer") ?? "").trim().replaceAll(/\s+/g, " "),
    policy: values.get("--policy") ?? DEFAULT_POLICY,
    confirm: values.get("--confirm") ?? "",
    apply,
  });
}

function validateArguments(input) {
  if (!UUID_PATTERN.test(input.profileId)) {
    throw new Error("--profile-id must be a canonical UUID.");
  }
  const legalTransition =
    (input.expected === "pending" &&
      ["approved", "rejected"].includes(input.decision)) ||
    (input.expected === "approved" && input.decision === "suspended");
  if (!legalTransition) {
    throw new Error("Use pending→approved/rejected or approved→suspended.");
  }
  if (
    input.reason.length < 10 ||
    input.reason.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(input.reason)
  ) {
    throw new Error("--reason must contain 10–500 printable characters.");
  }
  if (
    input.reviewer.length < 3 ||
    input.reviewer.length > 120 ||
    /[\u0000-\u001f\u007f]/.test(input.reviewer)
  ) {
    throw new Error("--reviewer must contain 3–120 printable characters.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$/.test(input.policy)) {
    throw new Error(
      "--policy must be a lowercase hyphenated version identifier.",
    );
  }
  if (input.apply && input.confirm !== input.profileId) {
    throw new Error(
      "Applying requires --confirm with the exact target profile UUID.",
    );
  }
  if (!input.apply && input.confirm) {
    throw new Error("--confirm is valid only together with --apply.");
  }
}

function databaseConfiguration() {
  const raw = process.env.COACH_REVIEW_DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "COACH_REVIEW_DATABASE_URL is required. Use an owner-privileged direct PostgreSQL URL, never the application runtime login.",
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("COACH_REVIEW_DATABASE_URL is not a valid URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("COACH_REVIEW_DATABASE_URL must use PostgreSQL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  return Object.freeze({ raw, ssl: local ? false : "require" });
}

async function applicationSummary(connection, profileId) {
  const rows = await connection`
    select
      application.profile_id::text,
      application.status,
      application.revision,
      application.submitted_at,
      application.decided_at,
      application.decision_reason,
      application.verification_policy_version,
      coach.public_slug,
      coach.display_name,
      coach.visibility,
      coach.is_demo,
      coach.location_confirmed_at is not null as location_complete,
      exists (
        select 1
        from app.coach_profile_disciplines as discipline
        where discipline.run_id = coach.run_id
          and discipline.profile_id = coach.profile_id
      ) as disciplines_complete
    from app.coach_applications as application
    left join app.coach_profiles as coach
      on coach.profile_id = application.profile_id
    where application.profile_id = ${profileId}::uuid
  `;
  if (rows.length !== 1) {
    throw new Error("The exact coach application was not found.");
  }
  return rows[0];
}

function safeSummary(row) {
  return Object.freeze({
    profileId: row.profile_id,
    status: row.status,
    revision: Number(row.revision),
    submittedAt: new Date(row.submitted_at).toISOString(),
    decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
    decisionReason: row.decision_reason,
    policy: row.verification_policy_version,
    coachSlug: row.public_slug,
    coachDisplayName: row.display_name,
    coachVisibility: row.visibility,
    demoProfile: row.is_demo,
    applicationComplete:
      row.location_complete === true && row.disciplines_complete === true,
  });
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log(usage());
    return;
  }
  const input = parseArguments(process.argv.slice(2));
  validateArguments(input);
  const configuration = databaseConfiguration();
  const database = postgres(configuration.raw, {
    max: 1,
    prepare: false,
    ssl: configuration.ssl,
  });
  try {
    const before = await applicationSummary(database, input.profileId);
    console.log("Coach application review target:");
    console.log(JSON.stringify(safeSummary(before), null, 2));
    console.log(
      `Requested transition: ${input.expected} -> ${input.decision} (${input.policy})`,
    );
    if (!input.apply) {
      console.log("Dry run only. No database state was changed.");
      return;
    }

    const result = await database.begin(async (transaction) => {
      const reviewed = await transaction`
        select app.review_coach_application(
          ${input.profileId}::uuid,
          ${input.expected}::text,
          ${input.decision}::text,
          ${input.reason}::text,
          ${input.reviewer}::text,
          ${input.policy}::text
        ) as status
      `;
      const after = await applicationSummary(transaction, input.profileId);
      return { status: reviewed[0]?.status, after };
    });
    if (result.status !== input.decision) {
      throw new Error("The review operation returned an unexpected state.");
    }
    console.log("Coach application review applied:");
    console.log(JSON.stringify(safeSummary(result.after), null, 2));
  } finally {
    await database.end({ timeout: 5 });
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Coach application review failed: ${message}`);
  console.error(usage());
  process.exitCode = 1;
}
