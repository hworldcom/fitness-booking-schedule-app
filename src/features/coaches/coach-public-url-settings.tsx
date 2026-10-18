"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  isCoachPublicHandleResult,
  type CoachPublicHandleResult,
} from "@/domain/coach-public-url";

export function CoachPublicUrlSettings({
  initial,
  visible,
}: {
  initial: CoachPublicHandleResult;
  visible: boolean;
}) {
  const [result, setResult] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function request(confirm: boolean) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/coach/public-url",
        confirm && result.status === "ready"
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                username: result.username,
                expectedRevision: result.revision,
                consent,
              }),
            }
          : { cache: "no-store" },
      );
      const next: unknown = await response.json();
      if (!isCoachPublicHandleResult(next)) throw new Error("Invalid response");
      if (next.status === "ready") {
        setResult(next);
        setConsent(false);
        router.refresh();
      } else
        setError(
          next.status === "conflict"
            ? "Your username changed. Load the latest username and review its URL before confirming."
            : next.status === "signed-out"
              ? "Sign in again before confirming your public URL."
              : "We couldn’t confirm your public URL. Nothing was published. Try loading the latest username.",
        );
    } catch {
      setError(
        "Your confirmation could not be verified. Load the latest username to check its saved state.",
      );
    } finally {
      setPending(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void request(true);
  }
  return (
    <section
      className="coach-public-url-settings"
      aria-labelledby="coach-public-url-title"
    >
      <h3 id="coach-public-url-title">Your public coach URL</h3>
      {result.status !== "ready" ? (
        <p role="status">
          Your public URL settings are unavailable. Save your coach profile
          first, then load the latest username.
        </p>
      ) : !result.username ? (
        <p>
          Choose a username in{" "}
          <Link href="/account?section=login-security">
            Account → Login &amp; security
          </Link>
          , then return here to confirm its public URL. Your existing coach link
          keeps working.
        </p>
      ) : (
        <>
          <p className="coach-public-url-preview">
            movx.club/@{result.username}
          </p>
          {result.confirmed ? (
            <>
              <p role="status">
                Public username confirmed.{" "}
                {visible
                  ? "Your previous coach links open this URL."
                  : "This URL becomes available when your approved profile is visible."}
              </p>
              {visible && (
                <Link
                  className="button secondary"
                  href={`/@${result.username}`}
                >
                  Open your public coach URL
                </Link>
              )}
              <p>
                To change it, edit your username in{" "}
                <Link href="/account?section=login-security">Account</Link>.
                Previous public usernames remain reserved to you.
              </p>
            </>
          ) : (
            <form onSubmit={submit}>
              <p>
                Your saved username is private until you confirm. Confirmation
                makes it public when your approved coach profile is visible.
                Your existing coach link keeps working until then.
              </p>
              <label className="coach-public-url-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                  disabled={pending}
                />{" "}
                I agree to make @{result.username} my public coach username.
              </label>
              <p>
                Later changes update your URL; previous public usernames stay
                reserved to you.
              </p>
              <button
                className="button dark"
                type="submit"
                disabled={pending || !consent}
              >
                {pending ? "Confirming…" : "Confirm public URL"}
              </button>
            </form>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="button secondary"
        type="button"
        disabled={pending}
        onClick={() => void request(false)}
      >
        Load latest username
      </button>
    </section>
  );
}
