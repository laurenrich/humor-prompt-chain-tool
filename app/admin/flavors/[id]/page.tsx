import {
  deleteHumorFlavor,
  updateHumorFlavor,
} from "@/app/actions/humor";
import { FlavorRunHistory } from "@/components/flavor-run-history";
import { FlavorSteps } from "@/components/flavor-steps";
import { FlavorTestPanel } from "@/components/flavor-test-panel";
import { createClient } from "@/lib/supabase/server";
import type {
  HumorFlavor,
  HumorFlavorRun,
  HumorFlavorStep,
  HumorTestImage,
} from "@/types/humor";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

function normalizeFinalCaptions(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) return raw;
  return [];
}

async function saveFlavor(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!id || !slug) return;
  await updateHumorFlavor(id, { slug, description: description || null });
  redirect(`/admin/flavors/${id}`);
}

async function removeFlavor(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteHumorFlavor(id);
  redirect("/admin");
}

export default async function FlavorDetailPage(props: PageProps) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: flavor, error: fe } = await supabase
    .from("humor_flavors")
    .select("id, slug, description, created_datetime_utc, modified_datetime_utc")
    .eq("id", id)
    .single();

  if (fe || !flavor) notFound();

  const { data: steps, error: se } = await supabase
    .from("humor_flavor_steps")
    .select(
      "id, humor_flavor_id, order_by, llm_user_prompt, llm_system_prompt, created_datetime_utc, modified_datetime_utc",
    )
    .eq("humor_flavor_id", id)
    .order("order_by", { ascending: true });

  if (se) {
    return (
      <p className="text-sm text-red-600">
        Failed to load steps: {se.message}
      </p>
    );
  }

  const f = flavor as HumorFlavor;
  const stepRows = (steps ?? []) as HumorFlavorStep[];

  const { data: testImageRows, error: te } = await supabase
    .from("humor_test_images")
    .select("id, label, image_url, sort_order")
    .order("sort_order", { ascending: true });

  const testImages = (!te && testImageRows ? testImageRows : []) as HumorTestImage[];

  const { data: runRows, error: runErr } = await supabase
    .from("humor_flavor_runs")
    .select(
      "id, flavor_id, test_image_id, image_url, step_outputs, final_captions, created_at",
    )
    .eq("flavor_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const captionRuns: HumorFlavorRun[] =
    !runErr && runRows
      ? (runRows.map((r) => ({
          ...r,
          step_outputs: Array.isArray(r.step_outputs)
            ? (r.step_outputs as HumorFlavorRun["step_outputs"])
            : [],
          final_captions: normalizeFinalCaptions(r.final_captions),
        })) as HumorFlavorRun[])
      : [];

  return (
    <div className="space-y-10">
      <div>
        <Link href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          ← All flavors
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{f.slug}</h1>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-sm font-medium">Flavor details</h2>
        <form action={saveFlavor} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={f.id} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Slug</span>
            <input
              name="slug"
              defaultValue={f.slug}
              required
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Description</span>
            <textarea
              name="description"
              defaultValue={f.description ?? ""}
              rows={2}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white"
            >
              Save
            </button>
          </div>
        </form>
        <form action={removeFlavor} className="mt-4 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="id" value={f.id} />
          <button
            type="submit"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
          >
            Delete flavor
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Steps</h2>
        <FlavorSteps flavorId={String(f.id)} initialSteps={stepRows} />
      </section>

      <FlavorTestPanel flavorId={String(f.id)} testImages={testImages} />

      <FlavorRunHistory runs={captionRuns} />
    </div>
  );
}
