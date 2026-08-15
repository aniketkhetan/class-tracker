"use client";

import { useState } from "react";

import { buttonStyles, Card } from "@/app/_components/ui";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center p-4">
      <Card title="Class tracker">
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Sign in to confirm your classes.
        </p>

        <button
          className={`${buttonStyles.primary} w-full`}
          onClick={signIn}
          disabled={busy}
        >
          {busy ? "Redirecting…" : "Continue with GitHub"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </Card>
    </main>
  );
}
