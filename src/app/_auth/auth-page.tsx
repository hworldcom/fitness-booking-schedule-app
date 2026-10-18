import { supabasePublicConfig } from "@/auth/config";
import { safeReturnTo } from "@/auth/return-to";
import {
  SignInScreen,
  type AuthenticationStage,
} from "@/features/auth/sign-in";

export type AuthenticationSearchParams = Promise<{
  returnTo?: string | string[];
  intent?: string | string[];
  reason?: string | string[];
  purpose?: string | string[];
  notice?: string | string[];
}>;
export async function AuthenticationPage({
  stage,
  searchParams,
}: {
  stage: AuthenticationStage;
  searchParams: AuthenticationSearchParams;
}) {
  const params = await searchParams;
  const config = supabasePublicConfig();
  return (
    <SignInScreen
      key={stage}
      stage={stage}
      returnTo={config ? safeReturnTo(params.returnTo, config.siteUrl) : "/"}
      intent={
        params.intent === "coach" || params.intent === "client"
          ? params.intent
          : null
      }
      accessRequired={params.reason === "forbidden"}
      emailPurpose={params.purpose === "recovery" ? "recovery" : "confirmation"}
      passwordUpdated={params.notice === "password-updated"}
    />
  );
}
