import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  Dumbbell,
  MapPin,
  MessageCircle,
  ShieldCheck,
  TicketCheck,
  UserRoundSearch,
  UsersRound,
  WalletCards,
} from "lucide-react";

const memberSteps = [
  {
    number: "01",
    title: "Find your coach",
    description:
      "Browse martial-arts coaches by discipline, public training location and, once live, real weekly availability.",
    Icon: UserRoundSearch,
  },
  {
    number: "02",
    title: "Choose a private slot",
    description:
      "Pick one capacity-one time from the coach’s coming week. The time and training location stay attached to the booking.",
    Icon: CalendarDays,
  },
  {
    number: "03",
    title: "Use or buy a pass",
    description:
      "Use a valid TrainingPass or purchase a one-session or ten-session pass with test EURC on Solana Devnet.",
    Icon: WalletCards,
  },
  {
    number: "04",
    title: "Train, then redeem",
    description:
      "Booking reserves a session. The balance changes only after the private class is completed and the coach confirms it.",
    Icon: Dumbbell,
  },
] as const;

const coachSteps = [
  "Create a coach profile and choose one public training location.",
  "Publish capacity-one private slots for the coming seven days.",
  "Offer a one-session or ten-session pass with clear test-EURC terms.",
  "Confirm completed training, then keep clients connected through posts.",
] as const;

