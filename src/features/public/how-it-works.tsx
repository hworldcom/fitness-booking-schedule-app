import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
  UserRound,
  UsersRound,
  Check,
  CalendarCheck2,
  Plus,
  Sparkles,
} from "lucide-react";

export function HowItWorksStory() {
  return (
    <div className="how-page">
      <section className="hero wrap" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">HOW IT WORKS</span>
          <h1 id="hero-title">
            Good coaching.
            <br />
            <span>More personal.</span>
          </h1>
          <p>
            One-to-one attention or the energy of a group. Find your coach,
            choose your session and take the next step towards your goals.
          </p>
          <span className="hero-note">
            A good fit starts with a little exploring.
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" aria-hidden="true"></div>
          <div className="art-orbit orbit-two" aria-hidden="true"></div>
          <span className="art-caption">
            <Sparkles className="icon" aria-hidden="true" />
            Your training. Your way.
          </span>
          <div className="illustration-card private-illustration">
            <div className="illustration-card-top">
              <span className="mini-icon purple">
                <UserRound className="icon" aria-hidden="true" />
              </span>
              <span className="format-tag">ONE-TO-ONE</span>
              <span className="illustration-number" aria-hidden="true">
                01
              </span>
            </div>
            <div className="connection-visual" aria-hidden="true">
              <span className="person-dot coach-dot">
                <UserRound className="icon" aria-hidden="true" />
              </span>
              <span className="connection-line"></span>
              <span className="person-dot athlete-dot">
                <UserRound className="icon" aria-hidden="true" />
              </span>
            </div>
            <strong>
              A session built
              <br />
              around you.
            </strong>
            <p>You + your coach</p>
          </div>
          <div className="illustration-card group-illustration">
            <div className="illustration-card-top">
              <span className="mini-icon green">
                <UsersRound className="icon" aria-hidden="true" />
              </span>
              <span className="format-tag">GROUP TRAINING</span>
              <span className="illustration-number" aria-hidden="true">
                02
              </span>
            </div>
            <div className="group-visual" aria-hidden="true">
              <span></span>
              <span></span>
              <span className="group-leader">
                <UserRound className="icon" aria-hidden="true" />
              </span>
              <span></span>
              <span></span>
            </div>
            <strong>
              Shared energy.
              <br />
              Personal progress.
            </strong>
            <p>Your coach + your group</p>
          </div>
          <span className="art-footnote">Two ways to move forward.</span>
        </div>
      </section>
      <nav className="section-nav" aria-label="On this page">
        <div className="wrap section-nav-inner">
          <span className="section-nav-label">FIND YOUR PATH</span>
          <div>
            <a href="#athletes">For athletes</a>
            <a href="#coaches">For coaches</a>
            <a href="#questions">Common questions</a>
          </div>
          <ArrowDown className="icon section-nav-arrow" aria-hidden="true" />
        </div>
      </nav>
      <section
        className="athletes-section wrap section-space"
        id="athletes"
        tabIndex={-1}
        aria-labelledby="athletes-title"
      >
        <div className="section-intro">
          <span className="eyebrow">FOR ATHLETES</span>
          <h2 id="athletes-title">
            Your goals.
            <br className="mobile-break" /> Your kind of training.
          </h2>
          <p>
            Choose focused time with a coach or find a group that feels right
            for you.
          </p>
        </div>
        <div className="training-grid">
          <article className="training-card private-card">
            <div className="training-card-top">
              <span className="format-icon purple">
                <UserRound className="icon" aria-hidden="true" />
              </span>
              <span className="soft-label">ONE-TO-ONE</span>
            </div>
            <span className="eyebrow card-eyebrow">PRIVATE TRAINING</span>
            <h3>Your time. Your coach.</h3>
            <p>
              A session focused on you, with space to work on your technique,
              build confidence and move towards your own goals.
            </p>
            <ul className="benefits">
              <li>
                <Check className="icon" aria-hidden="true" />
                Your coach’s undivided attention
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                Guidance for your level and goals
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                Choose from the coach’s available times
              </li>
            </ul>
            <Link className="text-action" href="/explore">
              Find a coach
              <ArrowRight className="icon" aria-hidden="true" />
            </Link>
          </article>
          <article className="training-card group-card">
            <div className="training-card-top">
              <span className="format-icon green">
                <UsersRound className="icon" aria-hidden="true" />
              </span>
              <span className="soft-label green-label">BETTER TOGETHER</span>
            </div>
            <span className="eyebrow card-eyebrow">GROUP TRAINING</span>
            <h3>Find your kind of group.</h3>
            <p>
              Enjoy the motivation of training together. Prefer a more personal
              class? Look for a smaller group with more room for individual
              guidance.
            </p>
            <ul className="benefits">
              <li>
                <Check className="icon" aria-hidden="true" />
                Learn and make progress together
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                Find smaller classes for closer coaching
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                Check class size and minimum participants
              </li>
            </ul>
            <Link className="text-action" href="/events">
              Explore group classes
              <ArrowRight className="icon" aria-hidden="true" />
            </Link>
          </article>
        </div>
        <div className="journey-heading">
          <h3>From “I’d like to” to “let’s go.”</h3>
          <span>Three simple steps</span>
        </div>
        <ol className="steps athlete-steps">
          <li>
            <span className="step-number">01</span>
            <div>
              <h4>Find your fit</h4>
              <p>
                Explore coaches and classes by what you want to train and where
                you want to go.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">02</span>
            <div>
              <h4>Choose your session</h4>
              <p>
                Request an available private session or reserve a place in a
                group class.
              </p>
            </div>
          </li>
          <li>
            <span className="step-number">03</span>
            <div>
              <h4>Check your confirmation</h4>
              <p>
                Your private request needs coach acceptance. For groups, check
                whether the coach has confirmed the session.
              </p>
            </div>
          </li>
        </ol>
        <div className="helpful-note">
          <CalendarCheck2 className="icon" aria-hidden="true" />
          <p>
            <strong>Help your group get going.</strong> Group classes need a
            minimum number of approved participants before the coach can
            confirm. Invite a friend and check the latest status before heading
            out.
          </p>
        </div>
      </section>
      <section
        className="coach-section wrap"
        id="coaches"
        tabIndex={-1}
        aria-labelledby="coaches-title"
      >
        <div className="coach-panel">
          <div className="coach-panel-heading">
            <div className="section-intro">
              <span className="eyebrow">FOR COACHES</span>
              <h2 id="coaches-title">
                Bring your coaching.
                <br />
                We’ll help with the planning.
              </h2>
              <p>
                Make room for private sessions and group training, with your
                availability and bookings in one place.
              </p>
            </div>
            <span className="coach-heading-icon" aria-hidden="true">
              <CalendarCheck2 className="icon" aria-hidden="true" />
            </span>
          </div>
          <div className="coach-formats">
            <article>
              <span className="mini-icon purple">
                <UserRound className="icon" aria-hidden="true" />
              </span>
              <div>
                <h3>Coach one-to-one</h3>
                <p>
                  Offer private sessions, publish your available times and
                  choose which requests to confirm.
                </p>
              </div>
            </article>
            <article>
              <span className="mini-icon purple">
                <UsersRound className="icon" aria-hidden="true" />
              </span>
              <div>
                <h3>Bring a group together</h3>
                <p>
                  Create a class, set its minimum and maximum group size and
                  invite athletes to join. Offer a smaller group when you want
                  to keep the coaching close.
                </p>
              </div>
            </article>
          </div>
          <ol className="steps coach-steps">
            <li>
              <span className="step-number">01</span>
              <div>
                <h3>Introduce yourself</h3>
                <p>
                  Create your coach profile and complete the approval process
                  before publishing.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">02</span>
              <div>
                <h3>Set up your training</h3>
                <p>
                  Add your locations, private availability and group classes.
                  You choose the times and group sizes.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number">03</span>
              <div>
                <h3>Keep it all moving</h3>
                <p>
                  Review private requests, confirm group sessions and manage
                  your upcoming training.
                </p>
              </div>
            </li>
          </ol>
          <div className="coach-panel-footer">
            <Link
              className="button primary"
              href="/sign-in?intent=coach&returnTo=%2Fprofile%2Fcoach"
            >
              Become a coach
              <ArrowRight className="icon" aria-hidden="true" />
            </Link>
            <span>More time for what you love: coaching.</span>
          </div>
        </div>
      </section>
      <section
        className="faq-section wrap section-space"
        id="questions"
        tabIndex={-1}
        aria-labelledby="questions-title"
      >
        <div className="section-intro">
          <span className="eyebrow">A LITTLE MORE CLARITY</span>
          <h2 id="questions-title">
            Good questions.
            <br />
            Simple answers.
          </h2>
          <p>A few things to know before your next session.</p>
        </div>
        <div className="faq-list">
          <details>
            <summary>
              Do I need an account to explore?
              <Plus className="icon" aria-hidden="true" />
            </summary>
            <p>
              You can browse coaches and group classes without an account. Sign
              in when you’re ready to request a private session or reserve a
              group place.
            </p>
          </details>
          <details>
            <summary>
              When is my session confirmed?
              <Plus className="icon" aria-hidden="true" />
            </summary>
            <p>
              A private session is confirmed when the coach accepts your
              request. Joining a group holds your seat while the coach reviews
              your participation. The class needs its minimum number of approved
              participants before the coach separately confirms it. Reaching the
              minimum does not confirm the class automatically. If the coach has
              not confirmed by the decision deadline, the class becomes Not
              confirmed. Check the session’s current status in MovX.
            </p>
          </details>
          <details>
            <summary>
              How small are the group classes?
              <Plus className="icon" aria-hidden="true" />
            </summary>
            <p>
              Class sizes vary. If you’re looking for more individual attention,
              choose a smaller class and check its maximum group size before
              joining.
            </p>
          </details>
          <details>
            <summary>
              How do payments work?
              <Plus className="icon" aria-hidden="true" />
            </summary>
            <p>
              MovX does not collect payments. Group classes show whether they’re
              free or paid at the session. For paid group classes, the coach
              collects payment at the venue.
            </p>
          </details>
          <details>
            <summary>
              What if my plans change?
              <Plus className="icon" aria-hidden="true" />
            </summary>
            <p>
              You can withdraw a pending private request or cancel a confirmed
              private session before it starts. You can also leave a group
              before its start time. Check your sessions in MovX for the latest
              status, including any coach cancellation.
            </p>
          </details>
        </div>
      </section>
      <section className="final-cta wrap" aria-labelledby="cta-title">
        <span className="eyebrow">YOUR NEXT STEP</span>
        <h2 id="cta-title">
          Find your coach.
          <br />
          Find your rhythm.
        </h2>
        <p>Start with a little exploring. See what feels right.</p>
        <div className="final-actions">
          <Link className="button primary" href="/explore">
            Explore coaches
            <ArrowRight className="icon" aria-hidden="true" />
          </Link>
          <Link className="button secondary" href="/events">
            Find a group class
          </Link>
        </div>
      </section>
    </div>
  );
}
