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
 *
 * Month and day are BOTH read in UTC. Reading the month locally while the day
 * came from getUTCDate() printed impossible dates ("31 Nov" for a weekend
 * starting 2026-10-31T21:00Z, seen in IST) and could collapse a cross-month
 * range to a single month.
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const monthA = start.toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  });
  const monthB = end.toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  });
  const dayA = start.getUTCDate();
  const dayB = end.getUTCDate();
  if (monthA === monthB && dayA === dayB) return `${dayA} ${monthA}`;
  if (monthA === monthB) return `${dayA} - ${dayB} ${monthA}`;
  return `${dayA} ${monthA} - ${dayB} ${monthB}`;
}
