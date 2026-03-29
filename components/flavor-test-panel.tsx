"use client";

import {
  runFlavorOnTestImage,
  runFlavorOnUploadedImage,
} from "@/app/actions/humor";
import type { HumorFlavorPipelineResult } from "@/lib/almostcrackd";
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
  const [lastResult, setLastResult] = useState<HumorFlavorPipelineResult | null>(null);
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
    setLastResult(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await runFlavorOnUploadedImage(flavorId, fd);
      setLastResult(res);
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
    setLastResult(null);
    try {
      const res = await runFlavorOnTestImage(flavorId, testImageId);
      setLastResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-card">
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Test this flavor</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Runs use this page’s <code className="text-xs">humorFlavorId</code> and your session. Wording can vary between
          runs; the flavor id does not.
        </p>
      </div>

      {testImages.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">Image test set</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Curated URLs from <code className="font-mono text-xs">humor_test_images</code>.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Test image</span>
              <select
                value={testImageId}
                onChange={(e) => setTestImageId(e.target.value)}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
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
              className="h-12 w-full rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              style={{ background: "var(--success)" }}
            >
              {busy ? "Running…" : "Generate captions"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
        <h3 className="text-sm font-medium text-[var(--foreground)]">Upload an image</h3>
        <label className="mt-3 flex flex-col gap-2 text-sm">
          <span className="text-[var(--muted)]">Image file</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        </label>
        <button
          type="button"
          disabled={busy || !file}
          onClick={() => void runUpload()}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white shadow-sm disabled:opacity-50"
          style={{ background: "var(--success)" }}
        >
          <span aria-hidden>🚀</span>
          {busy ? "Running…" : "Generate captions"}
        </button>
      </div>

      {previewBlobUrl ? (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewBlobUrl} alt="" className="max-h-56 w-full object-cover" />
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {lastResult ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-[var(--foreground)]">Generated captions</h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color: "var(--success)", background: "var(--success-bg)" }}
            >
              {lastResult.finalCaptions.length}{" "}
              {lastResult.finalCaptions.length === 1 ? "line" : "lines"}
            </span>
          </div>
          <ol className="mt-4 space-y-3">
            {lastResult.finalCaptions.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: "var(--success)" }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 leading-relaxed text-[var(--foreground)]">{c}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
