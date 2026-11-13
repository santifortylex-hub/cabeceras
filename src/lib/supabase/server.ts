import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminJs } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* Server Component: el refresco lo hace proxy.ts */
          }
        },
      },
    },
  );
}

/** Cliente con service role: SOLO en servidor (jobs, alta de usuarios). */
export function createAdminClient() {
  return createAdminJs(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
