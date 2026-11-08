"use client";

// Owned loopback layout probe. It loads no account data and never saves.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { ProtectedAccessUnavailable } from "@/features/auth/protected-access";
import "@/features/coaches/availability-editor.css";

export default function Fixture() {
  const pathname = usePathname();
  const { actor, refreshActor } = useActor();
  const { session, refreshSession } = useAuthSession();
  const latestActorRefresh = useRef(refreshActor);
  useEffect(() => {
    latestActorRefresh.current = refreshActor;
  }, [refreshActor]);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <p data-fixture-state={JSON.stringify({ actor, session })}>
        Isolated navigation fixture. No real Auth, SQL or email.
      </p>
      <button
        onClick={async () => {
          await refreshSession();
          await new Promise((resolve) => setTimeout(resolve, 0));
          await latestActorRefresh.current();
        }}
      >
        Refresh fixture account
      </button>
      <button onClick={() => setFailed(true)}>Show content failure</button>
      {failed ? (
        <ProtectedAccessUnavailable />
      ) : (
        <h1>
          {pathname.startsWith("/coach") ? "Coach" : "Athlete"} workspace
          fixture
        </h1>
      )}
      <p>Navigation changes views within the same account.</p>
      <div style={{ minHeight: 1000, paddingTop: 24 }}>
        <label>
          Unsubmitted sample note <input aria-label="Unsubmitted sample note" />
        </label>
      </div>
      <div className="availability-savebar is-floating">
        <div>
          <strong>Availability layout probe</strong>
          <small>Fixture only; no save command.</small>
        </div>
        <button
          className="button dark"
          type="button"
          aria-label="Sample availability action"
        >
          Save changes
        </button>
      </div>
      <button type="button" style={{ marginTop: 28 }}>
        End of content action
      </button>
    </>
  );
}
