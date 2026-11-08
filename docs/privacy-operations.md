# Manual privacy requests

The public [privacy notice](../src/features/public/privacy-notice.tsx) identifies the responsible individual and monitored contact. [MOV-211](https://linear.app/movx/issue/MOV-211/create-a-public-privacy-notice-page-for-movx) records the owner-confirmed initial operating policy: general fitness only, intended age16+, no medical records, and manual requests handled through `hello@movx.club`. Automated account deletion remains [MOV-8](https://linear.app/movx/issue/MOV-8/dev0165-implement-the-account-deletion-lifecycle); its absence does not suspend privacy rights.

## Receive and verify

Record the request's receipt date, type, minimum necessary identity evidence, responsible handler and response deadline in a restricted operator record. Do not put message contents, medical details, credentials, private addresses or exported personal data into public tickets or repository files. Normally respond within one month of receipt, without undue delay. If a lawful complexity/volume extension applies, explain it within the first month; up to two additional months are possible. Record the reason rather than silently extending a deadline. See [European Commission rights guidance](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en).

Use a verified account/contact channel where possible. Ask for additional identity evidence only if reasonably necessary. Never request a password, Google token or an unnecessary full identity-document copy. Clarify a vague request without treating clarification as an automatic deadline reset. Never disclose another participant's private records while verifying an account.

## Assess and act

1. Identify the exact production account and relevant records. Distinguish private profile/photos/logs, public coach content, shared sessions/messages, coach-private notes, notification records and provider copies. A cancelled session or ended relationship is not deletion.
2. For access/correction/export, use authorized owner/provider tools and a secure delivery channel. Exclude other people's private information and record any necessary redaction or limitation.
3. For erasure/restriction, remove or irreversibly anonymize information no longer necessary. Assess shared records and any specific legal obligation or actual dispute separately. Keep only the necessary portion, with its reason, restricted purpose and a review date. An inconvenience or an unimplemented self-service screen is not a retention justification.
4. Use existing safe editing/removal controls where applicable. A whole-account operation requires review of application references, authentication, public content, Storage, notifications and provider copies before execution. Follow [hosted authority/recovery procedures](../supabase/README.md#hosted-changes-and-recovery); do not issue a blind Auth delete, broad SQL reset or restore over later activity. Any implementation needed for a particular request requires a bounded development issue and validation. This guide authorizes no data mutation by itself.
5. Notify relevant processors/recipients when required and record the result or limitation. Confirm the outcome to the requester, explain any lawful refusal or extension, and provide the competent authority complaint route. Close a request only after the actual actions and response are recorded.

## Retention and recovery copies

Apply the notice's purpose-based criteria. Account/profile/training history is retained for the active account and requested history, not on an invented automatic purge timer. Shared/operational records need a specific service, recovery, security, legal or dispute purpose. Keep minimal privacy-request evidence only while needed to resolve the case or demonstrate handling of a related obligation/complaint. Review the applicable purpose when a request arrives, an account is closed, an incident ends or recovery work is completed.

Restricted local release/incident backups already exist. The production Supabase backup API listed no managed backups and PITR was disabled on8 November2026; do not promise daily backups or a fixed provider retention window. Keep an inventory of operator copies and the release/incident recovery purpose. Remove copies when that purpose ends, subject to a specific documented legal hold. This policy change does not itself erase historical recovery evidence.

Record erasure/restriction outcomes separately from a recovery copy. Delete or replace affected copies where feasible. If a copy cannot be changed individually, restrict it until expiry/removal and reapply the recorded erasure/restriction before restored data returns to ordinary service. Never repurpose backups as a user directory. Review provider retention controls and the current processing terms when following through on a request.

## Underage reports and sensitive information

Current signup does not verify age. Review a credible under16 report promptly; use minimal evidence to determine whether the16+ audience rule is met. Do not collect extra medical details or a birth certificate by default. Use authorized access restriction where appropriate while resolving the report, assess removal and respond through a suitable verified contact. This process does not introduce guardian consent or a new signup age gate.

For accidentally disclosed medical information, limit further access, help the owner remove it through available controls and assess any copies or disclosures. Do not treat free-text entry as explicit consent. Do not enable medical-data collection, Google Calendar or native permissions under this general-fitness notice; review the processing basis, safeguards and notice before adding those features.

## Providers and publication

Initial production uses Vercel, Supabase, Porkbun and Resend; maps/place search use OpenFreeMap/Geoapify when accessed. Google sign-in is described conditionally and remains disabled in production; Mux uploads are not enabled there. Processing agreements and international-transfer provisions are linked from the notice. These public standard terms do not establish that every custom agreement or every future feature has been reviewed.

Keep the effective date, actual data practices and homepage privacy link accurate. Publish the same publicly accessible policy URL in Google Branding only after live route/content verification. Publishing a notice does not constitute Google brand verification or an independent legal certification.
