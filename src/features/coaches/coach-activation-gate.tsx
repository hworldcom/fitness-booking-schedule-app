"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BadgeCheck, Search, UserRound } from "lucide-react";
import { activateCoaching } from "@/auth/client/coaching-activation-client";

export function CoachActivationGate() {
  const router = useRouter();
  const actionLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    if (actionLock.current) return;
    actionLock.current = true;
    setPending(true);
    setError(null);
    const result = await activateCoaching();
    if (result.status === "activated") {
      router.replace("/profile/coach");
      router.refresh();
      return;
    }
    setError(
      result.status === "signed-out"
        ? "Your sign-in expired. Sign in again before activating coaching."
        : result.status === "forbidden"
          ? "This account cannot activate coaching in the current workspace."
          : "MovX could not activate coaching right now. Try again shortly.",
    );
    actionLock.current = false;
    setPending(false);
  }

  return (
    <section className="coach-workspace-gate coach-activation-gate">
      <BadgeCheck size={28} aria-hidden="true" />
      <span className="eyebrow">SELF-SERVICE ACTIVATION</span>
      <h1>Activate coaching when you are ready.</h1>
      <p>
        Activation is immediate and needs no administrator approval. It lets you
        create a self-declared coach profile; it does not verify credentials or
        publish anything by itself.
      </p>
      <div className="coach-activation-actions">
        <button
          type="button"
          className="button dark"
          disabled={pending}
          onClick={() => void activate()}
        >
          <UserRound size={17} aria-hidden="true" />
          {pending ? "Activating coaching…" : "Activate coaching"}
        </button>
        <Link className="button secondary" href="/explore">
          <Search size={17} aria-hidden="true" /> Find a coach
        </Link>
      </div>
      {error && (
        <p className="coach-activation-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
