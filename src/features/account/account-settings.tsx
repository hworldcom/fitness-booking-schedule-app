"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Globe2, ShieldCheck, UserRound } from "lucide-react";
import {
  accountDetailsInput,
  defaultFirstName,
  isAccountResult,
  preferredChatName,
  type AccountInput,
  type AccountResult,
} from "@/account/contracts";
import { accountSectionHref, type AccountSection } from "@/account/sections";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { signInHref } from "@/auth/return-to";
import { accountEditInput, advanceOtherDraft } from "./account-settings-model";
import { AccountGenderField } from "./account-gender-field";
import { AccountAuthenticationControls } from "@/features/auth/account-authentication-controls";

type EditableSection = AccountInput["section"];
type Draft = { input: AccountInput; error: string | null; conflict: boolean };

async function requestDetails(
  input?: AccountInput,
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

export function AccountSettings({ section }: { section: AccountSection }) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  if (actor.status !== "authorized" || session.status !== "signed-in")
    return (
      <div className="account-access-state">
        <h1>Account settings</h1>
        <p role="alert">
          {actor.status === "unavailable" || session.status === "unavailable"
            ? "We couldn’t verify your account right now."
            : "Sign in to manage your account."}
        </p>
        <Link
          className="button dark"
          href={signInHref(accountSectionHref(section))}
        >
          Check sign-in
        </Link>
      </div>
    );
  return (
    <AccountEditor
      key={`${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}`}
      email={session.email}
      section={section}
    />
  );
}

