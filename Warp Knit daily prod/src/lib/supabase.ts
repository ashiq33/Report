import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const hasUrl = Boolean(url);
const hasKey = Boolean(key);
export const supabaseConfigError =
  hasUrl !== hasKey
    ? "Supabase configuration is incomplete. Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment, then redeploy."
    : !hasUrl && import.meta.env.PROD
      ? "Supabase is not configured for this production deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy."
      : hasUrl && (!url!.startsWith("https://") || url!.includes("YOUR-PROJECT"))
        ? "VITE_SUPABASE_URL is invalid. Use the Project URL from Supabase → Project Settings → Data API."
        : "";

export const isSupabaseConfigured = hasUrl && hasKey && !supabaseConfigError;
export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
