import Link from "next/link";
import {
  ProfileEditRegion,
  type ProfileEditField,
} from "./profile-edit-region";
import type { ReactNode } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui";
import { profileInitials } from "@/auth/profile-presentation";
import type { PublicCoachProfileState } from "@/domain/coaches";
import { EMPTY_COACH_WEBSITE_CONTENT } from "@/domain/coach-website";
import type { ReviewPageResult } from "@/domain/coach-reviews";
import type { SessionCatalog } from "@/domain/typed-sessions";
import type { CoachMediaResult, PublicCoachMedia } from "@/domain/coach-media";
import { PublicCoachMediaSection } from "./coach-media-gallery";
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
} from "@/coaches/public-website";

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
  onEdit,
  mediaContent,
  ownerPreview = false,
  sectionControls,
  media = { status: "ready", media: { photos: [], video: null } },
}: {
  state: State;
  onEdit?: (field: ProfileEditField) => void;
  mediaContent?: ReactNode;
  ownerPreview?: boolean;
  sectionControls?: Partial<
    Record<"services" | "locations" | "groups", ReactNode>
  >;
  marketplace: ReactNode;
  catalog?: SessionCatalog | null;
  groups?: CoachPublicGroups;
  reviews?: ReviewPageResult;
  origin?: string | null;
  ownProfile?: boolean;
  media?: CoachMediaResult<PublicCoachMedia>;
}) {
  const { coach, website } = state;
  const region = (
    field: ProfileEditField,
    label: string,
    children: ReactNode,
  ) =>
    onEdit ? (
      <ProfileEditRegion field={field} label={label} onEdit={onEdit}>
        {children}
      </ProfileEditRegion>
    ) : (
      children
    );
  const placeholder = (label: string) => (
    <p className="profile-edit-placeholder">{label}</p>
  );
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
    ["about", "About me"],
    ["services", "Sessions"],
    ...(locations.length ? [["locations", "Locations"]] : []),
    ["groups", "Group sessions"],
    ["reviews", "Reviews"],
    ...(ownerPreview ? [["private-schedule", "Schedule"]] : []),
    ...(content.faqs.length || onEdit ? [["questions", "FAQs"]] : []),
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
        {region(
          "banner",
          "banner image",
          <PublicWebsiteBanner
            url={website?.banner?.hero.url ?? null}
            name={coach.displayName}
          />,
        )}
        <header className="coach-website-identity">
          {region(
            "portrait",
            "coach picture",
            <Avatar
              initials={profileInitials(coach.displayName)}
              imageUrl={coach.portraitUrl}
              alt={
                coach.portraitUrl ? `${coach.displayName}'s coach portrait` : ""
              }
            />,
          )}
          <div className="coach-website-name">
            {(content.brandLabel || onEdit) &&
              region(
                "brandLabel",
                "brand label",
                <p className="eyebrow">
                  {content.brandLabel || "Add your brand label"}
                </p>,
              )}
            {region(
              "displayName",
              "display name",
              <h1>{coach.displayName}</h1>,
            )}
            <p className="coach-website-trust">
              {coach.trustKind === "verified"
                ? "Verified coach — MovX reviewed this coach's identity and application."
                : "Demo coach — this fictional profile is not a verified professional."}
            </p>
            {region(
              "disciplines",
              "disciplines",
              <div className="coach-website-tags">
                {coach.disciplines.map((discipline) => (
                  <span key={discipline}>{discipline}</span>
                ))}
              </div>,
            )}
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
              {region(
                "introduction",
                "introduction",
                <p className="coach-website-intro">
                  {content.introduction ||
                    (onEdit ? "Add a short introduction" : coach.bio)}
                </p>,
              )}
              {(content.introduction || onEdit) &&
                coach.bio &&
                region("bio", "biography", <p>{coach.bio}</p>)}
              {(!!content.focusLabels.length || onEdit) &&
                region(
                  "focusLabels",
                  "coaching focus",
                  <div
                    className="coach-website-tags"
                    aria-label="Coaching focus"
                  >
                    {content.focusLabels.map((label, index) => (
                      <span key={index}>{label}</span>
                    ))}
                    {!content.focusLabels.length &&
                      placeholder("Add coaching focus and levels")}
                  </div>,
                )}
              <p className="coach-website-note">
                {coach.trustKind === "verified"
                  ? "MovX verification covers identity and application review only. It does not guarantee licensing, competence, safety or presence at this place."
                  : "This fictional profile uses a public discovery point—not live tracking, current presence or a gym endorsement."}
              </p>
              {region(
                "media",
                "training photos and video",
                mediaContent !== undefined ? (
                  mediaContent
                ) : (
                  <PublicCoachMediaSection
                    key={coach.slug}
                    slug={coach.slug}
                    initial={media}
                  />
                ),
              )}
              {(content.approach || content.experience || onEdit) && (
                <div className="coach-about-details">
                  {(content.approach || onEdit) &&
                    region(
                      "approach",
                      "approach",
                      <div id="approach" tabIndex={-1}>
                        <h3>My approach</h3>
                        <p>
                          {content.approach || "Add your coaching approach"}
                        </p>
                      </div>,
                    )}
                  {(content.experience || onEdit) &&
                    region(
                      "experience",
                      "experience and qualifications",
                      <div id="experience" tabIndex={-1}>
                        <h3>Experience &amp; qualifications</h3>
                        <p>
                          {content.experience ||
                            "Add experience and qualifications"}
                        </p>
                        <p className="coach-website-note">
                          Coach-provided information.
                        </p>
                      </div>,
                    )}
                </div>
              )}
            </section>
            <section
              id="services"
              tabIndex={-1}
              className="coach-website-section"
            >
              <span className="eyebrow">WAYS TO TRAIN</span>
              <h2>Sessions with me</h2>
              {sectionControls?.services}
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
            {!!locations.length && (
              <div
                id="locations"
                tabIndex={-1}
                className="coach-website-section"
              >
                {sectionControls?.locations}
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
              {sectionControls?.groups}
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
            {(!!content.faqs.length || onEdit) &&
              region(
                "faqs",
                "frequently asked questions",
                <section
                  id="questions"
                  tabIndex={-1}
                  className="coach-website-section"
                >
                  <h2>Good to know</h2>
                  {!content.faqs.length &&
                    placeholder("Add answers to common questions")}
                  {content.faqs.map((faq, index) => (
                    <details key={index}>
                      <summary>{faq.question}</summary>
                      <p>{faq.answer}</p>
                    </details>
                  ))}
                </section>,
              )}
            {(!!content.links.length || onEdit) &&
              region(
                "links",
                "external links",
                <section className="coach-website-section">
                  <h2>Find out more</h2>
                  {!content.links.length &&
                    placeholder("Add your website or social links")}
                  <div className="coach-website-external-links">
                    {content.links.map((link, index) => (
                      <a
                        key={index}
                        href={
                          /^https:\/\//i.test(link.url) ? link.url : undefined
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                </section>,
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
            {region(
              "rate",
              "starting rate",
              website?.startingRate ? (
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
                <p>
                  {onEdit
                    ? "Add or edit your starting rate"
                    : "Get in touch to discuss your training."}
                </p>
              ),
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
            {!ownerPreview && (
              <PublicWebsiteShare
                url={identity.url}
                path={identity.path}
                title={identity.title}
                description={identity.description}
              />
            )}
          </aside>
        </div>
        <div className="coach-website-booking">{marketplace}</div>
      </article>
    </PublicReviewsProvider>
  );
}
