"use client";

import {
  runFlavorOnTestImage,
  runFlavorOnUploadedImage,
} from "@/app/actions/humor";
import type { HumorTestImage } from "@/types/humor";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  flavorId: string;
  /** Rows from `humor_test_images` — image test set (Week 8). */
  testImages?: HumorTestImage[];
};

export function FlavorTestPanel({ flavorId, testImages = [] }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string[] | null>(null);
  const [testImageId, setTestImageId] = useState<string>("");

  useEffect(() => {
    if (!file) {
      setPreviewBlobUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreviewBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function runUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setLast(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await runFlavorOnUploadedImage(flavorId, fd);
      setLast(res.finalCaptions);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function runTestSet() {
    if (!testImageId) return;
    setBusy(true);
    setError(null);
    setLast(null);
    try {
      const res = await runFlavorOnTestImage(flavorId, testImageId);
      setLast(res.finalCaptions);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <h2 className="text-lg font-semibold">Test this flavor</h2>
      <p className="text-sm text-[var(--muted)]">
        Uses Almost Crackd with this flavor’s id. Placeholders: {"{{previous}}"},{" "}
        {"${step1Output}"}, etc. Runs are saved to caption history when{" "}
        <code className="rounded bg-[var(--muted-bg)] px-1 text-xs">humor_flavor_runs</code> exists.
        Often 30–90s.
      </p>

      {testImages.length > 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
          <h3 className="text-sm font-medium">Image test set</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Week 8: generate captions from a curated URL in <code className="font-mono">humor_test_images</code>.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Test image</span>
              <select
                value={testImageId}
                onChange={(e) => setTestImageId(e.target.value)}
                className="h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
              >
                <option value="">Select…</option>
                {testImages.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label?.trim() || t.image_url.slice(0, 48)}…
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !testImageId}
              onClick={() => void runTestSet()}
              className="h-10 shrink-0 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Running…" : "Generate from test image"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
        <h3 className="text-sm font-medium">Upload an image</h3>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Image file</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
              }}
              className="text-sm file:mr-2 file:rounded file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
          </label>
          <button
            type="button"
            disabled={busy || !file}
            onClick={() => void runUpload()}
            className="h-10 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Running…" : "Generate from upload"}
          </button>
        </div>
      </div>

      {previewBlobUrl ? (
        <div className="overflow-hidden rounded-md border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewBlobUrl} alt="" className="max-h-48 w-full object-cover" />
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {last ? (
        <div className="text-sm">
          <h3 className="font-medium">Output</h3>
          <ul className="mt-2 list-disc pl-5">
            {last.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
