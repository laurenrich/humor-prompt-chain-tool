/**
 * humor_flavor_steps requires FKs to lookup tables. Set these in .env.local to match your DB IDs.
 * Defaults are 1 — only work if those rows exist in your llm_* / humor_* reference tables.
 */

/** Almost Crackd requires a non-null system prompt per step for generate-captions. */
export function defaultLlmSystemPrompt(): string {
  const v = process.env.HUMOR_DEFAULT_LLM_SYSTEM_PROMPT?.trim();
  if (v) return v;
  return "You are a helpful assistant.";
}

function int2Env(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const x = Number.parseInt(v, 10);
  return Number.isFinite(x) ? x : fallback;
}

export function humorFlavorStepFkDefaults() {
  return {
    llm_input_type_id: int2Env("HUMOR_DEFAULT_LLM_INPUT_TYPE_ID", 1),
    llm_output_type_id: int2Env("HUMOR_DEFAULT_LLM_OUTPUT_TYPE_ID", 1),
    llm_model_id: int2Env("HUMOR_DEFAULT_LLM_MODEL_ID", 1),
    humor_flavor_step_type_id: int2Env(
      "HUMOR_DEFAULT_HUMOR_FLAVOR_STEP_TYPE_ID",
      1,
    ),
  };
}
