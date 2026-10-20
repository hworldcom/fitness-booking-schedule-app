import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui";
import { profileInitials } from "@/auth/profile-presentation";
import type { PublicCoachProfileState } from "@/domain/coaches";
import { EMPTY_COACH_WEBSITE_CONTENT } from "@/domain/coach-website";
import type { ReviewPageResult } from "@/domain/coach-reviews";
import type { SessionCatalog } from "@/domain/typed-sessions";
import { CoachProfileLocations } from "../coach-profile-locations";
import {
  PublicWebsiteBanner,
  PublicWebsiteShare,
} from "./public-website-controls";
import {
  PublicCoachReviews,
  PublicReviewsProvider,
  PublicReviewRating,
} from "./public-coach-reviews";
import {
  publicWebsiteIdentity,
  type CoachPublicGroups,
} from "./public-website-model";

type State = Omit<
  Extract<PublicCoachProfileState, { status: "ready" }>,
  "databaseTime"
>;
export function PublicCoachWebsite({
  state,
  marketplace,
  catalog = null,
  groups = { status: "unavailable" },
  reviews = { status: "unavailable" },
  origin = null,
  ownProfile = false,
}: {
  state: State;
  marketplace: ReactNode;
  catalog?: SessionCatalog | null;
  groups?: CoachPublicGroups;
  reviews?: ReviewPageResult;
  origin?: string | null;
  ownProfile?: boolean;
}) {
  const { coach, website } = state;
  const content = website?.content ?? EMPTY_COACH_WEBSITE_CONTENT;
  const locations = coach.locations.filter(
    (location) => location.status === "active",
  );
  const primary = locations.find((location) => location.isPrimary);
  const identity = publicWebsiteIdentity(coach, website, origin);
  const types = catalog?.enabled
    ? catalog.types.filter((type) => type.bookable && !type.archived)
    : [];
  const sections = [
    ["about", "About"],
    ["services", "Sessions"],
    ...(content.approach ? [["approach", "Approach"]] : []),
    ...(content.experience ? [["experience", "Experience"]] : []),
    ...(locations.length ? [["locations", "Locations"]] : []),
    ["groups", "Group sessions"],
    ["reviews", "Reviews"],
    ...(content.faqs.length ? [["questions", "FAQs"]] : []),
  ];
  return (
    <PublicReviewsProvider
      key={coach.slug}
      initial={reviews.status === "ready" ? reviews.summary : null}
    >
      <article className="coach-personal-website">
        <div className="coach-website-topline">
          <Link href="/explore">
            <ArrowLeft size={16} aria-hidden="true" /> Back to coaches
          </Link>
          <span>
            {coach.trustKind === "demo"
              ? "DEMO COACH WEBSITE"
              : "MOVX CLUB COACH"}
          </span>
        </div>
        <PublicWebsiteBanner
          url={website?.banner?.hero.url ?? null}
          name={coach.displayName}
        />
        <header className="coach-website-identity">
          <Avatar
            initials={profileInitials(coach.displayName)}
            imageUrl={coach.portraitUrl}
            alt={
              coach.portraitUrl ? `${coach.displayName}'s coach portrait` : ""
            }
          />
          <div className="coach-website-name">
            {content.brandLabel && (
              <p className="eyebrow">{content.brandLabel}</p>
            )}
            <h1>{coach.displayName}</h1>
            <p className="coach-website-trust">
              {coach.trustKind === "verified"
                ? "Verified coach — MovX reviewed this coach's identity and application."
                : "Demo coach — this fictional profile is not a verified professional."}
            </p>
            <div className="coach-website-tags">
              {coach.disciplines.map((discipline) => (
                <span key={discipline}>{discipline}</span>
              ))}
            </div>
            <div className="coach-website-facts">
              <a href="#locations">
                <MapPin size={16} aria-hidden="true" />
                {primary?.publicName ??
                  coach.gymName ??
                  "Independent training place"}{" "}
                · {primary?.location.label ?? coach.location.label}
              </a>
              <PublicReviewRating />
            </div>
          </div>
        </header>
        <nav
          className="coach-website-navigation"
          aria-label="Coach website sections"
        >
          {sections.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </nav>
        <div className="coach-website-layout">
          <div className="coach-website-main">
            <section id="about" tabIndex={-1} className="coach-website-section">
              <span className="eyebrow">MEET YOUR COACH</span>
              <h2>Training with {coach.displayName}</h2>
              <p className="coach-website-intro">
                {content.introduction || coach.bio}
              </p>
              {content.introduction && coach.bio && <p>{coach.bio}</p>}
              {!!content.focusLabels.length && (
                <div className="coach-website-tags" aria-label="Coaching focus">
                  {content.focusLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              )}
              <p className="coach-website-note">
                {coach.trustKind === "verified"
                  ? "MovX verification covers identity and application review only. It does not guarantee licensing, competence, safety or presence at this place."
                  : "This fictional profile uses a public discovery point—not live tracking, current presence or a gym endorsement."}
              </p>
            </section>
            <section
              id="services"
              tabIndex={-1}
              className="coach-website-section"
            >
              <span className="eyebrow">WAYS TO TRAIN</span>
              <h2>Sessions with me</h2>
              {types.length ? (
                <div className="coach-website-services">
                  {types.map((type) => (
                    <div key={type.id}>
                      <span className="eyebrow">
                        {type.format === "private"
                          ? "PRIVATE SESSION"
                          : "GROUP SESSION TYPE"}{" "}
                        · {type.durationMinutes} MIN
                      </span>
                      <h3>{type.name}</h3>
                      {type.description && <p>{type.description}</p>}
                      <a
                        href={
                          type.format === "private"
                            ? "#private-schedule"
                            : "#groups"
                        }
                      >
                        {type.format === "private"
                          ? "View available times"
                          : "View published groups"}{" "}
                        ↗
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p>
                  {catalog?.enabled
                    ? "No publicly bookable session types right now. Check the schedule and published groups below."
                    : catalog
                      ? "Check private availability and published groups below for this coach’s current sessions."
                      : "Session types are unavailable. You can retry the schedule below."}
                </p>
              )}
            </section>
            {content.approach && (
              <section
                id="approach"
                tabIndex={-1}
                className="coach-website-section"
              >
                <span className="eyebrow">HOW WE WORK</span>
                <h2>My approach</h2>
                <p>{content.approach}</p>
              </section>
            )}
            {content.experience && (
              <section
                id="experience"
                tabIndex={-1}
                className="coach-website-section"
              >
                <h2>Experience &amp; qualifications</h2>
                <p>{content.experience}</p>
                <p className="coach-website-note">
                  Coach-provided information.
                </p>
              </section>
            )}
            {!!locations.length && (
              <div
                id="locations"
                tabIndex={-1}
                className="coach-website-section"
              >
                <CoachProfileLocations
                  coachName={coach.displayName}
                  locations={locations}
                />
              </div>
            )}
            <section
              id="groups"
              tabIndex={-1}
              className="coach-website-section"
            >
              <span className="eyebrow">TRAIN TOGETHER</span>
              <h2>Upcoming group sessions</h2>
              {groups.status === "unavailable" ? (
                <>
                  <p role="status">
                    We couldn’t load this coach’s group sessions.
                  </p>
                  <a href={`${identity.path}#groups`}>Retry group sessions</a>
                </>
              ) : groups.sessions.length ? (
                <div className="coach-website-groups">
                  {groups.sessions.map((session) => (
                    <article key={session.id}>
                      <span className="eyebrow">
                        {session.discipline} · {session.intendedLevel}
                      </span>
                      <h3>
                        <Link href={`/events/${session.slug}`}>
                          {session.title}
                        </Link>
                      </h3>
                      <p>
                        <time dateTime={session.startsAt}>
                          {new Intl.DateTimeFormat("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Europe/Berlin",
                          }).format(new Date(session.startsAt))}
                        </time>{" "}
                        · Berlin time
                      </p>
                      <p>
                        {session.venue.name} · {session.venue.label}
                      </p>
                      <p>
                        {Math.round(
                          (Date.parse(session.endsAt) -
                            Date.parse(session.startsAt)) /
                            60000,
                        )}{" "}
                        min ·{" "}
                        {session.priceCents === 0
                          ? "Free"
                          : new Intl.NumberFormat("en-GB", {
                              style: "currency",
                              currency: session.currency,
                            }).format(session.priceCents / 100) + " per person"}
                      </p>
                      <Link href={`/events/${session.slug}`}>
                        View group session ↗
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No upcoming public group sessions right now.</p>
              )}
              <Link className="coach-website-browse-events" href="/events">
                Browse all MovX events ↗
              </Link>
            </section>
            <PublicCoachReviews
              key={coach.slug}
              slug={coach.slug}
              initial={reviews}
            />
            {!!content.faqs.length && (
              <section
                id="questions"
                tabIndex={-1}
                className="coach-website-section"
              >
                <h2>Good to know</h2>
                {content.faqs.map((faq, index) => (
                  <details key={index}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </section>
            )}
            {!!content.links.length && (
              <section className="coach-website-section">
                <h2>Find out more</h2>
                <div className="coach-website-external-links">
                  {content.links.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label} ↗
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
          <aside
            className="coach-website-contact"
            aria-label="Training and contact"
          >
            <span className="eyebrow">LET’S GET STARTED</span>
            <h2>
              Your next step <br />
              starts here.
            </h2>
            {website?.startingRate ? (
              <>
                <strong className="coach-website-rate">
                  {website.startingRate.label}
                </strong>
                <p className="coach-website-note">
                  Indicative starting rate. Individual sessions and groups may
                  differ.
                </p>
              </>
            ) : (
              <p>Get in touch to discuss your training.</p>
            )}
            <a className="coach-website-primary" href="#private-schedule">
              View available times <span aria-hidden="true">↗</span>
            </a>
            {!ownProfile && (
              <Link
                className="coach-website-secondary"
                href={`/messages?coach=${coach.profileId}`}
              >
                Message coach
              </Link>
            )}
            {ownProfile && (
              <p className="coach-website-note">
                This is your public profile. You can’t book or message yourself.
              </p>
            )}
            <p className="coach-website-note">
              Choose a session and venue before sending a request.
            </p>
            <PublicWebsiteShare
              url={identity.url}
              path={identity.path}
              title={identity.title}
              description={identity.description}
            />
          </aside>
        </div>
        <div className="coach-website-booking">{marketplace}</div>
      </article>
    </PublicReviewsProvider>
  );
}
