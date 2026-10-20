import { hostedRuntimeConfiguration } from "./lib/hosted-environment.mjs";

const CORE_VARIABLES = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

function fail(message) {
  throw new Error(`Vercel environment validation failed: ${message}`);
}

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function validateCompleteGroup(names, label) {
  const present = names.filter((name) => value(name));
  if (present.length !== 0 && present.length !== names.length) {
    const missing = names.filter((name) => !value(name));
    fail(`${label} is incomplete; missing ${missing.join(", ")}.`);
  }
  return present.length === names.length;
}

function parsedUrl(name) {
  try {
    return new URL(value(name));
  } catch {
    fail(`${name} must be a valid URL.`);
  }
}

function isLoopback(hostname) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function hostedEnvironment(vercelEnvironment) {
  const explicit = value("MOVX_HOSTED_ENVIRONMENT");
  if (explicit && !["dev", "prod"].includes(explicit)) {
    fail("MOVX_HOSTED_ENVIRONMENT must be dev or prod when set.");
  }
  const target =
    explicit || (vercelEnvironment === "production" ? "prod" : "dev");
  if (target === "prod" && vercelEnvironment !== "production") {
    fail("The production database requires a Vercel Production deployment.");
  }
  return target;
}

function validateCoreEnvironment(vercelEnvironment, target) {
  if (
    !validateCompleteGroup(CORE_VARIABLES, "Hosted database/Auth configuration")
  ) {
    if (
      vercelEnvironment === "production" ||
      value("MOVX_HOSTED_ENVIRONMENT")
    ) {
      fail(
        "Hosted database/Auth configuration is required for Production or explicitly hosted builds; configuration-free public preview is limited to non-production builds.",
      );
    }
    return "public-preview";
  }

  const databaseUrl = parsedUrl("DATABASE_URL");
  if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol)) {
    fail("DATABASE_URL must use PostgreSQL.");
  }
  if (
    !databaseUrl.hostname ||
    !databaseUrl.username ||
    !databaseUrl.password ||
    databaseUrl.pathname === "/"
  ) {
    fail("DATABASE_URL must include a host, user, password and database name.");
  }
  if (isLoopback(databaseUrl.hostname)) {
    fail("DATABASE_URL cannot target a loopback host on Vercel.");
  }
  if (
    databaseUrl.port !== "6543" ||
    !databaseUrl.hostname.endsWith(".pooler.supabase.com")
  ) {
    fail("DATABASE_URL must use the Supabase transaction pooler on port 6543.");
  }

  const supabaseUrl = parsedUrl("NEXT_PUBLIC_SUPABASE_URL");
  if (
    supabaseUrl.protocol !== "https:" ||
    !supabaseUrl.hostname.endsWith(".supabase.co") ||
    supabaseUrl.username ||
    supabaseUrl.password ||
    supabaseUrl.pathname !== "/" ||
    supabaseUrl.search ||
    supabaseUrl.hash
  ) {
    fail("NEXT_PUBLIC_SUPABASE_URL must be a root HTTPS Supabase project URL.");
  }

  const projectReference = supabaseUrl.hostname.slice(
    0,
    -".supabase.co".length,
  );
  const usernameParts = decodeURIComponent(databaseUrl.username).split(".");
  if (
    usernameParts.length !== 2 ||
    usernameParts[0] === "postgres" ||
    usernameParts[1] !== projectReference
  ) {
    fail(
      "DATABASE_URL must use a dedicated application role for the configured Supabase project.",
    );
  }

  const publishableKey = value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (
    !publishableKey.startsWith("sb_publishable_") &&
    !publishableKey.startsWith("eyJ")
  ) {
    fail(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon key.",
    );
  }

  const siteUrl = parsedUrl("NEXT_PUBLIC_SITE_URL");
  if (
    siteUrl.protocol !== "https:" ||
    !siteUrl.hostname ||
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    fail("NEXT_PUBLIC_SITE_URL must be an exact root HTTPS origin.");
  }
  const canonicalTargets = {
    "https://uat.movx.club": "dev",
    "https://movx.club": "prod",
  };
  if (
    canonicalTargets[siteUrl.origin] &&
    canonicalTargets[siteUrl.origin] !== target
  ) {
    fail(
      "NEXT_PUBLIC_SITE_URL does not match the selected hosted environment.",
    );
  }
  hostedRuntimeConfiguration(process.env, target);
  return "hosted-runtime";
}

function validateGeoapifyEnvironment() {
  const apiKey = value("NEXT_PUBLIC_GEOAPIFY_API_KEY");
  if (
    apiKey &&
    (apiKey.length < 20 ||
      apiKey.length > 200 ||
      !/^[A-Za-z0-9_-]+$/.test(apiKey) ||
      /^(?:your|replace|placeholder)/i.test(apiKey))
  ) {
    fail(
      "NEXT_PUBLIC_GEOAPIFY_API_KEY must be a valid public Geoapify API key.",
    );
  }
  return Boolean(apiKey);
}

function main() {
  const vercelEnvironment = value("VERCEL_ENV") || "local";
  if (
    !["production", "preview", "development", "local"].includes(
      vercelEnvironment,
    )
  ) {
    fail("VERCEL_ENV must be production, preview or development when set.");
  }
  const target = hostedEnvironment(vercelEnvironment);
  const runtimeMode = validateCoreEnvironment(vercelEnvironment, target);
  const geoapifyEnabled = validateGeoapifyEnvironment();
  console.log(
    `Validated ${vercelEnvironment} Vercel build in ${runtimeMode} mode (OpenFreeMap enabled; Geoapify search ${geoapifyEnabled ? "configured" : "disabled"}) without printing environment values.`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Vercel environment validation failed.",
  );
  process.exitCode = 1;
}
