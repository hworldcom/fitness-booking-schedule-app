export type AccountDetails = Readonly<{
  displayName: string;
  birthdate: string | null;
  gender: string | null;
  revision: number;
}>;

export type AccountResult =
  | Readonly<{ status: "ready"; details: AccountDetails }>
  | Readonly<{
      status:
        "invalid" | "conflict" | "signed-out" | "forbidden" | "unavailable";
    }>;

const controls = /[\p{Cc}\p{Cf}\u2028\u2029]/u;
const count = (value: string) => [...value].length;
const normalize = (value: string) => value.trim().replace(/\s+/gu, " ");

export function validBirthdate(
  value: unknown,
  today = new Date().toISOString().slice(0, 10),
): value is string | null {
  if (value === null) return true;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > today
  )
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function accountDetailsInput(
  value: unknown,
  today?: string,
): AccountDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).sort().join(",") !==
    "birthdate,displayName,gender,revision"
  )
    return null;
  if (
    typeof data.displayName !== "string" ||
    controls.test(data.displayName) ||
    !/[\p{L}\p{N}]/u.test(data.displayName)
  )
    return null;
  const displayName = normalize(data.displayName);
  if (count(displayName) < 2 || count(displayName) > 80) return null;
  if (!validBirthdate(data.birthdate, today)) return null;
  if (
    data.gender !== null &&
    (typeof data.gender !== "string" || controls.test(data.gender))
  )
    return null;
  const gender =
    typeof data.gender === "string" ? normalize(data.gender) || null : null;
  if (gender !== null && count(gender) > 80) return null;
  if (
    !Number.isSafeInteger(data.revision) ||
    (data.revision as number) < 0 ||
    (data.revision as number) > 2147483646
  )
    return null;
  return {
    displayName,
    birthdate: data.birthdate,
    gender,
    revision: data.revision as number,
  };
}

export function isAccountResult(value: unknown): value is AccountResult {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (data.status === "ready") {
    const details = accountDetailsInput(data.details);
    if (Object.keys(data).length !== 2 || !details) return false;
    const raw = data.details as AccountDetails;
    return (
      raw.displayName === details.displayName && raw.gender === details.gender
    );
  }
  return (
    Object.keys(data).length === 1 &&
    ["invalid", "conflict", "signed-out", "forbidden", "unavailable"].includes(
      String(data.status),
    )
  );
}
