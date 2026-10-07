import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Sparkles,
} from "lucide-react";
import { WaitlistRequest } from "./waitlist-request";

const previewSteps = [
  "Discover coaches and confirmed public training places",
  "Compare real published one-hour availability",
  "Book one capacity-one private session by email",
  "Manage client and coach schedules from the same database",
];

export function ComingSoonScreen() {
  return (
    <div className="coming-soon">
      <section className="coming-soon-hero" aria-labelledby="coming-soon-title">
        <div className="coming-soon-copy">
          <span className="eyebrow">MOVX CLUB · SCHEDULING PREVIEW</span>
          <h1 id="coming-soon-title">
            Find a coach and reserve your next hour.
          </h1>
          <p>
            MovX connects coach discovery, recurring availability and direct
            private-session booking in one focused experience.
          </p>
          <ul>
            {previewSteps.map((step) => (
              <li key={step}>
                <Check size={14} strokeWidth={3} aria-hidden="true" />
                {step}
              </li>
            ))}
          </ul>
          <div className="coming-soon-status">
            <Sparkles size={17} aria-hidden="true" />
            <span>Product preview · Fictional profiles · No payments</span>
          </div>
        </div>
        <div className="coming-soon-orbit" aria-hidden="true">
          <span className="coming-soon-orbit-ring" />
          <span className="coming-soon-orbit-center">
            <CalendarDays size={35} />
          </span>
          <strong>DISCOVER · SCHEDULE · TRAIN</strong>
        </div>
      </section>
      <section className="coming-soon-waitlist" aria-label="Join the waitlist">
        <div className="coming-soon-waitlist-copy">
          <span className="eyebrow">FOLLOW THE BUILD</span>
          <h2>Get an invitation when the hosted demo is ready.</h2>
          <p>
            Join the early-access list for scheduling-product updates and demo
            availability.
          </p>
          <Link href="/" className="coming-soon-text-link">
            <ArrowLeft size={15} aria-hidden="true" /> MovX Club home
          </Link>
        </div>
        <WaitlistRequest />
      </section>
      <section className="coming-soon-return">
        <div>
          <span className="eyebrow">EARLY ACCESS</span>
          <h2>The complete hosted scheduling rehearsal comes next.</h2>
        </div>
        <a className="button dark" href="#waitlist-email">
          Join the waitlist <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
