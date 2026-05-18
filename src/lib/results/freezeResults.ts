/**
 * Freeze rule for the automatic/OpenF1 results path (changes.md §7).
 *
 * Pure + unit-tested. The OpenF1 fetch (admin "Fetch from OpenF1" button or
 * the nightly cron) must NOT modify an existing results row once it is
 * admin-entered OR the event has been revealed — that would re-score a
 * locked-in / revealed event. Before reveal, an `openf1` row may still be
 * refreshed (provisional → official). Admin manual entry bypasses this
 * entirely (it is the override and always wins).
 */
export function isResultsFrozenForAuto(input: {
  existingSource: "openf1" | "admin" | null;
  revealedAt: string | null;
}): boolean {
  return input.existingSource === "admin" || input.revealedAt != null;
}
