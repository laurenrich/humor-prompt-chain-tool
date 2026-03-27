/** URL-safe slug for humor_flavors.slug (varchar unique). */
export function slugifyFlavorName(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "flavor";
}
