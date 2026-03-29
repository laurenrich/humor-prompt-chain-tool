import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin, is_matrix_admin")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.is_superadmin === true || profile?.is_matrix_admin === true;

    if (isAdmin) redirect("/admin");
    redirect("/unauthorized");
  }

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center bg-[var(--background)] px-4 py-24 text-[var(--foreground)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Humor Flavors</h1>
        <p className="mt-3 text-[var(--muted)]">
          Build prompt chains for image captions — sign in to manage flavors and steps.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
