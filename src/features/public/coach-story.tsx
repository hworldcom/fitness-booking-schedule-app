import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  MapPin,
  ShieldCheck,
  TicketCheck,
  UserRoundSearch,
  UsersRound,
  WalletCards,
} from "lucide-react";

const passSteps = [
  {
    number: "01",
    title: "Find your coach",
    description:
      "Compare fictional coaches by discipline, profile, coach-selected public location and published weekly availability.",
    Icon: UserRoundSearch,
  },
  {
    number: "02",
    title: "Buy one or ten credits",
    description:
      "Choose that coach’s one-session or ten-session offer and approve its exact test-EURC price on Solana Devnet.",
    Icon: WalletCards,
  },
  {
    number: "03",
    title: "Book one clear hour",
    description:
      "Use one available coach-specific credit to reserve one capacity-one time from the coach’s calendar.",
    Icon: CalendarDays,
  },
  {
    number: "04",
    title: "Cancel by a known rule",
    description:
      "An early cancellation returns the credit automatically. A later request waits for that coach’s decision.",
    Icon: Clock3,
  },
] as const;

const groupFundingSteps = [
  {
    number: "01",
    title: "Coach publishes the event",
    description:
      "The coach fixes the schedule, seat price, funding deadline, minimum, maximum and payout recipient.",
    Icon: CalendarDays,
  },
  {
    number: "02",
    title: "Each participant funds one seat",
    description:
      "A participant approves the exact test-EURC seat price into the program-controlled pool before the deadline.",
    Icon: UsersRound,
  },
  {
    number: "03",
    title: "The threshold decides",
    description:
      "After the deadline, settlement reads the immutable participant count. The deadline itself sends no transaction.",
    Icon: ShieldCheck,
  },
  {
    number: "04",
    title: "Payout or individual refunds",
    description:
      "A successful pool pays the frozen coach recipient once. A failed pool lets each participant reclaim exactly their contribution.",
    Icon: TicketCheck,
  },
] as const;

const coachSteps = [
  "Create a coach profile and choose one public training location.",
  "Publish recurring private availability and one-credit or ten-credit offers.",
  "Create a group event with an exact seat price, capacity and funding deadline.",
  "Decide late private-booking cancellations; the program decides group payout or refund eligibility.",
] as const;

