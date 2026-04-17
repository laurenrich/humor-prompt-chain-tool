"use client";

import {
  createHumorFlavorStep,
  deleteHumorFlavorStep,
  reorderHumorFlavorSteps,
  updateHumorFlavorStep,
} from "@/app/actions/humor";
import {
  findNonStandardDollarPlaceholders,
  stepPromptHasSelfReferentialOutput,
} from "@/lib/almostcrackd-placeholders";
import type { HumorFlavorStep } from "@/types/humor";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  flavorId: string;
  initialSteps: HumorFlavorStep[];
};

/** Card title: uppercase for scanability, but keep `${step1Output}` / `{{previous}}` casing (Almost Crackd tokens). */
function stepHeadline(prompt: string | null | undefined, order: number): string {
  const raw = (prompt ?? "").trim().split(/\n/)[0] ?? "";
  if (!raw) return `Step ${order}`;
  const preserved: string[] = [];
  const masked = raw.replace(/\$\{[^}]+\}|\{\{[^}]+\}\}/g, (m) => {
    preserved.push(m);
    return `\0${preserved.length - 1}\0`;
  });
  let out = masked.toUpperCase();
  preserved.forEach((ph, i) => {
    out = out.replace(`\0${i}\0`, ph);
  });
  return out.length > 52 ? `${out.slice(0, 49)}…` : out;
}

type StepRowProps = {
  step: HumorFlavorStep;
  flavorId: string;
  onSaved: () => void;
  dragHandle: ReactNode;
  style?: CSSProperties;
  isLast: boolean;
};

