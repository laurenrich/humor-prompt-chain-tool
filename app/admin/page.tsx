import { createHumorFlavor } from "@/app/actions/humor";
import { DeleteFlavorButton } from "@/components/delete-flavor-button";
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

  const { data: stepRows } = await supabase.from("humor_flavor_steps").select("humor_flavor_id");
  const stepCountByFlavor = new Map<string, number>();
  for (const row of stepRows ?? []) {
    const k = String((row as { humor_flavor_id: string | number }).humor_flavor_id);
    stepCountByFlavor.set(k, (stepCountByFlavor.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Humor Flavors</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Create flavors, add steps, then test on an image.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-card">
        <h2 className="text-sm font-medium text-[var(--foreground)]">New flavor</h2>
        <form action={createFlavor} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Name</span>
            <input
              name="name"
              required
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
              placeholder="e.g. LinkedIn speak"
            />
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Description (optional)</span>
            <input
              name="description"
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3"
              placeholder="Short notes for your team"
            />
          </label>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-lg bg-[var(--accent)] px-5 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            + Create
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Your flavors</h2>
        {list.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No flavors yet. Create one above.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {list.map((f) => {
              const n = stepCountByFlavor.get(String(f.id)) ?? 0;
              const fid = String(f.id);
              const base = `/admin/flavors/${fid}`;
              return (
                <li
                  key={f.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-card"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={base}
                          className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
                        >
                          {f.slug}
                        </Link>
                        <span className="rounded-full bg-[var(--accent)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--accent)]">
                          {n} {n === 1 ? "step" : "steps"}
                        </span>
                      </div>
                      {f.description ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">{f.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Updated {new Date(f.modified_datetime_utc).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`${base}#steps`}
                        className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--muted-bg)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--border)]/60"
                      >
                        Steps
                      </Link>
                      <Link
                        href={`${base}#test`}
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-[var(--success)]"
                        style={{ background: "var(--success-bg)" }}
                      >
                        Test
                      </Link>
                      <Link
                        href={`${base}#details`}
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ color: "var(--amber)", background: "var(--amber-bg)" }}
                      >
                        Edit
                      </Link>
                      <DeleteFlavorButton flavorId={fid} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
