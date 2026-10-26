"use client";

import { useState } from "react";
import type { CoachApplicationContact } from "@/domain/coach-application-contact";

export function CoachApplicationContactFields({
  contact,
  revision,
}: {
  contact: CoachApplicationContact | null;
  revision: number;
}) {
  // Controlled fields retain the applicant's draft when a server action fails.
  const [values, setValues] = useState({
    phoneNumber: contact?.phoneNumber ?? "",
    instagramUrl: contact?.instagramUrl ?? "",
    facebookUrl: contact?.facebookUrl ?? "",
    linkedinUrl: contact?.linkedinUrl ?? "",
  });
  return (
    <section
      className="coach-editor-panel"
      aria-labelledby="application-contact-heading"
    >
      <div className="coach-editor-section-title">
        <span>02</span>
        <div>
          <h2 id="application-contact-heading">Contact details for MovX</h2>
          <p id="application-contact-privacy">
            We use these details to review your application and contact you.
            They stay private and are included in the email to our review team.
            They do not appear on your public profile.
          </p>
        </div>
      </div>
      <input type="hidden" name="applicationContactRevision" value={revision} />
      <label className="coach-field">
        <span id="application-phone-label">Phone number</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          name="phoneNumber"
          value={values.phoneNumber}
          onChange={(event) =>
            setValues({ ...values, phoneNumber: event.target.value })
          }
          maxLength={40}
          required
          aria-labelledby="application-phone-label"
          aria-describedby="application-phone-help application-contact-privacy"
          placeholder="+49 151 23456789"
        />
        <small id="application-phone-help">
          Include your country code, for example +49.
        </small>
      </label>
      {(
        [
          ["instagramUrl", "Instagram", "https://www.instagram.com/yourname"],
          ["facebookUrl", "Facebook", "https://www.facebook.com/yourname"],
          ["linkedinUrl", "LinkedIn", "https://www.linkedin.com/in/yourname"],
        ] as const
      ).map(([name, label, placeholder]) => (
        <label className="coach-field" key={name}>
          <span>{label} (optional)</span>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            name={name}
            value={values[name]}
            onChange={(event) =>
              setValues({ ...values, [name]: event.target.value })
            }
            maxLength={500}
            placeholder={placeholder}
            aria-describedby="application-social-help application-contact-privacy"
          />
        </label>
      ))}
      <small id="application-social-help">
        Share full HTTPS profile links. You can leave all social links empty.
      </small>
    </section>
  );
}
