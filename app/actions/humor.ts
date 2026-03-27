"use server";

import { createClient } from "@/lib/supabase/server";
import {
  runHumorFlavorPipeline,
  runHumorFlavorPipelineFromImageFile,
  type HumorFlavorPipelineResult,
} from "@/lib/almostcrackd";
import {
  defaultLlmSystemPrompt,
  humorFlavorStepFkDefaults,
} from "@/lib/humor-step-defaults";
import { slugifyFlavorName } from "@/lib/slugify";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin, is_matrix_admin")
    .eq("id", user.id)
    .maybeSingle();
  const ok =
    profile?.is_superadmin === true || profile?.is_matrix_admin === true;
  if (!ok) throw new Error("Not authorized");
  return { supabase, user };
}

export async function createHumorFlavor(data: {
  name: string;
  description?: string;
}) {
  const { supabase, user } = await requireAdmin();
  const slug = slugifyFlavorName(data.name);
  const now = new Date().toISOString();
  const { data: row, error } = await supabase
    .from("humor_flavors")
    .insert({
      slug,
      description: data.description ?? null,
      created_by_user_id: user.id,
      modified_by_user_id: user.id,
      created_datetime_utc: now,
      modified_datetime_utc: now,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/admin");
  return String(row!.id);
}

export async function updateHumorFlavor(
  id: string,
  data: { slug: string; description?: string | null },
) {
  const { supabase, user } = await requireAdmin();
  const slug = slugifyFlavorName(data.slug);
  const { error } = await supabase
    .from("humor_flavors")
    .update({
      slug,
      description: data.description ?? null,
      modified_by_user_id: user.id,
      modified_datetime_utc: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin");
  revalidatePath(`/admin/flavors/${id}`);
}

export async function deleteHumorFlavor(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("humor_flavors").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function createHumorFlavorStep(
  flavorId: string,
  data: { llm_user_prompt: string; llm_system_prompt?: string },
) {
  const { supabase, user } = await requireAdmin();
  const fk = humorFlavorStepFkDefaults();
  const now = new Date().toISOString();
  const { data: maxRow } = await supabase
    .from("humor_flavor_steps")
    .select("order_by")
    .eq("humor_flavor_id", flavorId)
    .order("order_by", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.order_by ?? 0) + 1;

  const system =
    data.llm_system_prompt?.trim() || defaultLlmSystemPrompt();

  const { error } = await supabase.from("humor_flavor_steps").insert({
    humor_flavor_id: flavorId,
    order_by: nextOrder,
    llm_user_prompt: data.llm_user_prompt,
    llm_system_prompt: system,
    llm_temperature: null,
    ...fk,
    created_by_user_id: user.id,
    modified_by_user_id: user.id,
    created_datetime_utc: now,
    modified_datetime_utc: now,
  });
  if (error) throw error;
  revalidatePath(`/admin/flavors/${flavorId}`);
}

export async function updateHumorFlavorStep(
  stepId: string,
  flavorId: string,
  data: { llm_user_prompt: string; llm_system_prompt?: string },
) {
  const { supabase, user } = await requireAdmin();
  const system =
    data.llm_system_prompt?.trim() || defaultLlmSystemPrompt();
  const { error } = await supabase
    .from("humor_flavor_steps")
    .update({
      llm_user_prompt: data.llm_user_prompt,
      llm_system_prompt: system,
      modified_by_user_id: user.id,
      modified_datetime_utc: new Date().toISOString(),
    })
    .eq("id", stepId)
    .eq("humor_flavor_id", flavorId);
  if (error) throw error;
  revalidatePath(`/admin/flavors/${flavorId}`);
}

export async function deleteHumorFlavorStep(stepId: string, flavorId: string) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("humor_flavor_steps")
    .delete()
    .eq("id", stepId);
  if (error) throw error;

  const { data: remaining } = await supabase
    .from("humor_flavor_steps")
    .select("id")
    .eq("humor_flavor_id", flavorId)
    .order("order_by", { ascending: true });

  const now = new Date().toISOString();
  if (remaining?.length) {
    for (let i = 0; i < remaining.length; i++) {
      await supabase
        .from("humor_flavor_steps")
        .update({
          order_by: i + 1,
          modified_by_user_id: user.id,
          modified_datetime_utc: now,
        })
        .eq("id", remaining[i].id);
    }
  }

  revalidatePath(`/admin/flavors/${flavorId}`);
}

export async function reorderHumorFlavorSteps(
  flavorId: string,
  orderedStepIds: (string | number)[],
) {
  const { supabase, user } = await requireAdmin();
  const now = new Date().toISOString();
  for (let i = 0; i < orderedStepIds.length; i++) {
    const { error } = await supabase
      .from("humor_flavor_steps")
      .update({
        order_by: i + 1,
        modified_by_user_id: user.id,
        modified_datetime_utc: now,
      })
      .eq("id", orderedStepIds[i])
      .eq("humor_flavor_id", flavorId);
    if (error) throw error;
  }
  revalidatePath(`/admin/flavors/${flavorId}`);
}

function normalizeImageUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid image URL (https://…)");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Image URL must start with http:// or https://");
  }
  return u.href;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Matches Almost Crackd presign supported types. */
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function normalizeImageMime(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

async function getFlavorPipelineContext(flavorId: string): Promise<{
  accessToken: string;
  stepOrders: number[];
}> {
  const { supabase, user } = await requireAdmin();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? "";

  const { data: flavorRow, error: fe } = await supabase
    .from("humor_flavors")
    .select("id")
    .eq("id", flavorId)
    .single();
  if (fe || !flavorRow) throw fe ?? new Error("Flavor not found");

  const { data: steps, error: se } = await supabase
    .from("humor_flavor_steps")
    .select("id, order_by, llm_user_prompt, llm_system_prompt")
    .eq("humor_flavor_id", flavorId)
    .order("order_by", { ascending: true });
  if (se) throw se;
  if (!steps?.length) throw new Error("Add at least one step first");

  /** API rejects generate-captions if any step has null system prompt — backfill legacy rows. */
  const defaultSys = defaultLlmSystemPrompt();
  const now = new Date().toISOString();
  for (const step of steps) {
    if (step.llm_system_prompt?.trim()) continue;
    const { error: ue } = await supabase
      .from("humor_flavor_steps")
      .update({
        llm_system_prompt: defaultSys,
        modified_by_user_id: user.id,
        modified_datetime_utc: now,
      })
      .eq("id", step.id);
    if (ue) throw ue;
  }
  revalidatePath(`/admin/flavors/${flavorId}`);

  const stepOrders = steps.map((s) => s.order_by);
  return { accessToken, stepOrders };
}

/** Persist a caption run for “read captions produced” (Week 8). Fails soft if table/schema differs. */
async function safeRecordHumorFlavorRun(input: {
  flavorId: string;
  testImageId: string | null;
  imageUrl: string | null;
  result: HumorFlavorPipelineResult;
}) {
  try {
    const { supabase, user } = await requireAdmin();
    const now = new Date().toISOString();
    const { error } = await supabase.from("humor_flavor_runs").insert({
      flavor_id: input.flavorId,
      test_image_id: input.testImageId,
      image_url: input.imageUrl,
      step_outputs: input.result.stepOutputs,
      final_captions: input.result.finalCaptions,
      created_by_user_id: user.id,
      modified_by_user_id: user.id,
      created_datetime_utc: now,
      modified_datetime_utc: now,
    });
    if (error) {
      console.error("[humor_flavor_runs insert]", error.message);
      return;
    }
    revalidatePath(`/admin/flavors/${input.flavorId}`);
  } catch (e) {
    console.error("[humor_flavor_runs]", e);
  }
}

/**
 * Generate captions from a public image URL (Assignment 5 pipeline).
 * Optional `testImageId` links the run to `humor_test_images` for the image test set.
 */
export async function runFlavorOnImageUrl(
  flavorId: string,
  imageUrl: string,
  options?: { testImageId?: string | null },
) {
  const resolvedUrl = normalizeImageUrl(imageUrl);
  const { accessToken, stepOrders } = await getFlavorPipelineContext(flavorId);

  const result = await runHumorFlavorPipeline({
    accessToken,
    imageUrl: resolvedUrl,
    humorFlavorId: flavorId,
    stepOrders,
  });
  await safeRecordHumorFlavorRun({
    flavorId,
    testImageId: options?.testImageId ?? null,
    imageUrl: resolvedUrl,
    result,
  });
  return result;
}

/**
 * Run the flavor on a row from `humor_test_images` (Week 8 “image test set”).
 */
export async function runFlavorOnTestImage(flavorId: string, testImageId: string) {
  const { supabase } = await requireAdmin();
  const { data: row, error } = await supabase
    .from("humor_test_images")
    .select("id, image_url")
    .eq("id", testImageId)
    .single();
  if (error || !row) throw new Error("Test image not found");
  return runFlavorOnImageUrl(flavorId, row.image_url, {
    testImageId: String(row.id),
  });
}

export async function runFlavorOnUploadedImage(
  flavorId: string,
  formData: FormData,
) {
  const file = formData.get("image");
  if (!(file instanceof File)) {
    throw new Error("No image file selected");
  }
  const contentType = normalizeImageMime(file.type || "image/jpeg");
  if (!ALLOWED_IMAGE_MIME.has(contentType)) {
    throw new Error(
      `Unsupported image type (${file.type || "unknown"}). Use JPEG, PNG, WebP, GIF, or HEIC.`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image must be under 10MB");
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const { accessToken, stepOrders } = await getFlavorPipelineContext(flavorId);

  const result = await runHumorFlavorPipelineFromImageFile({
    accessToken,
    fileBytes,
    contentType,
    humorFlavorId: flavorId,
    stepOrders,
  });
  await safeRecordHumorFlavorRun({
    flavorId,
    testImageId: null,
    imageUrl: null,
    result,
  });
  return result;
}
