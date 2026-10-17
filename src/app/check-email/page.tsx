import type { Metadata } from "next";
import {
  AuthenticationPage,
  type AuthenticationSearchParams,
} from "../_auth/auth-page";

export const metadata: Metadata = {
  title: "Check your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page({
  searchParams,
}: {
  searchParams: AuthenticationSearchParams;
}) {
  return <AuthenticationPage stage="check-email" searchParams={searchParams} />;
}
