"use client";

import {
  duplicateHumorFlavor,
  isHumorFlavorNameAvailable,
} from "@/app/actions/humor";
import { slugifyFlavorName } from "@/lib/slugify";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  sourceFlavorId: string;
  placeholder: string;
};

export function DuplicateFlavorForm({ sourceFlavorId, placeholder }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewSlug = name.trim() ? slugifyFlavorName(name) : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for the copy.");
      return;
    }
    setBusy(true);
    try {
      const ok = await isHumorFlavorNameAvailable(trimmed);
      if (!ok) {
        setError(
          "That name is already taken (another flavor uses the same slug). Try a different name.",
        );
        return;
      }
      const newId = await duplicateHumorFlavor(sourceFlavorId, trimmed);
      router.push(`/admin/flavors/${newId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="duplicate"
      onSubmit={(e) => void onSubmit(e)}
      className="mt-4 scroll-mt-24 border-t border-[var(--border)] pt-4"
    >
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        Duplicate flavor
      </h3>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Creates a new flavor with a new slug and copies all pipeline steps (prompts, model IDs, order).
      </p>
      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">New name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder={placeholder}
          className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-2"
          disabled={busy}
          aria-invalid={error != null}
        />
      </label>
      {previewSlug ? (
        <p className="mt-1 text-[10px] text-[var(--muted)]">
          Slug will be: <code className="rounded bg-[var(--muted-bg)] px-1">{previewSlug}</code>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted-bg)] disabled:opacity-50"
      >
        {busy ? "Duplicating…" : "Duplicate with new name"}
      </button>
    </form>
  );
}
