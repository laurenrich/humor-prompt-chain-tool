"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const err = searchParams.get("error");

  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const origin = window.location.origin;
    // Must match Supabase "Redirect URLs" exactly — query strings often fail validation
    // ("requested path is invalid"). Post-login destination defaults in /auth/callback.
    const redirectTo = `${origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    setMessage("Could not start Google sign-in.");
    setLoading(false);
  }

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center bg-[var(--background)] px-4 py-16 text-[var(--foreground)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Use your Google account. The admin console is only for matrix or superadmin profiles.
        </p>
        {err ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Authentication failed. Try again.
          </p>
        ) : null}
        <div className="mt-6">
          <button
            type="button"
            disabled={loading}
            onClick={() => void signInWithGoogle()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm hover:bg-[var(--muted-bg)] disabled:opacity-50"
          >
            <GoogleGlyph />
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>
          {message ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{message}</p>
          ) : null}
        </div>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          <Link className="text-[var(--accent)] underline" href="/">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
