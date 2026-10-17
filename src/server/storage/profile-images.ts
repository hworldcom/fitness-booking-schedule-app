import "server-only";

import { createSupabaseProfileImageStorage } from "./supabase-profile-images";

// The adapter stores no Auth client, cookies, token or per-request result.
// Each I/O call obtains its own current-request client through the Auth boundary.
export const profileImageStorage = createSupabaseProfileImageStorage();