export function CoachStoryHome() {
  return (
    <div className="coach-story">
      <section className="coach-hero" aria-labelledby="coach-hero-title">
        <div className="coach-hero-copy">
          <span className="eyebrow">YOUR GOALS · YOUR COACH · YOUR TIME</span>
          <h1 id="coach-hero-title">
            Private training built around the way you want to move.
          </h1>
          <p>
            Discover martial-arts coaches, compare disciplines and public
            training locations, then choose a private slot that fits your
            week—all with one clear TrainingPass balance.
          </p>
          <div className="coach-story-actions">
            <Link className="button lime" href="/explore">
              Explore coaches <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button coach-button-ghost" href="/how-it-works">
              See how it works
            </Link>
          </div>
          <div className="coach-preview-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              Product preview · fictional coaches and gyms · Devnet test EURC
              only
            </span>
          </div>
        </div>

        <div className="coach-hero-visual" aria-label="Product flow preview">
          <span className="coach-visual-label">HOW MOVX CONNECTS THE DOTS</span>
          <div className="coach-location-preview">
            <span className="coach-location-icon" aria-hidden="true">
              <MapPin size={22} />
            </span>
            <span>
              <small>COACH-SELECTED TRAINING PLACE</small>
              <strong>Independent or at a fictional gym</strong>
            </span>
          </div>
          <div className="coach-week-preview">
            <span>
              <small>PRIVATE AVAILABILITY</small>
              <strong>One coach · one client · one clear slot</strong>
            </span>
            <span className="coach-time-chip">
              <Clock3 size={14} aria-hidden="true" /> Coming week
            </span>
          </div>
          <div className="coach-pass-preview">
            <span className="coach-pass-count">10</span>
            <span>
              <small>TRAININGPASS</small>
              <strong>Sessions stay visible and verifiable</strong>
            </span>
          </div>
          <p>
            A map pin shows the coach’s chosen public training place—not live
            tracking, current presence or availability.
          </p>
        </div>
      </section>

      <section className="coach-story-section" aria-labelledby="loop-title">
        <div className="coach-section-heading">
          <span className="eyebrow">ONE SIMPLE TRAINING LOOP</span>
          <h2 id="loop-title">From the right coach to a completed class.</h2>
          <p>
            MovX keeps discovery, booking and session balance in one
            understandable flow.
          </p>
        </div>
        <div className="coach-step-grid">
          {memberSteps.map(({ number, title, description, Icon }) => (
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
      </section>

      <section className="coach-pass-story" aria-labelledby="pass-story-title">
        <div className="coach-pass-story-copy">
          <span className="eyebrow">CREDITS THAT STAY CLEAR</span>
          <h2 id="pass-story-title">Book with confidence.</h2>
          <p>
            A booking reserves one session without consuming it. Cancel before
            the class starts and the unused credit remains available. One
            session is deducted only after completed training is confirmed.
          </p>
        </div>
        <div className="coach-pass-options" aria-label="TrainingPass options">
          <article>
            <span>1×</span>
            <div>
              <h3>One session</h3>
              <p>Try a coach or book the occasional private class.</p>
            </div>
          </article>
          <article>
            <span>10×</span>
            <div>
              <h3>Ten sessions</h3>
              <p>
                Build consistency while keeping the remaining balance clear.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="coach-two-sides" aria-labelledby="two-sides-title">
        <div className="coach-section-heading">
          <span className="eyebrow">BUILT FOR BOTH SIDES</span>
          <h2 id="two-sides-title">Less coordination. More good training.</h2>
        </div>
        <div className="coach-benefit-grid">
          <article className="coach-benefit-card member">
            <span className="coach-benefit-icon" aria-hidden="true">
              <Compass size={23} />
            </span>
            <span className="eyebrow">FOR CLIENTS</span>
            <h3>Choose with context.</h3>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" /> Compare disciplines,
                profiles and locations
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> See the booked time and
                place clearly
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Keep unused credits after
                cancellation
              </li>
            </ul>
          </article>
          <article className="coach-benefit-card coach">
            <span className="coach-benefit-icon" aria-hidden="true">
              <UsersRound size={23} />
            </span>
            <span className="eyebrow">FOR COACHES</span>
            <h3>Own your training offer.</h3>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" /> Publish your own weekly
                private slots
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Train independently or at
                a fictional gym location
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Build an audience through
                coach posts
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="coach-devnet-story" aria-labelledby="devnet-title">
        <div>
          <span className="eyebrow">WEB2 EXPERIENCE · SOLANA RAILS</span>
          <h2 id="devnet-title">The product stays understandable first.</h2>
          <p>
            Email handles the account experience. Solana Devnet records offer,
            payment and TrainingPass state using test EURC—never real funds in
            this preview.
          </p>
        </div>
        <ol>
          <li>
            <span>1</span> Email account
          </li>
          <li>
            <span>2</span> Test-EURC purchase
          </li>
          <li>
            <span>3</span> Verifiable balance
          </li>
          <li>
            <span>4</span> Completed-session use
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
          <h1 id="how-story-title">One clear path to private training.</h1>
          <p>
            Find a martial-arts coach, choose a real weekly slot and use one
            transparent pass. MovX keeps the coach, time, place and remaining
            sessions connected.
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
          <strong>Preview, not a live marketplace</strong>
          <p>
            Coach profiles, gym names, locations, offers and availability shown
            during development are fictional demonstration data.
          </p>
        </div>
      </section>

      <section
        className="coach-story-section"
        aria-labelledby="client-flow-title"
      >
        <div className="coach-section-heading">
          <span className="eyebrow">THE CLIENT JOURNEY</span>
          <h2 id="client-flow-title">Know what happens at every step.</h2>
        </div>
        <div className="coach-step-grid how-step-grid">
          {memberSteps.map(({ number, title, description, Icon }) => (
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
      </section>

      <section
        className="how-details-grid"
        aria-label="Important product details"
      >
        <article>
          <MapPin size={25} aria-hidden="true" />
          <span className="eyebrow">THE PLACE</span>
          <h2>A public training location, not live tracking.</h2>
          <p>
            A coach chooses one public place for discovery. It may be an
            independent location or a fictional gym. The gym is only a location
            label—it does not control the coach, offer or booking.
          </p>
        </article>
        <article>
          <TicketCheck size={25} aria-hidden="true" />
          <span className="eyebrow">THE PASS</span>
          <h2>One session or ten, with a visible balance.</h2>
          <p>
            A future booking reserves a credit. Cancellation before the start
            releases it. Only a coach-confirmed completed class consumes it.
          </p>
        </article>
        <article>
          <MessageCircle size={25} aria-hidden="true" />
          <span className="eyebrow">THE CONNECTION</span>
          <h2>Follow the coaches you want to train with.</h2>
          <p>
            Coach posts keep clients connected after discovery without adding
            reactions, comments, rankings or private messages to the MVP.
          </p>
        </article>
      </section>

      <section className="coach-flow" aria-labelledby="coach-flow-title">
        <div>
          <span className="eyebrow">THE COACH JOURNEY</span>
          <h2 id="coach-flow-title">A direct way to offer private training.</h2>
          <p>
            Coaches control their profile, public location, weekly private slots
            and package terms. A selected gym receives no application or wallet
            authority.
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
            The demo targets Solana Devnet and test EURC. It does not use real
            money, promise a real coach or gym partnership, show live location,
            or claim that preview availability can already be booked.
          </p>
        </div>
      </section>

      <StoryCallToAction />
    </div>
  );
}

function StoryCallToAction() {
  return (
    <section className="coach-story-cta" aria-labelledby="story-cta-title">
      <div>
        <span className="eyebrow">FOLLOW THE BUILD</span>
        <h2 id="story-cta-title">Want to try the complete loop?</h2>
        <p>
          Join the early-access list and we’ll let you know when coach
          discovery, private booking and TrainingPasses are ready to explore
          together.
        </p>
      </div>
      <Link className="button lime" href="/coming-soon">
        Join early access <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
