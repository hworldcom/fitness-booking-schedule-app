import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedKeypairPath = path.join(
  projectRoot,
  "target",
  "deploy",
  "movx_membership_card-keypair.json",
);

const child = spawn(
  "cargo",
  ["build-sbf", "--manifest-path", "programs/movx-membership-card/Cargo.toml"],
  {
    cwd: projectRoot,
    env: { ...process.env, NO_DNA: "1" },
    stdio: "inherit",
  },
);

let exitCode = 1;
try {
  exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Membership-card build stopped by ${signal}.`));
        return;
      }
      resolve(code ?? 1);
    });
  });
} finally {
  // cargo-build-sbf generates a deployment keypair as a side effect. This
  // prototype needs only the local .so; never retain that disposable secret.
  await rm(generatedKeypairPath, { force: true });
}

process.exitCode = exitCode;
