export type AccountDetails = Readonly<{
  displayName: string;
  legalName: string | null;
  preferredFirstName: string | null;
  username: string | null;
  birthdate: string | null;
  gender: string | null;
  revision: number;
}>;
export type PersonalDetailsInput = Readonly<{
  section: "personal-details";
  legalName: string | null;
  preferredFirstName: string | null;
  birthdate: string | null;
  gender: string | null;
  revision: number;
}>;
export type UsernameInput = Readonly<{
  section: "login-security";
  username: string | null;
  revision: number;
}>;
export type AccountInput = PersonalDetailsInput | UsernameInput;
export type AccountResult =
  | Readonly<{ status: "ready"; details: AccountDetails }>
  | Readonly<{
      status:
        | "invalid"
        | "conflict"
        | "username-taken"
        | "signed-out"
        | "forbidden"
        | "unavailable";
    }>;
const controls = /[\p{Cc}\p{Cf}\u2028\u2029]/u;
const count = (value: string) => [...value].length;
const normalize = (value: string) => value.trim().replace(/\s+/gu, " ");
const revisionValid = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) < 2147483647;
const exactKeys = (data: Record<string, unknown>, keys: string) =>
  Object.keys(data).sort().join(",") === keys;
function optionalText(
  value: unknown,
  minimum: number,
  name = false,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || controls.test(value)) return undefined;
  const normalized = normalize(value);
  if (!normalized) return null;
  if (
    count(normalized) < minimum ||
    count(normalized) > 80 ||
    (name && !/[\p{L}\p{N}]/u.test(normalized))
  )
    return undefined;
  return normalized;
}
export function normalizeUsername(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) return value.trim() === "" ? null : undefined;
  return /^[a-z][a-z0-9_]{2,29}$/.test(normalized) ? normalized : undefined;
}
export function defaultFirstName(
  legalName: string | null,
  displayName: string,
) {
  return normalize(legalName || displayName).split(" ", 1)[0] || "Member";
}
export function preferredChatName(
  details: Pick<
    AccountDetails,
    "legalName" | "preferredFirstName" | "displayName"
  >,
) {
  return (
    details.preferredFirstName ||
    defaultFirstName(details.legalName, details.displayName)
  );
}
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
): AccountInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!revisionValid(data.revision)) return null;
  if (data.section === "login-security") {
    if (!exactKeys(data, "revision,section,username")) return null;
    const username = normalizeUsername(data.username);
    return username === undefined
      ? null
      : { section: data.section, username, revision: data.revision };
  }
  if (
    data.section !== "personal-details" ||
    !exactKeys(
      data,
      "birthdate,gender,legalName,preferredFirstName,revision,section",
    )
  )
    return null;
  const legalName = optionalText(data.legalName, 2, true);
  const preferredFirstName = optionalText(data.preferredFirstName, 1, true);
  const gender = optionalText(data.gender, 1);
  if (
    legalName === undefined ||
    preferredFirstName === undefined ||
    gender === undefined ||
    !validBirthdate(data.birthdate, today)
  )
    return null;
  return {
    section: data.section,
    legalName,
    preferredFirstName,
    birthdate: data.birthdate,
    gender,
    revision: data.revision,
  };
}
export function isAccountResult(value: unknown): value is AccountResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (data.status !== "ready")
    return (
      exactKeys(data, "status") &&
      [
        "invalid",
        "conflict",
        "username-taken",
        "signed-out",
        "forbidden",
        "unavailable",
      ].includes(String(data.status))
    );
  if (
    !exactKeys(data, "details,status") ||
    !data.details ||
    typeof data.details !== "object" ||
    Array.isArray(data.details)
  )
    return false;
  const raw = data.details as Record<string, unknown>;
  if (
    !exactKeys(
      raw,
      "birthdate,displayName,gender,legalName,preferredFirstName,revision,username",
    ) ||
    typeof raw.displayName !== "string" ||
    !raw.displayName ||
    count(raw.displayName) > 80
  )
    return false;
  const personal = accountDetailsInput({
    section: "personal-details",
    legalName: raw.legalName,
    preferredFirstName: raw.preferredFirstName,
    birthdate: raw.birthdate,
    gender: raw.gender,
    revision: raw.revision,
  });
  const username = normalizeUsername(raw.username);
  return (
    personal?.section === "personal-details" &&
    personal.legalName === raw.legalName &&
    personal.preferredFirstName === raw.preferredFirstName &&
    personal.gender === raw.gender &&
    username !== undefined &&
    username === raw.username
  );
}
