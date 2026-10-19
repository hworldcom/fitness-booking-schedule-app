# Ticket DEV0373: Move domain DNS to Vercel

- Status: Completed
- Created: 2026-10-19
- Last updated: 2026-10-19
- Milestone: Hosted UAT DNS
- Coordination: None — independent development ticket
- Related records: Downstream deployment [DEV0372](DEV0372-deploy-reviewed-release-to-uat.md); historical DNS adoption [DEV0056](../backend/DEV0056-staging-release-and-domain-rehearsal.md); retired hosting [DEV0139](../backend/DEV0139-retire-cloudflare-deployment-path.md). No direct coordination membership is implied.

## Objective and context

The user asks to move `movx.club` DNS management to Vercel while continuing the UAT deployment. DNS (Domain Name System) maps domain names to service addresses. Porkbun remains the registrar and email provider; only authoritative DNS hosting moves. Historical DEV0056 records the original Porkbun → Cloudflare delegation for the old Cloudflare Worker deployment. DEV0139 retired that repository deployment path without changing external DNS. Current `art.ns.cloudflare.com`/`erin.ns.cloudflare.com` delegation therefore remains; it is not required by Next.js or Vercel.

Follow [infrastructure boundaries](../../../docs/mvp-spec.md#6-application-and-infrastructure-boundaries) and [data integrity](../../../docs/mvp-spec.md#8-identity-data-and-demo-integrity). This is a bounded infrastructure operation, not a product feature or application data change.

## Scope and non-goals

Inventory/export the complete existing zone and dependencies, preserve records in Vercel, verify the prepared replacement against the source, then update only nameserver delegation at Porkbun and verify authoritative service resolution. Retain rollback copies and the existing Cloudflare zone. Add the already authorized UAT destination while preserving wildcard, staging, mail, verification records and other retained services. Retire the root coming-soon and survey site routing as explicitly authorized below; retain their Worker projects and the source zone for rollback.

Exclude transferring domain registration/mailboxes, deleting old zones or deployments, moving email/SMTP, unrelated site changes, application/schema/data changes, account/credential resets, paid upgrades and assuming guessed public lookups enumerate the full zone. DEV0372 retains ownership of final app alias/TLS/responsive acceptance.

## Expected behavior and edge cases

Porkbun registration and `hello@movx.club` email continue with unchanged MX/SPF/DKIM/DMARC and other necessary records. Retained site/subdomain destinations remain consistent; the root coming-soon and survey sites are removed from public domain routing. UAT routes to the selected reviewed Vercel release. Vercel becomes the authoritative DNS provider; the old source zone remains available during cache propagation and rollback. Do not switch delegation with an incomplete export, unexplained record differences, active old DNSSEC delegation or unaccounted proxy/Worker/redirect dependencies. Cloudflare SOA/zone-apex NS metadata is provider-owned and is not copied as application DNS records.

## Assumptions, decisions, and dependencies

- The current user request authorizes preparing and executing the DNS migration; it supersedes DEV0372's earlier one-record-only boundary for this independent ticket's scope.
- Vercel account access exists. Its actual suggested nameservers are `ns1.vercel-dns.com` and `ns2.vercel-dns.com`; recheck before cutover.
- Need authenticated access to the complete current Cloudflare zone and Porkbun registrar controls. Public queries can verify known records but cannot enumerate all labels/verification entries. A historical export is evidence, not an assumed current source of truth.
- Public preflight finds MX `10 fwd1.porkbun.com`, `20 fwd2.porkbun.com` and SPF `v=spf1 include:_spf.porkbun.com ~all`; preserve exact values, selectors and priorities. DKIM/DMARC and the full zone still require inventory. Current DS lookup returns NOERROR with no DS answer; no active DNSSEC delegation was observed. Recheck the registrar/parent state before cutover.
- One reviewable DNS migration task; no implementation split or coordination record is needed. Application release remains a separate peer dependency.

## Implementation plan

1. Inspect official Vercel/Porkbun migration guidance, current NS/DS and known service records, and historical ownership records.
2. Obtain the complete current zone export/record inventory and inspect proxy/Worker/redirect/delegated-child dependencies. Save the original privately; produce a record-by-record migration manifest and exact rollback state.
3. Copy compatible records to Vercel's inactive DNS zone, resolving only documented provider-specific representations. Preserve mail, root/wildcard/staging and verification data; prepare only the authorized UAT change. Compare every source record and authoritative responses before cutover.
4. Inspect current Porkbun nameservers and DNSSEC. Update delegation only after the replacement is complete and any DNSSEC handling is explicitly planned; retain old zone and old NS values for rollback.
5. Verify parent/public NS propagation, old/new authority record equality for retained services and correct UAT destination. Resume DEV0372 alias/TLS/native proof separately; do not claim email delivery from DNS-only checks.
6. Complete/archive this record only after required DNS criteria pass. Otherwise leave an exact access/state blocker and continuation record. Update current operating guidance and DEV0372's dependency without rewriting completed historical tickets.

## Acceptance criteria

- [x] AC1: Complete current source records and DNS/proxy dependencies are captured with a reviewable preservation/translation manifest and rollback baseline.
- [x] AC2: Prepared Vercel zone accounts for every source record and required service, with mail and retained destinations preserved, the two authorized site retirements accounted for and UAT explicitly mapped.
- [x] AC3: Porkbun delegates to the actual Vercel nameservers, parent/public resolution confirms the change and retained service records match the reviewed baseline.
- [x] AC4: Ownership, evidence, propagation limitations and rollback are documented; downstream DEV0372 accurately reflects the DNS handoff.

## Validation plan

Use complete authenticated source/destination inventories, DNS NS/SOA/DS/A/AAAA/CNAME/MX/TXT/CAA/SRV checks for every owned label, explicit source/destination value/priority comparison and provider delegation verification. Test `staging.movx.club` continuity and UAT DNS without writing application data. Do not send email or alter a mailbox as part of a DNS-only check. Application unit/type/build suites are not applicable to record/delegation-only work; DEV0372 already proves the unchanged source build. Run documentation links, uniqueness/status and whitespace checks.

## Implementation record

### Changes and rationale

The complete current Cloudflare zone and both managed Worker dependencies were backed up. The user explicitly authorized retiring the coming-soon and survey sites. All twelve retained ordinary records are copied to Vercel with exact readback and 24/24 authoritative value checks; email and staging destinations are preserved. Porkbun successfully saved the verified Vercel nameservers after DNSSEC/forwarding inspection. The .club parent and both public recursive DNS probes now confirm Vercel; the retained-record, UAT and staging checks passed after cutover. Cloudflare zone/Workers are retained for rollback. No app data, credential, mailbox or security setting was changed.

### Affected files

This ticket and [index](../../README.md); [DEV0372](DEV0372-deploy-reviewed-release-to-uat.md) records the new independent DNS dependency. README now links the live UAT release and this DNS operation; Porkbun remains the registrar/email provider and Vercel manages DNS.

### Decisions and deviations

19 October: Found the explicit historical Cloudflare DNS onboarding in DEV0056, replacing the earlier inference about why Cloudflare remains. Vercel has default records only, including root/wildcard ALIAS and three CAA records; these are not a complete copy of the existing zone. Preserve old destinations rather than accepting those defaults as equivalent.

### Contracts, configuration, and operations

No app environment/schema/dependency change. Planned delegation is two Vercel NS values at Porkbun; exact record manifest, provider defaults/DNSSEC and rollback require completed inventory first. Keep original provider/export and mail values private where they include reporting addresses or verification material; no credential enters this record.

## Validation results

The first preflight entries below describe the original access blocker. Later dated entries record the successful full export, exact destination copy and delegation submission; final entries below contain the completed post-cutover evidence.

- `vercel domains inspect movx.club` confirms current Cloudflare versus proposed Vercel NS and both UAT/staging project bindings.
- `vercel dns ls movx.club` confirms only default Vercel CAA and root/wildcard ALIAS records, with no mail records.
- `dig NS/MX/TXT/DS movx.club +time=2 +tries=1 +short` confirms the known delegation/mail values above; no DS answer, detailed status still to verify.
- Official references: [Vercel DNS migration](https://vercel.com/docs/domains/managing-dns-records), [Vercel nameservers](https://vercel.com/docs/domains/working-with-nameservers), [Porkbun nameserver changes](https://kb.porkbun.com/article/22-how-to-change-your-nameservers).
- Sixteen public DNS query pairs returned NOERROR: current NS/SOA, root A/AAAA/MX/TXT/CAA/DS, default DKIM/DMARC, staging A/CNAME, UAT A/CNAME and www A/CNAME. DS/CAA had no answers. Live default DKIM and DMARC exist; their full values are kept in private evidence rather than copied into this record.
- Native signed-in Porkbun inspection: domain `movx.club` has seven legacy records: root ALIAS and wildcard CNAME to parking, two MX entries, default DKIM, SPF and DMARC. The provider warning explicitly confirms these saved records are not authoritative. No provider-defaults, deletion, edit or nameserver submission was clicked. The source Cloudflare tab is at its sign-in screen with no zone access. The user was asked to sign in for the complete backup; no credential was requested in chat or entered by the agent.
- Authenticated Vercel DNS inventory reports five records and no next page, matching the CLI's default root/wildcard ALIAS and three CAA entries. No MX/TXT records exist there. Private `work/dev0373/public-preflight.json`, `vercel-dns-before-private.json` and `known-records-private.json` preserve read-only evidence and a clearly nonauthoritative seven-record baseline, plus known staging and authorized UAT destinations. These do not claim a complete source export or permit cutover.
- Complete source inventory, destination copy, delegation and downstream UAT verification are not yet run.

## Risks, limitations, and follow-ups

Porkbun/registry, two .club parent servers and the public recursive probes confirm Vercel delegation. Resolver cache propagation is not globally instantaneous: one DNS-over-HTTPS Google endpoint still returned the old cached NS while direct Google/Cloudflare recursive queries and Cloudflare DNS-over-HTTPS returned Vercel. Old caches may therefore temporarily keep root/survey visible. Both zones preserve the same retained UAT/staging/mail records. DNS equality does not prove mail delivery; no test email was sent. Keep the source zone and Worker projects for rollback/cache continuity. Restoring art.ns.cloudflare.com/erin.ns.cloudflare.com at Porkbun restores the old zone and both former sites; selectively restoring a site requires a reviewed forward routing change. No paid subscription, permanent Worker deletion, production deployment or account-data migration occurred.

## Completion and review references

- Completed: 2026-10-19 — full inventory, preservation, authorized retirements, delegation and post-cutover checks passed.
- Commit: Operation/completion evidence is included in the commit bearing DEV0373; the exact application release and earlier deployment commits remain owned by DEV0372.
- Review: Self-reviewed all four criteria, complete record accounting, exact API/authoritative comparisons, DNSSEC/delegation, rollback, final links and scoped changes. No independent review.
- Deployment or release: Vercel is the delegated DNS provider, confirmed by parent/public DNS. Root/survey Worker routing is retired in the new zone; old caches may persist. DEV0372 records the live UAT application.

### Access resumed — 19 October 2026, 21:21 Berlin

The user confirmed Cloudflare sign-in. Native account access now shows the movx.club zone and its DNS Records link. Resume the existing plan with a complete zone export and dependency review before any destination write or delegation. The previous blocker is historical; no DNS change has occurred yet.

### Complete backup and service discovery — 19 October 2026

A fresh owned Chrome window resolved the stale browser binding. The authenticated active zone shows exactly 13 rows: 11 ordinary A/CNAME/MX/TXT records plus two managed Worker custom-domain rows. Native Export downloaded `movx.club.txt`; an exact private copy is `work/dev0373/cloudflare-zone-original.txt`, 2,324 bytes, SHA-256 `8dd83399b4695f73cae7511e27568449114c1d0cbafe41dd2ffcca8d60712a88`. Its BIND data contains the eleven ordinary records and provider SOA/NS metadata; managed Worker routing is recorded separately from the visible table. The full manifest accounts for all thirteen rows. Additional records absent from the saved Porkbun zone include Resend send/return-path CNAMEs and its DKIM record; these must also survive.

Critical dependency: root `movx.club` is a managed custom domain for Worker `delicate-silence-b197` (HTTP 200, title “MovX Club — Coming soon”); `survey.movx.club` is a custom domain for `movx-survey` (HTTP 200, “MovX Survey”). These are actual live services, not ordinary portable A/AAAA records. Cloudflare's current [Custom Domains requirements](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) require an active Cloudflare zone. A blanket nameserver switch is therefore not safe without a service migration/retirement decision. The user was asked whether to preserve/migrate them, keep DNS and activate UAT, or retire both. This is a newly discovered service-scope question, not a repeat request for deployment permission. No nameserver change or live-site retirement is authorized by silence.

Plan refinement before destination writes: preserve the eleven ordinary records in the inactive Vercel zone with exact values and MX priorities; normalize Cloudflare Auto TTL (`1` in its export) to 300 seconds. The two managed services remain explicitly unresolved in the manifest and block delegation. Do not copy their Cloudflare placeholder addresses as origins or assume default Vercel apex routing preserves them. DEV0372 will independently add the already authorized DNS-only A record for `uat` in the currently authoritative Cloudflare zone and complete the Vercel release. This one-host operation preserves both live sites and works with every pending migration option. Broader service migration, if chosen, needs its own bounded implementation records before code changes; this ticket retains DNS backup/copy/cutover ownership.

### Confirmed site retirement and cutover plan — 19 October 2026

The user answered the live-service scope question: “they can both be removed.” This explicitly authorizes retiring the root coming-soon and survey domain routing while moving DNS to Vercel. It does not require irreversible Worker/project deletion: retain both Workers and the source Cloudflare zone/export for rollback. No application migration or additional development scope is needed.

Before writes: copy all eleven ordinary original records plus DEV0372’s new UAT A record into Vercel, preserving exact values/MX priorities and normalizing only Auto TTL to 300. Preserve the source wildcard parking CNAME and explicit www/staging/Resend/mail records. Vercel’s system wildcard ALIAS is overridden by the explicit source wildcard CNAME; its unbound apex ALIAS may remain as provider metadata, so the retired root serves no application rather than the old Worker. Survey has no retained explicit destination and follows the preserved wildcard parking record. Retain the provider’s three certificate-authority defaults; the source had no CAA restriction. Verify actual authoritative answers before delegation, including all TXT bytes and both MX priorities.

Recheck public/parent DS and registrar DNSSEC before changing only the Porkbun nameservers to ns1.vercel-dns.com and ns2.vercel-dns.com. Do not add a DS or enable DNSSEC during this migration. Validate parent delegation and retained service answers, correct UAT alias/TLS and staging. DNS cache propagation may temporarily keep old sites visible; no email-delivery claim follows from DNS equality. Rollback is restoring art.ns.cloudflare.com and erin.ns.cloudflare.com at Porkbun while the original Cloudflare zone/Workers remain intact.

### Destination prepared and delegation submitted — 19 October 2026

All twelve retained ordinary records (eleven source records plus UAT) were created through Vercel REST API v2 and reread through v4: 12/12 exact name/type/value/TTL/MX-priority matches, 17 total records including five provider defaults, no additional page. The explicit wildcard CNAME overrides the system ALIAS as planned. Actual direct queries to both Vercel nameservers passed all 24 source-record checks, including byte-equivalent DKIM/DMARC/SPF strings, exact MX priorities and both staging/UAT A answers. Survey now follows the retained parking wildcard on Vercel; no Worker-domain record was copied. Private manifests and comparisons are under ignored work/dev0373/.

Native Porkbun details confirmed the existing Cloudflare nameservers, Registry DNSSEC “0 records” and URL forwarding “Not Set”. Direct DS lookup at a.nic.club returned authoritative NOERROR with zero DS answers. Only the movx.club nameserver textarea was changed to the two verified Vercel nameservers and saved. After successful dismissal, native domain details show ns1.vercel-dns.com/ns2.vercel-dns.com. Domain registration, auto renewal, transfer lock, WHOIS privacy, mailbox settings, the other Porkbun domain and API access were unchanged.

The registry’s authoritative parent still returned the old delegation immediately after submission; propagation is pending rather than failed. Keep the old zone and Workers intact for rollback/cache continuity. No permanent deletion was performed. Destination correctness is passed; authoritative parent/public delegation remains to verify before completion.

### Reviewed retained-record manifest

Source includes thirteen original rows: eleven ordinary records below and two managed Worker routes explicitly retired by the user. DEV0372 adds the twelfth ordinary record, UAT. All twelve ordinary records match the destination API readback and both Vercel authoritative servers. TXT values stay in the private exact export; the digests below identify the compared bytes without reproducing reporting addresses. Cloudflare Auto/export TTL 1 maps to Vercel 300 seconds; existing explicit 3600 stays unchanged.

| Name | Type | Preserved destination or value fingerprint | TTL seconds |
| --- | --- | --- | --- |
| `staging` | A | `76.76.21.21` | 300 |
| `*` | CNAME | `pixie.porkbun.com` | 300 |
| `rsend` | CNAME | `rsend.forge.rmta.net` | 3600 |
| `send` | CNAME | `send.forge.rmta.net` | 3600 |
| `www` | CNAME | `pixie.porkbun.com` | 300 |
| `@` | MX | `20 fwd2.porkbun.com` | 300 |
| `@` | MX | `10 fwd1.porkbun.com` | 300 |
| `default._domainkey` | TXT | `SHA-256 11ec4a7cee032b1a06958400cb609ab87d1b61ce218bf67b9e40d0a98730da3c` | 300 |
| `_dmarc` | TXT | `SHA-256 0ae3fb12533585335d09f4b9e5622a895e268db1f53f9b1275f5adef6aa5e42d` | 300 |
| `@` | TXT | `SHA-256 8120f666529439496fe036c7c4de814784900f3df041eaeebc35b87e401a5ad7` | 300 |
| `resend._domainkey` | TXT | `SHA-256 b360279b041e7d29b76181291e8bb8b8bba2257d25802fb21aa7b0a065350312` | 3600 |
| `uat` | A | `76.76.21.21` | 300 |

Retained provider defaults: apex ALIAS to cname.vercel-dns-016.com (no bound root application), system wildcard ALIAS overridden by the explicit source wildcard CNAME, and three CAA issuers pki.goog/sectigo.com/letsencrypt.org. Direct Vercel survey CNAME is pixie.porkbun.com through wildcard inheritance, replacing the survey Worker. Cloudflare SOA/NS are provider metadata, not copied. No delegated child/SRV/other record exists in the complete export/table.

Registry WHOIS independently reports Updated Date 2026-10-19T19:33:44Z, the two Vercel nameservers and DNSSEC unsigned. Authoritative parent and recursive caches were still returning the prior delegation immediately afterward. This confirms accepted registrar/registry state while distinguishing it from completed DNS propagation.

### Final cutover and completion evidence — 19 October 2026

Direct NS queries at a.nic.club and ns3.dns.nic.club now both return only ns1.vercel-dns.com/ns2.vercel-dns.com. Queries through 1.1.1.1 and 8.8.8.8 return the same pair. Parent DS remains empty/unsigned. Cloudflare DNS-over-HTTPS also confirms Vercel; a Google DNS-over-HTTPS cache still returned the old pair at the sampled moment, which is the documented propagation limitation rather than a registrar failure. The earlier Vercel CLI inspection likewise had cached old discovery; it does not override the later actual parent/recursive proof.

The original 24 direct record-value checks were repeated successfully against both Vercel authorities after delegation, including all email/Resend bytes/priorities and staging/UAT. Final source/destination inventory has no unexplained record omission: both user-authorized Worker routes are retired, twelve ordinary records preserved, five Vercel defaults accounted for. The new authoritative apex A values are Vercel addresses (216.150.16.1/216.150.1.1); forcing an ordinary HTTP request to the verified new Vercel address with the root Host returns 404, with no old coming-soon app. Survey CNAME on both new authorities is the preserved parking wildcard destination; its former Worker is not routed there. No permanent Cloudflare data/project deletion occurred.

All sixteen direct real-host UAT route/API checks passed again after cutover with ordinary TLS verification (7×200, 4×307, 5×401); staging HTTPS remains 200. DEV0372's native desktop/phone and exact retained-data proof passed independently. This DNS-only change needs no additional app unit/lint/type/build run: source/configuration is unchanged and the exact release already passed its required checks. No email was sent and no delivery certification is claimed.

The first final-delegation wrapper used dig +short, which omitted the referral's authority section and failed its empty-answer assertion. The corrected wrapper explicitly parses NS records from both answer/authority sections; it then passed with the exact expected names. No DNS values or acceptance expectations were weakened. Private evidence: work/dev0373/final-delegation.json, authoritative-comparison-private.json, final-doh.json, staging-final.json and retired-root-vercel.headers; work/dev0372/post-cutover-smoke.json.

Final repository verification: 492 relative links across release guidance/specification/index/both records resolve, 287 record identifiers are unique with statuses in the proper current/archive directories, whitespace checks pass, and pre-existing specification/browser-test/index edits match the initial QA snapshot after excluding only the authorized origin and owned ticket rows/next ID. Source and private evidence/secrets remain outside this operational commit.
