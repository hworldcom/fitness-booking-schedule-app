import type { AuthSessionSnapshot } from "../contracts";

// An older read must never restore authority after a newer login/logout/reset.
export function createSessionRefresh(
  read: () => Promise<AuthSessionSnapshot>,
  apply: (session: AuthSessionSnapshot) => void,
) {
  let generation = 0;
  return {
    async refresh() {
      const requested = ++generation;
      const session = await read();
      if (requested === generation) apply(session);
      return session;
    },
    invalidate(session: AuthSessionSnapshot) {
      generation++;
      apply(session);
    },
  };
}
