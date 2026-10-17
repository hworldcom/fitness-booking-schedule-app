"use client";

import { createAuthenticationGateway } from "../gateway";
import { supabaseAuthenticationAdapter } from "./supabase-auth-adapter";
import { fetchVerifiedAuthSession } from "./session-client";

export const authenticationGateway = createAuthenticationGateway(
  supabaseAuthenticationAdapter,
  fetchVerifiedAuthSession,
);
