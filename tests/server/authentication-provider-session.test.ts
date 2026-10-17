import assert from "node:assert/strict";
import test from "node:test";
import { AuthApiError } from "@supabase/supabase-js";
import { verifiedProviderContext } from "@/server/auth/session";
import type { serverAuthClient } from "@/server/auth/client";
const subject = "90000000-0000-4000-8000-000000000001";
const sessionId = "90000000-0000-4000-8000-000000000002";
function client(error: AuthApiError | null, confirmed = true) {
  return {
    auth: {
      getClaims: async () => ({
        data: {
          claims: { sub: subject, session_id: sessionId, exp: 2000000000 },
        },
        error: null,
      }),
      getUser: async () => ({
        data: {
          user: {
            id: subject,
            email: "athlete@example.test",
            email_confirmed_at: confirmed ? "2026-10-17T00:00:00Z" : undefined,
            identities: [{ provider: "email" }],
            user_metadata: { role: "coach", email_verified: true },
          },
        },
        error,
      }),
    },
  } as unknown as NonNullable<Awaited<ReturnType<typeof serverAuthClient>>>;
}
test("revoked or expired managed sessions become signed-out while provider outages stay unavailable", async () => {
  for (const code of [
    "session_not_found",
    "session_expired",
    "bad_jwt",
    "refresh_token_not_found",
  ])
    assert.equal(
      (
        await verifiedProviderContext(
          client(new AuthApiError("bounded fixture", 401, code)),
        )
      ).session.status,
      "signed-out",
    );
  assert.equal(
    (
      await verifiedProviderContext(
        client(
          new AuthApiError(
            "private upstream detail",
            503,
            "unexpected_failure",
          ),
        ),
      )
    ).session.status,
    "unavailable",
  );
  const verified = await verifiedProviderContext(client(null));
  assert.equal(verified.session.status, "signed-in");
  assert.equal(verified.authSessionId, sessionId);
  assert.equal(
    (await verifiedProviderContext(client(null, false))).session.status,
    "unavailable",
  );
});
