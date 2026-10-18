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
  fitnessDemoCoachSeedSql,
  DEMO_FIXTURE_VERSION,
  assertDemoCoachStates,
  demoCoachDefaultsSql,
  needsDemoInitialization,
  sqlLiteral,
  type DemoCoachState,
} from "./demo-coach-fixtures";
import {
  generateDemoPassword,
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

export async function provisionDemoCoaches(args: readonly string[]) {
  const environment = demoEnvironmentArgument(args);
  const resetPasswords = args.includes("--reset-passwords");
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
  let store: Awaited<ReturnType<typeof privateDemoCredentialStore>> | undefined;
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
      if (args.includes("--check")) {
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
    if (args.includes("--check")) {
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
    // One exact additive fixture block, after target validation; no broad re-seed.
    await query(
      `begin; ${fitnessDemoCoachSeedSql(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"))} commit; select true prepared;`,
    );
    const rows =
      await query(`select p.id::text profile_id,p.auth_user_id::text,p.record_source,p.claimed_at::text,c.run_id::text,r.slug run_slug,r.status run_status,d.status participant_status,d.role participant_role,c.public_slug,c.record_source coach_record_source,c.is_demo
      from app.profiles p join app.coach_profiles c on c.profile_id=p.id join app.demo_runs r on r.id=c.run_id join app.demo_run_participants d on d.profile_id=p.id and d.run_id=c.run_id
      where p.id in (${DEMO_COACH_FIXTURES.map((coach) => sqlLiteral(coach.profileId) + "::uuid").join(",")}) order by p.id;`);
    assertDemoCoachStates(rows as unknown as DemoCoachState[]);
    const [schema] = await query(
      "select to_regclass('app.coach_website_content') is not null website, to_regprocedure('app.record_password_method(uuid)') is not null passwords;",
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
        for (const part of ["password", "profile", "website"] as const)
          needsDemoInitialization(byId.app_metadata, part);
      } else if (
        rows.find((row) => row.profile_id === coach.profileId)?.auth_user_id
      )
        throw new Error(
          `Bound demo account is missing for ${coach.slug}; repair it explicitly before setup.`,
        );
    }
    store = await privateDemoCredentialStore(root, environment, target);
    const profileIds: string[] = [],
      websiteIds: string[] = [],
      passwordIds: string[] = [];
    const currentUsers = new Map<string, User>();
    for (const coach of DEMO_COACH_FIXTURES) {
      let user = users.find((candidate) => candidate.id === coach.authUserId);
      const metadata = user?.app_metadata ?? {};
      const configurePassword =
        !user ||
        resetPasswords ||
        needsDemoInitialization(metadata, "password");
      const defaults = {
        ...metadata,
        ...(environment === "local" ? { movx_local_demo: true } : {}),
        movx_demo_environment: environment,
        movx_coach_profile_id: coach.profileId,
        movx_coach_slug: coach.slug,
      };
      if (configurePassword) {
        const previous = store.credentials.coaches[coach.slug];
        const credential =
          !resetPasswords && previous?.initializedAt === null
            ? previous
            : {
                email: coach.email,
                authUserId: coach.authUserId,
                password: generateDemoPassword(),
                initializedAt: null,
              };
        store.credentials.coaches[coach.slug] = credential;
        await store.save(); // Journal the secret before the administrative mutation.
        const attributes = {
          email: coach.email,
          password: credential.password,
          email_confirm: true,
          app_metadata: defaults,
        };
        const response = user
          ? await auth.auth.admin.updateUserById(user.id, attributes)
          : await auth.auth.admin.createUser({
              ...attributes,
              id: coach.authUserId,
              user_metadata: { display_name: coach.displayName },
            });
        if (response.error || !response.data.user)
          throw new Error(
            `Could not initialize ${coach.slug}'s demo password. Private journal retained; rerun setup.`,
          );
        user = response.data.user;
        passwordIds.push(coach.profileId);
      }
      if (!user) throw new Error("Missing demo Auth user.");
      assertDemoAuthUser(coach, user, environment);
      if (needsDemoInitialization(metadata, "profile"))
        profileIds.push(coach.profileId);
      if (schema.website && needsDemoInitialization(metadata, "website"))
        websiteIds.push(coach.profileId);
      currentUsers.set(coach.profileId, user);
    }
    await query(demoCoachDefaultsSql(profileIds, websiteIds, passwordIds));
    for (const coach of DEMO_COACH_FIXTURES) {
      const user = currentUsers.get(coach.profileId)!;
      const parts = {
        ...(passwordIds.includes(coach.profileId)
          ? { movx_demo_password_version: DEMO_FIXTURE_VERSION }
          : {}),
        ...(profileIds.includes(coach.profileId)
          ? { movx_demo_profile_version: DEMO_FIXTURE_VERSION }
          : {}),
        ...(websiteIds.includes(coach.profileId)
          ? { movx_demo_website_version: DEMO_FIXTURE_VERSION }
          : {}),
      };
      if (Object.keys(parts).length) {
        const response = await auth.auth.admin.updateUserById(user.id, {
          app_metadata: { ...user.app_metadata, ...parts },
        });
        if (response.error)
          throw new Error(
            `Could not record completed demo setup for ${coach.slug}; private journal retained.`,
          );
      }
      const credential = store.credentials.coaches[coach.slug];
      if (credential && passwordIds.includes(coach.profileId))
        credential.initializedAt = new Date().toISOString();
    }
    await store.save();
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
      `Prepared ${DEMO_COACH_FIXTURES.length} Demo coaches in ${environment}. Private initial tester logins: ${path.relative(root, store.file)} (passwords are not printed).`,
    );
    if (!schema.website)
      console.log(
        "Hosted-dev website migration is not installed; existing profiles are ready and sample website content will initialize after that migration.",
      );
    if (!schema.passwords)
      console.log(
        "Hosted-dev authentication migrations are not installed; provider password login is ready, full current-application Auth requires the separately owned rollout.",
      );
    for (const coach of DEMO_COACH_FIXTURES)
      if (!store.credentials.coaches[coach.slug])
        console.log(
          `${coach.email}: existing password preserved; obtain its existing credential or explicitly use --reset-passwords.`,
        );
  } finally {
    await store?.close();
    await closeDatabase();
    if (work) await rm(work, { recursive: true, force: true });
  }
}
