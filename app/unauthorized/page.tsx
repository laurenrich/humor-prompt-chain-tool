import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function UnauthorizedPage() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center bg-[var(--background)] px-4 py-16 text-center text-[var(--foreground)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-8">
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This tool is only available when your profile has{" "}
          <code className="rounded bg-[var(--background)] px-1 py-0.5 font-mono text-xs">
            is_superadmin
          </code>{" "}
          or{" "}
          <code className="rounded bg-[var(--background)] px-1 py-0.5 font-mono text-xs">
            is_matrix_admin
          </code>{" "}
          set to true.
        </p>
        <LogoutButton
          label="Back to sign in"
          className="mt-6 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        />
      </div>
    </div>
  );
}
