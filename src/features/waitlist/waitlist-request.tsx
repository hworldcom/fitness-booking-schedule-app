"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Mail, RotateCcw } from "lucide-react";

export function WaitlistRequest() {
  const [email, setEmail] = useState("");
  const [preparedEmail, setPreparedEmail] = useState<string | null>(null);
  const mailtoHref = useMemo(() => {
    if (!preparedEmail) return "mailto:hello@movx.club";
    const subject = "Join the MovX Club waitlist";
    const body = [
      "Hi MovX Club,",
      "",
      `Please add ${preparedEmail} to the MovX early-access waitlist.`,
      "",
      "I understand this is a scheduling preview using fictional coach profiles.",
    ].join("\n");
    return `mailto:hello@movx.club?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [preparedEmail]);

  function prepareRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPreparedEmail(email.trim().toLowerCase());
  }

  function resetRequest() {
    setPreparedEmail(null);
  }

  return (
    <div className="waitlist-card">
      <span className="waitlist-card-icon">
        <Mail size={20} aria-hidden="true" />
      </span>
      <span className="eyebrow">EARLY ACCESS WAITLIST</span>
      <h2>Save your place.</h2>
      {!preparedEmail ? (
        <form onSubmit={prepareRequest}>
          <label htmlFor="waitlist-email">Email address</label>
          <div className="waitlist-email-row">
            <input
              id="waitlist-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className="button lime" type="submit">
              Continue <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <div className="waitlist-prepared" role="status">
          <strong>One last step</strong>
          <p>
            Send the prepared message so we can add {preparedEmail} to the
            waitlist.
          </p>
          <div className="waitlist-actions">
            <a className="button lime" href={mailtoHref}>
              Open waitlist email <Mail size={16} aria-hidden="true" />
            </a>
            <button
              className="waitlist-reset"
              type="button"
              onClick={resetRequest}
            >
              <RotateCcw size={14} aria-hidden="true" /> Use another email
            </button>
          </div>
        </div>
      )}
      <p className="waitlist-privacy">
        This preview does not store your address. Your request reaches us only
        after you send the prepared email to hello@movx.club.
      </p>
    </div>
  );
}
