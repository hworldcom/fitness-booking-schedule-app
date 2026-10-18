import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type User } from "@supabase/supabase-js";
import postgres from "postgres";
import { assertLocalSupabaseConfiguration } from "./local-supabase-project.mjs";
import { parseLocalSupabaseStatus } from "./local-coach-accounts";
import {
  assertDemoLocalTarget,
  demoEnvironmentArgument,
  demoHostedTarget,
} from "./demo-coach-target";
import {
  DEMO_COACH_FIXTURES,
  DEMO_FIXTURE_VERSION,
  assertDemoCoachStates,
  demoCoachDefaultsSql,
  demoCoachPublicUrlStatements,
  sqlLiteral,
  type DemoCoachState,
} from "./demo-coach-fixtures";
import {
  generateDemoPassword,
  attachDemoCoachUrls,
  demoCoachPublicUrl,
  privateDemoCredentialStore,
  type DemoEnvironment,
} from "./demo-coach-credentials";

type Query = (sql: string) => Promise<Record<string, unknown>[]>;
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export function assertDemoAuthUser(
  coach: (typeof DEMO_COACH_FIXTURES)[number],
  user: User,
  environment: DemoEnvironment,
) {
  const metadata = user.app_metadata;
  if (
    user.id !== coach.authUserId ||
    user.email?.toLowerCase() !== coach.email ||
    !user.email_confirmed_at ||
    metadata.movx_coach_profile_id !== coach.profileId ||
    metadata.movx_coach_slug !== coach.slug ||
    !(
      metadata.movx_demo_environment === environment ||
      (environment === "local" &&
        metadata.movx_local_demo === true &&
        metadata.movx_demo_environment === undefined)
    )
  )
    throw new Error(`Reserved demo Auth identity conflicts for ${coach.slug}.`);
}

// Only accounts absent from the validated inventory can enter the write path.
// Initialization markers on an existing account never authorize an upgrade.
export async function createMissingDemoAccounts({
  users,
  environment,
  auth,
  query,
  openStore,
  siteUrl = "http://localhost:3100",
}: {
  users: readonly User[];
  environment: DemoEnvironment;
  auth: Pick<ReturnType<typeof createClient>, "auth">;
  query: Query;
  openStore: () => Promise<
    Awaited<ReturnType<typeof privateDemoCredentialStore>>
  >;
  siteUrl?: string;
}) {
  const missing = DEMO_COACH_FIXTURES.filter(
    (coach) => !users.some((user) => user.id === coach.authUserId),
  );
  if (!missing.length) return { created: 0 };
  const store = await openStore();
  try {
    const created: User[] = [];
    for (const coach of missing) {
      const previous = store.credentials.coaches[coach.slug];
      const credential =
        previous?.initializedAt === null
          ? previous
          : {
              email: coach.email,
              authUserId: coach.authUserId,
              password: generateDemoPassword(),
              initializedAt: null,
            };
      store.credentials.coaches[coach.slug] = credential;
      store.credentials.coaches[coach.slug].publicUrl = demoCoachPublicUrl(
        siteUrl,
        coach.username,
      );
      await store.save();
      const response = await auth.auth.admin.createUser({
        id: coach.authUserId,
        email: coach.email,
        password: credential.password,
        email_confirm: true,
        user_metadata: { display_name: coach.displayName },
        app_metadata: {
          ...(environment === "local" ? { movx_local_demo: true } : {}),
          movx_demo_environment: environment,
          movx_coach_profile_id: coach.profileId,
          movx_coach_slug: coach.slug,
        },
      });
      if (response.error || !response.data.user)
        throw new Error(
          `Could not create ${coach.slug}'s missing demo account. Private journal retained.`,
        );
      assertDemoAuthUser(coach, response.data.user, environment);
      created.push(response.data.user);
    }
    const ids = missing.map((coach) => coach.profileId);
    await query(demoCoachDefaultsSql(ids, [], ids));
    for (const user of created) {
      const coach = missing.find((entry) => entry.authUserId === user.id)!;
      const response = await auth.auth.admin.updateUserById(user.id, {
        app_metadata: {
          ...user.app_metadata,
          movx_demo_password_version: DEMO_FIXTURE_VERSION,
          movx_demo_profile_version: DEMO_FIXTURE_VERSION,
        },
      });
      if (response.error)
        throw new Error(
          `Could not finish ${coach.slug}'s new account initialization; explicit repair may be required.`,
        );
      store.credentials.coaches[coach.slug].initializedAt =
        new Date().toISOString();
    }
    await store.save();
    return { created: created.length };
  } finally {
    await store.close();
  }
}

