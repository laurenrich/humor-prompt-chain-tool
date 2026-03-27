/** Matches public.humor_flavors (int8 id, slug, …). */
export type HumorFlavor = {
  id: number | string;
  slug: string;
  description: string | null;
  created_datetime_utc: string;
  modified_datetime_utc: string;
};

/** Matches public.humor_flavor_steps (int8 id, humor_flavor_id, order_by, llm_user_prompt, …). */
export type HumorFlavorStep = {
  id: number | string;
  humor_flavor_id: number | string;
  order_by: number;
  llm_user_prompt: string | null;
  llm_system_prompt?: string | null;
  created_datetime_utc?: string;
  modified_datetime_utc?: string;
};

/** public.humor_test_images */
export type HumorTestImage = {
  id: string;
  label: string | null;
  image_url: string;
  sort_order: number;
};

/** public.humor_flavor_runs */
export type HumorFlavorRun = {
  id: string;
  flavor_id: string;
  test_image_id: string | null;
  image_url: string | null;
  step_outputs: { step_order: number; output: string }[];
  final_captions: string[] | null;
  created_at: string;
};
