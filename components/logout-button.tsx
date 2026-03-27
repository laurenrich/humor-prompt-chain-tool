"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const defaultClassName =
  "rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--muted-bg)]";

type LogoutButtonProps = {
  label?: string;
  className?: string;
};

/** Signs out and navigates to /login so middleware does not bounce non-admins back to /unauthorized. */
export function LogoutButton({ label = "Sign out", className = defaultClassName }: LogoutButtonProps) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className={className}
    >
      {label}
    </button>
  );
}
