// Used only by the isolated rehearsal snapshot. Never imported by application code.
import "server-only";
import { cookies } from "next/headers";
import type { ActorSnapshot } from "@/auth/actor-contracts";
import type { AuthSessionSnapshot } from "@/auth/contracts";
export async function fixtureScenario() {
  const jar = await cookies();
  return {
    actor: jar.get("dev0239-actor")?.value ?? "owner",
    fault: jar.get("dev0239-fault")?.value ?? "none",
  };
}
export async function initialAuthorizationState(): Promise<{
  session: AuthSessionSnapshot;
  actor: ActorSnapshot;
}> {
  const { actor } = await fixtureScenario();
  if (actor === "signed-out")
    return {
      session: { status: "signed-out" },
      actor: { status: "signed-out" },
    };
  const other = actor === "other";
  return {
    session: {
      status: "signed-in",
      subject: other
        ? "22222222-2222-4222-8222-222222222222"
        : "11111111-1111-4111-8111-111111111111",
      email: "fixture@users.movx.test",
      expiresAt: null,
    },
    actor: {
      status: "authorized",
      profile: {
        slug: other ? "fixture-other" : "fixture-owner",
        displayName: "Fixture coach",
        avatarUrl: null,
        coachPortraitUrl: null,
      },
      demoRun: { slug: "fixture", name: "Explicit isolated fixture" },
      role: "member",
      coachAccessStatus:
        actor === "suspended"
          ? "suspended"
          : actor === "applicant"
            ? "pending"
            : actor === "athlete"
              ? "not-applied"
              : "approved",
    },
  };
}
export async function currentActorSnapshot() {
  return (await initialAuthorizationState()).actor;
}
