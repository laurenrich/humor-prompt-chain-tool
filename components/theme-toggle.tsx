"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
      <span className="sr-only">Theme</span>
      <select
        suppressHydrationWarning
        value={theme ?? "system"}
        onChange={(e) => setTheme(e.target.value)}
        className="h-9 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-[var(--foreground)]"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
