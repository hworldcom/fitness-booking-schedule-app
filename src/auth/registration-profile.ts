import { normalizeUsername } from "@/account/contracts";
import { normalizeDisplayName } from "./identity-contracts";

export type RegistrationProfileInput = Readonly<{
  username: string;
  fullName: string;
  displayName: string;
}>;

export function registrationProfileInput(
  value: unknown,
): RegistrationProfileInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(",") !== "displayName,fullName,username")
    return null;
  if (
    [data.fullName, data.displayName].some(
      (name) =>
        typeof name !== "string" || /[\p{Cc}\p{Cf}\u2028\u2029]/u.test(name),
    )
  )
    return null;
  const username = normalizeUsername(data.username);
  const fullName = normalizeDisplayName(data.fullName);
  const displayName = normalizeDisplayName(data.displayName);
  return username && fullName && displayName
    ? { username, fullName, displayName }
    : null;
}
