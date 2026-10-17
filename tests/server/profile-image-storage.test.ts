import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseProfileImageStorage } from "@/server/storage/supabase-profile-images";
import { storeAndAttachProfileImage } from "@/server/profile-images/store-and-attach";
import type {
  ProfileImageObject,
  ProfileImageStorage,
} from "@/server/storage/contracts";

const owner = "10000000-0000-4000-8000-000000000001";
const path = `${owner}/20000000-0000-4000-8000-000000000001.webp`;
const previous = `${owner}/20000000-0000-4000-8000-000000000002.webp`;
const object: ProfileImageObject = { scope: "account-avatar", path };
const bytes = new Uint8Array([82, 73, 70, 70, 0, 255]);
const unavailable = { status: "unavailable" as const };
const ready = { status: "ready" as const };

function client(fetcher: typeof fetch, authorization = "Bearer test-actor") {
  return createClient("https://storage.example.test", "test-public-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetcher, headers: { Authorization: authorization } },
  });
}

test("the installed SDK receives current request credentials, immutable upload settings and exact bytes", async () => {
  const requests: Request[] = [];
  let actor = "Bearer first-test-actor";
  let clients = 0;
  const storage = createSupabaseProfileImageStorage({
    client: async () => {
      clients++;
      return client(async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        if (request.method === "GET") return new Response(bytes);
        return Response.json({ Key: path, Id: "object-id" });
      }, actor);
    },
    publicOrigin: () => "https://storage.example.test",
  });
  assert.deepEqual(await storage.upload(object, bytes), ready);
  assert.equal(
    requests[0].url,
    `https://storage.example.test/storage/v1/object/account-avatars/${path}`,
  );
  assert.equal(requests[0].headers.get("content-type"), "image/webp");
  assert.equal(requests[0].headers.get("cache-control"), "max-age=31536000");
  assert.equal(requests[0].headers.get("x-upsert"), "false");
  assert.deepEqual(new Uint8Array(await requests[0].arrayBuffer()), bytes);
  actor = "Bearer second-test-actor";
  assert.deepEqual(await storage.download(object), { status: "ready", bytes });
  actor = "Bearer third-test-actor";
  assert.deepEqual(await storage.remove(object), ready);
  assert.equal(clients, 3);
  assert.deepEqual(
    requests.map((request) => request.headers.get("authorization")),
    [
      "Bearer first-test-actor",
      "Bearer second-test-actor",
      "Bearer third-test-actor",
    ],
  );
  assert.equal(requests[2].method, "DELETE");
  assert.deepEqual(await requests[2].json(), { prefixes: [path] });
  assert.deepEqual(
    await storage.upload({ scope: "coach-banner", path }, bytes),
    ready,
  );
  assert.equal(
    requests[3].url,
    `https://storage.example.test/storage/v1/object/coach-banners/${path}`,
  );
  assert.equal(requests[3].headers.get("cache-control"), "max-age=0");
  assert.equal(requests[3].headers.get("x-upsert"), "false");
});

test("absent clients, provider rejection, transport errors and unreadable bodies return only unavailable", async () => {
  const sources = [
    async () => null,
    async () => {
      throw new Error("private-client-detail");
    },
    async () =>
      client(async () =>
        Response.json({ message: "private-policy-detail" }, { status: 403 }),
      ),
    async () =>
      client(async () => {
        throw new Error("private-transport-detail");
      }),
  ];
  for (const source of sources) {
    const storage = createSupabaseProfileImageStorage({
      client: source,
      publicOrigin: () => null,
    });
    assert.deepEqual(await storage.upload(object, bytes), unavailable);
    assert.deepEqual(await storage.download(object), unavailable);
    assert.deepEqual(await storage.remove(object), unavailable);
  }
  const storage = createSupabaseProfileImageStorage({
    client: async () =>
      client(async () => {
        const response = new Response(bytes);
        await response.arrayBuffer();
        return response;
      }),
    publicOrigin: () => null,
  });
  assert.deepEqual(await storage.download(object), unavailable);
});

