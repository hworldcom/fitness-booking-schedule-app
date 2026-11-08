import type { Metadata } from "next";
import { PrivacyNotice } from "@/features/public/privacy-notice";
import "@/features/public/privacy-notice.css";

export const metadata: Metadata = {
  title: "Privacy notice",
  description:
    "How MovX handles account, coaching, booking and training information, including Google sign-in, retention and privacy requests.",
  alternates: { canonical: "https://movx.club/privacy" },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <PrivacyNotice />;
}
