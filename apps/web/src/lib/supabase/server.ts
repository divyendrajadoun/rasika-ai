import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createSupabaseServer() {
  const jar = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list: Array<{ name: string; value: string; options: CookieOptions }>) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          /* called from a Server Component: middleware refreshes the session instead */
        }
      },
    },
  });
}
