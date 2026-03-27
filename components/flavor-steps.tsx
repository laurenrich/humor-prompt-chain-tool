"use client";

import {
  createHumorFlavorStep,
  deleteHumorFlavorStep,
  reorderHumorFlavorSteps,
  updateHumorFlavorStep,
} from "@/app/actions/humor";
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

type StepRowProps = {
  step: HumorFlavorStep;
  flavorId: string;
  onSaved: () => void;
  dragHandle: ReactNode;
  style?: CSSProperties;
};

const FlavorStepRow = forwardRef<HTMLLIElement, StepRowProps>(function FlavorStepRow(
  { step, flavorId, onSaved, dragHandle, style },
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

  return (
    <li
      ref={ref}
      style={style}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm"
    >
      <div className="flex items-start gap-2">
        {dragHandle}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded bg-[var(--muted-bg)] px-1.5 py-0.5 font-medium text-[var(--foreground)]">
              Step {step.order_by}
            </span>
            <span>
              Almost Crackd substitutes placeholders in your prompts: use{" "}
              <code className="rounded bg-[var(--muted-bg)] px-1">{"{{previous}}"}</code> for the
              immediate prior step’s output (empty on step 1). Reference flavors often use{" "}
              <code className="rounded bg-[var(--muted-bg)] px-1">{"${step1Output}"}</code>,{" "}
              <code className="rounded bg-[var(--muted-bg)] px-1">{"${step2Output}"}</code>, etc., to
              pull specific earlier steps when a later step needs more than one.
            </span>
          </div>
          {editing ? (
            <div className="space-y-2">
              <label className="block text-xs text-[var(--muted)]">User prompt</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-sm"
              />
              <label className="block text-xs text-[var(--muted)]">
                System prompt (required by API; leave blank to use default)
              </label>
              <textarea
                value={systemText}
                onChange={(e) => setSystemText(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-sm"
              />
            </div>
          ) : (
            <>
              <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--foreground)]">
                {step.llm_user_prompt ?? ""}
              </pre>
              {step.llm_system_prompt ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  <span className="font-medium text-[var(--foreground)]">System:</span>{" "}
                  {step.llm_system_prompt}
                </p>
              ) : null}
            </>
          )}
          {error ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm text-white"
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
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
});

function SortableRow({
  step,
  flavorId,
  onSaved,
}: {
  step: HumorFlavorStep;
  flavorId: string;
  onSaved: () => void;
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
}: {
  step: HumorFlavorStep;
  flavorId: string;
  onSaved: () => void;
}) {
  return (
    <FlavorStepRow
      step={step}
      flavorId={flavorId}
      onSaved={onSaved}
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
    <div className="rounded-lg border border-dashed border-[var(--border)] p-4">
      <h3 className="mb-2 text-sm font-medium">New step</h3>
      <label className="mb-1 block text-xs text-[var(--muted)]">User prompt</label>
      <textarea
        value={newPrompt}
        onChange={(e) => setNewPrompt(e.target.value)}
        rows={4}
        placeholder="Step 1: image task. Later steps: {{previous}} and/or ${step1Output}, ${step2Output}, … per Almost Crackd."
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
      {!dndReady ? (
        <ul className="space-y-3">
          {steps.map((step) => (
            <StaticRow
              key={step.id}
              step={step}
              flavorId={flavorId}
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
            <ul className="space-y-3">
              {steps.map((step) => (
                <SortableRow
                  key={step.id}
                  step={step}
                  flavorId={flavorId}
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
