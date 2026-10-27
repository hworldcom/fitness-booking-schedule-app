import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Check, LockKeyhole } from "lucide-react";

const exampleWorkouts = [
  {
    day: "Mon",
    time: "18:00",
    name: "Strength training",
    kind: "Your routine",
  },
  { day: "Wed", time: "19:00", name: "Boxing", kind: "Private session" },
  {
    day: "Sat",
    time: "10:00",
    name: "Outdoor training",
    kind: "Group session",
  },
] as const;

export function TrainingCalendarIntro({
  id,
  title = (
    <>
      Your week.
      <br />
      Your training.
    </>
  ),
  description = "Bring your own workouts, private sessions and group training together. Set up recurring routines, log completed activities, and keep your training notes private.",
  showGuideLink = false,
}: {
  id: string;
  title?: ReactNode;
  description?: string;
  showGuideLink?: boolean;
}) {
  return (
    <section className="public-training-calendar" aria-labelledby={id}>
      <div className="public-training-calendar-copy">
        <span className="eyebrow">YOUR PERSONAL CALENDAR</span>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
        <div className="public-training-calendar-actions">
          <Link className="text-link" href="/sessions/calendar">
            Open my calendar <ArrowRight size={17} aria-hidden="true" />
          </Link>
          {showGuideLink && (
            <Link className="text-link" href="/how-it-works">
              How MovX works <ArrowRight size={17} aria-hidden="true" />
            </Link>
          )}
        </div>
        <span className="public-training-calendar-privacy">
          <LockKeyhole size={14} aria-hidden="true" />
          Your calendar and notes stay private.
        </span>
      </div>
      <figure className="public-training-week">
        <figcaption>
          <CalendarDays size={18} aria-hidden="true" />
          Example training week
        </figcaption>
        <div className="public-training-week-days" aria-hidden="true">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span
              key={day}
              className={
                exampleWorkouts.some((workout) => workout.day === day)
                  ? "has-workout"
                  : ""
              }
            >
              {day}
              <i />
            </span>
          ))}
        </div>
        <ul>
          {exampleWorkouts.map((workout, index) => (
            <li key={workout.day}>
              <span className="public-training-week-time">
                <strong>{workout.day}</strong>
                {workout.time}
              </span>
              <span className="public-training-week-activity">
                <strong>{workout.name}</strong>
                <span>{workout.kind}</span>
              </span>
              {index === 0 && (
                <Check size={17} aria-label="Logged activity example" />
              )}
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}