export async function provisionDemoCoaches(args: readonly string[]) {
  const environment = demoEnvironmentArgument(args);
  const root = process.cwd();
  const cli = (args: string[]) => {
    try {
      return execFileSync(path.join(root, "node_modules/.bin/supabase"), args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
    } catch {
      throw new Error(
        "Supabase CLI operation failed. Check local services or hosted-dev CLI login/project access; no fallback target was used.",
      );
    }
  };
  let query: Query, apiUrl: string, key: string, target: string;
  let closeDatabase = async () => {};
  let work: string | undefined;
  try {
    if (environment === "local") {
      assertLocalSupabaseConfiguration(
        readFileSync(path.join(root, "supabase/config.toml"), "utf8"),
      );
      const status = parseLocalSupabaseStatus(cli(["status", "-o", "env"]));
      assertDemoLocalTarget(status);
      apiUrl = status.apiUrl;
      key = status.serviceRoleKey;
      target = "movx-club-local";
      const database = postgres(status.databaseUrl, {
        max: 1,
        prepare: false,
        ssl: false,
        connect_timeout: 10,
        onnotice: () => {},
      });
      closeDatabase = () => database.end({ timeout: 5 });
      query = (sql) =>
        database.unsafe(sql) as unknown as Promise<Record<string, unknown>[]>;
    } else {
      const configuration = demoHostedTarget(process.env);
      target = configuration.projectRef;
      apiUrl = `https://${target}.supabase.co`;
      if (args.includes("--check") && !args.includes("--publish-urls")) {
        console.log(
          "Validated exact hosted-dev demo target; no data or credentials changed.",
        );
        return;
      }
      work = await mkdtemp(path.join(tmpdir(), "movx-demo-coaches-"));
      await mkdir(path.join(work, "supabase"));
      await writeFile(
        path.join(work, "supabase/config.toml"),
        'project_id="dev0335_demo_coaches"\n',
        { mode: 0o600 },
      );
      query = async (sql) => {
        const file = path.join(work!, `${randomUUID()}.sql`);
        await writeFile(file, sql, { mode: 0o600 });
        try {
          const result = JSON.parse(
            cli([
              "db",
              "query",
              "--linked",
              "--project-ref",
              target,
              "--workdir",
              work!,
              "--file",
              file,
              "--output",
              "json",
            ]),
          );
          if (!Array.isArray(result.rows))
            throw new Error("Unexpected hosted-dev database response.");
          return result.rows;
        } finally {
          await rm(file, { force: true });
        }
      };
      const keys = JSON.parse(
        cli([
          "projects",
          "api-keys",
          "--project-ref",
          target,
          "--output",
          "json",
          "--reveal",
        ]),
      ) as { name?: string; type?: string; api_key: string }[];
      key =
        (
          keys.find((entry) => entry.type === "secret") ??
          keys.find((entry) => entry.name === "service_role")
        )?.api_key ?? "";
      if (key.length < 40)
        throw new Error("Hosted-dev administrative Auth key is unavailable.");
    }
    if (args.includes("--check") && !args.includes("--publish-urls")) {
      console.log(
        "Validated exact local demo target; no data or credentials changed.",
      );
      return;
    }

    const [disciplines] = await query(
      "select count(*)::int supported from pg_constraint where connamespace='app'::regnamespace and conname in ('coach_profile_disciplines_value_check','coach_group_sessions_discipline_check','group_events_discipline_check') and pg_get_constraintdef(oid) like '%''Fitness''%';",
    );
    if (disciplines.supported !== 3)
      throw new Error(
        "Apply the Fitness migration 20261018000500 to this nonproduction target before demo setup. No fixture or account changes were made.",
      );
    const rows =
      await query(`select p.id::text profile_id,p.auth_user_id::text,p.record_source,p.claimed_at::text,c.run_id::text,r.slug run_slug,r.status run_status,d.status participant_status,d.role participant_role,c.public_slug,c.record_source coach_record_source,c.is_demo
      from app.profiles p join app.coach_profiles c on c.profile_id=p.id join app.demo_runs r on r.id=c.run_id join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id
      where p.id in (${DEMO_COACH_FIXTURES.map((coach) => sqlLiteral(coach.profileId) + "::uuid").join(",")}) order by p.id;`);
    assertDemoCoachStates(rows as unknown as DemoCoachState[]);
    const [schema] = await query(
      "select to_regclass('app.coach_website_content') is not null website, to_regprocedure('app.record_password_method(uuid)') is not null passwords, to_regclass('app.coach_public_handles') is not null and to_regprocedure('app.public_coach_handle(text,boolean)') is not null public_urls;",
    );
    const auth = createClient(apiUrl, key, options);
    const users: User[] = [];
    const reserved = await query(
      `select id::text,email from auth.users where id in (${DEMO_COACH_FIXTURES.map((coach) => sqlLiteral(coach.authUserId) + "::uuid").join(",")}) or lower(email) in (${DEMO_COACH_FIXTURES.map((coach) => sqlLiteral(coach.email)).join(",")});`,
    );
    for (const coach of DEMO_COACH_FIXTURES) {
      const byId = reserved.find((row) => row.id === coach.authUserId);
      const byEmail = reserved.find(
        (row) => String(row.email).toLowerCase() === coach.email,
      );
      if (!byId && !byEmail) continue;
      if (!byId || !byEmail || byId.id !== byEmail.id)
        throw new Error(`Reserved demo email/ID conflicts for ${coach.slug}.`);
      const { data, error } = await auth.auth.admin.getUserById(
        coach.authUserId,
      );
      if (error || !data.user)
        throw new Error(
          `Unable to inspect reserved demo identity ${coach.slug}.`,
        );
      users.push(data.user);
    }
    // Validate every ID/email before creating or changing any account.
    for (const coach of DEMO_COACH_FIXTURES) {
      const byId = users.find((user) => user.id === coach.authUserId);
      const byEmail = users.find(
        (user) => user.email?.toLowerCase() === coach.email,
      );
      if (byId || byEmail) {
        if (!byId || !byEmail || byId.id !== byEmail.id)
          throw new Error(
            `Reserved demo email/ID conflicts for ${coach.slug}.`,
          );
        assertDemoAuthUser(coach, byId, environment);
        const state = rows.find((row) => row.profile_id === coach.profileId);
        if (
          state?.auth_user_id !== byId.id ||
          state.record_source !== "user" ||
          state.coach_record_source !== "user" ||
          state.participant_role !== "member"
        )
          throw new Error(
            `Existing demo binding needs explicit repair for ${coach.slug}; no existing data was changed.`,
          );
      } else if (
        rows.find((row) => row.profile_id === coach.profileId)?.auth_user_id
      )
        throw new Error(
          `Bound demo account is missing for ${coach.slug}; repair it explicitly before setup.`,
        );
    }
    const publishingUrls = args.includes("--publish-urls");
    const hasMissingAccounts = users.length < DEMO_COACH_FIXTURES.length;
    if ((publishingUrls || hasMissingAccounts) && !schema.public_urls)
      throw new Error(
        "Public URL migration 20261018000600 is required before demo account creation or URL publication. No data or credentials changed.",
      );
    const siteUrl =
      environment === "local"
        ? "http://localhost:3100"
        : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
    if (publishingUrls || hasMissingAccounts)
      demoCoachPublicUrl(siteUrl, DEMO_COACH_FIXTURES[0].username);
    if (publishingUrls) {
      if (hasMissingAccounts)
        throw new Error(
          "URL-only mode requires the six existing bound demo accounts. Run explicit fresh setup for missing untouched fixtures first.",
        );
      if (args.includes("--check")) {
        console.log(
          `Verified ${environment} demo identities and public URL schema. No data or private tester files changed.`,
        );
        return;
      }
      const store = await privateDemoCredentialStore(
        root,
        environment,
        target,
        {
          preserveNote: true,
        },
      );
      try {
        await query(
          `begin; ${demoCoachPublicUrlStatements(DEMO_COACH_FIXTURES.map((c) => c.profileId))} commit; select true as urls_prepared;`,
        );
        const names = await query(
          `select a.profile_id::text,a.username from app.account_personal_details a join app.coach_public_handles h on h.profile_id=a.profile_id and h.username=a.username where a.profile_id in (${DEMO_COACH_FIXTURES.map((c) => sqlLiteral(c.profileId) + "::uuid").join(",")});`,
        );
        if (
          attachDemoCoachUrls(
            store.credentials,
            names as { profile_id: string; username: string }[],
            siteUrl,
          )
        )
          await store.save();
        console.log(
          `Prepared public URLs for six existing ${environment} Demo coaches. Other data and passwords preserved; existing private tester entries include publicUrl.`,
        );
      } finally {
        await store.close();
      }
      return;
    }
    const initialized = await createMissingDemoAccounts({
      users,
      environment,
      auth,
      query,
      openStore: () => privateDemoCredentialStore(root, environment, target),
      siteUrl,
    });
    const resolved = await query(
      `select expected.id::text auth_user_id,i.identity_profile_id::text,i.identity_role from unnest(array[${DEMO_COACH_FIXTURES.map((c) => sqlLiteral(c.authUserId)).join(",")}]::uuid[]) expected(id) cross join lateral app.current_application_identity(expected.id) i;`,
    );
    if (
      resolved.length !== DEMO_COACH_FIXTURES.length ||
      resolved.some(
        (row) =>
          !DEMO_COACH_FIXTURES.some(
            (coach) =>
              coach.authUserId === row.auth_user_id &&
              coach.profileId === row.identity_profile_id,
          ) || row.identity_role !== "member",
      )
    )
      throw new Error(
        "Demo application identities did not resolve to the original allowlisted member profiles.",
      );
    console.log(
      `Verified ${DEMO_COACH_FIXTURES.length} Demo coaches in ${environment}; created ${initialized.created} missing accounts. Existing data and passwords preserved. Private initial tester logins: work/demo-coaches/${environment}.json (passwords are not printed).`,
    );
    if (!schema.website)
      console.log(
        "Website schema is unavailable. Existing profiles remain unchanged; setup does not backfill their content.",
      );
    if (!schema.passwords)
      console.log(
        "Hosted-dev authentication migrations are not installed; provider password login is ready, full current-application Auth requires the separately owned rollout.",
      );
  } finally {
    await closeDatabase();
    if (work) await rm(work, { recursive: true, force: true });
  }
}
