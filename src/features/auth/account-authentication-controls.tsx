"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authenticationGateway } from "@/auth/client/authentication-gateway";
import { authenticationResultMessage } from "@/auth/gateway";
import { validateNewPassword } from "@/auth/password";

export function AccountAuthenticationControls({ email }: { email: string }) {
  const router = useRouter();
  const navigate = (path: string) => {
    router.replace(path);
    router.refresh();
  };
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/methods", {
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        const value: unknown = await response.json();
        if (!response.ok || !value || typeof value !== "object")
          throw new Error("unavailable");
        const data = value as Record<string, unknown>;
        if (
          data.status !== "ready" ||
          data.email !== email ||
          typeof data.hasPassword !== "boolean"
        )
          throw new Error("unavailable");
        if (active) setHasPassword(data.hasPassword);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [email]);
  useEffect(() => {
    if (error) notice.current?.focus();
  }, [error]);
  async function change(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
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
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await authenticationGateway.execute({
        action: "change-password",
        password,
        currentPassword,
      });
      if (result.status === "password-updated") {
        setPassword("");
        setCurrentPassword("");
        navigate(
          "/sign-in?notice=password-updated&returnTo=" +
            encodeURIComponent("/account?section=login-security"),
        );
      } else if (result.status === "recovery-required") navigate(result.next);
      else setError(authenticationResultMessage(result));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function signOut() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await authenticationGateway.signOut();
      if (result.status === "success") navigate("/sign-in");
      else setError(authenticationResultMessage(result));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="account-authentication-controls">
      <h3>Password</h3>
      {unavailable ? (
        <p role="status">
          Sign-in settings are unavailable. Reload to try again.
        </p>
      ) : hasPassword === null ? (
        <p role="status">Checking sign-in methods…</p>
      ) : (
        <>
          <p className="account-section-intro">
            {hasPassword
              ? "You can sign in with your email and password."
              : "You haven’t added a password yet. Verify your email to set one on this same account."}{" "}
            Email codes remain available for existing accounts.
          </p>
          {hasPassword ? (
            editing ? (
              <form
                className="authentication-form"
                onSubmit={change}
                noValidate
              >
                <fieldset disabled={busy}>
                  <legend className="sr-only">Change password</legend>
                  <label>
                    Current password
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    New password
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      aria-describedby="account-password-guidance"
                    />
                  </label>
                  <p
                    id="account-password-guidance"
                    className="authentication-help"
                  >
                    At least 8 characters. After saving, sign in again on your
                    devices.
                  </p>
                  <button className="button dark" type="submit">
                    {busy ? "Saving…" : "Save new password"}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setPassword("");
                      setCurrentPassword("");
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </fieldset>
              </form>
            ) : (
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(true)}
              >
                Change password
              </button>
            )
          ) : (
            <Link
              className="button secondary"
              href="/forgot-password?returnTo=%2Faccount%3Fsection%3Dlogin-security"
            >
              Set a password
            </Link>
          )}
          {hasPassword && (
            <p>
              <Link
                href="/forgot-password?returnTo=%2Faccount%3Fsection%3Dlogin-security"
                className="account-edit-link"
              >
                Forgot your current password?
              </Link>
            </p>
          )}
        </>
      )}
      {error && (
        <p
          role="alert"
          className="authentication-error"
          tabIndex={-1}
          ref={notice}
        >
          {error}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => void signOut()}
        disabled={busy}
      >
        Sign out on this device
      </button>
    </div>
  );
}
