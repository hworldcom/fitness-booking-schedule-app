import type { AccountDetails, AccountInput } from "@/account/contracts";
export function accountEditInput(
  details: AccountDetails,
  section: AccountInput["section"],
): AccountInput {
  return section === "login-security"
    ? { section, username: details.username, revision: details.revision }
    : {
        section,
        legalName: details.legalName,
        preferredFirstName: details.preferredFirstName,
        birthdate: details.birthdate,
        gender: details.gender,
        revision: details.revision,
      };
}
// Only a successful save of the other section can advance an otherwise current draft.
// A stale draft keeps its original revision and must receive conflict recovery.
export function advanceOtherDraft(
  draft: AccountInput,
  saved: AccountInput,
  revision: number,
): AccountInput {
  return draft.section !== saved.section && draft.revision === saved.revision
    ? { ...draft, revision }
    : draft;
}
