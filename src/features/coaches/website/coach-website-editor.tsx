"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useActor } from "@/auth/client/actor-provider";
import { useAuthSession } from "@/auth/client/session-provider";
import { Modal } from "@/components/ui";
import type { CoachProjection } from "@/domain/coaches";
import {
  COACH_BANNER_MAX_SOURCE_BYTES,
  parseCoachWebsiteContent,
  validateCoachWebsiteContent,
  type CoachWebsiteContentIssue,
  type CoachWebsite,
  type CoachWebsiteContent,
} from "@/domain/coach-website";
import {
  parseCoachStartingRateText,
  type OwnedCoachStartingRate,
} from "@/domain/coach-starting-rate";
import { RevisionEditor, type EditorSnapshot } from "./revision-editor";
import {
  editorRequest,
  parseOwnedRate,
  parseOwnedWebsite,
  rateDraft,
  type RateDraft,
} from "./website-client";
import { CoachWebsitePreview } from "./coach-website-preview";
import {
  WebsiteContentErrorSummary,
  WebsiteFieldErrors,
  websiteContentFieldId,
} from "./website-content-errors";
import "./coach-website-editor.css";

const WEBSITE_API = "/api/coach/website";
const RATE_API = "/api/coach/starting-rate";
const readWebsite = () =>
  editorRequest(WEBSITE_API, parseOwnedWebsite, "website");
const readRate = () => editorRequest(RATE_API, parseOwnedRate, "startingRate");

export function CoachWebsiteEditor(props: {
  coach: CoachProjection;
  publicationAllowed: boolean;
}) {
  const { actor } = useActor();
  const { session } = useAuthSession();
  const scope =
    session.status === "signed-in" &&
    actor.status === "authorized" &&
    ["approved", "demo", "pending", "rejected"].includes(
      actor.coachAccessStatus,
    )
      ? `${session.subject}:${actor.demoRun.slug}:${actor.profile.slug}:${actor.coachAccessStatus}`
      : null;
  // Bind these server-provided coach props to the first verified identity. A
  // later identity must reload the route, rather than borrow the old preview.
  const [initialScope] = useState(scope);
  if (!scope || initialScope !== scope)
    return (
      <p role="status">
        Reload your coach profile to check website editing access.
      </p>
    );
  return <ScopedWebsiteEditor key={scope} {...props} />;
}

