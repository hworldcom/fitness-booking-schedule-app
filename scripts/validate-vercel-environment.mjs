import { address, createKeyPairSignerFromBytes } from "@solana/kit";

const CORE_VARIABLES = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
];

const SOLANA_VARIABLES = [
  "SOLANA_CLUSTER",
  "NEXT_PUBLIC_SOLANA_RPC_URL",
  "SOLANA_RPC_URL",
  "NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID",
  "SOLANA_FEE_SPONSOR_ADDRESS",
  "SOLANA_FEE_SPONSOR_KEYPAIR_BASE64",
  "SOLANA_RECOVERY_AUTHORITY_ADDRESS",
];

const REVIEWED_PROGRAM_ADDRESS = "GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU";

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
  const databaseUsername = decodeURIComponent(databaseUrl.username);
  const usernameParts = databaseUsername.split(".");
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

function validateRpcUrl(name, browserVisible) {
  const url = parsedUrl(name);
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.hash ||
    (browserVisible && (url.username || url.password))
  ) {
    fail(`${name} must be a valid HTTPS endpoint.`);
  }
}

async function validateSolanaEnvironment() {
  if (
    !validateCompleteGroup(SOLANA_VARIABLES, "Devnet transaction configuration")
  ) {
    return false;
  }

  if (value("SOLANA_CLUSTER") !== "devnet") {
    fail("SOLANA_CLUSTER must be devnet for MVP transactions.");
  }
  validateRpcUrl("NEXT_PUBLIC_SOLANA_RPC_URL", true);
  validateRpcUrl("SOLANA_RPC_URL", false);

  const programAddress = value("NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID");
  if (programAddress !== REVIEWED_PROGRAM_ADDRESS) {
    fail(
      "NEXT_PUBLIC_SOLANA_COACH_PASS_PROGRAM_ID must match the reviewed program identity.",
    );
  }

  const sponsorAddressValue = value("SOLANA_FEE_SPONSOR_ADDRESS");
  const recoveryAddressValue = value("SOLANA_RECOVERY_AUTHORITY_ADDRESS");
  try {
    address(sponsorAddressValue);
    address(recoveryAddressValue);
  } catch {
    fail("Solana sponsor and recovery values must be valid addresses.");
  }
  if (sponsorAddressValue === recoveryAddressValue) {
    fail(
      "The Solana recovery authority must be separate from the fee sponsor.",
    );
  }

  const encodedKeypair = value("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64");
  if (!/^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/.test(encodedKeypair)) {
    fail("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64 must encode a 64-byte keypair.");
  }
  const keypairBytes = new Uint8Array(Buffer.from(encodedKeypair, "base64"));
  try {
    if (keypairBytes.byteLength !== 64) {
      fail("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64 must encode a 64-byte keypair.");
    }
    const signer = await createKeyPairSignerFromBytes(keypairBytes);
    if (signer.address !== sponsorAddressValue) {
      fail("SOLANA_FEE_SPONSOR_ADDRESS must match its configured keypair.");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Vercel environment validation failed:")
    ) {
      throw error;
    }
    fail("SOLANA_FEE_SPONSOR_KEYPAIR_BASE64 must contain a valid keypair.");
  } finally {
    keypairBytes.fill(0);
  }

  return true;
}

async function main() {
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
  const solanaEnabled = await validateSolanaEnvironment();

  console.log(
    `Validated ${vercelEnvironment} Vercel build in ${runtimeMode} mode (Mapbox ${mapboxEnabled ? "configured" : "disabled"}, Devnet transactions ${solanaEnabled ? "configured" : "disabled"}) without printing environment values.`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Vercel environment validation failed.",
  );
  process.exitCode = 1;
});
