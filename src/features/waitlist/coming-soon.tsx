import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Dumbbell, Sparkles } from "lucide-react";
import { WaitlistRequest } from "./waitlist-request";

const previewSteps = [
  "Discover coaches and public training locations",
  "Buy one or ten coach-specific credits",
  "Book one capacity-one private calendar hour",
  "Fund one group-event seat with payout-or-refund rules",
];

export function ComingSoonScreen() {
  return (
    <div className="coming-soon">
      <section className="coming-soon-hero" aria-labelledby="coming-soon-title">
        <div className="coming-soon-copy">
          <span className="eyebrow">MOVX CLUB · COMING SOON</span>
          <h1 id="coming-soon-title">
            Book private training or help a group event happen.
          </h1>
          <p>
            Discover independent or fictional-gym-associated coaches, explore
            their disciplines and schedules, then choose one of two clear paths:
            use coach-specific credits for a private calendar booking, or fund
            one seat in a group event whose minimum decides payout or refunds.
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
            <span>
              Product preview · Solana Devnet · Test EURC · No real funds
            </span>
          </div>
        </div>

        <div className="coming-soon-orbit" aria-hidden="true">
          <span className="coming-soon-orbit-ring" />
          <span className="coming-soon-orbit-center">
            <Dumbbell size={35} />
          </span>
          <strong>PRIVATE BOOKING · GROUP FUNDING</strong>
        </div>
      </section>

      <section className="coming-soon-waitlist" aria-label="Join the waitlist">
        <div className="coming-soon-waitlist-copy">
          <span className="eyebrow">FOLLOW THE BUILD</span>
          <h2>Get an invitation when the complete demo is ready.</h2>
          <p>
            Join the early-access list for product updates, demo availability
            and the first complete pass-booking and group-funding walkthrough.
          </p>
          <Link href="/" className="coming-soon-text-link">
            <ArrowLeft size={15} aria-hidden="true" /> MovX Club home
          </Link>
        </div>
        <WaitlistRequest />
      </section>

      <section className="coming-soon-return">
        <div>
          <span className="eyebrow">FOLLOW THE REBUILD</span>
          <h2>The complete two-feature experience is coming next.</h2>
        </div>
        <a className="button dark" href="#waitlist-email">
          Join the waitlist <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
    </div>
  );
}