const FlavorStepRow = forwardRef<HTMLLIElement, StepRowProps>(function FlavorStepRow(
  { step, flavorId, onSaved, dragHandle, style, isLast },
  ref,
) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(step.llm_user_prompt ?? "");
  const [systemText, setSystemText] = useState(step.llm_system_prompt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(step.llm_user_prompt ?? "");
    setSystemText(step.llm_system_prompt ?? "");
  }, [step.llm_user_prompt, step.llm_system_prompt]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateHumorFlavorStep(String(step.id), flavorId, {
        llm_user_prompt: text,
        llm_system_prompt: systemText,
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this step?")) return;
    setBusy(true);
    setError(null);
    try {
      await deleteHumorFlavorStep(String(step.id), flavorId);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const headline = stepHeadline(step.llm_user_prompt, step.order_by);
  const promptForLint = editing ? text : (step.llm_user_prompt ?? "");
  const selfRefStepOutput = stepPromptHasSelfReferentialOutput(
    promptForLint,
    step.order_by,
  );
  const oddDollarTokens = findNonStandardDollarPlaceholders(promptForLint);

  return (
    <li ref={ref} style={style} className="relative flex gap-4 pb-10 last:pb-0">
      <div className="flex shrink-0 flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white shadow-sm">
          {step.order_by}
        </div>
        {!isLast ? (
          <div
            className="mt-2 w-px flex-1 min-h-[1.5rem] bg-[var(--border)]"
            aria-hidden
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-[var(--accent)]">{headline}</h3>
          <div className="flex shrink-0 items-center gap-1">{dragHandle}</div>
        </div>
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">If this prompt uses tokens:</span>{" "}
          <code className="rounded bg-[var(--muted-bg)] px-1">{"{{previous}}"}</code>,{" "}
          <code className="rounded bg-[var(--muted-bg)] px-1">{"${step1Output}"}</code>,{" "}
          <code className="rounded bg-[var(--muted-bg)] px-1">{"${step2Output}"}</code>, … — use{" "}
          <code className="rounded bg-[var(--muted-bg)] px-1">{"${step1Output}"}</code>
          <span className="text-[var(--muted)]">-style casing, not</span>{" "}
          <code className="rounded bg-[var(--muted-bg)] px-1">{"${STEP1OUTPUT}"}</code>
          <span className="text-[var(--muted)]">
            . Plain-text-only prompts (no tokens) are fine too; the app does not require them.
          </span>
        </p>
        {selfRefStepOutput ? (
          <p className="mb-3 rounded-md border border-amber-400/80 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <span className="font-medium">Self-reference:</span> this step mentions{" "}
            <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/50">
              {"${step"}
              {step.order_by}
              {"Output}"}
            </code>{" "}
            in its <em>own</em> prompt—that output does not exist until this step finishes. Step 1 should not
            use <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/50">{"${step1Output}"}</code>.
            Step 2 should pull step 1’s text with{" "}
            <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/50">{"${step1Output}"}</code>, not{" "}
            <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/50">{"${step2Output}"}</code>, for
            the first model’s result.
          </p>
        ) : null}
        {oddDollarTokens.length > 0 ? (
          <p className="mb-3 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-[11px] leading-snug text-[var(--muted)]">
            <span className="font-medium text-[var(--foreground)]">Non-standard tokens:</span>{" "}
            {oddDollarTokens.join(", ")} — not documented for Almost Crackd; they may appear literally in the
            model input and break the chain.
          </p>
        ) : null}
        {editing ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  User prompt
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  System prompt
                </label>
                <textarea
                  value={systemText}
                  onChange={(e) => setSystemText(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-sm"
                  placeholder="Required by API; leave blank to use default"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  User prompt
                </p>
                <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--foreground)]">
                  {step.llm_user_prompt ?? ""}
                </pre>
              </div>
              {step.llm_system_prompt ? (
                <div className="mt-3 border-t border-[var(--border)] pt-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    System prompt
                  </p>
                  <p className="text-sm text-[var(--muted)]">{step.llm_system_prompt}</p>
                </div>
              ) : null}
            </>
          )}
          {error ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setText(step.llm_user_prompt ?? "");
                    setSystemText(step.llm_system_prompt ?? "");
                    setEditing(false);
                  }}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                  style={{ background: "var(--amber-bg)", color: "var(--amber)" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  Delete
                </button>
              </>
            )}
          </div>
      </div>
    </li>
  );
});

function SortableRow({
  step,
  flavorId,
  onSaved,
  isLast,
}: {
  step: HumorFlavorStep;
  flavorId: string;
  onSaved: () => void;
  isLast: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(step.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <FlavorStepRow
      ref={setNodeRef}
      style={style}
      step={step}
      flavorId={flavorId}
      onSaved={onSaved}
      isLast={isLast}
      dragHandle={
        <button
          type="button"
          className="mt-1 cursor-grab touch-none rounded px-1 text-[var(--muted)] hover:bg-[var(--muted-bg)]"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      }
    />
  );
}

function StaticRow({
  step,
  flavorId,
  onSaved,
  isLast,
}: {
  step: HumorFlavorStep;
  flavorId: string;
  onSaved: () => void;
  isLast: boolean;
}) {
  return (
    <FlavorStepRow
      step={step}
      flavorId={flavorId}
      onSaved={onSaved}
      isLast={isLast}
      dragHandle={
        <span
          className="mt-1 inline-block rounded px-1 text-[var(--muted)] opacity-60"
          aria-hidden
          title="Reorder available after load"
        >
          ⋮⋮
        </span>
      }
    />
  );
}

export function FlavorSteps({ flavorId, initialSteps }: Props) {
  const router = useRouter();
  const sorted = useMemo(
    () => [...initialSteps].sort((a, b) => a.order_by - b.order_by),
    [initialSteps],
  );
  const [steps, setSteps] = useState(sorted);
  const [newPrompt, setNewPrompt] = useState("");
  const [newSystem, setNewSystem] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** dnd-kit IDs (e.g. aria-describedby) differ SSR vs client — render DnD only after mount. */
  const [dndReady, setDndReady] = useState(false);

  useEffect(() => {
    setDndReady(true);
  }, []);

  useEffect(() => {
    setSteps(sorted);
  }, [sorted]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => String(s.id) === String(active.id));
    const newIndex = steps.findIndex((s) => String(s.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(steps, oldIndex, newIndex);
    setSteps(next);
    void reorderHumorFlavorSteps(
      flavorId,
      next.map((s) => String(s.id)),
    )
      .then(() => router.refresh())
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Reorder failed");
        setSteps(sorted);
      });
  }

  async function addStep() {
    if (!newPrompt.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await createHumorFlavorStep(flavorId, {
        llm_user_prompt: newPrompt.trim(),
        llm_system_prompt: newSystem.trim() || undefined,
      });
      setNewPrompt("");
      setNewSystem("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add step");
    } finally {
      setAdding(false);
    }
  }

  const newStepForm = (
    <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--muted-bg)]/40 p-5">
      <h3 className="mb-2 text-sm font-medium text-[var(--foreground)]">+ New step</h3>
      <label className="mb-1 block text-xs text-[var(--muted)]">User prompt</label>
      <textarea
        value={newPrompt}
        onChange={(e) => setNewPrompt(e.target.value)}
        rows={4}
        placeholder="Plain text or tokens — both OK. Example: only prose, or e.g. Context: ${step1Output} then your instructions."
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-sm"
      />
      <label className="mb-1 mt-2 block text-xs text-[var(--muted)]">
        System prompt (optional)
      </label>
      <textarea
        value={newSystem}
        onChange={(e) => setNewSystem(e.target.value)}
        rows={2}
        placeholder="Defaults if empty"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-sm"
      />
      <button
        type="button"
        disabled={adding}
        onClick={() => void addStep()}
        className="mt-2 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Add step
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted)]">
        <strong className="font-medium text-[var(--foreground)]">Run order:</strong> top → bottom.
        Step 1 runs first, then 2, then 3. Drag ⋮⋮ to reorder; that updates what Almost Crackd runs when you
        test.
      </p>
      <p className="text-xs text-[var(--muted)]">
        <strong className="font-medium text-[var(--foreground)]">Authoring:</strong> both patterns are supported—
        <span className="text-[var(--foreground)]"> plain instructions only</span> on every step (no{" "}
        <code className="rounded bg-[var(--muted-bg)] px-1 text-[10px]">{"${stepNOutput}"}</code>), or{" "}
        <span className="text-[var(--foreground)]">explicit chaining</span> where you put{" "}
        <code className="rounded bg-[var(--muted-bg)] px-1 text-[10px]">{"{{previous}}"}</code> /{" "}
        <code className="rounded bg-[var(--muted-bg)] px-1 text-[10px]">{"${step1Output}"}</code> in the text
        where you need prior output inlined. Same flavor can mix both (e.g. step 2 plain, step 3 with tokens).
      </p>
      {!dndReady ? (
        <ul className="list-none p-0">
          {steps.map((step, i) => (
            <StaticRow
              key={step.id}
              step={step}
              flavorId={flavorId}
              isLast={i === steps.length - 1}
              onSaved={() => router.refresh()}
            />
          ))}
        </ul>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={steps.map((s) => String(s.id))}
            strategy={verticalListSortingStrategy}
          >
            <ul className="list-none p-0">
              {steps.map((step, i) => (
                <SortableRow
                  key={step.id}
                  step={step}
                  flavorId={flavorId}
                  isLast={i === steps.length - 1}
                  onSaved={() => router.refresh()}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {newStepForm}
    </div>
  );
}
