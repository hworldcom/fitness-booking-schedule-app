import type { Metadata } from "next";
import {
  AuthenticationPage,
  type AuthenticationSearchParams,
} from "../_auth/auth-page";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page({
  searchParams,
}: {
  searchParams: AuthenticationSearchParams;
}) {
  return <AuthenticationPage stage="sign-in" searchParams={searchParams} />;
}
