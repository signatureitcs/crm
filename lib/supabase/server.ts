import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Server (server component / route handler / server action) Supabase client.
// Uses the anon key + the signed-in user's session cookies, so RLS applies.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if middleware refreshes sessions.
          }
        },
      },
    },
  );
}

// Service-role client for privileged server-only operations (never expose
// the key to the browser). Uses the plain supabase-js client, which is the
// correct one for auth.admin calls. Throws a clear error if misconfigured.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — add it to your environment (Vercel project settings) to create users.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