export function CoachStoryHome() {
  return (
    <div className="coach-story">
      <section className="coach-hero" aria-labelledby="coach-hero-title">
        <div className="coach-hero-copy">
          <span className="eyebrow">TWO WAYS TO TRAIN WITH A COACH</span>
          <h1 id="coach-hero-title">
            Book a private session. Or help a group event happen.
          </h1>
          <p>
            Find a martial-arts coach, buy one or ten coach-specific credits and
            book from their calendar. For a group session, fund one seat and let
            the published minimum decide between coach payout and participant
            refunds.
          </p>
          <div className="coach-story-actions">
            <Link className="button lime" href="/explore">
              Explore coaches <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button coach-button-ghost" href="/how-it-works">
              See both features
            </Link>
          </div>
          <div className="coach-preview-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              Public product preview · fictional coaches and events · Solana
              Devnet test EURC · no real funds
            </span>
          </div>
        </div>

        <div className="coach-hero-visual" aria-label="Two-feature preview">
          <span className="coach-visual-label">THE TWO MVP LOOPS</span>
          <div className="coach-location-preview">
            <span className="coach-location-icon" aria-hidden="true">
              <MapPin size={22} />
            </span>
            <span>
              <small>DISCOVER</small>
              <strong>One coach-selected public training place</strong>
            </span>
          </div>
          <div className="coach-week-preview">
            <span>
              <small>PRIVATE BOOKING</small>
              <strong>One or ten credits · one calendar hour</strong>
            </span>
            <span className="coach-time-chip">
              <Clock3 size={14} aria-hidden="true" /> Coach cutoff
            </span>
          </div>
          <div className="coach-group-preview">
            <span className="coach-group-count" aria-hidden="true">
              <UsersRound size={21} />
            </span>
            <span>
              <small>GROUP FUNDING</small>
              <strong>Reach the minimum or reclaim each funded seat</strong>
            </span>
          </div>
          <p>
            Discovery and schedules are available today. Pass transactions,
            booking actions and group funding remain clearly labelled preview
            flows until their Devnet integrations are complete.
          </p>
        </div>
      </section>

      <section className="coach-story-section" aria-labelledby="loop-title">
        <div className="coach-section-heading">
          <span className="eyebrow">FEATURE ONE · PRIVATE BOOKING</span>
          <h2 id="loop-title">Buy coach credits, then book the right hour.</h2>
          <p>
            The primary loop keeps the coach, exact pass terms, calendar time
            and cancellation outcome connected.
          </p>
        </div>
        <StoryStepGrid steps={passSteps} />
      </section>

      <section className="coach-pass-story" aria-labelledby="pass-story-title">
        <div className="coach-pass-story-copy">
          <span className="eyebrow">ONE COACH · ONE CLEAR BALANCE</span>
          <h2 id="pass-story-title">Credits follow that coach’s calendar.</h2>
          <p>
            Buying a pass adds exactly one or ten credits for one coach. A
            booking reserves one credit. Cancel before the published cutoff and
            it returns automatically; cancel later and the coach approves or
            denies the return.
          </p>
        </div>
        <div className="coach-pass-options" aria-label="Coach pass options">
          <article>
            <span>1×</span>
            <div>
              <h3>One credit</h3>
              <p>Try one private session with a selected coach.</p>
            </div>
          </article>
          <article>
            <span>10×</span>
            <div>
              <h3>Ten credits</h3>
              <p>
                Keep one visible balance for repeat bookings with that coach.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="coach-group-story"
        aria-labelledby="group-story-title"
      >
        <div className="coach-section-heading">
          <span className="eyebrow">
            FEATURE TWO · CONDITIONAL GROUP FUNDING
          </span>
          <h2 id="group-story-title">
            Fund one seat. Let the published threshold decide.
          </h2>
          <p>
            A coach fixes the event terms before funding opens. Participants do
            not send money directly to the coach: exact seat contributions wait
            in a program-controlled pool for settlement after the deadline.
          </p>
        </div>
        <StoryStepGrid steps={groupFundingSteps} />
        <div className="coach-group-outcomes">
          <article>
            <Check size={18} aria-hidden="true" />
            <div>
              <strong>Minimum reached</strong>
              <p>
                The pool succeeds and the frozen coach recipient can be paid
                once.
              </p>
            </div>
          </article>
          <article>
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Minimum missed</strong>
              <p>
                The pool fails and each participant can claim their exact
                refund.
              </p>
            </div>
          </article>
          <Link className="button dark" href="/coming-soon">
            Group funding is coming soon
          </Link>
        </div>
      </section>

      <section className="coach-two-sides" aria-labelledby="two-sides-title">
        <div className="coach-section-heading">
          <span className="eyebrow">BUILT FOR BOTH SIDES</span>
          <h2 id="two-sides-title">Clear choices for clients and coaches.</h2>
        </div>
        <div className="coach-benefit-grid">
          <article className="coach-benefit-card member">
            <span className="coach-benefit-icon" aria-hidden="true">
              <Compass size={23} />
            </span>
            <span className="eyebrow">FOR CLIENTS</span>
            <h3>Choose private or group training with context.</h3>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" /> Compare coaches,
                locations, passes and schedules
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Know the private-booking
                cancellation rule before booking
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> See the group minimum,
                deadline and refund outcome before funding
              </li>
            </ul>
          </article>
          <article className="coach-benefit-card coach">
            <span className="coach-benefit-icon" aria-hidden="true">
              <UsersRound size={23} />
            </span>
            <span className="eyebrow">FOR COACHES</span>
            <h3>Publish private availability and viable group events.</h3>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" /> Offer one or ten credits
                against your working week
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Set immutable event
                price, capacity, deadline and recipient
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Receive group funds only
                after the minimum succeeds
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="coach-devnet-story" aria-labelledby="devnet-title">
        <div>
          <span className="eyebrow">EMAIL EXPERIENCE · SOLANA VALUE RAILS</span>
          <h2 id="devnet-title">MovX pays the SOL. Users keep authority.</h2>
          <p>
            Email handles the application account. A linked wallet authorizes
            its own marketplace action and exact test-EURC value, while the MovX
            platform pays transaction fees and account rent. Test EURC has no
            real value.
          </p>
        </div>
        <ol>
          <li>
            <span>1</span> Review exact Devnet terms
          </li>
          <li>
            <span>2</span> User signs the action
          </li>
          <li>
            <span>3</span> MovX pays SOL fees and rent
          </li>
          <li>
            <span>4</span> Finalized state drives the view
          </li>
        </ol>
      </section>

      <StoryCallToAction />
    </div>
  );
}

