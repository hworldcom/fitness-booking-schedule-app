"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Check,
  KeyRound,
  LogOut,
  Mail,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Pill } from "@/components/ui";
import { isCanonicalSignInLocation, supabasePublicConfig } from "@/auth/config";
import { authServiceUnavailableCopy } from "@/auth/service-availability";
import {
  emailOtpErrorMessage,
  normalizeEmail,
  normalizeEmailOtp,
} from "@/auth/email-otp";
import { normalizeDisplayName } from "@/auth/identity-contracts";
import { useActor } from "@/auth/client/actor-provider";
import { browserAuthClient } from "@/auth/client/browser-client";
import { activateCoaching } from "@/auth/client/coaching-activation-client";
import {
  completeApplicationProfile,
  fetchCurrentIdentity,
} from "@/auth/client/identity-client";
import { useAuthSession } from "@/auth/client/session-provider";
import type { ApplicationIdentitySnapshot } from "@/auth/identity-contracts";

const subscribeToHydration = () => () => {};

type IdentityUiState =
  ApplicationIdentitySnapshot | Readonly<{ status: "idle" | "checking" }>;

type IdentityResult = Readonly<{
  key: string;
  identity: ApplicationIdentitySnapshot;
}>;

type ActiveAction =
  "request-code" | "verify-code" | "profile" | "activate-coaching" | "sign-out";

