export type AuthServiceUnavailableCopy = Readonly<{
  title: string;
  detail: string;
  recoveryCommand: string | null;
}>;

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLocalAuthServiceUrl(value: string) {
  const hostname = parsedUrl(value)?.hostname.toLowerCase();
  if (!hostname) return false;

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

export function authServiceTransportErrorMessage(supabaseUrl: string) {
  if (isLocalAuthServiceUrl(supabaseUrl)) {
    const origin = parsedUrl(supabaseUrl)?.origin ?? "the configured endpoint";
    return `Local Supabase Auth at ${origin} could not be reached. Run "npm run auth:start", wait for Supabase to report ready, then retry.`;
  }

  return "The configured Supabase Auth service could not be reached. Check service health and network connectivity, then retry.";
}

export function authServiceUnavailableCopy(
  supabaseUrl: string,
): AuthServiceUnavailableCopy {
  if (isLocalAuthServiceUrl(supabaseUrl)) {
    const origin = parsedUrl(supabaseUrl)?.origin ?? "the local endpoint";
    return Object.freeze({
      title: "Local Supabase Auth is unreachable.",
      detail: `The app could not reach ${origin}. Start the local Auth stack, wait for Supabase to report ready, then check again. No signed-in state is being assumed.`,
      recoveryCommand: "npm run auth:start",
    });
  }

  return Object.freeze({
    title: "The sign-in service is unreachable.",
    detail:
      "MovX Club could not contact its configured authentication service. Check service health and network access, then try again. No signed-in state is being assumed.",
    recoveryCommand: null,
  });
}

export function createAuthServiceFetch(
  supabaseUrl: string,
  fetchImplementation: typeof fetch = globalThis.fetch,
): typeof fetch {
  const authFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    try {
      return await fetchImplementation(input, init);
    } catch (cause) {
      if (
        cause &&
        typeof cause === "object" &&
        "name" in cause &&
        cause.name === "AbortError"
      ) {
        throw cause;
      }
      throw new Error(authServiceTransportErrorMessage(supabaseUrl), {
        cause,
      });
    }
  };

  return authFetch as typeof fetch;
}
