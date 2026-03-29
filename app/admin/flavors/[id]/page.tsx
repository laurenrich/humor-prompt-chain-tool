import {
  deleteHumorFlavor,
  updateHumorFlavor,
} from "@/app/actions/humor";
import { FlavorSteps } from "@/components/flavor-steps";
import { FlavorTestPanel } from "@/components/flavor-test-panel";
import { createClient } from "@/lib/supabase/server";
import type { HumorFlavor, HumorFlavorStep, HumorTestImage } from "@/types/humor";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

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

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/admin" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← All flavors
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">{f.slug}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {stepRows.length} {stepRows.length === 1 ? "step" : "steps"} · Drag to reorder in the pipeline below
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="#test"
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-[var(--success)] shadow-sm"
            style={{ background: "var(--success-bg)" }}
          >
            Test
          </Link>
        </div>
      </div>

      <section
        id="details"
        className="scroll-mt-24 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-card"
      >
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Flavor details</h2>
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

      <section id="steps" className="scroll-mt-24 space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Pipeline steps</h2>
        <FlavorSteps flavorId={String(f.id)} initialSteps={stepRows} />
      </section>

      <section id="test" className="scroll-mt-24">
        <FlavorTestPanel flavorId={String(f.id)} testImages={testImages} />
      </section>
    </div>
  );
}
