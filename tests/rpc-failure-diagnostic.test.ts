import assert from "node:assert/strict";
import test from "node:test";
import { rpcFailureDiagnostic } from "@/solana/rpc-failure-diagnostic";

test("RPC diagnostics retain only bounded Solana and HTTP codes", () => {
  assert.deepEqual(
    rpcFailureDiagnostic({
      name: "SolanaError",
      message: "secret provider URL and response body",
      context: {
        __code: 8_100_002,
        statusCode: 403,
        headers: { authorization: "secret" },
      },
    }),
    {
      category: "http",
      errorName: "SolanaError",
      solanaCode: 8_100_002,
      httpStatus: 403,
      causeCode: null,
    },
  );
});

test("RPC diagnostics classify timeout and lower-level transport failures", () => {
  assert.deepEqual(rpcFailureDiagnostic({ name: "TimeoutError" }), {
    category: "timeout",
    errorName: "TimeoutError",
    solanaCode: null,
    httpStatus: null,
    causeCode: null,
  });
  assert.deepEqual(
    rpcFailureDiagnostic({
      name: "TypeError",
      message: "fetch failed at https://provider.example/?key=secret",
      cause: { code: "ECONNRESET", address: "private.example" },
    }),
    {
      category: "transport",
      errorName: "TypeError",
      solanaCode: null,
      httpStatus: null,
      causeCode: "ECONNRESET",
    },
  );
});

test("RPC diagnostics discard unbounded names and cause values", () => {
  assert.deepEqual(
    rpcFailureDiagnostic({
      name: "x".repeat(41),
      cause: { code: "not safe: https://secret.example" },
    }),
    {
      category: "unknown",
      errorName: "UnknownError",
      solanaCode: null,
      httpStatus: null,
      causeCode: null,
    },
  );
});
