"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { parseTrainingPage, type TrainingPage } from "@/training/contracts";
import {
  difficultyLabel,
  loadProgress,
  trainingHours,
  type ProgressPeriod,
  type TrainingProgress,
} from "./progress-model";

function DifficultyGauge({ average }: { average: number | null }) {
  return (
    <svg
      className={`training-difficulty-gauge${average === null ? " unrated" : ""}`}
      viewBox="0 0 64 44"
      aria-hidden="true"
    >
      <path d="M8 34a24 24 0 0 1 12-20.8" className="gauge-easy" />
      <path d="M20 13.2a24 24 0 0 1 24 0" className="gauge-moderate" />
      <path d="M44 13.2A24 24 0 0 1 56 34" className="gauge-hard" />
      {average !== null && (
        <path
          d="M32 34V17"
          className="gauge-needle"
          transform={`rotate(${(average - 2) * 65} 32 34)`}
        />
      )}
      <circle cx="32" cy="34" r="3" className="gauge-hub" />
    </svg>
  );
}

function PeriodMetrics({
  title,
  value,
}: {
  title: string;
  value: ProgressPeriod;
}) {
  const average = value.averageDifficulty;
  return (
    <section className="training-progress-period" aria-label={title}>
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>Training hours</dt>
          <dd className="training-hours">
            {trainingHours(value.minutes)} <span>hrs</span>
          </dd>
        </div>
        <div>
          <dt>Average difficulty</dt>
          <dd className="training-difficulty">
            <DifficultyGauge average={average} />
            <div>
              <strong>
                {average === null ? "Not rated" : difficultyLabel(average)}
              </strong>
              <span>
                {average === null
                  ? "No difficulty logged"
                  : `${average.toFixed(1)} / 3 · ${value.ratedCount} rated`}
              </span>
            </div>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function TrainingProgressDetails({
  page,
  scope,
  timezone,
  paused,
}: {
  page: TrainingPage;
  scope: string;
  timezone: string;
  paused: boolean;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    page: TrainingPage;
    scope: string;
    timezone: string;
    attempt: number;
    value?: TrainingProgress;
  } | null>(null);

  useEffect(() => {
    if (!expanded || paused) return;
    const controller = new AbortController();
    void loadProgress(
      async (args) => {
        const response = await fetch("/api/training", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, command: { action: "list", args } }),
        });
        const data = await response.json();
        if (!response.ok || data.status !== "ready" || data.scope !== scope)
          throw Error("Training progress unavailable");
        return parseTrainingPage(data.value);
      },
      page.now,
      timezone,
    ).then(
      (value) => {
        if (!controller.signal.aborted)
          setResult({ page, scope, timezone, attempt, value });
      },
      () => {
        if (!controller.signal.aborted)
          setResult({ page, scope, timezone, attempt });
      },
    );
    return () => controller.abort();
  }, [expanded, paused, page, scope, timezone, attempt]);

  const current =
    result?.page === page &&
    result.scope === scope &&
    result.timezone === timezone &&
    result.attempt === attempt
      ? result
      : null;
  return (
    <div className="training-progress">
      <button
        className="training-progress-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => {
          setResult(null);
          setExpanded(!expanded);
        }}
      >
        {expanded ? "View less" : "View more"}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div id={id} hidden={!expanded} className="training-progress-details">
        {expanded &&
          (paused ? (
            <p role="status">
              Training details will refresh once your calendar is up to date.
            </p>
          ) : !current ? (
            <p role="status">Loading training details…</p>
          ) : current.value ? (
            <>
              <div className="training-progress-periods">
                <PeriodMetrics title="This week" value={current.value.week} />
                <PeriodMetrics title="This month" value={current.value.month} />
              </div>
              <p className="training-progress-help">
                Attended workouts only. Hours use logged duration, or scheduled
                duration when none is logged. Difficulty averages your ratings:
                Easy 1 · Moderate 2 · Hard 3.
              </p>
            </>
          ) : (
            <div className="training-progress-error">
              <p role="status">Training details are unavailable. Try again.</p>
              <button
                className="text-link"
                onClick={() => setAttempt(attempt + 1)}
              >
                Retry training details
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
