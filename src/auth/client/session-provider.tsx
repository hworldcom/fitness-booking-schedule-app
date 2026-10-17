"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SIGNED_OUT_AUTH_SESSION,
  type AuthSessionSnapshot,
} from "../contracts";
import { authenticationGateway } from "./authentication-gateway";
import { fetchVerifiedAuthSession } from "./session-client";

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
  const refreshPromise = useRef<Promise<AuthSessionSnapshot> | null>(null);

  const refreshSession = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;

    const request = fetchVerifiedAuthSession()
      .then((nextSession) => {
        setSession(nextSession);
        return nextSession;
      })
      .finally(() => {
        refreshPromise.current = null;
      });

    refreshPromise.current = request;
    return request;
  }, []);

  useEffect(() => {
    return authenticationGateway.subscribe((event) => {
      if (event === "signed-out") {
        setSession(SIGNED_OUT_AUTH_SESSION);
        return;
      }
      if (event === "session-changed") {
        queueMicrotask(() => void refreshSession());
      }
    });
  }, [refreshSession]);

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