export function HowItWorksStory() {
  return (
    <div className="coach-story how-story">
      <section className="how-story-hero" aria-labelledby="how-story-title">
        <div>
          <span className="eyebrow">HOW MOVX WORKS</span>
          <h1 id="how-story-title">Two clear paths to train with a coach.</h1>
          <p>
            Buy coach-specific credits and book a private calendar hour, or fund
            one seat in a coach-created group event whose published minimum
            decides payout or refunds.
          </p>
          <div className="coach-story-actions">
            <Link className="button lime" href="/explore">
              Explore coaches <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button coach-button-ghost" href="/">
              Back to overview
            </Link>
          </div>
        </div>
        <div className="how-story-summary" aria-label="Preview disclosure">
          <TicketCheck size={30} aria-hidden="true" />
          <strong>Public preview, not live transactions</strong>
          <p>
            Discovery, profiles and schedules are available. Pass purchase,
            private booking and group-funding actions remain unavailable until
            their Devnet interfaces are finished.
          </p>
        </div>
      </section>

      <section
        className="coach-story-section"
        aria-labelledby="client-flow-title"
      >
        <div className="coach-section-heading">
          <span className="eyebrow">FEATURE ONE · PRIVATE BOOKING</span>
          <h2 id="client-flow-title">One pass balance, one coach at a time.</h2>
          <p>
            Credits are bought for a specific coach and reserve only that
            coach’s calendar occurrences.
          </p>
        </div>
        <StoryStepGrid steps={passSteps} extraClassName="how-step-grid" />
      </section>

      <section
        className="coach-group-story how-group-story"
        aria-labelledby="group-flow-title"
      >
        <div className="coach-section-heading">
          <span className="eyebrow">FEATURE TWO · GROUP FUNDING</span>
          <h2 id="group-flow-title">
            One funded seat, with a deterministic outcome.
          </h2>
          <p>
            The coach cannot change financial terms after the pool is created.
            Settlement succeeds or fails from the published threshold, and the
            two outcomes cannot both pay.
          </p>
        </div>
        <StoryStepGrid steps={groupFundingSteps} />
      </section>

      <section
        className="how-details-grid"
        aria-label="Important product boundaries"
      >
        <article>
          <MapPin size={25} aria-hidden="true" />
          <span className="eyebrow">THE PLACE</span>
          <h2>A public training location, not live tracking.</h2>
          <p>
            A coach chooses one public discovery location. A fictional gym is a
            place label only and receives no account, wallet or payout
            authority.
          </p>
        </article>
        <article>
          <WalletCards size={25} aria-hidden="true" />
          <span className="eyebrow">THE PRIVATE PASS</span>
          <h2>One or ten coach-specific credits.</h2>
          <p>
            Purchase adds the exact credits atomically. Booking reserves one;
            the published cutoff determines automatic return or a later coach
            decision.
          </p>
        </article>
        <article>
          <UsersRound size={25} aria-hidden="true" />
          <span className="eyebrow">THE GROUP POOL</span>
          <h2>Coach payout or individual refunds.</h2>
          <p>
            Exact seat payments wait in a program-controlled vault. Reaching the
            minimum enables one payout; missing it enables each contributor’s
            exact refund.
          </p>
        </article>
      </section>

      <section className="coach-flow" aria-labelledby="coach-flow-title">
        <div>
          <span className="eyebrow">THE COACH JOURNEY</span>
          <h2 id="coach-flow-title">
            One profile for private and group training.
          </h2>
          <p>
            Coaches own their profile, public location, weekly availability,
            pass terms and event terms. MovX sponsorship pays SOL costs but
            cannot sign as the coach or change a financial outcome.
          </p>
        </div>
        <ol>
          {coachSteps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="how-trust" aria-labelledby="trust-title">
        <ShieldCheck size={30} aria-hidden="true" />
        <div>
          <span className="eyebrow">HONEST BY DESIGN</span>
          <h2 id="trust-title">
            What the current preview does—and does not—claim.
          </h2>
          <p>
            The demo targets Solana Devnet and test EURC. It uses fictional
            coaches, locations and events, and no real funds. A deadline does
            not execute automatically, the platform sponsor grants no business
            authority, and on-chain settlement does not prove that training
            occurred or resolve a service dispute.
          </p>
        </div>
      </section>

      <StoryCallToAction />
    </div>
  );
}

function StoryStepGrid({
  steps,
  extraClassName,
}: {
  steps: readonly {
    number: string;
    title: string;
    description: string;
    Icon: typeof CalendarDays;
  }[];
  extraClassName?: string;
}) {
  return (
    <div
      className={`coach-step-grid${extraClassName ? ` ${extraClassName}` : ""}`}
    >
      {steps.map(({ number, title, description, Icon }) => (
        <article className="coach-step-card" key={number}>
          <div className="coach-step-topline">
            <span>{number}</span>
            <Icon size={21} aria-hidden="true" />
          </div>
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}

function StoryCallToAction() {
  return (
    <section className="coach-story-cta" aria-labelledby="story-cta-title">
      <div>
        <span className="eyebrow">FOLLOW THE BUILD</span>
        <h2 id="story-cta-title">Want to try both complete loops?</h2>
        <p>
          Join the early-access list for the first complete pass-booking and
          group-funding walkthrough. No purchase, booking or funding action is
          available from this preview yet.
        </p>
      </div>
      <Link className="button lime" href="/coming-soon">
        Join early access <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
