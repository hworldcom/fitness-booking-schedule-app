const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = /^\d{6}$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeEmailOtp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.replace(/\s+/g, "");
  return OTP_PATTERN.test(token) ? token : null;
}

type AuthErrorDetails = Readonly<{
  message: string;
  status: number | null;
}>;

function authErrorDetails(error: unknown): AuthErrorDetails {
  if (!error || typeof error !== "object") {
    return { message: "", status: null };
  }
  const candidate = error as { message?: unknown; status?: unknown };
  return {
    message:
      typeof candidate.message === "string"
        ? candidate.message.toLowerCase()
        : "",
    status: typeof candidate.status === "number" ? candidate.status : null,
  };
}

export function emailOtpErrorMessage(
  error: unknown,
  action: "request" | "verify",
) {
  const { message, status } = authErrorDetails(error);
  if (message.includes("npm run auth:start")) {
    return "Local Supabase Auth is unreachable. Run npm run auth:start from the project directory, wait for it to report ready, then try again.";
  }
  if (status === 429 || message.includes("rate limit")) {
    return "Too many code attempts were made. Wait a few minutes before trying again.";
  }
  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("could not be reached") ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return "The authentication service is unavailable. Public browsing still works; try again shortly.";
  }
  if (action === "verify") {
    return "That code is invalid or expired. Request a new code and try again.";
  }
  return "We couldn’t send a sign-in code. Check the email address and try again.";
}
