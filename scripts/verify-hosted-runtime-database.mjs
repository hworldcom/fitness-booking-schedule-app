import postgres from "postgres";
import {
  hostedEnvironmentArgument,
  hostedRuntimeConfiguration,
  redactHostedError,
} from "./lib/hosted-environment.mjs";

let configuration;
try {
  configuration = hostedRuntimeConfiguration(
    process.env,
    hostedEnvironmentArgument(process.argv.slice(2)),
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Hosted configuration is invalid.",
  );
  process.exit(1);
}
const databaseUrl = configuration.connectionString;
const expectedUser = configuration.runtimeUser;
const connection = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
  connect_timeout: 10,
  idle_timeout: 5,
});

try {
  const [role] = await connection`
    select
      current_user as current_user_name,
      runtime.rolcanlogin,
      runtime.rolsuper,
      runtime.rolcreatedb,
      runtime.rolcreaterole,
      runtime.rolinherit,
      runtime.rolreplication,
      runtime.rolbypassrls,
      pg_has_role(current_user, 'app_runtime', 'member') as has_runtime_membership,
      pg_has_role(current_user, 'app_owner', 'member') as has_owner_membership,
      has_database_privilege(current_user, current_database(), 'create') as can_create_schema,
      has_schema_privilege(current_user, 'app', 'usage') as has_app_schema_usage,
      has_table_privilege(current_user, 'app.profiles', 'select') as can_select_profiles,
      has_table_privilege(current_user, 'app.coach_private_bookings', 'select') as can_select_bookings,
      has_table_privilege(current_user, 'app.coach_private_bookings', 'insert') as can_insert_bookings,
      has_function_privilege(
        current_user,
        'app.current_application_identity(uuid)',
        'execute'
      ) as can_read_current_identity,
      has_function_privilege(
        current_user,
        'app.enroll_application_identity(uuid,text)',
        'execute'
      ) as can_enroll_identity,
      has_function_privilege(
        current_user,
        'app.create_coach_booking_request(uuid)',
        'execute'
      ) as can_create_request,
      has_function_privilege(current_user,'app.accept_coach_booking_request(uuid)','execute') as can_accept_request,
      has_schema_privilege('anon', 'app', 'usage') as anon_has_app_usage,
      has_schema_privilege('authenticated', 'app', 'usage') as authenticated_has_app_usage,
      has_schema_privilege('service_role', 'app', 'usage') as service_role_has_app_usage
    from pg_roles as runtime
    where runtime.rolname = current_user
  `;

  if (!role) {
    throw new Error("The connected database role was not visible in pg_roles.");
  }

  const permissionChecks = [
    {
      name: `the database session runs as ${expectedUser}`,
      passed: role.current_user_name === expectedUser,
    },
    { name: "the role may log in", passed: role.rolcanlogin === true },
    { name: "the role is not a superuser", passed: role.rolsuper === false },
    {
      name: "the role cannot create databases",
      passed: role.rolcreatedb === false,
    },
    {
      name: "the role cannot create roles",
      passed: role.rolcreaterole === false,
    },
    {
      name: "the role inherits group grants",
      passed: role.rolinherit === true,
    },
    {
      name: "the role cannot replicate",
      passed: role.rolreplication === false,
    },
    {
      name: "the role cannot bypass row-level security",
      passed: role.rolbypassrls === false,
    },
    {
      name: "the role inherits app_runtime",
      passed: role.has_runtime_membership === true,
    },
    {
      name: "the role does not inherit app_owner",
      passed: role.has_owner_membership === false,
    },
    {
      name: "the role cannot create schemas",
      passed: role.can_create_schema === false,
    },
    {
      name: "the role may use the private app schema",
      passed: role.has_app_schema_usage === true,
    },
    {
      name: "the role may select profiles through row-level security",
      passed: role.can_select_profiles === true,
    },
    {
      name: "the role may select actor-scoped private bookings",
      passed: role.can_select_bookings === true,
    },
    {
      name: "the role cannot insert private bookings directly",
      passed: role.can_insert_bookings === false,
    },
    {
      name: "the role may execute the bounded identity lookup",
      passed: role.can_read_current_identity === true,
    },
    {
      name: "the role may execute bounded identity enrollment",
      passed: role.can_enroll_identity === true,
    },
    {
      name: "the role may execute bounded booking requests",
      passed: role.can_create_request === true,
    },
    {
      name: "browser-facing database roles cannot use the app schema",
      passed:
        role.anon_has_app_usage === false &&
        role.authenticated_has_app_usage === false &&
        role.service_role_has_app_usage === false,
    },
  ];

  const checks = [
    ...permissionChecks,
    {
      name: "the role may execute bounded request acceptance",
      passed: role.can_accept_request === true,
    },
  ];
  for (const check of checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.name}`);
  }

  const failures = checks.filter((check) => !check.passed);
  if (failures.length > 0) {
    throw new Error(
      `Hosted runtime verification failed ${failures.length} check(s).`,
    );
  }

  console.log(
    `Hosted ${configuration.environment} runtime database access is correctly restricted.`,
  );
} catch (error) {
  console.error(
    `Hosted runtime database verification failed: ${redactHostedError(error, databaseUrl)}`,
  );
  process.exitCode = 1;
} finally {
  await connection.end({ timeout: 5 });
}
