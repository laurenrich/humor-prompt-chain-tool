/**
 * Almost Crackd replaces ${step1Output}, ${step2Output}, … after each LLM step.
 * Substitutions are typically exact-match; `${STEP2OUTPUT}` is left as literal text and breaks chaining.
 */
export function normalizeAlmostCrackdStepPlaceholders(text: string): string {
  return text.replace(
    /\$\{STEP(\d+)OUTPUT\}/gi,
    (_, digits: string) => "${step" + digits + "Output}",
  );
}

function isDocumentedStepOutputToken(inner: string): boolean {
  return /^step\s*\d+\s*output$/i.test(inner.trim());
}

/** True if the prompt uses `${stepNOutput}` where N is this step’s run order (that output does not exist yet). */
export function stepPromptHasSelfReferentialOutput(
  prompt: string,
  stepOrder: number,
): boolean {
  const re = new RegExp(`\\$\\{step\\s*${stepOrder}\\s*Output\\}`, "i");
  return re.test(prompt);
}

/**
 * `${...}` tokens that are not `stepNOutput` (documented). e.g. `${imageAdditionalContext}` is not substituted unless the backend defines it.
 */
export function findNonStandardDollarPlaceholders(prompt: string): string[] {
  const out = new Set<string>();
  const re = /\$\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const inner = m[1].trim();
    if (!isDocumentedStepOutputToken(inner)) {
      out.add(m[0]);
    }
  }
  return [...out];
}
