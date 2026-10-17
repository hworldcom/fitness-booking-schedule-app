"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Globe2, ShieldCheck, UserRound } from "lucide-react";
import {
  accountDetailsInput,
  isAccountResult,
  type AccountDetails,
  type AccountResult,
} from "@/account/contracts";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { signInHref } from "@/auth/return-to";

async function requestDetails(
  input?: AccountDetails,
  signal?: AbortSignal,
): Promise<AccountResult> {
  try {
    const response = await fetch("/api/account", {
      method: input ? "POST" : "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal,
      headers: input
        ? { "content-type": "application/json", accept: "application/json" }
        : { accept: "application/json" },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    const value: unknown = await response.json();
    return isAccountResult(value) && (response.ok || value.status !== "ready")
      ? value
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export function AccountSettings() {
  const { actor, refreshActor } = useActor();
  const { session } = useAuthSession();
  if (actor.status !== "authorized" || session.status !== "signed-in") {
    return (
      <div className="account-access-state">
        <h1>Account settings</h1>
        <p role="alert">
          {actor.status === "unavailable" || session.status === "unavailable"
            ? "We couldn’t verify your account right now."
            : "Sign in to manage your account."}
        </p>
        <Link className="button dark" href={signInHref("/account")}>
          Check sign-in
        </Link>
      </div>
    );
  }
  return (
    <AccountEditor
      key={`${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}`}
      email={session.email}
      onSaved={refreshActor}
    />
  );
}

function AccountEditor({
  email,
  onSaved,
}: {
  email: string;
  onSaved: () => Promise<unknown>;
}) {
  const [result, setResult] = useState<AccountResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AccountDetails | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const editButton = useRef<HTMLButtonElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void requestDetails(undefined, controller.signal).then((value) => {
      if (controller.signal.aborted) return;
      setResult(value);
      setLoading(false);
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [reload]);
  useEffect(() => {
    if (editing) nameInput.current?.focus();
  }, [editing]);
  const details = result?.status === "ready" ? result.details : null;
  const endEdit = () => {
    setEditing(false);
    setDraft(null);
    setError(null);
    setConflict(false);
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const startEdit = () => {
    if (!details) return;
    setDraft(details);
    setEditing(true);
    setNotice(null);
    setError(null);
    setConflict(false);
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !draft) return;
    const input = accountDetailsInput(draft);
    if (!input) {
      setError(
        "Use a name of 2–80 characters, a valid birthdate, and gender of up to 80 characters.",
      );
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    setConflict(false);
    try {
      const next = await requestDetails(input);
      if (!alive.current) return;
      if (next.status === "ready") {
        setResult(next);
        endEdit();
        setNotice("Personal details saved.");
        await onSaved();
      } else if (next.status === "signed-out" || next.status === "forbidden") {
        setResult(next);
        endEdit();
      } else {
        setConflict(next.status === "conflict");
        setError(
          next.status === "conflict"
            ? "These details changed in another window. Your draft is kept. Load the latest details before editing again."
            : next.status === "invalid"
              ? "Check your name, birthdate and gender, then try again."
              : "We couldn’t save your details. Your draft is kept; try again.",
        );
      }
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  }
  const retry = () => {
    endEdit();
    setLoading(true);
    setResult(null);
    setNotice(null);
    setReload((value) => value + 1);
  };
  return (
    <AccountSettingsView email={email}>
      <section
        id="personal-details"
        aria-labelledby="personal-details-heading"
        className="account-settings-section"
      >
        <div className="account-section-heading">
          <h2 id="personal-details-heading">Personal details</h2>
          {details && !editing && (
            <button
              ref={editButton}
              type="button"
              className="account-edit-link"
              onClick={startEdit}
            >
              Edit<span className="sr-only"> personal details</span>
            </button>
          )}
        </div>
        <p className="account-section-intro">
          Your personal information, in one place.
        </p>
        {loading ? (
          <p role="status">Loading your details…</p>
        ) : !details ? (
          <div className="account-settings-feedback" role="alert">
            <p>
              {result?.status === "signed-out" || result?.status === "forbidden"
                ? "Sign in again to access your personal details."
                : "Your personal details are unavailable right now."}
            </p>
            {result?.status === "signed-out" ||
            result?.status === "forbidden" ? (
              <Link href={signInHref("/account")}>Check sign-in</Link>
            ) : (
              <button
                type="button"
                className="account-edit-link"
                onClick={retry}
              >
                Try again
              </button>
            )}
          </div>
        ) : editing && draft ? (
          <form onSubmit={(event) => void save(event)}>
            <fieldset disabled={saving}>
              <legend className="sr-only">Edit personal details</legend>
              <label className="account-settings-field">
                Name
                <input
                  ref={nameInput}
                  autoComplete="name"
                  name="displayName"
                  value={draft.displayName}
                  required
                  maxLength={160}
                  onChange={(event) =>
                    setDraft({ ...draft, displayName: event.target.value })
                  }
                />
                <span>
                  This is the name used in your MovX sessions and messages.
                </span>
              </label>
              <label className="account-settings-field">
                Birthdate <span className="account-optional">(optional)</span>
                <input
                  type="date"
                  name="birthdate"
                  autoComplete="bday"
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={draft.birthdate ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      birthdate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label className="account-settings-field">
                Gender <span className="account-optional">(optional)</span>
                <input
                  name="gender"
                  autoComplete="sex"
                  maxLength={160}
                  value={draft.gender ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, gender: event.target.value || null })
                  }
                />
                <span>Describe it in your own words, or leave this empty.</span>
              </label>
              <p className="account-private-note">
                <ShieldCheck size={17} aria-hidden="true" /> Birthdate and
                gender are visible only to you.
              </p>
              {error && (
                <div className="account-settings-feedback" role="alert">
                  <p>{error}</p>
                  {conflict && (
                    <button
                      type="button"
                      className="account-edit-link"
                      onClick={retry}
                    >
                      Discard draft and load latest details
                    </button>
                  )}
                </div>
              )}
              <div className="account-form-actions">
                <button
                  type="submit"
                  className="button dark"
                  disabled={conflict}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="account-edit-link"
                  onClick={endEdit}
                >
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <dl className="account-settings-rows">
            <SettingRow title="Name" value={details.displayName} />
            <SettingRow
              title="Birthdate"
              value={
                details.birthdate
                  ? formatBirthdate(details.birthdate)
                  : "Not provided"
              }
            />
            <SettingRow
              title="Gender"
              value={details.gender ?? "Not provided"}
            />
          </dl>
        )}
        {notice && (
          <p className="account-save-notice" role="status">
            {notice}
          </p>
        )}
      </section>
    </AccountSettingsView>
  );
}

export function AccountSettingsView({
  email,
  children,
}: {
  email: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="account-settings-layout">
      <aside className="account-settings-sidebar">
        <h1>Account settings</h1>
        <nav aria-label="Account settings">
          <a href="#personal-details">
            <UserRound size={20} aria-hidden="true" />
            Personal details
          </a>
          <a href="#login-security">
            <ShieldCheck size={20} aria-hidden="true" />
            Login &amp; security
          </a>
          <a href="#language">
            <Globe2 size={20} aria-hidden="true" />
            Language
          </a>
        </nav>
        <Link className="account-profile-return" href="/profile">
          Open personal Profile
        </Link>
      </aside>
      <div className="account-settings-content">
        {children}
        <section
          id="login-security"
          aria-labelledby="login-security-heading"
          className="account-settings-section"
        >
          <h2 id="login-security-heading">Login &amp; security</h2>
          <dl className="account-settings-rows">
            <SettingRow title="Email address" value={email} />
            <SettingRow title="Sign-in method" value="One-time email code" />
          </dl>
          <p className="account-section-intro">
            Use the code sent to your email to sign in. You don’t need a MovX
            password.
          </p>
          <Link href={signInHref("/account")} className="account-edit-link">
            Manage sign-in and sign out
          </Link>
        </section>
        <section
          id="language"
          aria-labelledby="language-heading"
          className="account-settings-section"
        >
          <h2 id="language-heading">Language</h2>
          <p className="account-section-intro">
            The language used across MovX.
          </p>
          <dl className="account-settings-rows">
            <div className="account-setting-row">
              <div>
                <dt>English</dt>
                <dd>Current language</dd>
              </div>
              <span className="account-language-status">Active</span>
            </div>
            <div className="account-setting-row">
              <div>
                <dt lang="de">Deutsch</dt>
                <dd>German</dd>
              </div>
              <span className="account-coming-soon">Coming soon</span>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function SettingRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="account-setting-row">
      <div>
        <dt>{title}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}

export function formatBirthdate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
