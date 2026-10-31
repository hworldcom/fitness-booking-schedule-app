// MOV-144: operator only. Never loads an implicit hosted/staging environment.
import { parseArgs } from "node:util";
import postgres from "postgres";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function main() {
  const { values: v } = parseArgs({
    options: {
      "profile-id": { type: "string" },
      "run-id": { type: "string" },
      "expected-revision": { type: "string" },
      status: { type: "string" },
      reason: { type: "string" },
      operator: { type: "string" },
      target: { type: "string" },
      apply: { type: "boolean", default: false },
      confirm: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (v.help) {
    console.log(
      'Owner-only staff assignment/revocation. Default: dry-run. Set COACH_REVIEW_DATABASE_URL explicitly.\n--target host:port/database --profile-id UUID --run-id UUID --expected-revision N --status active|revoked --reason "10–500 characters" --operator reference\nAfter inspecting the summary: --apply --confirm profile-id:run-id:status:expected-revision',
    );
    return;
  }
  const revision = Number(v["expected-revision"]);
  if (
    !uuid.test(v["profile-id"] ?? "") ||
    !uuid.test(v["run-id"] ?? "") ||
    !/^\d{1,6}$/.test(v["expected-revision"] ?? "") ||
    !Number.isInteger(revision) ||
    revision > 999999 ||
    !["active", "revoked"].includes(v.status) ||
    typeof v.reason !== "string" ||
    v.reason.trim().length < 10 ||
    v.reason.length > 500 ||
    typeof v.operator !== "string" ||
    v.operator.trim().length < 3 ||
    v.operator.length > 120 ||
    /[\u0000-\u001f\u007f]/u.test(v.reason + v.operator)
  )
    throw Error("Invalid staff command. Run with --help.");
  const raw = process.env.COACH_REVIEW_DATABASE_URL;
  if (!raw)
    throw Error(
      "Set COACH_REVIEW_DATABASE_URL explicitly; never use an app runtime credential.",
    );
  const url = new URL(raw);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.pathname === "/"
  )
    throw Error("Use a complete privileged PostgreSQL URL.");
  const target = `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  if (v.target !== target)
    throw Error(
      "--target must exactly match the configured database host:port/database.",
    );
  const confirm = `${v["profile-id"]}:${v["run-id"]}:${v.status}:${revision}`;
  if (v.apply ? v.confirm !== confirm : !!v.confirm)
    throw Error(
      "Applying requires the exact profile-id:run-id:status:expected-revision confirmation.",
    );
  const db = postgres(raw, {
    ssl: ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ? false
      : "require",
    max: 1,
    prepare: false,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    await db`set statement_timeout='10s'`;
    const [authority] =
      await db`select r.rolsuper or pg_has_role(current_user,'app_owner','MEMBER') allowed from pg_roles r where r.rolname=current_user`;
    if (!authority?.allowed)
      throw Error("An owner-privileged operator connection is required.");
    const [summary] =
      await db`select p.id profile_id,m.run_id,p.display_name,u.email,app.staff_account_active(p.id,m.run_id) account_active,coalesce(s.revision,0) revision,s.status from app.profiles p join app.demo_run_participants m on m.profile_id=p.id join auth.users u on u.id=p.auth_user_id left join app.platform_staff s on s.run_id=m.run_id and s.profile_id=p.id where p.id=${v["profile-id"]}::uuid and m.run_id=${v["run-id"]}::uuid`;
    if (!summary) throw Error("The exact profile/dataset was not found.");
    console.log(
      JSON.stringify({
        mode: v.apply ? "apply" : "dry-run",
        target,
        account: summary,
        requestedStatus: v.status,
        expectedRevision: revision,
      }),
    );
    if (v.apply) {
      const [result] =
        await db`select app.set_platform_staff(${v["profile-id"]}::uuid,${v["run-id"]}::uuid,${revision},${v.status},${v.reason.trim()},${v.operator.trim()}) revision`;
      console.log(
        JSON.stringify({ status: "saved", revision: result.revision }),
      );
    } else if (Number(summary.revision) !== revision)
      throw Error(
        "The expected revision is stale. Inspect the saved assignment before applying.",
      );
  } finally {
    await db.end({ timeout: 1 });
  }
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error && !(error instanceof postgres.PostgresError)
      ? error.message
      : "Staff assignment failed. Inspect the saved assignment before retrying; no credentials were printed.",
  );
  process.exitCode = 1;
}
