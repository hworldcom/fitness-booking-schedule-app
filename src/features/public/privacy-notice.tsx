import Link from "next/link";

const sections = [
  {
    id: "contact",
    title: "Who is responsible and how to reach us",
    content: (
      <>
        <p>
          MovX Club is a project for finding coaches, arranging training and
          keeping a personal training calendar. The person responsible for
          processing personal information through MovX Club (the data
          controller) is:
        </p>
        <address className="privacy-controller">
          <strong>Hoang Luong</strong>
          <span>ul. Bitwy Warszawskiej 1920 roku 18/59</span>
          <span>02-366 Warsaw, Poland</span>
          <a href="mailto:hello@movx.club">hello@movx.club</a>
        </address>
        <p>
          For privacy questions or requests, email the address above with
          “Privacy request” in the subject line.
        </p>
      </>
    ),
  },
  {
    id: "information",
    title: "Information used by the service",
    content: (
      <>
        <p>The information involved depends on the features you use:</p>
        <ul>
          <li>
            <strong>Your account:</strong> email, account identifiers, sign-in
            methods, verification and session records. New profiles also ask for
            a username, private full name and display name. A personal photo and
            other supported profile details are optional.
          </li>
          <li>
            <strong>Coaching:</strong> applications, private contact details,
            review decisions, public profile content, services, prices,
            locations, photos and videos you choose to provide.
          </li>
          <li>
            <strong>Training and bookings:</strong> availability, requests,
            sessions, group registrations, cancellations, personal routines,
            attendance, activity logs and notification preferences.
          </li>
          <li>
            <strong>Communication:</strong> messages, shared session plans and
            notes, separate coach-private notes, video links and connection or
            invitation records.
          </li>
          <li>
            <strong>Technical information:</strong> requests to the website and
            its providers may include an IP address, browser/device details,
            request times and security or delivery diagnostics.
          </li>
        </ul>
        <p>
          Coaches can enter an external client’s name and optional email before
          that person creates an account. An invitation recipient must verify
          the matching email and explicitly accept before gaining access to the
          associated shared session history.
        </p>
      </>
    ),
  },
  {
    id: "google",
    title: "When you choose Google sign-in",
    content: (
      <>
        <p>
          Google sign-in is optional and available only in environments where it
          is enabled. Google and Supabase Auth establish your verified account
          identity. The sign-in request asks for basic identity permissions:
          your account identifier, email and profile information, which can
          include your name and picture.
        </p>
        <p>
          MovX uses that identity to sign you in and restore the appropriate
          account. Supported linking with the same verified email preserves the
          original account; different email addresses are not automatically
          merged. Google profile information does not automatically replace your
          MovX names or picture, approve a coach application or accept an
          invitation.
        </p>
        <p>
          This sign-in does not request access to Google Calendar, Gmail,
          contacts or Drive. Calendar synchronization would require a separate
          feature and explicit permission. Google account information is used
          for account access, not advertising.
        </p>
      </>
    ),
  },
  {
    id: "purposes",
    title: "Purposes and legal bases",
    content: (
      <>
        <p>
          Account and training information supports the services you request:
          signing in, maintaining a profile, arranging sessions, communicating
          with participants and keeping your training records. Security and
          operational records support access control, abuse prevention,
          troubleshooting and reliable delivery. Staff use coach application
          information to review applications; a Google profile grants no coach
          approval.
        </p>
        <p>
          Optional choices include publishing coach content, uploading media,
          connecting with another participant and enabling personal training
          reminders. Required fields are identified in the relevant form.
          Without the necessary account or booking information, MovX cannot
          provide that feature.
        </p>
        <ul>
          <li>
            <strong>Providing the service you request:</strong> account access,
            profiles, bookings, messages and training records are processed to
            perform our agreement with you or take steps at your request before
            entering an agreement (GDPR Article 6(1)(b)).
          </li>
          <li>
            <strong>Operating and protecting MovX:</strong> security checks,
            abuse prevention, troubleshooting, coach application review and
            organizing coach-supplied external-client records rely on our
            legitimate interests in running a safe, reliable coaching service
            (Article 6(1)(f)). We consider the effect on the people concerned
            and limit the information used. You may object as explained below.
          </li>
          <li>
            <strong>Meeting legal duties:</strong> where a legal obligation
            requires us to handle a privacy request, preserve a particular
            record or make a disclosure, we rely on Article 6(1)(c).
          </li>
        </ul>
        <p>
          Optional features remain your choice. You can stop optional reminders
          in settings and choose whether to publish coach content. We do not
          sell personal information or use Google account data for advertising.
          Coach application decisions are reviewed by a person; MovX does not
          make solely automated decisions producing legal or similarly
          significant effects about you.
        </p>
        <p>
          MovX is for general fitness scheduling and activity records, not
          medical care or medical record storage. Do not enter diagnoses,
          medications, injury records or other sensitive health information in
          profiles, messages, notes or uploads. Free text can reveal sensitive
          information even when a form does not ask for it. If such information
          is added accidentally, remove it where controls are available and
          contact us for help. Entering it is not an explicit-consent process.
        </p>
      </>
    ),
  },
  {
    id: "visibility",
    title: "Who can see your information",
    content: (
      <>
        <p>
          Published coach pages, services, locations, portraits and selected
          media are public. Your private full name, account contact details and
          private training logs are not part of a public coach profile. Other
          signed-in members can view basic member identity, such as a chosen
          display name and current photo, where the service’s access rules
          permit.
        </p>
        <p>
          Booking participants can access their own session information.
          Messages and shared notes are available to the authorized
          participants. Coach-private notes are separate from shared notes;
          personal workout notes remain private to their owner. Group
          participation and connection features disclose only the participant
          information those features permit.
        </p>
        <p>
          Authorized staff and infrastructure providers may process data to
          operate, secure or support the service. Messages are stored on the
          server and are not end-to-end encrypted. A coach may also process
          client information independently; contact that coach about their
          separate records and practices.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Service providers and external content",
    content: (
      <>
        <dl className="privacy-providers">
          <div>
            <dt>Website hosting and account storage</dt>
            <dd>
              Vercel hosts the website and Supabase provides authentication,
              database and image storage. Our application functions and primary
              Supabase project are configured in Frankfurt, Germany. Providers
              can also process technical request, support and security data.
            </dd>
          </div>
          <div>
            <dt>Email delivery</dt>
            <dd>
              Porkbun handles account email and the project contact inbox;
              Resend delivers service notifications. They process recipient
              addresses, message content and delivery information. Emailing a
              privacy request also sends the information you include to the
              contact inbox. Please send only what is necessary.
            </dd>
          </div>
          <div>
            <dt>Maps and place search</dt>
            <dd>
              Maps request resources from OpenFreeMap. Place search sends search
              text and lookup parameters to Geoapify when used. These providers
              receive technical request information such as an IP address.
              Manual location entry remains available. See the{" "}
              <a href="https://openfreemap.org/privacy/">
                OpenFreeMap privacy policy
              </a>{" "}
              and{" "}
              <a href="https://www.geoapify.com/privacy-policy/">
                Geoapify privacy policy
              </a>
              .
            </dd>
          </div>
          <div>
            <dt>Google, video and external links</dt>
            <dd>
              Where Google sign-in is enabled, Google handles the sign-in you
              choose under its own{" "}
              <a href="https://policies.google.com/privacy">privacy policy</a>.
              Where coach video uploads and playback are enabled, Mux processes
              the uploaded videos and technical playback information, such as an
              IP address, device details and video identifiers. See the{" "}
              <a href="https://www.mux.com/privacy">Mux privacy policy</a> and{" "}
              <a href="https://www.mux.com/dpa">data processing terms</a>.
              Opening external training, video or social links takes you to
              services with their own privacy practices.
            </dd>
          </div>
        </dl>
        <p>
          Some providers are based in, or use support and infrastructure in,
          countries outside the European Economic Area, including the United
          States and Singapore. A Frankfurt database does not mean all
          processing stays in the EEA. For transfers requiring safeguards, the
          providers’ processing terms include European Commission standard
          contractual clauses; an applicable adequacy decision may also cover a
          transfer. These arrangements include access and security obligations.
        </p>
        <p>
          You can review the processing and transfer terms for{" "}
          <a href="https://vercel.com/legal/dpa">Vercel</a>,{" "}
          <a href="https://supabase.com/legal/customer-resources/data-processing-addendum">
            Supabase
          </a>
          , <a href="https://resend.com/legal/dpa">Resend</a> and{" "}
          <a href="https://porkbun.com/legal/agreement/data_processing_addendum">
            Porkbun
          </a>
          . Contact us for information about the safeguards relevant to your
          data or a copy, subject to necessary redactions.
        </p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Cookies and browser storage",
    content: (
      <>
        <p>
          MovX uses authentication cookies and short-lived sign-in, recovery and
          invitation state to maintain access and return you to the right page.
          The Google sign-in continuation lasts up to ten minutes; the email
          confirmation/recovery flow lasts up to one hour. These are different
          from the application’s ordinary session, which has a maximum
          thirty-day grant.
        </p>
        <p>
          Browser session storage remembers the selected athlete or coach
          workspace for the account and dataset. It does not grant access to
          private data. Blocking necessary storage may prevent sign-in or affect
          navigation. The current application does not install an
          advertising-tracker integration; embedded and infrastructure providers
          may process their own technical request information.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long information is kept",
    content: (
      <>
        <p>
          Cancelling a booking, disconnecting from a coach or ending a routine
          does not automatically erase existing session, conversation or
          training history. Some history and retry/security records remain
          necessary to preserve the outcome of previous actions and the other
          participants’ access. Session expiry is not an account-data deletion
          schedule.
        </p>
        <p>
          There is currently no general automatic expiry for stored messages and
          no self-service account-deletion flow. Email{" "}
          <a href="mailto:hello@movx.club?subject=Privacy%20request">
            hello@movx.club
          </a>{" "}
          to request deletion or ask about a particular record. A request may
          require checking your identity and the rights or obligations
          associated with shared records.
        </p>
        <ul>
          <li>
            <strong>Account, profile and training content:</strong> kept while
            you maintain an account and use the service or need your saved
            history. You can clear supported fields and request account or
            content deletion by email. There is no automatic deletion merely
            because you stop signing in.
          </li>
          <li>
            <strong>Shared sessions, messages and operational records:</strong>{" "}
            retained while needed to provide the participants’ history, resolve
            a failed or repeated action, investigate an incident or handle a
            specific legal obligation or dispute. A deletion request is assessed
            record by record; we explain any information that must remain and
            restrict it to that purpose.
          </li>
          <li>
            <strong>Privacy correspondence:</strong> kept to resolve the request
            and, where needed, demonstrate how it was handled or deal with a
            related complaint. We limit the retained evidence to what is
            necessary.
          </li>
          <li>
            <strong>Recovery copies and provider logs:</strong> restricted
            operator backups may be made for a release or incident. They are
            kept only while needed to recover from that event and are not used
            as an ordinary user directory. Infrastructure logs and any
            provider-managed copies follow the relevant service’s retention
            controls and processing terms. MovX does not promise daily backups
            or a fixed backup window.
          </li>
        </ul>
        <p>
          When information is no longer needed for these purposes, we delete or
          irreversibly anonymize it. If a recovery copy cannot be changed
          individually, it remains restricted until removed or replaced. If we
          restore a copy, applicable deletion and restriction requests must be
          reapplied before the data returns to ordinary use. Contact us to ask
          which retention criterion applies to a particular record.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your choices and privacy requests",
    content: (
      <>
        <p>
          Use the available Profile and Account settings to review or change
          your details and photos. Coaches control publication of their public
          content. Supported connection, message-blocking and reminder settings
          control those respective features; removing a relationship does not
          erase independently shared session history.
        </p>
        <p>
          Depending on the applicable law and circumstances, you may request
          access, correction, deletion, restriction, portability or object to
          processing. Where processing relies on consent, you may withdraw it
          for the future. You may also complain to a competent data protection
          authority, including Poland’s{" "}
          <a href="https://uodo.gov.pl/en/p/for-citizens">
            Personal Data Protection Office (UODO)
          </a>
          . Contact{" "}
          <a href="mailto:hello@movx.club?subject=Privacy%20request">
            hello@movx.club
          </a>{" "}
          so the responsible operator can review your request and verify
          ownership before disclosing private information.
        </p>
        <p>
          Requests are handled manually. We respond without undue delay and
          normally within one month of receiving a request. If the law permits
          an extension because of complexity or the number of requests, we tell
          you within that first month and explain the reason; an extension can
          add up to two months. If we cannot take the action requested, we
          explain why and how to complain. We ask only for information
          reasonably needed to verify your identity and understand the request.
        </p>
      </>
    ),
  },
  {
    id: "young-people",
    title: "Young people aged 16 and over",
    content: (
      <>
        <p>
          MovX is intended for people aged 16 and older, including
          16–17-year-olds. It is not intended for children under 16. If you are
          under 16, please do not create an account.
        </p>
        <p>
          If you believe an account belongs to someone under 16, contact{" "}
          <a href="mailto:hello@movx.club?subject=Privacy%20request">
            hello@movx.club
          </a>{" "}
          so the responsible operator can review it.
        </p>
        <p>
          Current signup does not verify age. If we learn that an account may
          belong to someone under 16, we review the report, seek only the
          information needed to assess it and restrict access or arrange removal
          where appropriate. This notice does not provide a parental or guardian
          consent process.
        </p>
        <p>
          For 16–17-year-olds, the same private-profile and participant-only
          access rules apply. Use a display name you are comfortable sharing and
          avoid putting your home address, private contact details or sensitive
          information in public content. Publishing a coach profile makes its
          selected content visible to everyone. Contact us if you need help
          understanding this notice or removing information.
        </p>
      </>
    ),
  },
  {
    id: "updates",
    title: "Changes to this notice",
    content: (
      <>
        <p>
          We update this notice when our service or data practices change.
          Native app permissions and future integrations, including Google
          Calendar synchronization, require corresponding information before
          they are introduced. We will explain material changes here and use an
          in-product notice or email where appropriate.
        </p>
        <p>
          This version takes effect on 8 November 2026. It establishes the
          initial published notice, including optional Google sign-in,
          purpose-based retention, manual privacy requests and the intended
          audience of people aged 16 and older.
        </p>
      </>
    ),
  },
] as const;

export function PrivacyNotice() {
  return (
    <article className="privacy-page" aria-labelledby="privacy-title">
      <header className="privacy-header">
        <span className="eyebrow">YOUR INFORMATION</span>
        <h1 id="privacy-title" tabIndex={-1}>
          Privacy notice
        </h1>
        <p className="privacy-intro">
          How MovX handles account, coaching and training information, and the
          choices available to you.
        </p>
        <p className="privacy-date">
          Effective and last updated{" "}
          <time dateTime="2026-11-08">8 November 2026</time>
        </p>
      </header>

      <div className="privacy-layout">
        <nav className="privacy-contents" aria-label="On this page">
          <span>IN THIS NOTICE</span>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#privacy-${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="privacy-body">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={`privacy-${section.id}`}
              aria-labelledby={`privacy-${section.id}-title`}
              tabIndex={-1}
            >
              <span className="privacy-section-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 id={`privacy-${section.id}-title`}>{section.title}</h2>
              {section.content}
            </section>
          ))}
          <div className="privacy-end">
            <a href="#privacy-title">Back to top</a>
            <Link href="/">Return to MovX Club</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
