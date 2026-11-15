import "server-only";

import { createHash } from "node:crypto";
import type { AuthenticationResult } from "@/auth/gateway";
import type { AuthSessionSnapshot } from "@/auth/contracts";
import type { EmailAuthFlow } from "@/server/db/auth/repository";

type VerifiedRecovery = Readonly<{
  status: "verified";
  subject: string;
  sessionId: string;
  email: string;
  publish(): Promise<boolean>;
  discard(): Promise<void>;
}>;

export type RecoveryPorts = Readonly<{
  read(idHash: string): Promise<EmailAuthFlow | null>;
  verify(tokenHash: string): Promise<VerifiedRecovery | AuthenticationResult>;
  consume(idHash: string, emailHash: string): Promise<boolean>;
  grant(proof: VerifiedRecovery, flow: EmailAuthFlow): Promise<boolean>;
  revoke(proof: VerifiedRecovery): Promise<void>;
  retirePrevious(proof: VerifiedRecovery): Promise<void>;
}>;

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** A portable email proof can grant recovery authority only, never normal login. */
export async function acceptRecoveryProof(
  command: { flow: string; tokenHash: string },
  previous: AuthSessionSnapshot,
  ports: RecoveryPorts,
): Promise<AuthenticationResult> {
  let verified: VerifiedRecovery | undefined;
  let published = false;
  try {
    if (previous.status === "recovery-required")
      return { status: "recovery-required", next: "/reset-password" };
    if (previous.status === "unavailable" || previous.status === "disabled")
      return { status: "unavailable" };
    const idHash = hash(command.flow);
    const flow = await ports.read(idHash);
    if (!flow || flow.purpose !== "recovery")
      return { status: "invalid-proof" };
    if (
      previous.status === "signed-in" &&
      hash(previous.email) !== flow.emailHash
    )
      return { status: "invalid", message: "recovery-account-conflict" };

    const result = await ports.verify(command.tokenHash);
    if (result.status !== "verified")
      return ["invalid-proof", "unavailable", "rate-limited"].includes(
        result.status,
      )
        ? result
        : { status: "unavailable" };
    verified = result;
    if (
      hash(verified.email) !== flow.emailHash ||
      !(await ports.consume(idHash, flow.emailHash))
    )
      return { status: "invalid-proof" };
    if (!(await ports.grant(verified, flow))) return { status: "unavailable" };
    if (!(await verified.publish())) return { status: "unavailable" };
    published = true;
    await ports.retirePrevious(verified);
    return { status: "recovery-required", next: "/reset-password" };
  } catch {
    // Once cookies were adopted, retain the restricted session for recovery.
    return published
      ? { status: "recovery-required", next: "/reset-password" }
      : { status: "unavailable" };
  } finally {
    if (verified && !published) {
      // Also handle an uncertain grant write: revoke only this temporary session.
      await ports.revoke(verified).catch(() => {});
      await verified.discard().catch(() => {});
    }
  }
}
