type UnknownRecord = Readonly<Record<string, unknown>>;

export type RpcFailureDiagnostic = Readonly<{
  category: "timeout" | "http" | "solana" | "transport" | "unknown";
  errorName: string;
  solanaCode: number | null;
  httpStatus: number | null;
  causeCode: string | null;
}>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function finiteInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : null;
}

function boundedCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z0-9_-]{1,40}$/.test(value)
    ? value
    : null;
}

export function rpcFailureDiagnostic(error: unknown): RpcFailureDiagnostic {
  const errorRecord = record(error);
  const context = record(errorRecord?.context);
  const cause = record(errorRecord?.cause);
  const errorName =
    typeof errorRecord?.name === "string" && errorRecord.name.length <= 40
      ? errorRecord.name
      : "UnknownError";
  const solanaCode = finiteInteger(context?.__code);
  const httpStatus = finiteInteger(context?.statusCode);
  const causeCode = boundedCode(cause?.code);

  let category: RpcFailureDiagnostic["category"] = "unknown";
  if (errorName === "AbortError" || errorName === "TimeoutError") {
    category = "timeout";
  } else if (httpStatus !== null) {
    category = "http";
  } else if (solanaCode !== null) {
    category = "solana";
  } else if (errorName === "TypeError" || causeCode !== null) {
    category = "transport";
  }

  return Object.freeze({
    category,
    errorName,
    solanaCode,
    httpStatus,
    causeCode,
  });
}
