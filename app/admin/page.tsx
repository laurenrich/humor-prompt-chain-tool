import { createHumorFlavor } from "@/app/actions/humor";
import { createClient } from "@/lib/supabase/server";
import type { HumorFlavor } from "@/types/humor";
import Link from "next/link";
import { redirect } from "next/navigation";

async function createFlavor(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;
  await createHumorFlavor({ name, description: description || undefined });
  redirect("/admin");
}

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: flavors, error } = await supabase
    .from("humor_flavors")
    .select("id, slug, description, created_datetime_utc, modified_datetime_utc")
    .order("modified_datetime_utc", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        Could not load humor flavors. Confirm env vars point at the shared project, tables exist as
        provided by the course, and RLS allows your signed-in user.{" "}
        <span className="font-mono">{error.message}</span>
      </div>
    );
  }

  const list = (flavors ?? []) as HumorFlavor[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Humor flavors</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Each flavor is an ordered chain of prompts. The first step can use an image URL you paste
          when testing; later steps build on prior output.
        </p>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-medium">Create flavor</h2>
        <form action={createFlavor} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Name</span>
            <input
              name="name"
              required
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-2"
              placeholder="e.g. Dog captions"
            />
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Description (optional)</span>
            <input
              name="description"
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-2"
              placeholder="Short notes for your team"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Create
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Your flavors</h2>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No flavors yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--card)]">
            {list.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    href={`/admin/flavors/${f.id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {f.slug}
                  </Link>
                  {f.description ? (
                    <p className="mt-0.5 text-sm text-[var(--muted)]">{f.description}</p>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Updated {new Date(f.modified_datetime_utc).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
