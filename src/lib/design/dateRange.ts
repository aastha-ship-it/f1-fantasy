/**
 * Format a weekend date range using the locale's short month name.
 *
 *   formatDateRange("2026-05-02T00:00Z", "2026-05-04T00:00Z") → "2 May - 4 May"
 *   formatDateRange("2026-05-31T00:00Z", "2026-06-02T00:00Z") → "31 May - 1 Jun"
 *   formatDateRange("2026-05-04T00:00Z", "2026-05-04T00:00Z") → "4 May"
 *
 * Used on the dashboard hero, predict-list hero + rounds, and anywhere we
 * need to render a weekend's start–end span. Day-first, title-case month,
 * ASCII hyphen — matches the canvas.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const monthA = start.toLocaleDateString(undefined, { month: "short" });
  const monthB = end.toLocaleDateString(undefined, { month: "short" });
  const dayA = start.getUTCDate();
  const dayB = end.getUTCDate();
  if (monthA === monthB && dayA === dayB) return `${dayA} ${monthA}`;
  if (monthA === monthB) return `${dayA} - ${dayB} ${monthA}`;
  return `${dayA} ${monthA} - ${dayB} ${monthB}`;
}