function Recovery<T extends { revision: number }, D>({
  editor,
  state,
  read,
}: {
  editor: RevisionEditor<T, D>;
  state: EditorSnapshot<T, D>;
  read: () => ReturnType<typeof editorRequest<T>>;
}) {
  return (
    <>
      {state.message && (
        <p
          className="website-editor-notice"
          role={state.recovery || state.accessLost ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
      {state.recovery === "choose" ? (
        <div className="website-editor-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => editor.choose(false)}
          >
            Use latest saved version
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => editor.choose(true)}
          >
            Keep my draft for review
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="website-editor-text-button"
          disabled={state.busy}
          onClick={() => void editor.load(read)}
        >
          {state.saved ? "Load latest saved version" : "Retry loading"}
        </button>
      )}
    </>
  );
}

function TextField({
  label,
  value,
  limit,
  rows,
  onChange,
  id,
  issues = [],
}: {
  id?: string;
  issues?: readonly CoachWebsiteContentIssue[];
  label: string;
  value: string;
  limit: number;
  rows?: number;
  onChange: (value: string) => void;
}) {
  const count = [...value].length;
  return (
    <label className="coach-field">
      <span>{label}</span>
      {rows ? (
        <textarea
          id={id}
          aria-describedby={
            id
              ? `${id}-count${issues.length ? ` ${id}-errors` : ""}`
              : undefined
          }
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={issues.length > 0 || count > limit || undefined}
        />
      ) : (
        <input
          id={id}
          aria-describedby={
            id
              ? `${id}-count${issues.length ? ` ${id}-errors` : ""}`
              : undefined
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={issues.length > 0 || count > limit || undefined}
        />
      )}
      <small id={id ? `${id}-count` : undefined}>
        {count} / {limit} characters
      </small>
      {id && <WebsiteFieldErrors id={`${id}-errors`} issues={issues} />}
    </label>
  );
}

function ScopedWebsiteEditor({
  coach,
  publicationAllowed,
}: {
  coach: CoachProjection;
  publicationAllowed: boolean;
}) {
  const [website] = useState(
    () =>
      new RevisionEditor<CoachWebsite, CoachWebsiteContent>(
        (value) => value.content,
      ),
  );
  const [rate] = useState(
    () => new RevisionEditor<OwnedCoachStartingRate, RateDraft>(rateDraft),
  );
  const contentState = useSyncExternalStore(
    website.subscribe,
    website.getSnapshot,
    website.getSnapshot,
  );
  const rateState = useSyncExternalStore(
    rate.subscribe,
    rate.getSnapshot,
    rate.getSnapshot,
  );
  const [preview, setPreview] = useState<"saved" | "draft" | null>(null);
  const mounted = useRef(false);
  const fieldPrefix = `website-content-${useId()}`;
  const errorSummary = useRef<HTMLDivElement>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const contentIssues =
    validationAttempted && contentState.editing
      ? validateCoachWebsiteContent(contentState.draft).issues
      : [];
  const fieldId = (field: string) => websiteContentFieldId(fieldPrefix, field);
  const issuesFor = (field: string) =>
    contentIssues.filter((issue) => issue.field === field);
  useEffect(() => {
    if (validationAttempt > 0) errorSummary.current?.focus();
  }, [validationAttempt]);
  useEffect(() => {
    mounted.current = true;
    void website.load(readWebsite);
    void rate.load(readRate);
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) {
          website.dispose();
          rate.dispose();
        }
      });
    };
  }, [website, rate]);
  const editing = contentState.editing || rateState.editing;
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);
  const accessLost = contentState.accessLost || rateState.accessLost;
  useEffect(() => {
    if (accessLost) {
      website.revoke();
      rate.revoke();
    }
  }, [accessLost, website, rate]);
  if (accessLost)
    return (
      <section className="coach-website-editor">
        <h2>Coach website</h2>
        <p role="alert">
          Your website editing access changed. Reload the page to check your
          account.
        </p>
      </section>
    );
  const draft = contentState.draft;
  function change<K extends keyof CoachWebsiteContent>(
    key: K,
    value: CoachWebsiteContent[K],
  ) {
    if (draft) website.change({ ...draft, [key]: value });
  }
  async function saveContent() {
    const { content } = validateCoachWebsiteContent(draft);
    setValidationAttempted(true);
    if (!content) {
      setValidationAttempt((attempt) => attempt + 1);
      website.notice("");
      return;
    }
    await website.mutate((expectedRevision) =>
      editorRequest(WEBSITE_API, parseOwnedWebsite, "website", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemaVersion: 1, expectedRevision, content }),
      }),
    );
  }
  async function banner(file: File | null, remove = false) {
    if (
      !remove &&
      (!file ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > COACH_BANNER_MAX_SOURCE_BYTES ||
        !file.size)
    ) {
      website.notice(
        "Choose a JPEG, PNG or WebP image up to 4 MiB. Your current banner and text are retained.",
      );
      return;
    }
    await website.mutate(
      (expectedRevision) =>
        editorRequest(`${WEBSITE_API}/banner`, parseOwnedWebsite, "website", {
          method: remove ? "DELETE" : "POST",
          headers: {
            "if-match": `"${expectedRevision}"`,
            ...(!remove && file ? { "content-type": file.type } : {}),
          },
          ...(!remove && file ? { body: file } : {}),
        }),
      true,
    );
  }
  async function saveRate() {
    const parsed = parseCoachStartingRateText(rateState.draft?.amount);
    if (!parsed || !rateState.draft) {
      rate.notice(
        "Enter a non-negative EUR amount with at most two decimal places, up to €21,474,836.47. Leave it empty for no starting rate.",
      );
      return;
    }
    const showPublicly = rateState.draft.showPublicly;
    await rate.mutate((expectedRevision) =>
      editorRequest(RATE_API, parseOwnedRate, "startingRate", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          expectedRevision,
          ...parsed,
          currency: "EUR",
          showPublicly,
        }),
      }),
    );
  }
  const blocked =
    contentState.busy || !!contentState.recovery || !contentState.saved;
  const rateBlocked =
    rateState.busy || !!rateState.recovery || !rateState.saved;
  const previewContent =
    preview === "draft" && contentState.editing
      ? parseCoachWebsiteContent(draft)
      : contentState.saved?.content;
  const previewRate =
    preview === "draft" && rateState.editing && rateState.draft
      ? (() => {
          const parsed = parseCoachStartingRateText(rateState.draft.amount);
          return parsed
            ? { ...parsed, showPublicly: rateState.draft.showPublicly }
            : null;
        })()
      : rateState.saved;
  return (
    <section
      className="coach-website-editor"
      aria-labelledby="website-editor-title"
    >
      <div className="website-editor-heading">
        <div>
          <span className="eyebrow">YOUR COACH WEBSITE</span>
          <h2 id="website-editor-title">A page that feels like you.</h2>
          <p>Tell athletes how you coach. All website fields are optional.</p>
        </div>
        <button
          type="button"
          className="button dark"
          disabled={!contentState.saved || contentState.busy}
          onClick={() => setPreview("saved")}
        >
          Preview website
        </button>
      </div>
      <div className="website-editor-columns">
        <div className="website-editor-panel">
          <h3>Website content</h3>
          <p>
            Content saves independently from your profile details and starting
            rate below.
          </p>
          {contentState.saved && !contentState.editing && (
            <>
              <p>
                {contentState.saved.content.brandLabel ||
                  "No brand label added yet."}
              </p>
              <p>
                {contentState.saved.content.introduction ||
                  "Add a short introduction, your approach and answers to common questions."}
              </p>
              <button
                className="button secondary"
                type="button"
                disabled={blocked}
                onClick={() => {
                  setValidationAttempted(false);
                  website.edit();
                }}
              >
                Edit website content
              </button>
            </>
          )}
          {contentState.editing && draft && (
            <form
              noValidate
              id={fieldId("content")}
              tabIndex={-1}
              onSubmit={(event) => {
                event.preventDefault();
                void saveContent();
              }}
            >
              <WebsiteContentErrorSummary
                prefix={fieldPrefix}
                issues={contentIssues}
                summaryRef={errorSummary}
              />
              <fieldset
                disabled={contentState.busy}
                className="website-editor-fields"
              >
                <legend className="sr-only">Website content</legend>
                <TextField
                  label="Brand label (optional)"
                  id={fieldId("brandLabel")}
                  issues={issuesFor("brandLabel")}
                  value={draft.brandLabel}
                  limit={80}
                  onChange={(value) => change("brandLabel", value)}
                />
                <TextField
                  label="Short introduction (optional)"
                  id={fieldId("introduction")}
                  issues={issuesFor("introduction")}
                  value={draft.introduction}
                  limit={220}
                  rows={3}
                  onChange={(value) => change("introduction", value)}
                />
                <TextField
                  label="Your approach (optional)"
                  id={fieldId("approach")}
                  issues={issuesFor("approach")}
                  value={draft.approach}
                  limit={2000}
                  rows={5}
                  onChange={(value) => change("approach", value)}
                />
                <TextField
                  label="Experience & qualifications (optional)"
                  id={fieldId("experience")}
                  issues={issuesFor("experience")}
                  value={draft.experience}
                  limit={2000}
                  rows={5}
                  onChange={(value) => change("experience", value)}
                />
                <p>
                  Experience and qualifications are coach-provided information,
                  separate from MOVX approval.
                </p>
                <label className="coach-field">
                  <span>Focus &amp; levels (one per line, up to 8)</span>
                  <textarea
                    id={fieldId("focusLabels")}
                    aria-invalid={
                      issuesFor("focusLabels").length > 0 || undefined
                    }
                    aria-describedby={`${fieldId("focusLabels")}-help${issuesFor("focusLabels").length ? ` ${fieldId("focusLabels")}-errors` : ""}`}
                    rows={4}
                    value={draft.focusLabels.join("\n")}
                    onChange={(event) =>
                      change(
                        "focusLabels",
                        event.target.value === ""
                          ? []
                          : event.target.value.split("\n"),
                      )
                    }
                  />
                  <small id={`${fieldId("focusLabels")}-help`}>
                    Up to 60 characters each. Remove empty lines before saving.
                  </small>
                  <WebsiteFieldErrors
                    id={`${fieldId("focusLabels")}-errors`}
                    issues={issuesFor("focusLabels")}
                  />
                </label>
                <h4 id={fieldId("faqs")} tabIndex={-1}>
                  Frequently asked questions
                </h4>
                <WebsiteFieldErrors
                  id={`${fieldId("faqs")}-errors`}
                  issues={issuesFor("faqs")}
                />
                {draft.faqs.map((faq, index) => (
                  <fieldset className="website-editor-row" key={index}>
                    <legend>Question {index + 1}</legend>
                    <TextField
                      label={`FAQ ${index + 1} question`}
                      id={fieldId(`faqs.${index}.question`)}
                      issues={issuesFor(`faqs.${index}.question`)}
                      value={faq.question}
                      limit={160}
                      onChange={(question) =>
                        change(
                          "faqs",
                          draft.faqs.map((row, i) =>
                            i === index ? { ...row, question } : row,
                          ),
                        )
                      }
                    />
                    <TextField
                      label={`FAQ ${index + 1} answer`}
                      id={fieldId(`faqs.${index}.answer`)}
                      issues={issuesFor(`faqs.${index}.answer`)}
                      value={faq.answer}
                      limit={1000}
                      rows={3}
                      onChange={(answer) =>
                        change(
                          "faqs",
                          draft.faqs.map((row, i) =>
                            i === index ? { ...row, answer } : row,
                          ),
                        )
                      }
                    />
                    <button
                      className="website-editor-text-button"
                      type="button"
                      onClick={() =>
                        change(
                          "faqs",
                          draft.faqs.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove question {index + 1}
                    </button>
                  </fieldset>
                ))}
                <button
                  className="button secondary"
                  type="button"
                  disabled={draft.faqs.length >= 6}
                  onClick={() =>
                    change("faqs", [
                      ...draft.faqs,
                      { question: "", answer: "" },
                    ])
                  }
                >
                  Add question
                </button>
                <h4 id={fieldId("links")} tabIndex={-1}>
                  External links
                </h4>
                <WebsiteFieldErrors
                  id={`${fieldId("links")}-errors`}
                  issues={issuesFor("links")}
                />
                {draft.links.map((link, index) => (
                  <fieldset className="website-editor-row" key={index}>
                    <legend>Link {index + 1}</legend>
                    <TextField
                      label={`Link ${index + 1} label`}
                      id={fieldId(`links.${index}.label`)}
                      issues={issuesFor(`links.${index}.label`)}
                      value={link.label}
                      limit={60}
                      onChange={(label) =>
                        change(
                          "links",
                          draft.links.map((row, i) =>
                            i === index ? { ...row, label } : row,
                          ),
                        )
                      }
                    />
                    <label className="coach-field">
                      <span>Link {index + 1} HTTPS address</span>
                      <input
                        type="url"
                        id={fieldId(`links.${index}.url`)}
                        aria-invalid={
                          issuesFor(`links.${index}.url`).length > 0 ||
                          undefined
                        }
                        aria-describedby={
                          issuesFor(`links.${index}.url`).length
                            ? `${fieldId(`links.${index}.url`)}-errors`
                            : undefined
                        }
                        value={link.url}
                        maxLength={2048}
                        onChange={(event) =>
                          change(
                            "links",
                            draft.links.map((row, i) =>
                              i === index
                                ? { ...row, url: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                      <WebsiteFieldErrors
                        id={`${fieldId(`links.${index}.url`)}-errors`}
                        issues={issuesFor(`links.${index}.url`)}
                      />
                    </label>
                    <button
                      className="website-editor-text-button"
                      type="button"
                      onClick={() =>
                        change(
                          "links",
                          draft.links.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove link {index + 1}
                    </button>
                  </fieldset>
                ))}
                <button
                  className="button secondary"
                  type="button"
                  disabled={draft.links.length >= 4}
                  onClick={() =>
                    change("links", [...draft.links, { label: "", url: "" }])
                  }
                >
                  Add link
                </button>
              </fieldset>
              <div className="website-editor-actions">
                <button className="button dark" disabled={blocked}>
                  Save website content
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={blocked}
                  onClick={() => {
                    setValidationAttempted(false);
                    website.cancel();
                  }}
                >
                  Cancel content edits
                </button>
              </div>
            </form>
          )}
          <Recovery editor={website} state={contentState} read={readWebsite} />
        </div>
        <div className="website-editor-sidebar">
          <div className="website-editor-panel">
            <h3>Banner image</h3>
            <p>
              A separate wide image for your coach page. Your portrait is
              managed in coaching identity.
            </p>
            <p>
              JPEG, PNG or WebP · Up to 4 MiB · Single frame · At least 320 ×
              120 px. Center-cropped to 8:3.
            </p>
            {contentState.saved?.banner && (
              <p>Banner saved. View it in your website preview.</p>
            )}
            <label className="coach-field">
              <span>
                {contentState.saved?.banner
                  ? "Replace banner (saves immediately)"
                  : "Upload banner (saves immediately)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={blocked}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  event.target.value = "";
                  if (file) void banner(file);
                }}
              />
            </label>
            {contentState.saved?.banner && (
              <button
                className="button secondary"
                type="button"
                disabled={blocked}
                onClick={() => void banner(null, true)}
              >
                Remove banner now
              </button>
            )}
            <small>
              Banner changes save immediately. Cancel content edits does not
              undo a saved banner change.
            </small>
          </div>
          <div className="website-editor-panel">
            <h3>Private-session starting rate</h3>
            <p>
              An optional guide for one-hour private sessions. This does not set
              a booking price.
            </p>
            {rateState.saved && !rateState.editing && (
              <>
                <p>
                  {rateState.saved.amountCents === null
                    ? "No starting rate saved."
                    : `${rateDraft(rateState.saved).amount} EUR · ${rateState.saved.showPublicly ? "Public disclosure on" : "Only you can see this amount"}`}
                </p>
                <button
                  className="button secondary"
                  type="button"
                  disabled={rateBlocked}
                  onClick={() => rate.edit()}
                >
                  Edit starting rate
                </button>
              </>
            )}
            {rateState.editing && rateState.draft && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveRate();
                }}
              >
                <fieldset
                  className="website-editor-fields"
                  disabled={rateState.busy}
                >
                  <legend className="sr-only">Starting rate</legend>
                  <label className="coach-field">
                    <span>Starting amount (EUR)</span>
                    <input
                      inputMode="decimal"
                      value={rateState.draft.amount}
                      onChange={(event) =>
                        rate.change({
                          ...rateState.draft!,
                          amount: event.target.value,
                        })
                      }
                    />
                    <small>Leave empty for no rate. Enter 0 for free.</small>
                  </label>
                  <label className="website-editor-checkbox">
                    <input
                      type="checkbox"
                      checked={rateState.draft.showPublicly}
                      onChange={(event) =>
                        rate.change({
                          ...rateState.draft!,
                          showPublicly: event.target.checked,
                        })
                      }
                    />
                    <span>Show starting rate publicly</span>
                  </label>
                </fieldset>
                <div className="website-editor-actions">
                  <button className="button dark" disabled={rateBlocked}>
                    Save starting rate
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={rateBlocked}
                    onClick={() => rate.cancel()}
                  >
                    Cancel rate edits
                  </button>
                </div>
              </form>
            )}
            <Recovery editor={rate} state={rateState} read={readRate} />
          </div>
        </div>
      </div>
      {preview && contentState.saved && (
        <Modal
          title="Your coach website preview"
          eyebrow="COACH WEBSITE"
          onClose={() => setPreview(null)}
        >
          <div className="website-preview-controls">
            <PreviewChoice
              active={preview === "saved"}
              onClick={() => setPreview("saved")}
            >
              Saved content
            </PreviewChoice>
            <PreviewChoice
              active={preview === "draft"}
              onClick={() => setPreview("draft")}
              disabled={!editing}
            >
              Unsaved draft
            </PreviewChoice>
          </div>
          {previewContent ? (
            <CoachWebsitePreview
              coach={coach}
              content={previewContent}
              bannerUrl={contentState.saved.banner?.hero.url ?? null}
              rate={previewRate ?? null}
              publicationAllowed={publicationAllowed}
              unsaved={preview === "draft" && editing}
              unverified={
                !!contentState.recovery ||
                !!rateState.recovery ||
                !rateState.saved
              }
            />
          ) : (
            <p role="alert">
              Some draft fields are incomplete or invalid. Complete them before
              previewing. Saved content is available in the Saved content view.
            </p>
          )}
          {preview === "draft" && rateState.editing && !previewRate && (
            <p role="alert">
              The starting-rate draft is invalid and is omitted from this
              preview.
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
function PreviewChoice({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={`button ${active ? "dark" : "secondary"}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