export function SignInScreen({
  returnTo,
  accessRequired,
}: {
  returnTo: string | null;
  accessRequired: boolean;
}) {
  const router = useRouter();
  const { session, refreshSession } = useAuthSession();
  const { refreshActor } = useActor();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const config = supabasePublicConfig();
  const unavailableCopy = config
    ? authServiceUnavailableCopy(config.url)
    : null;
  const canonicalLocation =
    mounted && config
      ? isCanonicalSignInLocation(config, window.location)
      : false;
  const [emailInput, setEmailInput] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [onboardingChoiceVisible, setOnboardingChoiceVisible] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [identityResult, setIdentityResult] = useState<IdentityResult | null>(
    null,
  );
  const actionLock = useRef(false);
  const identityRequestKey = useRef<string | null>(null);
  const actorRefreshKey = useRef<string | null>(null);
  const identityKey =
    session.status === "signed-in"
      ? `${session.subject}:${session.expiresAt ?? "no-expiry"}`
      : null;
  const applicationIdentity: IdentityUiState = identityKey
    ? identityResult?.key === identityKey
      ? identityResult.identity
      : { status: "checking" }
    : { status: "idle" };

  useEffect(() => {
    if (!identityKey) {
      identityRequestKey.current = null;
      actorRefreshKey.current = null;
      return;
    }
    if (identityRequestKey.current === identityKey) return;
    identityRequestKey.current = identityKey;
    let active = true;
    void fetchCurrentIdentity().then((identity) => {
      if (active && identityRequestKey.current === identityKey) {
        setIdentityResult({ key: identityKey, identity });
      }
    });
    return () => {
      active = false;
      if (identityRequestKey.current === identityKey) {
        identityRequestKey.current = null;
      }
    };
  }, [identityKey]);

  useEffect(() => {
    if (
      !identityKey ||
      onboardingChoiceVisible ||
      applicationIdentity.status !== "enrolled" ||
      actorRefreshKey.current === identityKey
    ) {
      return;
    }
    actorRefreshKey.current = identityKey;
    let active = true;
    void refreshActor().then((actor) => {
      if (active && returnTo && actor.status === "authorized") {
        router.replace(returnTo);
        router.refresh();
      }
    });
    return () => {
      active = false;
    };
  }, [
    applicationIdentity.status,
    identityKey,
    onboardingChoiceVisible,
    refreshActor,
    returnTo,
    router,
  ]);

  async function refreshIdentity() {
    if (!identityKey) return;
    identityRequestKey.current = identityKey;
    setIdentityResult(null);
    setIdentityResult({
      key: identityKey,
      identity: await fetchCurrentIdentity(),
    });
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current || !config || !canonicalLocation) return;
    const email = normalizeEmail(emailInput);
    if (!email) {
      setActionError("Enter a valid email address.");
      return;
    }
    const client = browserAuthClient();
    if (!client) return;

    actionLock.current = true;
    setActiveAction("request-code");
    setActionError(null);
    try {
      const result = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (result.error) throw result.error;
      setPendingEmail(email);
      setEmailInput(email);
      setCodeInput("");
    } catch (error) {
      setActionError(emailOtpErrorMessage(error, "request"));
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current || !pendingEmail || !config || !canonicalLocation) {
      return;
    }
    const token = normalizeEmailOtp(codeInput);
    if (!token) {
      setActionError("Enter the six-digit code from your email.");
      return;
    }
    const client = browserAuthClient();
    if (!client) return;

    actionLock.current = true;
    setActiveAction("verify-code");
    setActionError(null);
    try {
      const result = await client.auth.verifyOtp({
        email: pendingEmail,
        token,
        type: "email",
      });
      if (result.error) throw result.error;
      if (normalizeEmail(result.data.user?.email) !== pendingEmail) {
        await client.auth.signOut({ scope: "local" });
        throw new Error("Verified email did not match the requested account.");
      }
      const verified = await refreshSession();
      if (verified.status !== "signed-in" || verified.email !== pendingEmail) {
        await client.auth.signOut({ scope: "local" });
        await refreshSession();
        throw new Error("The server could not verify this email session.");
      }
      setCodeInput("");
      router.refresh();
    } catch (error) {
      setActionError(emailOtpErrorMessage(error, "verify"));
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function completeProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionLock.current || !identityKey) return;
    const displayName = normalizeDisplayName(displayNameInput);
    if (!displayName) {
      setActionError(
        "Enter a display name between 2 and 80 characters using at least one letter or number.",
      );
      return;
    }

    actionLock.current = true;
    setActiveAction("profile");
    setActionError(null);
    try {
      const identity = await completeApplicationProfile(displayName);
      setIdentityResult({ key: identityKey, identity });
      if (identity.status !== "enrolled") {
        setActionError(
          identity.status === "profile-required"
            ? "The profile details were not accepted. Review the display name and try again."
            : "Profile setup is unavailable. Your verified email session remains active; try again shortly.",
        );
        return;
      }
      setDisplayNameInput("");
      setOnboardingChoiceVisible(true);
      actorRefreshKey.current = identityKey;
      await refreshActor();
      router.refresh();
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function chooseCoaching() {
    if (actionLock.current || !identityKey) return;
    actionLock.current = true;
    setActiveAction("activate-coaching");
    setActionError(null);
    try {
      const result = await activateCoaching();
      if (result.status !== "activated") {
        setActionError(
          result.status === "signed-out"
            ? "Your sign-in expired. Sign in again before activating coaching."
            : result.status === "forbidden"
              ? "This account cannot activate coaching in the current workspace."
              : "MovX could not activate coaching right now. Try again shortly.",
        );
        return;
      }
      actorRefreshKey.current = identityKey;
      await refreshActor();
      setOnboardingChoiceVisible(false);
      router.replace("/profile/coach");
      router.refresh();
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  async function signOut() {
    if (actionLock.current) return;
    const client = browserAuthClient();
    if (!client) return;

    actionLock.current = true;
    setActiveAction("sign-out");
    setActionError(null);
    try {
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      await refreshSession();
      setPendingEmail(null);
      setIdentityResult(null);
      setOnboardingChoiceVisible(false);
      router.refresh();
    } catch {
      setActionError(
        "MovX Club could not sign out. Check the connection and try again.",
      );
    } finally {
      actionLock.current = false;
      setActiveAction(null);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-heading">
        <div>
          <span className="eyebrow">MovX Club identity</span>
          <h1>Sign in with your email.</h1>
          <p>
            Request a one-time code, verify your email and create a small
            profile. A wallet is optional and can be linked separately later.
          </p>
        </div>
        <Pill tone="lime">Email code · No password</Pill>
      </div>

      <div className="auth-layout">
        <div className="auth-card">
          <div className="auth-card-title">
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <span>Application account</span>
              <h2>MovX Club sign-in</h2>
            </div>
          </div>

          {accessRequired && (
            <div className="auth-notice neutral" role="status">
              <strong>This area needs a MovX Club account.</strong>
              <p>
                Sign in and complete your profile first. The requested page
                opens only after the server authorizes your account.
              </p>
            </div>
          )}

          {session.status === "disabled" && (
            <div className="auth-notice warning" role="status">
              <strong>Local authentication is not configured.</strong>
              <p>
                Add the public Supabase values from <code>.env.example</code>
                and start the local Auth stack. Public discovery remains
                available.
              </p>
            </div>
          )}

          {session.status === "unavailable" && (
            <div className="auth-notice warning" role="alert">
              <strong>
                {unavailableCopy?.title ??
                  "Sign-in status could not be verified."}
              </strong>
              <p>
                {unavailableCopy?.detail ??
                  "The Auth service is unavailable. No signed-in state is being assumed."}
              </p>
              {unavailableCopy?.recoveryCommand && (
                <p>
                  Run <code>{unavailableCopy.recoveryCommand}</code> from the
                  project directory.
                </p>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => void refreshSession()}
              >
                Check again
              </button>
              {config && (
                <button
                  type="button"
                  className="text-button auth-clear-session"
                  disabled={activeAction !== null}
                  onClick={() => void signOut()}
                >
                  {activeAction === "sign-out"
                    ? "Clearing local session…"
                    : "Clear local session on this device"}
                </button>
              )}
            </div>
          )}

          {session.status === "signed-out" && !pendingEmail && (
            <form className="auth-form" onSubmit={requestCode} noValidate>
              <label htmlFor="sign-in-email">Email address</label>
              <input
                id="sign-in-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                value={emailInput}
                disabled={!config || activeAction !== null}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="you@example.com"
                required
              />
              <button
                type="submit"
                className="button dark full"
                disabled={
                  !config || activeAction !== null || !canonicalLocation
                }
              >
                <Mail size={17} aria-hidden="true" />
                {activeAction === "request-code"
                  ? "Sending code…"
                  : "Email me a sign-in code"}
              </button>
            </form>
          )}

          {session.status === "signed-out" && pendingEmail && (
            <form className="auth-form" onSubmit={verifyCode} noValidate>
              <div className="auth-notice neutral" role="status">
                <strong>Check your email.</strong>
                <p>
                  If <strong>{pendingEmail}</strong> can receive MovX Club
                  email, a six-digit code is on its way. New and returning
                  accounts follow the same steps.
                </p>
              </div>
              <label htmlFor="sign-in-code">Six-digit code</label>
              <input
                id="sign-in-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={codeInput}
                disabled={activeAction !== null}
                onChange={(event) =>
                  setCodeInput(event.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
                required
              />
              <button
                type="submit"
                className="button dark full"
                disabled={activeAction !== null}
              >
                <KeyRound size={17} aria-hidden="true" />
                {activeAction === "verify-code"
                  ? "Checking code…"
                  : "Verify and sign in"}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={activeAction !== null}
                onClick={() => {
                  setPendingEmail(null);
                  setCodeInput("");
                  setActionError(null);
                }}
              >
                Use a different email
              </button>
            </form>
          )}

          {session.status === "signed-in" &&
            (applicationIdentity.status === "idle" ||
              applicationIdentity.status === "checking") && (
              <div className="auth-notice neutral" role="status">
                <strong>Checking your MovX Club profile…</strong>
                <p>The server is loading the profile for this account.</p>
              </div>
            )}

          {session.status === "signed-in" &&
            applicationIdentity.status === "profile-required" && (
              <form className="auth-form" onSubmit={completeProfile} noValidate>
                <div className="auth-notice success" role="status">
                  <strong>Email verified.</strong>
                  <p>
                    Signed in as {session.email}. Choose the name other people
                    will see in MovX Club.
                  </p>
                </div>
                <label htmlFor="profile-display-name">Display name</label>
                <input
                  id="profile-display-name"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  value={displayNameInput}
                  disabled={activeAction !== null}
                  onChange={(event) => setDisplayNameInput(event.target.value)}
                  placeholder="Your display name"
                  required
                />
                <button
                  type="submit"
                  className="button dark full"
                  disabled={activeAction !== null}
                >
                  <UserRound size={17} aria-hidden="true" />
                  {activeAction === "profile"
                    ? "Creating profile…"
                    : "Create my profile"}
                </button>
              </form>
            )}

          {session.status === "signed-in" &&
            applicationIdentity.status === "enrolled" &&
            onboardingChoiceVisible && (
              <div className="auth-onboarding-choice">
                <div className="auth-notice success" role="status">
                  <strong>
                    Welcome, {applicationIdentity.profile.displayName}.
                  </strong>
                  <p>
                    Your account is ready. Choose a starting path; coaches can
                    still book as clients.
                  </p>
                </div>
                <h3>How would you like to use MovX?</h3>
                <div className="auth-onboarding-actions">
                  <Link className="button secondary" href="/explore">
                    <Search size={17} aria-hidden="true" /> Find a coach
                  </Link>
                  <button
                    type="button"
                    className="button dark"
                    disabled={activeAction !== null}
                    onClick={() => void chooseCoaching()}
                  >
                    <UserRound size={17} aria-hidden="true" />
                    {activeAction === "activate-coaching"
                      ? "Activating coaching…"
                      : "Offer coaching"}
                  </button>
                </div>
                <p className="auth-onboarding-note">
                  Coaching activates immediately without administrator approval.
                  Your public profile remains hidden until you finish and
                  publish it.
                </p>
              </div>
            )}

          {session.status === "signed-in" &&
            applicationIdentity.status === "enrolled" &&
            !onboardingChoiceVisible && (
              <div className="auth-notice success" role="status">
                <strong>
                  Signed in as {applicationIdentity.profile.displayName}.
                </strong>
                <p>
                  Your verified email account has ordinary MovX Club access. A
                  wallet is not required for this application session.
                </p>
              </div>
            )}

          {session.status === "signed-in" &&
            applicationIdentity.status === "unavailable" && (
              <div className="auth-notice warning" role="alert">
                <strong>Profile access is unavailable.</strong>
                <p>
                  Your verified email session remains active, but the local
                  application database could not load the profile.
                </p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void refreshIdentity()}
                >
                  Try profile access again
                </button>
              </div>
            )}

          {config && mounted && !canonicalLocation && (
            <div className="auth-notice danger" role="alert">
              <strong>Use the configured sign-in address.</strong>
              <p>
                Email sign-in is disabled on this origin. Open{" "}
                {config.signInUrl}
                exactly and try again.
              </p>
            </div>
          )}

          {actionError && (
            <p className="wallet-error" role="alert">
              {actionError}
            </p>
          )}

          {session.status === "signed-in" && (
            <button
              type="button"
              className="button secondary full"
              disabled={activeAction !== null}
              onClick={() => void signOut()}
            >
              <LogOut size={17} aria-hidden="true" />
              {activeAction === "sign-out"
                ? "Signing out…"
                : "Sign out on this device"}
            </button>
          )}

          <p className="wallet-safety">
            MovX Club never asks for your email password, wallet recovery phrase
            or private key.
          </p>
        </div>

        <aside className="auth-explainer" aria-label="How email sign-in works">
          <h2>Three small steps</h2>
          <ol>
            <li>
              <span>
                <Mail size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>Request</strong>
                <p>Enter your email and receive a short-lived code.</p>
              </div>
            </li>
            <li>
              <span>
                <BadgeCheck size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>Verify</strong>
                <p>Use the six-digit code to create or restore your session.</p>
              </div>
            </li>
            <li>
              <span>
                <Check size={17} aria-hidden="true" />
              </span>
              <div>
                <strong>Complete your profile</strong>
                <p>First-time accounts choose a display name once.</p>
              </div>
            </li>
          </ol>
          <div className="notice">
            <strong>Wallets stay separate</strong>
            <p>
              Connect or link Phantom later only for wallet-backed actions. A
              connected wallet never signs you into this account automatically.
            </p>
          </div>
          <Link href="/" className="text-link">
            Continue browsing without signing in
          </Link>
          <p className="auth-wallet-note">
            <Wallet size={14} aria-hidden="true" /> Public browsing needs no
            account or wallet.
          </p>
        </aside>
      </div>
    </section>
  );
}
