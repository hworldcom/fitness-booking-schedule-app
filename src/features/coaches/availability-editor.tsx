"use client";
import Link from "next/link";
import { coachEventHref } from "@/features/coach-events/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AvailabilityEditorActions,
  AvailabilityEditorData,
} from "@/availability/contracts";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  expandAvailabilityRanges,
  isAvailabilityDate,
  type AvailabilityDate,
  type EffectiveAvailabilityCommand,
  type EffectiveAvailabilityPolicy,
  type EffectiveAvailabilityResult,
} from "@/domain/effective-availability";
import {
  AVAILABILITY_DAYS,
  applyAvailabilityCommand,
  availabilityHref,
  availabilityMonth,
  rangesFromHours,
  weeklyHours,
  weeklyRanges,
  copyAvailabilityDay,
  type AvailabilityRange,
  type WeeklyRangeDraft,
} from "./availability-editor-model";
import {
  AvailabilityDialog,
  AvailabilityRanges,
} from "./availability-editor-controls";
import "./availability-editor.css";

type SavedProjection = Extract<
  EffectiveAvailabilityResult,
  { outcome: "saved" }
>;
const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
const signature = (
  hours: readonly {
    locationId: string;
    locationUpdatedAt: string;
    localStartTime: string;
    isoWeekday?: number;
  }[],
) =>
  hours
    .map(
      (h) =>
        `${h.isoWeekday ?? ""}|${h.localStartTime}|${h.locationId}|${h.locationUpdatedAt}`,
    )
    .sort()
    .join(";");

