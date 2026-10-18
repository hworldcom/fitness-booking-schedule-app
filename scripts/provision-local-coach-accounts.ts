// Preserve the existing local-only command while sharing nonproduction defaults.
import { provisionDemoCoaches } from "./lib/provision-demo-coaches";

try {
  await provisionDemoCoaches([
    "--environment",
    "local",
    ...process.argv.slice(2),
  ]);
} catch {
  console.error(
    "Local demo coach setup failed. Check local services, fixture ownership and the private work/demo-coaches setup journal.",
  );
  process.exitCode = 1;
}
