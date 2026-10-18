"use client";
/* eslint-disable @next/next/no-img-element -- owner banner reads require the signed-in cookie */
import { useState } from "react";
import { Avatar } from "@/components/ui";
import { profileInitials } from "@/auth/profile-presentation";
import type { CoachProjection } from "@/domain/coaches";
import type { CoachWebsiteContent } from "@/domain/coach-website";
import { publicCoachStartingRate } from "@/domain/coach-starting-rate";

export function CoachWebsitePreview({
  coach,
  content,
  bannerUrl,
  rate,
  publicationAllowed,
  unsaved,
  unverified = false,
}: {
  coach: CoachProjection;
  content: CoachWebsiteContent;
  bannerUrl: string | null;
  rate: { amountCents: number | null; showPublicly: boolean } | null;
  publicationAllowed: boolean;
  unsaved: boolean;
  unverified?: boolean;
}) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const locations = coach.locations.filter(
    (location) => location.status === "active",
  );
  const publicRate =
    rate?.showPublicly && rate.amountCents !== null
      ? publicCoachStartingRate(rate.amountCents)
      : null;
  const visible = publicationAllowed && coach.visibility === "visible";
  return (
    <article
      className="coach-website-preview"
      aria-label="Coach website preview"
    >
      <div className="website-preview-notice">
        <strong>
          {unsaved ? "Unsaved draft preview" : "Saved content preview"}
        </strong>
        <span>
          {visible
            ? "Visibility setting: Visible · Website layout preview."
            : "Private draft · Your profile is not public."}
        </span>
        <small>
          Saved content is shown as last loaded. Availability and messaging open
          from your public coach profile; this preview sends no requests.
        </small>
        {unverified && (
          <strong role="status">
            Some changes are unverified. This preview uses the last loaded saved
            version. Load the saved version in the editor to check it.
          </strong>
        )}
      </div>
      <div className="website-preview-banner">
        {bannerUrl && failedBanner !== bannerUrl ? (
          <img
            src={bannerUrl}
            alt="Your coach banner"
            width={1600}
            height={600}
            onError={() => setFailedBanner(bannerUrl)}
          />
        ) : (
          <span>
            {bannerUrl ? "Banner unavailable" : "Your coaching. Your approach."}
          </span>
        )}
      </div>
      <div className="website-preview-content">
        <header className="website-preview-identity">
          <Avatar
            initials={profileInitials(coach.displayName)}
            imageUrl={coach.portraitUrl}
            alt={`${coach.displayName} public coach portrait`}
          />
          {content.brandLabel && (
            <p className="eyebrow">{content.brandLabel}</p>
          )}
          <h2>{coach.displayName}</h2>
          <p>{content.introduction || coach.bio}</p>
          <div className="website-preview-tags">
            {coach.disciplines.map((value) => (
              <span key={value}>{value}</span>
            ))}
            {content.focusLabels.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </header>
        <aside
          className="website-preview-contact"
          aria-label="Contact card preview"
        >
          <span className="eyebrow">TRAIN TOGETHER</span>
          <h3>Make space for progress.</h3>
          {publicRate ? (
            <strong>{publicRate.label}</strong>
          ) : (
            <p>Contact the coach for pricing.</p>
          )}
          <p>Private session · 60 minutes</p>
          <button type="button" disabled className="website-preview-action">
            View availability
          </button>
          <button
            type="button"
            disabled
            className="website-preview-action secondary"
          >
            Message coach
          </button>
          <small>Preview only · No booking or message is sent.</small>
        </aside>
        <div className="website-preview-sections">
          <section>
            <h3>About your coach</h3>
            <p>{coach.bio}</p>
          </section>
          {content.approach && (
            <section>
              <h3>My approach</h3>
              <p>{content.approach}</p>
            </section>
          )}
          {content.experience && (
            <section>
              <h3>Experience &amp; qualifications</h3>
              <p>{content.experience}</p>
              <small>Coach-provided information.</small>
            </section>
          )}
          {!!locations.length && (
            <section>
              <h3>Where we train</h3>
              {locations.map((location) => (
                <div className="website-preview-location" key={location.id}>
                  <strong>{location.publicName}</strong>
                  <p>{location.location.label}</p>
                  {location.isPrimary && (
                    <small>Primary training location</small>
                  )}
                </div>
              ))}
            </section>
          )}
          {!!content.faqs.length && (
            <section>
              <h3>Good to know</h3>
              {content.faqs.map((faq, index) => (
                <details key={index}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </section>
          )}
          {!!content.links.length && (
            <section>
              <h3>Find out more</h3>
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
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
