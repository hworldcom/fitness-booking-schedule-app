import { provisionDemoCoaches } from "./lib/provision-demo-coaches";

try {
  await provisionDemoCoaches(process.argv.slice(2));
} catch (error) {
  // Administrative SDK/CLI responses can contain credentials; only bounded errors are surfaced.
  console.error(
    error instanceof Error &&
      !error.message.includes("postgres") &&
      !error.message.includes("eyJ") &&
      !error.message.includes("sb_secret_")
      ? error.message
      : "Demo coach setup failed; check the target/schema and private setup journal. No fallback was attempted.",
  );
  process.exitCode = 1;
}
