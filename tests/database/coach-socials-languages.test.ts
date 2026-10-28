import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { parseCoachWebsiteContent } from "@/domain/coach-website";
import { withActorDatabaseContext } from "@/server/db/authorization/repository";
import type { AuthorizedActor } from "@/server/authorization/contracts";
import { enrollApplicationProfile } from "@/server/db/identity/repository";
import { submitOwnedCoachApplicationRecord } from "@/server/db/coaches/application-repository";
import { saveOwnedCoachApplicationContact } from "@/server/db/coaches/application-contact-repository";
import { upsertOwnedCoachProfileRecord } from "@/server/db/coaches/repository";
import {
  ownedCoachWebsiteRecord,
  mutateOwnedCoachWebsiteRecord,
  publicCoachWebsiteRecord,
  publicCoachWebsiteCards,
} from "@/server/db/coaches/website-repository";

const target = process.env.DATABASE_TEST_URL;
test(
  "MOV-135 current-chain SQL public socials/languages, privacy, bounds and revisions",
  {
    skip: !target || !new URL(target).pathname.startsWith("/mov135_"),
  },
  async (t) => {
    const admin = postgres(target!, {
      max: 1,
      prepare: false,
      onnotice: () => {},
    });
    const runtimeUrl = new URL(target!);
    runtimeUrl.username = "repx_runtime_login";
    runtimeUrl.password = "postgres";
    process.env.DATABASE_URL = runtimeUrl.toString();
    const runtime = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
    const work = <T>(
      actor: AuthorizedActor,
      fn: Parameters<typeof withActorDatabaseContext<T>>[1],
    ) => withActorDatabaseContext(actor, fn);
    try {
      const actors: AuthorizedActor[] = [];
      const slugs: string[] = [];
      for (let i = 0; i < 2; i++) {
        const authId = randomUUID();
        await admin`insert into auth.users(id,is_sso_user,is_anonymous) values(${authId},false,false)`;
        const enrolled = await enrollApplicationProfile(
          authId,
          `Social Coach ${i}`,
        );
        assert.ok(enrolled);
        const actor: AuthorizedActor = {
          authUserId: authId,
          profileId: enrolled.profileId,
          runId: enrolled.runId,
          runRole: "member",
        };
        actors.push(actor);
        await work(actor, submitOwnedCoachApplicationRecord);
        await work(actor, (tx) =>
          saveOwnedCoachApplicationContact(
            tx,
            {
              phoneNumber: "+4915123456789",
              instagramUrl: "https://instagram.com/private-application-contact",
              facebookUrl: null,
              linkedinUrl: null,
            },
            0,
          ),
        );
        slugs.push(
          await work(actor, (tx) =>
            upsertOwnedCoachProfileRecord(tx, {
              displayName: `Social Coach ${i}`,
              bio: "Supportive personal training for everyday strength and confidence.",
              disciplines: ["Boxing"],
              timezone: "Europe/Berlin",
              visibility: "hidden",
              selectedGymId: "40000000-0000-4000-8000-000000000001",
              independentLocation: null,
            }),
          ),
        );
      }
      const [owner, pending] = actors;
      const legacy = parseCoachWebsiteContent({
        links: [{ label: "Existing website", url: "https://example.com/" }],
      })!;
      const extended = parseCoachWebsiteContent({
        ...legacy,
        languages: ["English", "Deutsch", "Tiếng Việt"],
        websiteUrl: "https://coach.example.com/",
        socialLinks: {
          instagram: "https://www.instagram.com/public-coach",
          facebook: "https://facebook.com/public-coach",
          linkedin: "https://www.linkedin.com/in/public-coach",
        },
      })!;
      const save = (
        actor: AuthorizedActor,
        revision: number,
        content = extended,
      ) =>
        work(actor, (tx) =>
          mutateOwnedCoachWebsiteRecord(tx, actor, revision, content),
        );
      await t.test(
        "legacy reads do not publish private contacts or create content; extension reloads without touching links",
        async () => {
          const old = await work(owner, (tx) =>
            ownedCoachWebsiteRecord(tx, owner),
          );
          assert.equal(old?.revision, 0);
          assert.equal(old?.content.socialLinks, undefined);
          assert.equal(old?.content.languages, undefined);
          assert.equal(old?.content.websiteUrl, undefined);
          await save(owner, 0, legacy);
          await save(owner, 1);
          const saved = await work(owner, (tx) =>
            ownedCoachWebsiteRecord(tx, owner),
          );
          assert.deepEqual(saved?.content, extended);
          assert.equal(saved?.revision, 2);
          assert.doesNotMatch(
            JSON.stringify(saved),
            /private-application-contact|phoneNumber|491512/,
          );
          assert.equal(await publicCoachWebsiteRecord(slugs[0]), null);
        },
      );
      await t.test(
        "SQL independently rejects malformed platform URLs, extra private keys and invalid languages",
        async () => {
          const invalid = [
            { websiteUrl: null },
            { websiteUrl: 42 },
            { websiteUrl: "javascript:alert(1)" },
            { websiteUrl: "http://example.com" },
            { websiteUrl: "https://user:secret@example.com" },
            { websiteUrl: "https://example.com/white space" },
            { websiteUrl: "https://site.localhost" },
            { websiteUrl: "https://example.com/" + "x".repeat(2048) },
            { socialLinks: { instagram: "https://instagram.com.evil.test/a" } },
            { socialLinks: { instagram: "http://instagram.com/a" } },
            { socialLinks: { instagram: "https://user@instagram.com/a" } },
            { socialLinks: { instagram: "https://a..instagram.com/a" } },
            { socialLinks: { instagram: "https://-bad.instagram.com/a" } },
            { socialLinks: { instagram: "https://a_b.instagram.com/a" } },
            { socialLinks: { instagram: "https://instagram.com:8080/a" } },
            { socialLinks: { instagram: "https://instagram.com/white space" } },
            { socialLinks: { instagram: "https://instagram.com\\a" } },
            {
              socialLinks: {
                instagram: "https://instagram.com/" + "x".repeat(2048),
              },
            },
            { socialLinks: { instagram: "https://facebook.com/a" } },
            { socialLinks: { instagram: null } },
            { socialLinks: { phoneNumber: "+123456789" } },
            { socialLinks: null },
            { languages: null },
            { languages: ["English", "english"] },
            { languages: [""] },
            { languages: ["English\nGerman"] },
            { languages: ["<b>English</b>"] },
            { languages: ["x".repeat(61)] },
            { languages: Array.from({ length: 9 }, (_, i) => String(i)) },
            {
              instagramUrl: "https://instagram.com/private-application-contact",
            },
          ];
          for (const patch of invalid) {
            const input = { ...extended, ...patch };
            const [result] =
              await admin`select app.valid_coach_website_content(${JSON.stringify(input)}::jsonb) valid`;
            assert.equal(result.valid, false, JSON.stringify(patch));
            await assert.rejects(
              work(owner, (tx) =>
                tx.execute(
                  sql`select * from app.mutate_owned_coach_website(2,${JSON.stringify(input)}::jsonb,null,null,false)`,
                ),
              ),
            );
          }
          assert.equal(
            (await work(owner, (tx) => ownedCoachWebsiteRecord(tx, owner)))
              ?.revision,
            2,
          );
        },
      );
      await t.test(
        "owner/dataset isolation and concurrent revision fences remain authoritative",
        async () => {
          assert.equal(
            (await work(pending, (tx) => ownedCoachWebsiteRecord(tx, pending)))
              ?.revision,
            0,
          );
          assert.equal(
            (
              await runtime`select * from app.coach_website_content where profile_id=${owner.profileId}::uuid`
            ).length,
            0,
          );
          assert.equal(
            (
              await work(pending, (tx) =>
                tx.execute(
                  sql`select * from app.coach_website_content where profile_id=${owner.profileId}::uuid`,
                ),
              )
            ).length,
            0,
          );
          await assert.rejects(
            runtime`update app.coach_website_content set content=${JSON.stringify(extended)}::jsonb`,
          );
          await assert.rejects(
            work({ ...owner, runId: randomUUID() }, (tx) =>
              ownedCoachWebsiteRecord(tx, owner),
            ),
          );
          await assert.rejects(
            runtime`select * from app.coach_application_contacts`,
          );
          const results = await Promise.allSettled([
            save(owner, 2, { ...extended, languages: ["English"] }),
            save(owner, 2, { ...extended, languages: ["Tiếng Việt"] }),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            (await work(owner, (tx) => ownedCoachWebsiteRecord(tx, owner)))
              ?.revision,
            3,
          );
        },
      );
      await t.test(
        "approved/public page exposes only published fields; directory and pending/hidden profiles stay bounded",
        async () => {
          await admin`select app.review_coach_application(${owner.profileId},'pending','approved','Disposable social QA','test','movx-identity-application-v1')`;
          await admin`update app.coach_profiles set visibility='visible' where profile_id=${owner.profileId}::uuid`;
          await save(owner, 3);
          const published = await publicCoachWebsiteRecord(slugs[0]);
          assert.deepEqual(published?.content, extended);
          assert.doesNotMatch(
            JSON.stringify(published),
            /private-application-contact|phoneNumber|491512/,
          );
          const cards = await publicCoachWebsiteCards([owner.profileId]);
          assert.ok(cards.has(owner.profileId));
          assert.doesNotMatch(
            JSON.stringify([...cards.values()]),
            /websiteUrl|coach.example.com|languages|socialLinks|instagram|linkedin|facebook|private-application/,
          );
          await save(pending, 0);
          assert.equal(await publicCoachWebsiteRecord(slugs[1]), null);
          await admin`update app.coach_profiles set visibility='hidden' where profile_id=${owner.profileId}::uuid`;
          assert.equal(await publicCoachWebsiteRecord(slugs[0]), null);
          assert.equal(
            (await publicCoachWebsiteCards([owner.profileId])).size,
            0,
          );
        },
      );
      await t.test(
        "clear removes public extensions without changing other content, and private application contacts remain intact",
        async () => {
          await save(owner, 4, {
            ...extended,
            socialLinks: {},
            languages: [],
            websiteUrl: "",
          });
          const saved = await work(owner, (tx) =>
            ownedCoachWebsiteRecord(tx, owner),
          );
          assert.deepEqual(saved?.content.links, legacy.links);
          assert.deepEqual(saved?.content.socialLinks, {});
          assert.deepEqual(saved?.content.languages, []);
          assert.equal(saved?.content.websiteUrl, "");
          const [contact] =
            await admin`select details,revision from app.coach_application_contacts where profile_id=${owner.profileId}::uuid`;
          assert.equal(
            contact.details.instagramUrl,
            "https://instagram.com/private-application-contact",
          );
          assert.equal(contact.revision, 1);
        },
      );
    } finally {
      await runtime.end();
      await admin.end();
    }
  },
);
