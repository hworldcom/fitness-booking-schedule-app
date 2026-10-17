"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  SIGNED_OUT_AUTH_SESSION,
  type AuthSessionSnapshot,
} from "../contracts";
import { authenticationGateway } from "./authentication-gateway";
import { fetchVerifiedAuthSession } from "./session-client";
import { createSessionRefresh } from "./session-refresh";

type AuthSessionContextValue = Readonly<{
  session: AuthSessionSnapshot;
  refreshSession: () => Promise<AuthSessionSnapshot>;
}>;

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: AuthSessionSnapshot;
}) {
  const [session, setSession] = useState(initialSession);
  const [controller] = useState(() =>
    createSessionRefresh(fetchVerifiedAuthSession, setSession),
  );
  const refreshSession = controller.refresh;

  useEffect(() => {
    return authenticationGateway.subscribe((event) => {
      if (event === "signed-out") {
        controller.invalidate(SIGNED_OUT_AUTH_SESSION);
        return;
      }
      if (event === "session-changed") {
        queueMicrotask(() => void refreshSession());
      }
    });
  }, [controller, refreshSession]);

  return (
    <AuthSessionContext.Provider value={{ session, refreshSession }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }
  return context;
}
