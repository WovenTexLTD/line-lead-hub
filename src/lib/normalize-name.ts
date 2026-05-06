// Normalization for buyer/style autocomplete dedup + matching.
// Rules: trim leading/trailing whitespace, collapse multi-spaces, lowercase
// for comparison. Display values keep their original casing.

export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

// Display-clean a value: trim + collapse spaces, but preserve casing.
// Use this on values entered by the user before saving them.
export function cleanDisplayName(s: string | null | undefined): string {
  if (!s) return "";
  return s.trim().replace(/\s+/g, " ");
}
