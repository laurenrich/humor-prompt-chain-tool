/**
 * humor_flavor_steps requires FKs to lookup tables. Set these in .env.local to match your DB IDs.
 *
 * Pipeline contract (matches Almost Crackd / course shape): the **first** step consumes the image /
 * initial input; later steps chain on prior text. Wrong IDs here make generate-captions ignore your
 * prompts or run a default chain.
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

function floatEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const x = Number.parseFloat(v);
  return Number.isFinite(x) ? x : fallback;
}

/** Default temperature for new/ synced steps (course reference uses 0.7). */
export function defaultLlmTemperature(): number {
  return floatEnv("HUMOR_DEFAULT_LLM_TEMPERATURE", 0.7);
}

/**
 * FKs for the step at `orderIndex` (0 = first in pipeline after sorting by order_by).
 * First step: image / initial input. Rest: chain on previous LLM output.
 */
export function humorFlavorStepFkForOrderIndex(orderIndex: number) {
  const isFirst = orderIndex === 0;
  return {
    llm_input_type_id: isFirst
      ? int2Env("HUMOR_FIRST_LLM_INPUT_TYPE_ID", 1)
      : int2Env("HUMOR_CHAIN_LLM_INPUT_TYPE_ID", 2),
    llm_output_type_id: int2Env("HUMOR_DEFAULT_LLM_OUTPUT_TYPE_ID", 2),
    llm_model_id: int2Env("HUMOR_DEFAULT_LLM_MODEL_ID", 1),
    humor_flavor_step_type_id: isFirst
      ? int2Env("HUMOR_FIRST_HUMOR_FLAVOR_STEP_TYPE_ID", 1)
      : int2Env("HUMOR_CHAIN_HUMOR_FLAVOR_STEP_TYPE_ID", 3),
  };
}
