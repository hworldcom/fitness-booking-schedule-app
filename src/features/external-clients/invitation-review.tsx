"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authenticationGateway } from "@/auth/client/authentication-gateway";
import { useAuthSession } from "@/auth/client/session-provider";
import { SessionActorBoundary } from "@/features/session-types/actor-boundary";
import "@/features/session-types/session-types.css";
export function InvitationReview() {
  return (
    <section className="session-types-page">
      <h1>Your invitation</h1>
      <SessionActorBoundary publicWhenSignedOut>
        {(identity) => <Review key={identity} />}
      </SessionActorBoundary>
    </section>
  );
}
function Review() {
  const router = useRouter();
  const { session } = useAuthSession();
  const [offer, setOffer] = useState<{
      state: string;
      coachName?: string;
      context?: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState<{
      action: "accept" | "decline";
      context: string;
    } | null>(null);
  useEffect(() => {
    let active = true,
      sequence = 0;
    async function load() {
      const request = ++sequence;
      setOffer(null);
      setMessage("");
      try {
        const token = window.location.hash.slice(1);
        // Fragments never enter server or Auth URLs; remove only after the cookie exchange.
        const r = await (token
          ? fetch("/api/invitations", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "review", token }),
            })
          : fetch("/api/invitations", { cache: "no-store" }));
        const result = await r.json();
        if (!active || request !== sequence) return;
        if (result.status !== "ready") throw Error();
        if (token) window.history.replaceState(null, "", "/invitations");
        setOffer(result);
      } catch {
        if (active && request === sequence)
          setMessage(
            "The invitation could not be verified. Open your email link again to retry.",
          );
      }
    }
    void load();
    window.addEventListener("hashchange", load);
    return () => {
      active = false;
      window.removeEventListener("hashchange", load);
    };
  }, []);
  async function decide(
    action: "accept" | "decline",
    reviewContext = offer?.context,
  ) {
    if (!reviewContext) return;
    const command = { action, context: reviewContext };
    setBusy(true);
    setMessage("");
    try {
      const r = await (
        await fetch("/api/invitations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(command),
        })
      ).json();
      if (r.status === "ready") {
        setUncertain(null);
        setOffer((o) =>
          o?.context === command.context ? { ...o, state: r.state } : o,
        );
      } else if (
        ["invalid", "conflict", "forbidden", "signed-out"].includes(r.status)
      ) {
        setUncertain(null);
        setMessage(
          r.status === "forbidden"
            ? "This invitation requires the verified email that received it. Sign in with that account. Your coach or invitation may also be unavailable."
            : "The invitation changed or expired. Ask your coach for a new invitation.",
        );
      } else {
        setUncertain(command);
        setMessage(
          "The outcome is unverified. Retry this exact decision to check its result.",
        );
      }
    } catch {
      setUncertain(command);
      setMessage("The outcome is unverified. Retry this exact decision.");
    } finally {
      setBusy(false);
    }
  }
  const signedIn = session.status === "signed-in";
  return (
    <div className="session-type-editor">
      {!offer && !message && <p role="status">Checking invitation…</p>}
      {message && <p role="status">{message}</p>}
      {offer?.state === "pending" && (
        <>
          <h2>{offer.coachName} invited you to connect</h2>
          <p>
            Accept to connect with your coach and access your original sessions,
            plans and shared notes in My training.
          </p>
          <p>
            Use the verified email that received this invitation. Opening this
            page or signing in doesn’t accept it.
          </p>
          {signedIn ? (
            <>
              <div className="session-type-toolbar">
                {uncertain ? (
                  <button
                    className="button dark"
                    disabled={busy}
                    onClick={() =>
                      void decide(uncertain.action, uncertain.context)
                    }
                  >
                    Retry{" "}
                    {uncertain.action === "accept" ? "acceptance" : "decline"}
                  </button>
                ) : (
                  <>
                    <button
                      className="button dark"
                      disabled={busy}
                      onClick={() => void decide("accept")}
                    >
                      {busy ? "Checking…" : "Accept invitation"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void decide("decline")}
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
              <p>
                Using another account?{" "}
                <button
                  disabled={busy || !!uncertain}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await authenticationGateway.signOut();
                      if (r.status === "success")
                        router.replace("/sign-in?returnTo=%2Finvitations");
                      else
                        setMessage(
                          "Sign-out could not be verified. Try again.",
                        );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Switch account
                </button>
              </p>
            </>
          ) : (
            <div className="session-type-toolbar">
              <Link
                className="button dark"
                href="/sign-in?returnTo=%2Finvitations"
              >
                Sign in
              </Link>
              <Link
                className="button light"
                href="/register?returnTo=%2Finvitations"
              >
                Create an account
              </Link>
            </div>
          )}
        </>
      )}
      {offer?.state === "accepted" && (
        <>
          <h2>Invitation accepted</h2>
          <p>
            Sign in with the account that accepted this invitation to access
            your shared session history.
          </p>
          <Link
            className="button dark"
            href={signedIn ? "/sessions" : "/sign-in?returnTo=%2Fsessions"}
          >
            Open My training
          </Link>
        </>
      )}
      {offer?.state === "declined" && (
        <>
          <h2>Invitation declined</h2>
          <p>
            Your session records stay with the coach. You can ask for another
            invitation later.
          </p>
        </>
      )}
      {(offer?.state === "missing" || offer?.state === "unavailable") && (
        <>
          <h2>Invitation unavailable</h2>
          <p>
            Open the latest invitation from your email, or ask your coach for a
            new one.
          </p>
        </>
      )}
    </div>
  );
}
