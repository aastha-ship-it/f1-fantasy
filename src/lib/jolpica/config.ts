/**
 * Jolpica-F1 (Ergast successor) constants.
 * https://api.jolpi.ca/ergast/f1
 *
 * Anonymous tier: 4 req/sec burst, 500 req/hr sustained.
 * We throttle at 250 ms between requests (4/sec exactly) and rely on
 * 429-with-Retry-After backoff for the sustained limit.
 */

export const JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1";
export const JOLPICA_THROTTLE_MS = 250;
export const JOLPICA_HISTORY_WINDOW_YEARS = 10;
export const JOLPICA_PAGE_LIMIT = 100;
