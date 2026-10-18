"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { authenticationGateway } from "@/auth/client/authentication-gateway";
import { useAuthSession } from "@/auth/client/session-provider";
import { useActor } from "@/auth/client/actor-provider";
import {
  completeApplicationProfile,
  fetchCurrentIdentity,
} from "@/auth/client/identity-client";
import { submitCoachApplication } from "@/auth/client/coach-application-client";
import { authenticationResultMessage } from "@/auth/gateway";
import { validateNewPassword } from "@/auth/password";
import { type ApplicationIdentitySnapshot } from "@/auth/identity-contracts";
import { registrationProfileInput } from "@/auth/registration-profile";
import { profileInitials } from "@/auth/profile-presentation";
import { ProfileImageUploader } from "@/features/profile/profile-image-uploader";
import { supabasePublicConfig } from "@/auth/config";
import {
  parseAuthenticationCommand,
  type AuthenticationCommand,
} from "@/auth/operations";
import { safeReturnTo } from "@/auth/return-to";

export type AuthenticationStage =
  | "sign-in"
  | "register"
  | "check-email"
  | "forgot-password"
  | "reset-password"
  | "confirm"
  | "complete-profile";
const hydrate = () => () => {};
const stageCopy = {
  "sign-in": ["Welcome back", "Sign in to find your next training session."],
  register: [
    "Create your account",
    "Find your coach and make room for progress.",
  ],
  "check-email": [
    "Check your email",
    "If this address is eligible, an email with your next step is on its way.",
  ],
  "forgot-password": [
    "Reset your password",
    "We’ll email a link to reset your password or add one to your existing account.",
  ],
  "reset-password": [
    "Choose a new password",
    "Once saved, sign in again with your new password.",
  ],
  confirm: [
    "Continue with your email",
    "Confirm this action to continue securely.",
  ],
  "complete-profile": [
    "Let’s finish your profile",
    "Choose your username and how people will know you in MovX Club.",
  ],
} as const;

function stageHref(
  stage: string,
  returnTo: string,
  intent: "client" | "coach" | null,
) {
  const search = new URLSearchParams({ returnTo });
  if (intent) search.set("intent", intent);
  return `/${stage}?${search}`;
}

