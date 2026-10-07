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

function validateCoreEnvironment() {
  if (
    !validateCompleteGroup(CORE_VARIABLES, "Hosted database/Auth configuration")
  ) {
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
  return "hosted-runtime";
}

function validateMapboxEnvironment() {
  const token = value("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN");
  if (token && !/^pk\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    fail("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN must be a public Mapbox pk token.");
  }
  return Boolean(token);
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
  const runtimeMode = validateCoreEnvironment();
  const mapboxEnabled = validateMapboxEnvironment();
  console.log(
    `Validated ${vercelEnvironment} Vercel build in ${runtimeMode} mode (Mapbox ${mapboxEnabled ? "configured" : "disabled"}) without printing environment values.`,
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