function AccountEditor({
  email,
  section,
}: {
  email: string;
  section: AccountSection;
}) {
  const [result, setResult] = useState<AccountResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Partial<Record<EditableSection, Draft>>>(
    {},
  );
  const [notices, setNotices] = useState<
    Partial<Record<EditableSection, string>>
  >({});
  const [saving, setSaving] = useState<EditableSection | null>(null);
  const [reload, setReload] = useState(0);
  const editButtons = useRef<
    Partial<Record<EditableSection, HTMLButtonElement | null>>
  >({});
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void requestDetails(undefined, controller.signal).then((value) => {
      if (!controller.signal.aborted) {
        setResult(value);
        setLoading(false);
      }
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [reload]);
  const details = result?.status === "ready" ? result.details : null;
  const personal = drafts["personal-details"];
  const login = drafts["login-security"];
  const personalInput =
    personal?.input.section === "personal-details" ? personal.input : null;
  const loginInput =
    login?.input.section === "login-security" ? login.input : null;
  function change(input: AccountInput) {
    setDrafts((current) => ({
      ...current,
      [input.section]: { ...current[input.section]!, input },
    }));
  }
  function endEdit(target: EditableSection) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[target];
      return next;
    });
    requestAnimationFrame(() => editButtons.current[target]?.focus());
  }
  function startEdit(target: EditableSection) {
    if (!details) return;
    setDrafts((current) => ({
      ...current,
      [target]: {
        input: accountEditInput(details, target),
        error: null,
        conflict: false,
      },
    }));
    setNotices((current) => ({ ...current, [target]: undefined }));
    requestAnimationFrame(() =>
      document
        .getElementById(
          target === "personal-details"
            ? "account-legal-name"
            : "account-username",
        )
        ?.focus(),
    );
  }
  function error(target: EditableSection, message: string, conflict = false) {
    setDrafts((current) =>
      current[target]
        ? {
            ...current,
            [target]: { ...current[target]!, error: message, conflict },
          }
        : current,
    );
  }
  async function save(event: FormEvent, target: EditableSection) {
    event.preventDefault();
    if (lock.current) return;
    const input = accountDetailsInput(drafts[target]?.input);
    if (!input) {
      error(
        target,
        target === "login-security"
          ? "Use 3–30 letters, numbers or underscores, starting with a letter."
          : "Check your legal name, preferred first name, birthdate and gender. Names can have up to 80 characters.",
      );
      return;
    }
    lock.current = true;
    setSaving(target);
    error(target, "");
    try {
      const next = await requestDetails(input);
      if (!alive.current) return;
      if (next.status === "ready") {
        setResult(next);
        setDrafts((current) => {
          const remaining = { ...current };
          delete remaining[target];
          const other =
            target === "personal-details"
              ? "login-security"
              : "personal-details";
          if (remaining[other])
            remaining[other] = {
              ...remaining[other]!,
              input: advanceOtherDraft(
                remaining[other]!.input,
                input,
                next.details.revision,
              ),
            };
          return remaining;
        });
        setNotices((current) => ({
          ...current,
          [target]:
            target === "personal-details"
              ? "Personal details saved."
              : "Username saved.",
        }));
        requestAnimationFrame(() => editButtons.current[target]?.focus());
      } else if (next.status === "signed-out" || next.status === "forbidden") {
        setResult(next);
        setDrafts({});
      } else
        error(
          target,
          next.status === "username-taken"
            ? "That username is already taken. Try another."
            : next.status === "conflict"
              ? "These settings changed in another window. Your draft is kept. Load the latest settings before editing again."
              : next.status === "invalid"
                ? "Check these details, then try again."
                : "We couldn’t save your settings. Your draft is kept; try again.",
          next.status === "conflict",
        );
    } finally {
      lock.current = false;
      if (alive.current) setSaving(null);
    }
  }
  function retry() {
    setDrafts({});
    setLoading(true);
    setResult(null);
    setNotices({});
    setReload((value) => value + 1);
  }
  const unavailable = loading ? (
    <p role="status">Loading your details…</p>
  ) : (
    <div className="account-settings-feedback" role="alert">
      <p>
        {result?.status === "signed-out" || result?.status === "forbidden"
          ? "Sign in again to access your settings."
          : "Your settings are unavailable right now."}
      </p>
      {result?.status === "signed-out" || result?.status === "forbidden" ? (
        <Link href={signInHref(accountSectionHref(section))}>
          Check sign-in
        </Link>
      ) : (
        <button type="button" className="account-edit-link" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
  const feedback = (draft: Draft) =>
    draft.error ? (
      <div className="account-settings-feedback" role="alert">
        <p>{draft.error}</p>
        {draft.conflict && (
          <button type="button" className="account-edit-link" onClick={retry}>
            Discard drafts and load latest settings
          </button>
        )}
      </div>
    ) : null;
  const actions = (target: EditableSection, draft: Draft) => (
    <div className="account-form-actions">
      <button type="submit" className="button dark" disabled={draft.conflict}>
        {saving === target ? "Saving…" : "Save changes"}
      </button>
      <button
        type="button"
        className="account-edit-link"
        onClick={() => endEdit(target)}
      >
        Cancel
      </button>
    </div>
  );
  const edit = (target: EditableSection) => (
    <button
      ref={(element) => {
        editButtons.current[target] = element;
      }}
      type="button"
      className="account-edit-link"
      disabled={saving !== null}
      onClick={() => startEdit(target)}
    >
      Edit
      <span className="sr-only">
        {" "}
        {target === "personal-details" ? "personal details" : "username"}
      </span>
    </button>
  );
  return (
    <AccountSettingsView
      authenticationSettings={
        <AccountAuthenticationControls key={email} email={email} />
      }
      email={email}
      section={section}
      personalDetails={
        <section
          id="personal-details"
          aria-labelledby="personal-details-heading"
          className="account-settings-section"
        >
          <div className="account-section-heading">
            <h2 id="personal-details-heading" tabIndex={-1}>
              Personal details
            </h2>
            {details && !personalInput && edit("personal-details")}
          </div>
          <p className="account-section-intro">
            Your personal information, in one place.
          </p>
          {!details ? (
            unavailable
          ) : personalInput && personal ? (
            <form onSubmit={(event) => void save(event, "personal-details")}>
              <fieldset disabled={saving !== null}>
                <legend className="sr-only">Edit personal details</legend>
                <label className="account-settings-field">
                  Legal name{" "}
                  <span className="account-optional">(optional)</span>
                  <input
                    id="account-legal-name"
                    autoComplete="name"
                    name="legalName"
                    maxLength={160}
                    value={personalInput.legalName ?? ""}
                    onChange={(event) =>
                      change({
                        ...personalInput,
                        legalName: event.target.value || null,
                      })
                    }
                  />
                  <span>Your full legal name stays private.</span>
                </label>
                <label className="account-settings-field">
                  Preferred first name{" "}
                  <span className="account-optional">(optional)</span>
                  <input
                    autoComplete="given-name"
                    name="preferredFirstName"
                    maxLength={160}
                    value={personalInput.preferredFirstName ?? ""}
                    placeholder={defaultFirstName(
                      personalInput.legalName,
                      details.displayName,
                    )}
                    onChange={(event) =>
                      change({
                        ...personalInput,
                        preferredFirstName: event.target.value || null,
                      })
                    }
                  />
                  <span>
                    Shown in chats. Leave empty to use{" "}
                    {defaultFirstName(
                      personalInput.legalName,
                      details.displayName,
                    )}
                    .
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
                    value={personalInput.birthdate ?? ""}
                    onChange={(event) =>
                      change({
                        ...personalInput,
                        birthdate: event.target.value || null,
                      })
                    }
                  />
                </label>
                <AccountGenderField
                  value={personalInput.gender}
                  onChange={(gender) => change({ ...personalInput, gender })}
                />
                <p className="account-private-note">
                  <ShieldCheck size={17} aria-hidden="true" /> Legal name,
                  birthdate and gender are visible only to you.
                </p>
                {feedback(personal)}
                {actions("personal-details", personal)}
              </fieldset>
            </form>
          ) : (
            <dl className="account-settings-rows">
              <SettingRow
                title="Legal name"
                value={details.legalName ?? "Not provided"}
              />
              <SettingRow
                title="Preferred first name"
                value={preferredChatName(details)}
              />
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
          {notices["personal-details"] && (
            <p className="account-save-notice" role="status">
              {notices["personal-details"]}
            </p>
          )}
        </section>
      }
      usernameSettings={
        <div className="account-username-settings">
          <div className="account-section-heading">
            <h3>Username</h3>
            {details && !loginInput && edit("login-security")}
          </div>
          <p className="account-section-intro">
            Reserve a username for future sign-in and profile links. These
            features aren’t available yet.
          </p>
          {!details ? (
            unavailable
          ) : loginInput && login ? (
            <form onSubmit={(event) => void save(event, "login-security")}>
              <fieldset disabled={saving !== null}>
                <legend className="sr-only">Edit username</legend>
                <label className="account-settings-field">
                  Username <span className="account-optional">(optional)</span>
                  <input
                    id="account-username"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={31}
                    value={loginInput.username ?? ""}
                    onChange={(event) =>
                      change({
                        ...loginInput,
                        username: event.target.value || null,
                      })
                    }
                  />
                  <span>
                    3–30 letters, numbers or underscores, starting with a
                    letter. This isn’t your chat name.
                  </span>
                </label>
                {feedback(login)}
                {actions("login-security", login)}
              </fieldset>
            </form>
          ) : (
            <dl className="account-settings-rows">
              <SettingRow
                title="Username"
                value={details.username ?? "Not set"}
              />
            </dl>
          )}
          {notices["login-security"] && (
            <p className="account-save-notice" role="status">
              {notices["login-security"]}
            </p>
          )}
        </div>
      }
    />
  );
}

export function AccountSettingsView({
  email,
  section,
  personalDetails,
  usernameSettings,
  authenticationSettings,
}: {
  email: string;
  section: AccountSection;
  personalDetails?: ReactNode;
  usernameSettings?: ReactNode;
  authenticationSettings?: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  const previousSection = useRef(section);
  useEffect(() => {
    if (previousSection.current !== section) {
      content.current?.querySelector<HTMLElement>("h2")?.focus();
      previousSection.current = section;
    }
  }, [section]);
  return (
    <div className="account-settings-layout">
      <aside className="account-settings-sidebar">
        <h1>Account settings</h1>
        <nav aria-label="Account settings">
          {(
            [
              {
                key: "personal-details",
                label: "Personal details",
                Icon: UserRound,
              },
              {
                key: "login-security",
                label: "Login & security",
                Icon: ShieldCheck,
              },
              { key: "language", label: "Language", Icon: Globe2 },
            ] as const
          ).map(({ key, label, Icon }) => (
            <Link
              key={key}
              href={accountSectionHref(key)}
              scroll={false}
              aria-current={section === key ? "page" : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <Link className="account-profile-return" href="/profile">
          Open personal Profile
        </Link>
      </aside>
      <div ref={content} className="account-settings-content">
        {section === "personal-details" ? (
          personalDetails
        ) : section === "login-security" ? (
          <section
            id="login-security"
            aria-labelledby="login-security-heading"
            className="account-settings-section"
          >
            <h2 id="login-security-heading" tabIndex={-1}>
              Login &amp; security
            </h2>
            {usernameSettings}
            <dl className="account-settings-rows">
              <SettingRow title="Email address" value={email} />
            </dl>
            {authenticationSettings}
          </section>
        ) : (
          <section
            id="language"
            aria-labelledby="language-heading"
            className="account-settings-section"
          >
            <h2 id="language-heading" tabIndex={-1}>
              Language
            </h2>
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
        )}
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