function RetainedSessions({
  result,
  preview = true,
}: {
  result: SavedProjection;
  preview?: boolean;
}) {
  return (
    <div className="availability-impact">
      <p>
        <strong>
          {result.closedRequestCount} pending request
          {result.closedRequestCount === 1 ? "" : "s"}
        </strong>{" "}
        {preview ? "will close" : "closed"} with their existing message cards.
      </p>
      {result.retainedSessions.length > 0 ? (
        <>
          <h3>These sessions stay scheduled</h3>
          <p>
            Changing availability does not cancel or move them. Their time stays
            reserved.
          </p>
          <ul>
            {result.retainedSessions.map((s) => (
              <li key={`${s.kind}:${s.id}`}>
                <span>
                  <strong>
                    {timeLabel(s.startsAt)} –{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Europe/Berlin",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(s.endsAt))}
                  </strong>
                  <small>
                    {s.kind === "private" ? "Private session" : "Group session"}{" "}
                    · {s.venue}
                  </small>
                </span>
                <Link
                  target="_blank"
                  rel="noopener"
                  href={
                    s.kind === "private"
                      ? `/coach?view=bookings#coach-booking-${s.id}`
                      : coachEventHref(s.id)
                  }
                >
                  View{" "}
                  <span className="sr-only">{s.kind} session in a new tab</span>
                  <ChevronRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>
          No booked or published group sessions need to be retained outside
          these hours.
        </p>
      )}
    </div>
  );
}

export function AvailabilityEditor({
  initial,
  initialDate,
  initialTab = "weekly",
  actions,
}: {
  initial: AvailabilityEditorData;
  initialDate: string;
  initialTab?: "weekly" | "dates";
  actions: AvailabilityEditorActions;
}) {
  const [data, setData] = useState<AvailabilityEditorData | null>(initial);
  const [policy, setPolicy] = useState<EffectiveAvailabilityPolicy>(
    initial.policy,
  );
  const [week, setWeek] = useState<WeeklyRangeDraft>(() =>
    weeklyRanges(initial.policy.weeklyHours),
  );
  const weekStash = useRef<WeeklyRangeDraft>(week);
  const [tab, setTab] = useState<"weekly" | "dates">(initialTab);
  const existing = initial.policy.dates.find((d) => d.date === initialDate);
  const weekday = (new Date(`${initialDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const [dates, setDates] = useState<readonly string[]>([initialDate]);
  const [nextDate, setNextDate] = useState(initialDate);
  const [mode, setMode] = useState<AvailabilityDate["mode"]>(
    existing?.mode ?? "unavailable",
  );
  const [ranges, setRanges] = useState<readonly AvailabilityRange[]>(() =>
    rangesFromHours(
      existing?.hours.length
        ? existing.hours
        : initial.policy.weeklyHours.filter(
            (h) => h.isoWeekday === weekday + 1,
          ),
    ),
  );
  const [dateTouched, setDateTouched] = useState(false);
  const [busy, setBusy] = useState<"preview" | "save" | "load" | null>(null);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [copy, setCopy] = useState<{
    source: number;
    targets: readonly number[];
  } | null>(null);
  const [review, setReview] = useState<{
    command: EffectiveAvailabilityCommand;
    result: SavedProjection;
  } | null>(null);
  const [savedImpact, setSavedImpact] = useState<SavedProjection | null>(null);
  const [uncertain, setUncertain] =
    useState<EffectiveAvailabilityCommand | null>(null);
  const [navigation, setNavigation] = useState<(() => void) | null>(null);
  const afterSave = useRef<(() => void) | null>(null);
  const bypass = useRef(false);
  const [latestRevision, setLatestRevision] = useState(initial.policy.revision);
  const month = availabilityMonth(initialDate);
  let weekDirty = true;
  let hourCount = 0;
  try {
    const hours = weeklyHours(week);
    weekDirty = signature(hours) !== signature(policy.weeklyHours);
    hourCount = hours.length;
  } catch {}
  let dateDirty = dateTouched;
  if (dateTouched) {
    try {
      const hours = mode === "custom" ? expandAvailabilityRanges(ranges) : [];
      dateDirty = dates.some((date) => {
        const old = policy.dates.find((d) => d.date === date);
        return mode === "weekly"
          ? !!old
          : !old ||
              old.mode !== mode ||
              signature(old.hours) !== signature(hours);
      });
    } catch {}
  }
  const dirty = weekDirty || dateDirty || !!uncertain || !!review;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  const disabled = !!busy || !!uncertain || !data;
  const past = dates.some((date) => date < (data?.today ?? initial.today));

  const clearAccess = useCallback(() => {
    setData(null);
    setPolicy({ revision: 0, weeklyHours: [], dates: [] });
    setWeek(AVAILABILITY_DAYS.map(() => []));
    weekStash.current = AVAILABILITY_DAYS.map(() => []);
    setRanges([]);
    setDates([]);
    setReview(null);
    setUncertain(null);
    setSavedImpact(null);
    setMessage(null);
    setNavigation(null);
    afterSave.current = null;
    bypass.current = true;
  }, []);
  function requestNavigation(action: () => void) {
    if (busy) return;
    if (dirtyRef.current && !bypass.current) setNavigation(() => action);
    else action();
  }
  useEffect(() => {
    function unload(e: BeforeUnloadEvent) {
      if (dirtyRef.current && !bypass.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    function click(e: MouseEvent) {
      if (
        !dirtyRef.current ||
        bypass.current ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as Element).closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.href === location.href
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      setNavigation(() => () => {
        bypass.current = true;
        location.assign(url.href);
      });
    }
    function traverse(e: NavigateEvent) {
      if (
        e.navigationType !== "traverse" ||
        !e.cancelable ||
        !dirtyRef.current ||
        bypass.current
      )
        return;
      e.preventDefault();
      const key = e.destination.key;
      setNavigation(() => () => {
        bypass.current = true;
        window.navigation.traverseTo(key);
      });
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    window.navigation?.addEventListener("navigate", traverse);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      window.navigation?.removeEventListener("navigate", traverse);
    };
  }, []);
  useEffect(() => {
    let active = true;
    async function checkAccess() {
      if (document.visibilityState !== "visible") return;
      try {
        const result = await actions.load(
          month.from,
          month.through,
          initial.scope,
        );
        if (!active) return;
        if (result.status === "denied") clearAccess();
        else if (result.status === "ready")
          setLatestRevision(result.data.policy.revision);
      } catch {}
    }
    document.addEventListener("visibilitychange", checkAccess);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", checkAccess);
    };
  }, [actions, initial.scope, month.from, month.through, clearAccess]);

  function clearFeedback() {
    setMessage(null);
    setSavedImpact(null);
  }
  function setDay(day: number, value: readonly AvailabilityRange[]) {
    setWeek((w) => w.map((r, i) => (i === day ? value : r)));
    clearFeedback();
  }
  function resetDrafts(next = policy) {
    const savedWeek = weeklyRanges(next.weeklyHours);
    weekStash.current = savedWeek;
    setWeek(savedWeek);
    const entry = next.dates.find((d) => d.date === initialDate);
    setDates([initialDate]);
    setMode(entry?.mode ?? "unavailable");
    setRanges(
      rangesFromHours(
        entry?.hours.length
          ? entry.hours
          : next.weeklyHours.filter((h) => h.isoWeekday === weekday + 1),
      ),
    );
    setDateTouched(false);
    setReview(null);
    clearFeedback();
  }
  async function reload() {
    setBusy("load");
    try {
      const result = await actions.load(
        month.from,
        month.through,
        initial.scope,
      );
      if (result.status === "denied") clearAccess();
      else if (result.status === "ready") {
        setData(result.data);
        setPolicy(result.data.policy);
        resetDrafts(result.data.policy);
        setLatestRevision(result.data.policy.revision);
      } else setMessage({ kind: "error", text: result.message });
    } catch {
      setMessage({
        kind: "error",
        text: "Availability could not be refreshed. Your draft is still here.",
      });
    } finally {
      setBusy(null);
    }
  }
  function command(): EffectiveAvailabilityCommand {
    if (tab === "weekly")
      return {
        kind: "weekly",
        operationId: crypto.randomUUID(),
        expectedRevision: policy.revision,
        hours: weeklyHours(week),
      };
    if (!dates.length || dates.length > 31 || past)
      throw new Error("Choose 1–31 dates from today onwards.");
    const hours = mode === "custom" ? expandAvailabilityRanges(ranges) : [];
    if (mode === "custom" && !hours.length)
      throw new Error("Add at least one range for custom hours.");
    return {
      kind: "dates",
      operationId: crypto.randomUUID(),
      expectedRevision: policy.revision,
      dates: dates.map((date) => ({ date, mode, hours })),
    };
  }
  async function preview() {
    if (!data || busy || uncertain) return;
    setMessage(null);
    setSavedImpact(null);
    if (tab === "dates") setDateTouched(true);
    let next: EffectiveAvailabilityCommand;
    try {
      next = command();
    } catch (error) {
      afterSave.current = null;
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Review these ranges.",
      });
      return;
    }
    setBusy("preview");
    try {
      const result = await actions.change(next, data.scope, true);
      if (result.status === "denied") clearAccess();
      else if (result.status !== "ready") {
        afterSave.current = null;
        setMessage({ kind: "error", text: result.message });
      } else if (result.result.outcome === "conflict") {
        afterSave.current = null;
        setMessage({
          kind: "error",
          text: "Availability changed elsewhere. Your draft is unchanged. Reload the saved version before reviewing a new save.",
        });
      } else setReview({ command: next, result: result.result });
    } catch {
      afterSave.current = null;
      setMessage({
        kind: "error",
        text: "The review could not be loaded. Your draft is still here; no availability was saved by this preview.",
      });
    } finally {
      setBusy(null);
    }
  }
  async function save(next: EffectiveAvailabilityCommand) {
    if (!data || busy) return;
    setBusy("save");
    setUncertain(next);
    setMessage(null);
    try {
      const response = await actions.change(next, data.scope, false);
      if (response.status === "denied") clearAccess();
      else if (response.status === "unavailable")
        setMessage({ kind: "error", text: response.message });
      else if (response.status === "invalid") {
        afterSave.current = null;
        setUncertain(null);
        setReview(null);
        setMessage({ kind: "error", text: response.message });
      } else if (response.result.outcome === "conflict") {
        afterSave.current = null;
        setUncertain(null);
        setReview(null);
        setMessage({
          kind: "error",
          text: "Availability changed elsewhere. Your draft was kept. Reload the saved version before making a new save.",
        });
      } else {
        const updated = applyAvailabilityCommand(
          policy,
          next,
          response.result.revision,
        );
        setPolicy(updated);
        if (next.kind === "weekly")
          weekStash.current = weeklyRanges(updated.weeklyHours);
        setLatestRevision((known) => Math.max(known, updated.revision));
        setUncertain(null);
        setReview(null);
        setDateTouched(false);
        setSavedImpact(response.result);
        setMessage({
          kind: "success",
          text: "Availability saved. Existing sessions keep their original time and venue.",
        });
        if (afterSave.current) {
          const move = afterSave.current;
          afterSave.current = null;
          bypass.current = true;
          move();
          queueMicrotask(() => {
            bypass.current = false;
          });
        }
      }
    } catch {
      setMessage({
        kind: "error",
        text: "The save response was interrupted. It may have been applied. Retry the same save to check its recorded outcome.",
      });
    } finally {
      setBusy(null);
    }
  }

  if (!data)
    return (
      <section className="availability-notice" role="alert">
        <h2>Coach access changed</h2>
        <p>
          Your availability draft has been cleared. Reload and sign in with an
          authorized coach account.
        </p>
        <Link className="button dark" href="/coach">
          Reload workspace
        </Link>
      </section>
    );
  return (
    <section
      className="availability-editor"
      aria-label="Availability editor"
      aria-busy={!!busy}
    >
      <header className="availability-heading">
        <div>
          <span className="eyebrow">YOUR SCHEDULE</span>
          <h2>Availability</h2>
          <p>Set your usual week. Make room for the exceptions.</p>
        </div>
        <span className="availability-timezone">
          <Clock3 size={15} /> Europe/Berlin
        </span>
      </header>
      <div className="availability-toolbar">
        <div className="availability-tabs" aria-label="Availability sections">
          {(["weekly", "dates"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() =>
                tab !== t &&
                requestNavigation(() => {
                  setTab(t);
                  clearFeedback();
                })
              }
            >
              {t === "weekly" ? "Weekly hours" : "Date overrides"}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="availability-text-button"
          disabled={disabled}
          onClick={() =>
            requestNavigation(() => {
              void reload();
            })
          }
        >
          Reload saved version
        </button>
      </div>
      {Math.max(initial.policy.revision, latestRevision) > policy.revision && (
        <p className="availability-notice" role="status">
          A newer saved version is available. Your draft has been kept. Reload
          to review the current hours.
        </p>
      )}
      {message && (
        <div
          className={`availability-notice ${message.kind}`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.kind === "success" && <Check size={17} />}
          <p>{message.text}</p>
        </div>
      )}
      {uncertain && !busy && (
        <div className="availability-notice">
          <p>Editing is paused until this save is verified.</p>
          <button className="button dark" onClick={() => save(uncertain)}>
            Retry same save
          </button>
        </div>
      )}
      <fieldset disabled={disabled} className="availability-fields">
        {tab === "weekly" ? (
          <div className="availability-week-card">
            <div className="availability-card-intro">
              <h3>Your normal week</h3>
              <p>
                Each range creates one-hour private-session times at its
                selected venue.
              </p>
            </div>
            {AVAILABILITY_DAYS.map((day, i) => (
              <section className="availability-day" key={day} aria-label={day}>
                <label className="availability-day-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`${day} available`}
                    checked={week[i].length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const old = weekStash.current[i];
                        const l =
                          data.locations.find(
                            (l) => l.status === "active" && l.isPrimary,
                          ) ??
                          data.locations.find((l) => l.status === "active");
                        if (l)
                          setDay(
                            i,
                            old.length
                              ? old
                              : [
                                  {
                                    id: crypto.randomUUID(),
                                    startTime: "09:00",
                                    endTime: "17:00",
                                    locationId: l.id,
                                    locationUpdatedAt: l.updatedAt,
                                  },
                                ],
                          );
                      } else {
                        weekStash.current = weekStash.current.map((r, n) =>
                          n === i ? week[i] : r,
                        );
                        setDay(i, []);
                      }
                    }}
                  />
                  <span>
                    <strong>{day}</strong>
                    <small>{week[i].length ? "Available" : "Day off"}</small>
                  </span>
                </label>
                <div>
                  {week[i].length ? (
                    <AvailabilityRanges
                      label={day}
                      ranges={week[i]}
                      locations={data.locations}
                      disabled={disabled}
                      onChange={(r) => setDay(i, r)}
                    />
                  ) : (
                    <p className="availability-off">No private-session hours</p>
                  )}
                </div>
                <button
                  type="button"
                  className="availability-icon availability-copy"
                  aria-label={`Copy ${day} hours`}
                  onClick={() => setCopy({ source: i, targets: [] })}
                >
                  <Copy size={17} />
                </button>
              </section>
            ))}
          </div>
        ) : (
          <div className="availability-date-layout">
            <div className="availability-date-card">
              <div className="availability-card-intro">
                <h3>Make an exception</h3>
                <p>
                  Replaces the entire date across every venue. Your normal week
                  stays unchanged.
                </p>
              </div>
              <label className="availability-label">
                Choose a date
                <input
                  type="date"
                  value={nextDate}
                  min={data.today}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="availability-text-button"
                disabled={
                  dates.length >= 31 ||
                  !isAvailabilityDate(nextDate) ||
                  nextDate < data.today ||
                  dates.includes(nextDate)
                }
                onClick={() => {
                  setDates([...dates, nextDate].sort());
                  setDateTouched(true);
                  clearFeedback();
                }}
              >
                <Plus size={15} /> Add to selected dates
              </button>
              <div
                className="availability-date-chips"
                aria-label="Selected dates"
              >
                {dates.map((date) => (
                  <span key={date}>
                    {dateLabel(date)}
                    <button
                      type="button"
                      className="availability-icon"
                      aria-label={`Remove ${date}`}
                      onClick={() => {
                        setDates(dates.filter((d) => d !== date));
                        setDateTouched(true);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              {past && (
                <p className="availability-notice">
                  Past dates are read-only. Select today or a future date to
                  save.
                </p>
              )}
              <fieldset className="availability-modes" disabled={past}>
                <legend>Availability for selected dates</legend>
                {(
                  [
                    [
                      "unavailable",
                      "All day unavailable",
                      "Take a day off across all venues.",
                    ],
                    [
                      "custom",
                      "Custom hours",
                      "Use different hours or venues.",
                    ],
                    [
                      "weekly",
                      "Use normal week",
                      "Remove overrides and restore eligible weekly hours.",
                    ],
                  ] as const
                ).map(([value, label, help]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="availability-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => {
                        setMode(value);
                        setDateTouched(true);
                        clearFeedback();
                      }}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{help}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              {mode === "custom" && (
                <AvailabilityRanges
                  label="Date override"
                  ranges={ranges}
                  locations={data.locations}
                  disabled={disabled || past}
                  onChange={(r) => {
                    setRanges(r);
                    setDateTouched(true);
                    clearFeedback();
                  }}
                />
              )}
              {mode === "weekly" && (
                <div className="availability-normal-preview">
                  <strong>Current weekly hours</strong>
                  {dates.map((date) => {
                    const day =
                      (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
                    return (
                      <p key={date}>
                        {dateLabel(date)}:{" "}
                        {weeklyRanges(policy.weeklyHours)
                          [day].map(
                            (r) =>
                              `${r.startTime}–${r.endTime} · ${data.locations.find((l) => l.id === r.locationId)?.publicName ?? "Unavailable venue"}`,
                          )
                          .join("; ") || "Day off"}
                      </p>
                    );
                  })}
                  <small>
                    Existing bookings, group reservations and manually closed
                    hours stay protected. Review shows the current save impact.
                  </small>
                </div>
              )}
            </div>
            <aside className="availability-overrides">
              <header>
                <h3>Saved exceptions</h3>
                <div>
                  <Link
                    aria-label="Previous override month"
                    href={availabilityHref(month.previous)}
                  >
                    <ArrowLeft size={16} />
                  </Link>
                  <strong>{month.label}</strong>
                  <Link
                    aria-label="Next override month"
                    href={availabilityHref(month.next)}
                  >
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </header>
              {policy.dates.filter(
                (d) => d.date >= month.from && d.date <= month.through,
              ).length ? (
                <ul>
                  {policy.dates
                    .filter(
                      (d) => d.date >= month.from && d.date <= month.through,
                    )
                    .map((d) => (
                      <li key={d.date}>
                        <CalendarDays size={18} />
                        <span>
                          <strong>{dateLabel(d.date)}</strong>
                          <small>
                            {d.mode === "unavailable"
                              ? "All day unavailable"
                              : rangesFromHours(d.hours)
                                  .map(
                                    (r) =>
                                      `${r.startTime}–${r.endTime} · ${data.locations.find((l) => l.id === r.locationId)?.publicName ?? "Inactive venue"}`,
                                  )
                                  .join("; ")}
                          </small>
                        </span>
                        <Link href={availabilityHref(d.date)}>
                          Edit<span className="sr-only"> {d.date}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="availability-no-overrides">
                  <CalendarDays size={27} />
                  <strong>No exceptions this month</strong>
                  <p>
                    Your normal week applies unless a session already reserves
                    the time.
                  </p>
                </div>
              )}
              <p className="availability-helper">
                Future dates can be prepared now. Athletes see eligible times
                only within the next 30 local dates.
              </p>
            </aside>
          </div>
        )}
      </fieldset>
      <footer
        className={`availability-savebar${dirty || message ? " is-floating" : ""}`}
      >
        <div>
          <strong>
            {tab === "weekly"
              ? weekDirty
                ? "Unsaved weekly changes"
                : "Your normal week"
              : `${dates.length} date${dates.length === 1 ? "" : "s"} selected`}
          </strong>
          <small>
            {tab === "weekly"
              ? `${hourCount} hour${hourCount === 1 ? "" : "s"} per week · private sessions`
              : "Whole-day replacement · all venues"}
          </small>
        </div>
        <button
          type="button"
          className="button dark"
          disabled={
            disabled || (tab === "weekly" ? !weekDirty : past || !dates.length)
          }
          onClick={() => void preview()}
        >
          <Save size={16} />
          {busy === "preview" ? "Preparing review…" : "Review changes"}
        </button>
      </footer>
      {savedImpact && (
        <div className="availability-saved-impact">
          <h3>Saved change</h3>
          <RetainedSessions result={savedImpact} preview={false} />
        </div>
      )}
      {copy && (
        <AvailabilityDialog
          title={`Copy ${AVAILABILITY_DAYS[copy.source]} hours`}
          onClose={() => setCopy(null)}
        >
          <p>
            Choose target days. Their existing hours will be replaced in this
            draft.
          </p>
          <div className="availability-copy-days">
            {AVAILABILITY_DAYS.map(
              (day, i) =>
                i !== copy.source && (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={copy.targets.includes(i)}
                      onChange={(e) =>
                        setCopy({
                          ...copy,
                          targets: e.target.checked
                            ? [...copy.targets, i]
                            : copy.targets.filter((n) => n !== i),
                        })
                      }
                    />
                    {day}
                    {week[i].length > 0 && <small>Has assigned hours</small>}
                  </label>
                ),
            )}
          </div>
          {copy.targets.some((i) => week[i].length > 0) && (
            <p className="availability-notice">
              Replace existing hours on{" "}
              {copy.targets
                .filter((i) => week[i].length > 0)
                .map((i) => AVAILABILITY_DAYS[i])
                .join(", ")}
              ? This applies only after you confirm below, then save the week.
            </p>
          )}
          <div className="availability-dialog-actions">
            <button className="button secondary" onClick={() => setCopy(null)}>
              Cancel
            </button>
            <button
              className="button dark"
              disabled={!copy.targets.length}
              onClick={() => {
                setWeek(copyAvailabilityDay(week, copy.source, copy.targets));
                setCopy(null);
                clearFeedback();
              }}
            >
              Replace selected days
            </button>
          </div>
        </AvailabilityDialog>
      )}
      {review && (
        <AvailabilityDialog
          title="Review availability changes"
          busy={!!busy}
          onClose={() => {
            setReview(null);
            afterSave.current = null;
          }}
        >
          <p>
            {review.command.kind === "weekly"
              ? "Save the complete weekly schedule?"
              : `${review.command.dates.length} date(s) will use ${review.command.dates[0].mode === "unavailable" ? "all day unavailable" : review.command.dates[0].mode === "weekly" ? "the current normal week" : "the selected custom hours"} across all venues.`}
          </p>
          <RetainedSessions result={review.result} />
          {message?.kind === "error" && (
            <p role="alert" className="availability-notice error">
              {message.text}
            </p>
          )}
          {uncertain && !busy && (
            <p>Retry the exact save to verify its outcome.</p>
          )}
          <div className="availability-dialog-actions">
            <button
              className="button secondary"
              disabled={!!busy || !!uncertain}
              onClick={() => {
                setReview(null);
                afterSave.current = null;
              }}
            >
              Keep editing
            </button>
            <button
              className="button dark"
              disabled={!!busy}
              onClick={() => void save(uncertain ?? review.command)}
            >
              {busy === "save"
                ? "Saving…"
                : uncertain
                  ? "Retry same save"
                  : "Save availability"}
            </button>
          </div>
        </AvailabilityDialog>
      )}
      {navigation && (
        <AvailabilityDialog
          title={
            uncertain
              ? "Save outcome is unverified"
              : "Unsaved availability changes"
          }
          onClose={() => {
            setNavigation(null);
            afterSave.current = null;
          }}
        >
          <p>
            {uncertain
              ? "This save may already have been applied. Verify it before leaving, or leave without assuming it failed."
              : "Save your changes, discard this draft, or stay here to keep editing."}
          </p>
          <div className="availability-dialog-actions">
            <button
              className="button secondary"
              onClick={() => setNavigation(null)}
            >
              Keep editing
            </button>
            <button
              className="button secondary"
              onClick={() => {
                const move = navigation;
                setNavigation(null);
                resetDrafts();
                bypass.current = true;
                move();
                bypass.current = false;
              }}
            >
              {uncertain ? "Leave without verifying" : "Discard changes"}
            </button>
            <button
              className="button dark"
              onClick={() => {
                afterSave.current = navigation;
                setNavigation(null);
                if (uncertain) void save(uncertain);
                else void preview();
              }}
            >
              {uncertain ? "Verify save" : "Review & save"}
            </button>
          </div>
        </AvailabilityDialog>
      )}
    </section>
  );
}
