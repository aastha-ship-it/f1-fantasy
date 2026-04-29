/**
 * Shared OpenF1 fetch primitives. Used by:
 *   - CLI seed scripts (`scripts/seed-calendar.ts`, `scripts/seed-drivers.ts`)
 *   - Nightly cron endpoint (`/api/cron/sync-f1-data`)
 *
 * Handles OpenF1's rate limits with a small amount of exponential backoff,
 * so bulk walks can't get silently truncated mid-season.
 */

export const OPENF1 = "https://api.openf1.org/v1";

export async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url);
  if (res.status === 429 && attempt <= 6) {
    // Honor Retry-After if OpenF1 sets it; otherwise exponential backoff
    // starting at 2s (1, 2, 4, 8, 16, 32 → ~63s worst case).
    const retryAfter = Number(res.headers.get("retry-after"));
    const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2000 * 2 ** (attempt - 1);
    await new Promise((r) => setTimeout(r, backoffMs));
    return fetchJson<T>(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
