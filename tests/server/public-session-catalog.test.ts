import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseConnection } from "@/server/db/client";
import { publicSessionCatalogRecord } from "@/server/db/coaches/public-session-catalog-repository";

function database(results: (unknown[] | Error)[]) {
  let calls = 0;
  let closed = 0;
  const connection = {
    db: {
      async execute() {
        const result = results[calls++];
        if (result instanceof Error) throw result;
        if (!result) throw new Error("Unexpected unsupported query");
        return result;
      },
    },
    queryClient: {
      async end() {
        closed++;
      },
    },
  } as unknown as DatabaseConnection;
  return { connection, calls: () => calls, closed: () => closed };
}

test("confirmed missing catalog capability keeps legacy booking without invoking the absent function", async () => {
  const db = database([[{ installed: false }]]);
  assert.deepEqual(
    await publicSessionCatalogRecord("daniel-park", db.connection),
    {
      enabled: false,
      types: [],
      locations: [],
    },
  );
  assert.equal(db.calls(), 1);
  assert.equal(db.closed(), 1);
});

test("capability is checked anew and enabled empty catalogs never become legacy offers", async () => {
  const missing = database([[{ installed: false }]]);
  await publicSessionCatalogRecord("daniel-park", missing.connection);
  const installed = database([
    [{ installed: true }],
    [{ catalog: { enabled: true, types: [], locations: [] } }],
  ]);
  assert.deepEqual(
    await publicSessionCatalogRecord("daniel-park", installed.connection),
    {
      enabled: true,
      types: [],
      locations: [],
    },
  );
  assert.equal(installed.calls(), 2);
  assert.equal(installed.closed(), 1);
});

test("an installed catalog returns only its bounded public fields and retains explicit disabled state", async () => {
  const location = {
    id: "40000000-0000-4000-8000-000000000001",
    name: "Training studio",
    label: "Berlin",
  };
  const db = database([
    [{ installed: true }],
    [
      {
        catalog: {
          enabled: false,
          types: [],
          locations: [{ ...location, privateContact: "private" }],
          privateMetadata: "private",
        },
      },
    ],
  ]);
  assert.deepEqual(
    await publicSessionCatalogRecord("daniel-park", db.connection),
    {
      enabled: false,
      types: [],
      locations: [location],
    },
  );
});

test("a null installed-catalog result stays ineligible rather than enabling legacy booking", async () => {
  const db = database([[{ installed: true }], [{ catalog: null }]]);
  assert.equal(
    await publicSessionCatalogRecord("daniel-park", db.connection),
    null,
  );
});

test("installed-feature errors, including a missing inner dependency, propagate instead of reopening legacy booking", async () => {
  for (const code of ["42883", "42501", "08006"]) {
    const error = Object.assign(new Error("Synthetic catalog failure"), {
      code,
    });
    const db = database([[{ installed: true }], error]);
    await assert.rejects(
      publicSessionCatalogRecord("daniel-park", db.connection),
      (value) => value === error,
    );
    assert.equal(db.closed(), 1);
  }
});

test("unknown capability, malformed catalogs and malformed locations fail closed", async () => {
  for (const results of [
    [],
    [[]],
    [[{ installed: null }]],
    [[{ installed: true }], []],
    [
      [{ installed: true }],
      [{ catalog: { enabled: "false", types: [], locations: [] } }],
    ],
    [
      [{ installed: true }],
      [{ catalog: { enabled: false, types: null, locations: [] } }],
    ],
    [
      [{ installed: true }],
      [
        {
          catalog: {
            enabled: false,
            types: [],
            locations: [{ id: "forged", name: "Studio", label: "Berlin" }],
          },
        },
      ],
    ],
  ]) {
    const db = database(results);
    await assert.rejects(
      publicSessionCatalogRecord("daniel-park", db.connection),
    );
    assert.equal(db.closed(), 1);
  }
});
