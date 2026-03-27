import type { HumorFlavorRun } from "@/types/humor";

type Props = {
  runs: HumorFlavorRun[];
};

export function FlavorRunHistory({ runs }: Props) {
  if (!runs.length) {
    return (
      <section className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)]">
        <h2 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Caption history</h2>
        <p>No runs yet. Generate captions below; successful runs are stored here when your database includes{" "}
        <code className="rounded bg-[var(--muted-bg)] px-1 text-xs">humor_flavor_runs</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Caption history</h2>
      <p className="text-sm text-[var(--muted)]">
        Recent caption runs for this flavor (Week 8: read captions produced).
      </p>
      <ul className="space-y-4">
        {runs.map((run) => (
          <li
            key={run.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--muted)]">
              <time dateTime={run.created_at}>
                {new Date(run.created_at).toLocaleString()}
              </time>
              {run.test_image_id ? (
                <span className="font-mono">test_image_id: {run.test_image_id.slice(0, 8)}…</span>
              ) : (
                <span>Upload / URL</span>
              )}
            </div>
            {run.image_url ? (
              <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]" title={run.image_url}>
                {run.image_url}
              </p>
            ) : null}
            {run.final_captions?.length ? (
              <ul className="mt-2 list-disc pl-5">
                {run.final_captions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[var(--muted)]">(no captions parsed)</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
