function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set, see .env.example`);
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

// Safe in the browser: no privileges of its own, everything still goes
// through RLS. Falls back to the legacy anon key for older projects.
export const supabasePublishableKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

// Server only, bypasses RLS. Used by the cron nudge, which has no signed-in
// user and so no JWT for the policies to check.
export const supabaseSecretKey = () =>
  required(
    "SUPABASE_SECRET_KEY",
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