test("invalid object references fail before provider access and portrait URLs preserve the public-only legacy contract", async () => {
  let accessed = false;
  let origin: string | null = "https://storage.example.test/";
  const storage = createSupabaseProfileImageStorage({
    client: async () => {
      accessed = true;
      return null;
    },
    publicOrigin: () => origin,
  });
  for (const invalid of [
    { ...object, path: "../private.webp" },
    { ...object, path: `${owner}/not-a-uuid.webp` },
    {
      ...object,
      scope: "private-other-bucket",
    } as unknown as ProfileImageObject,
  ]) {
    assert.deepEqual(await storage.upload(invalid, bytes), unavailable);
    assert.deepEqual(await storage.download(invalid), unavailable);
    assert.deepEqual(await storage.remove(invalid), unavailable);
  }
  assert.equal(accessed, false);
  const updatedAt = "2026-10-08T12:00:00.000Z";
  assert.equal(storage.publicPortraitUrl(null), null);
  assert.equal(
    storage.publicPortraitUrl({
      source: "fixture",
      path: "/images/coaches/daniel-park.webp",
      updatedAt,
    }),
    "/images/coaches/daniel-park.webp",
  );
  assert.equal(
    storage.publicPortraitUrl({ source: "storage", path, updatedAt }),
    `https://storage.example.test/storage/v1/object/public/coach-portraits/${path}?v=${encodeURIComponent(updatedAt)}`,
  );
  assert.equal(
    storage.publicPortraitUrl({
      source: "storage",
      path: "../private.webp",
      updatedAt,
    }),
    null,
  );
  origin = null;
  assert.equal(
    storage.publicPortraitUrl({ source: "storage", path, updatedAt }),
    null,
  );
  assert.equal(accessed, false);
});

function workflowStorage(
  events: string[],
  uploadReady = true,
  cleanupReady = true,
): ProfileImageStorage {
  return {
    upload: async () => {
      events.push("upload");
      return uploadReady ? ready : unavailable;
    },
    remove: async (value) => {
      events.push(`remove:${value.path}`);
      return cleanupReady ? ready : unavailable;
    },
    download: async () => unavailable,
    publicPortraitUrl: () => null,
  };
}

test("a failed provider upload never attaches a missing object or deletes the current image", async () => {
  const events: string[] = [];
  const result = await storeAndAttachProfileImage(
    workflowStorage(events, false),
    object,
    bytes,
    async () => {
      events.push("attach");
      return {
        status: "attached",
        value: "new-version",
        previousPath: previous,
      };
    },
  );
  assert.deepEqual(result, unavailable);
  assert.deepEqual(events, ["upload"]);
});

test("lost authority or reference conflict after upload cleans up only the unreferenced new object", async () => {
  for (const status of [
    "signed-out",
    "forbidden",
    "unavailable",
    "conflict",
  ] as const) {
    const events: string[] = [];
    const result = await storeAndAttachProfileImage(
      workflowStorage(events),
      object,
      bytes,
      async () => {
        events.push("attach");
        return { status };
      },
    );
    assert.deepEqual(result, { status });
    assert.deepEqual(events, ["upload", "attach", `remove:${path}`]);
  }
});

test("replacement cleanup follows attachment and cleanup rejection cannot undo a saved reference", async () => {
  for (const cleanupReady of [true, false]) {
    const events: string[] = [];
    const attachment = {
      status: "attached" as const,
      value: "new-version",
      previousPath: previous,
    };
    const result = await storeAndAttachProfileImage(
      workflowStorage(events, true, cleanupReady),
      object,
      bytes,
      async () => {
        events.push("attach");
        return attachment;
      },
    );
    assert.deepEqual(result, attachment);
    assert.deepEqual(events, ["upload", "attach", `remove:${previous}`]);
  }
  const events: string[] = [];
  await storeAndAttachProfileImage(
    workflowStorage(events),
    { scope: "coach-portrait", path },
    bytes,
    async () => ({
      status: "attached",
      value: "fixture-replaced",
      previousPath: null,
    }),
  );
  assert.deepEqual(events, ["upload"]);
});