export function SignInScreen({
  stage = "sign-in",
  returnTo = "/",
  intent,
  accessRequired = false,
  emailPurpose = "confirmation",
  passwordUpdated = false,
}: {
  stage?: AuthenticationStage;
  returnTo: string | null;
  intent: "client" | "coach" | null;
  accessRequired?: boolean;
  emailPurpose?: "confirmation" | "recovery";
  passwordUpdated?: boolean;
}) {
  const navigate = (path: string) => {
    window.location.replace(path);
  };
  const { session, refreshSession } = useAuthSession();
  const { actor, refreshActor } = useActor();
  const mounted = useSyncExternalStore(
    hydrate,
    () => true,
    () => false,
  );
  const config = supabasePublicConfig();
  const ready = Boolean(
    mounted && config && window.location.origin === config.siteUrl,
  );
  const target = config ? safeReturnTo(returnTo, config.siteUrl) : "/";
  const [email, setEmail] = useState(
    session.status === "signed-in" ? session.email : "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [pictureStep, setPictureStep] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [identity, setIdentity] = useState<ApplicationIdentitySnapshot | null>(
    null,
  );
  const [proof, setProof] = useState<AuthenticationCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const proofCache = useRef<AuthenticationCommand | null | undefined>(
    undefined,
  );
  const link = (name: string) => stageHref(name, target, intent);
  const context = { returnTo: target, ...(intent ? { intent } : {}) };

  useEffect(() => {
    if (stage !== "confirm") return;
    if (proofCache.current === undefined) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      proofCache.current = parseAuthenticationCommand({
        action: "confirm-email",
        flow: params.get("flow"),
        tokenHash: params.get("token_hash"),
        type: params.get("type"),
      });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    const parsed = proofCache.current;
    let active = true;
    queueMicrotask(() => {
      if (active) setProof(parsed);
    });
    return () => {
      active = false;
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "complete-profile" || session.status !== "signed-in") return;
    let active = true;
    void fetchCurrentIdentity().then((value) => {
      if (active) setIdentity(value);
    });
    return () => {
      active = false;
    };
  }, [stage, session.status]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (stage === "complete-profile" && identity?.status === "enrolled")
      headingRef.current?.focus();
  }, [pictureStep, stage, identity?.status]);

  async function run(command: AuthenticationCommand) {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await authenticationGateway.execute(command);
      if (result.status === "requested") {
        setPassword("");
        navigate(
          link("check-email") +
            "&purpose=" +
            (command.action === "request-recovery"
              ? "recovery"
              : "confirmation"),
        );
      } else if (
        result.status === "success" ||
        result.status === "recovery-required" ||
        result.status === "password-updated"
      ) {
        setPassword("");
        await refreshSession();
        navigate(
          result.next ?? (command.action === "sign-out" ? "/sign-in" : target),
        );
      } else setError(authenticationResultMessage(result));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function profile(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || !ready) return;
    const input = registrationProfileInput({ username, fullName, displayName });
    if (!input) {
      setError(
        "Enter a full name and display name of 2–80 characters. Your username must start with a letter and use 3–30 letters, numbers or underscores.",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = await completeApplicationProfile(input);
      if (value.status !== "enrolled") {
        setError(
          value.status === "username-taken"
            ? "That username is already taken. Choose another one."
            : "We couldn’t save your profile. Check your details and try again.",
        );
        return;
      }
      setIdentity(value);
      setPictureStep(true);
      await refreshActor();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function coach() {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await submitCoachApplication();
      if (result.status === "pending" || result.status === "approved")
        navigate("/profile/coach");
      else
        setError(
          "We couldn’t submit your coach application. Please try again or continue as an athlete.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function credentials(event: React.FormEvent) {
    event.preventDefault();
    if (stage === "register" || stage === "reset-password") {
      const checked = validateNewPassword(password);
      if (!checked.valid) {
        setError(
          authenticationResultMessage({
            status: "invalid",
            message: checked.message,
          }),
        );
        return;
      }
    }
    if (stage === "forgot-password")
      void run({ action: "request-recovery", email, ...context });
    else if (stage === "reset-password")
      void run({ action: "reset-password", password });
    else
      void run({
        action: stage === "register" ? "register" : "sign-in",
        email,
        password,
        ...context,
      });
  }

  const [title, description] = stageCopy[stage];
  const showingPicture =
    stage === "complete-profile" &&
    pictureStep &&
    identity?.status === "enrolled";
  const finishPicture = () => {
    if (pictureBusy || busy) return;
    if (intent === "coach") setPictureStep(false);
    else navigate(target);
  };
  const authEntry = stage === "sign-in" || stage === "register";
  const recovery = session.status === "recovery-required";
  const signedIn = session.status === "signed-in";
  const formVisible =
    (stage === "forgot-password" && !recovery) ||
    (stage === "reset-password" && recovery) ||
    (authEntry && !signedIn && !recovery);
  const needsPassword = stage === "reset-password" || authEntry;
  return (
    <section className="authentication-page">
      <aside className="authentication-story" aria-label="Welcome to MovX Club">
        <Link
          href="/"
          className="authentication-brand"
          aria-label="MovX Club home"
        >
          MovX <span>Club</span>
        </Link>
        <div>
          <span className="eyebrow">Move forward, together</span>
          <h2>
            Your next chapter
            <br />
            starts with a coach.
          </h2>
          <p>
            Find the right fit. Choose a time. Build a routine that feels like
            you.
          </p>
        </div>
        <p className="authentication-story-foot">
          <ShieldCheck size={19} aria-hidden="true" />
          One account for athletes and coaches.
        </p>
      </aside>
      <div className="authentication-main">
        <div className="authentication-card">
          <Link
            href="/"
            className="authentication-mobile-brand"
            aria-label="MovX Club home"
          >
            MovX <span>Club</span>
          </Link>
          <header>
            <span className="authentication-icon">
              <LockKeyhole size={22} aria-hidden="true" />
            </span>
            <h1 ref={headingRef} tabIndex={-1}>
              {showingPicture ? "Add a profile picture" : title}
            </h1>
            <p>
              {showingPicture
                ? "Help people recognize you. You can also do this later from your Profile."
                : description}
            </p>
          </header>
          {!config && (
            <p className="authentication-notice" role="status">
              Sign-in is temporarily unavailable. You can keep browsing coaches.
            </p>
          )}
          {passwordUpdated && stage === "sign-in" && (
            <p role="status" className="authentication-notice">
              Your password was saved. Sign in again with your new password.
            </p>
          )}
          {accessRequired && (
            <p className="authentication-notice">
              Sign in to continue to your private workspace.
            </p>
          )}
          {recovery && stage !== "reset-password" && (
            <div className="authentication-notice">
              <p>Finish resetting your password before continuing.</p>
              <Link className="button dark full" href="/reset-password">
                Choose a new password
              </Link>
            </div>
          )}
          {signedIn && authEntry && (
            <div className="authentication-notice">
              <p>You’re already signed in.</p>
              <Link
                className="button dark full"
                href={link("complete-profile")}
              >
                Continue
              </Link>
            </div>
          )}
          {authEntry && !signedIn && !recovery && (
            <>
              <button
                className="authentication-google"
                type="button"
                disabled
                aria-describedby="google-unavailable"
              >
                <span aria-hidden="true">G</span>Continue with Google
              </button>
              <p className="authentication-help" id="google-unavailable">
                Google sign-in is currently unavailable.
              </p>
              <div className="authentication-divider">
                <span>or continue with email</span>
              </div>
            </>
          )}
          {formVisible && (
            <form
              className="authentication-form"
              onSubmit={credentials}
              noValidate
            >
              <fieldset disabled={!ready || busy}>
                <legend className="sr-only">{title}</legend>
                {stage !== "reset-password" && (
                  <label>
                    Email address
                    <input
                      id="auth-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      inputMode="email"
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>
                )}
                {needsPassword && (
                  <div className="authentication-password-field">
                    <label htmlFor="auth-password">
                      {stage === "sign-in" ? "Password" : "New password"}
                    </label>
                    <span className="authentication-password">
                      <input
                        id="auth-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          stage === "sign-in"
                            ? "current-password"
                            : "new-password"
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-describedby={
                          stage !== "sign-in" ? "password-guidance" : undefined
                        }
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={19} aria-hidden="true" />
                        ) : (
                          <Eye size={19} aria-hidden="true" />
                        )}
                      </button>
                    </span>
                  </div>
                )}
                {needsPassword && stage !== "sign-in" && (
                  <p className="authentication-help" id="password-guidance">
                    At least 8 characters. No special character mix required.
                  </p>
                )}
                {stage === "sign-in" && (
                  <Link
                    className="authentication-inline-link"
                    href={link("forgot-password")}
                  >
                    Forgot password?
                  </Link>
                )}
                <button className="button dark full" type="submit">
                  {busy
                    ? "Please wait…"
                    : stage === "register"
                      ? "Create account"
                      : stage === "forgot-password"
                        ? "Send reset link"
                        : stage === "reset-password"
                          ? "Save new password"
                          : "Sign in"}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </fieldset>
            </form>
          )}
          {stage === "check-email" && (
            <>
              <div className="authentication-notice">
                <Mail size={23} aria-hidden="true" />
                <p>
                  Open the latest email in the browser where you requested it.
                  The link works once and expires in one hour.
                </p>
              </div>
              <form
                className="authentication-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run({
                    action:
                      emailPurpose === "recovery"
                        ? "request-recovery"
                        : "resend-confirmation",
                    email,
                    ...context,
                  });
                }}
                noValidate
              >
                <fieldset disabled={!ready || busy}>
                  <legend className="sr-only">Resend confirmation</legend>
                  <label>
                    Email address
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={254}
                    />
                  </label>
                  <button type="submit" className="button secondary full">
                    {emailPurpose === "recovery"
                      ? "Resend reset link"
                      : "Resend confirmation email"}
                  </button>
                </fieldset>
              </form>
              <Link
                href={link("forgot-password")}
                className="authentication-inline-link"
              >
                Request a password reset link
              </Link>
            </>
          )}
          {stage === "confirm" && (
            <div className="authentication-notice">
              {proof ? (
                <>
                  <p>
                    Continue to verify your email or start the password reset
                    you requested.
                  </p>
                  <button
                    type="button"
                    className="button dark full"
                    disabled={!ready || busy}
                    onClick={() => void run(proof)}
                  >
                    {busy ? "Checking…" : "Continue securely"}
                  </button>
                </>
              ) : (
                <>
                  <p>
                    This link is missing, expired or already used. Request a
                    fresh email in this browser.
                  </p>
                  <Link
                    href={link("forgot-password")}
                    className="button secondary full"
                  >
                    Request a fresh reset link
                  </Link>
                </>
              )}
            </div>
          )}
          {stage === "reset-password" && !recovery && (
            <div className="authentication-notice">
              <p>Open a fresh reset link to choose a new password.</p>
              <Link
                href={link("forgot-password")}
                className="button secondary full"
              >
                Request reset link
              </Link>
            </div>
          )}
          {stage === "complete-profile" && (
            <>
              {!signedIn ? (
                <Link href={link("sign-in")} className="button dark full">
                  Sign in to continue
                </Link>
              ) : identity?.status === "profile-required" ? (
                <form
                  className="authentication-form"
                  onSubmit={profile}
                  noValidate
                >
                  <fieldset disabled={!ready || busy}>
                    <legend className="sr-only">Complete your profile</legend>
                    <label>
                      Username
                      <input
                        name="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={31}
                        aria-describedby="registration-username-help"
                        required
                      />
                    </label>
                    <p
                      id="registration-username-help"
                      className="authentication-help"
                    >
                      3–30 letters, numbers or underscores, starting with a
                      letter. Usernames are unique. Sign in with your email for
                      now.
                    </p>
                    <label>
                      Full name
                      <input
                        name="fullName"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        maxLength={80}
                        aria-describedby="registration-full-name-help"
                        required
                      />
                    </label>
                    <p
                      id="registration-full-name-help"
                      className="authentication-help"
                    >
                      Your full name stays private.
                    </p>
                    <label>
                      Display name
                      <input
                        name="displayName"
                        autoComplete="nickname"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={80}
                        aria-describedby="registration-display-name-help"
                        required
                      />
                    </label>
                    <p
                      id="registration-display-name-help"
                      className="authentication-help"
                    >
                      The name other people see, including in chats. It doesn’t
                      need to be unique.
                    </p>
                    <button className="button dark full" type="submit">
                      {busy ? "Saving…" : "Continue"}
                    </button>
                  </fieldset>
                </form>
              ) : showingPicture && identity?.status === "enrolled" ? (
                <div className="authentication-picture-step">
                  {actor.status === "authorized" ? (
                    <ProfileImageUploader
                      endpoint="/api/profile/avatar"
                      currentImageUrl={actor.profile.avatarUrl}
                      displayName={identity.profile.displayName}
                      initials={profileInitials(identity.profile.displayName)}
                      kind="account"
                      onBusyChange={setPictureBusy}
                    />
                  ) : (
                    <p role="status">
                      Picture upload is temporarily unavailable. You can
                      continue and add it from your Profile later.
                    </p>
                  )}
                  <button
                    className="button dark full"
                    type="button"
                    disabled={busy || pictureBusy}
                    onClick={finishPicture}
                  >
                    Continue
                  </button>
                  <button
                    className="text-button authentication-secondary"
                    type="button"
                    disabled={busy || pictureBusy}
                    onClick={finishPicture}
                  >
                    Do this later
                  </button>
                </div>
              ) : identity?.status === "enrolled" ? (
                <div className="authentication-notice">
                  <Check size={24} aria-hidden="true" />
                  <p>Your profile is ready, {identity.profile.displayName}.</p>
                  {intent === "coach" && (
                    <>
                      <p>
                        Apply to coach with this same account. MovX reviews
                        applications before coaches can publish their profile or
                        schedule.
                      </p>
                      <button
                        className="button dark full"
                        type="button"
                        disabled={!ready || busy}
                        onClick={() => void coach()}
                      >
                        {busy ? "Submitting…" : "Apply to coach"}
                      </button>
                    </>
                  )}
                  <Link href={target} className="button secondary full">
                    {intent === "coach" ? "Continue as an athlete" : "Continue"}
                  </Link>
                </div>
              ) : (
                <p role="status">
                  {identity?.status === "unavailable"
                    ? "Profile access is unavailable. Please reload to try again."
                    : "Checking your profile…"}
                </p>
              )}
            </>
          )}
          {error && (
            <p
              className="authentication-error"
              role="alert"
              ref={errorRef}
              tabIndex={-1}
            >
              {error}
            </p>
          )}
          {(signedIn || recovery) && (
            <button
              type="button"
              className="text-button authentication-secondary"
              disabled={!ready || busy || pictureBusy}
              onClick={() => void run({ action: "sign-out" })}
            >
              Sign out on this device
            </button>
          )}
          {authEntry && (
            <p className="authentication-switch">
              {stage === "sign-in"
                ? "New to MovX Club?"
                : "Already have an account?"}{" "}
              <Link href={link(stage === "sign-in" ? "register" : "sign-in")}>
                {stage === "sign-in" ? "Create an account" : "Sign in"}
              </Link>
            </p>
          )}
          {!authEntry && (
            <Link href={link("sign-in")} className="authentication-inline-link">
              Back to sign in
            </Link>
          )}
          <footer>
            <Link href="/explore">Browse coaches without signing in</Link>
            <span>Your account stays with you as your training grows.</span>
          </footer>
        </div>
      </div>
    </section>
  );
}
