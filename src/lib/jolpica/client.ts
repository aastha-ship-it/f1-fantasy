/**
 * Jolpica-F1 HTTP client.
 *
 * Two surfaces:
 *   - `jolpicaFetch<T>(path, params?)` — single request, types the MRData
 *     wrapper. Retries 429 honoring Retry-After.
 *   - `jolpicaPaginated<T>(path, opts?)` — async iterator that walks
 *     `MRData.total` via offset/limit. Yields one MRData page at a time;
 *     callers append to their own array.
 *
 * Throttling is left to callers (the orchestrators batch many sequential
 * requests; the test harness mocks fetch directly so a baked-in sleep would
 * just slow tests). When sequential requests are needed, callers should
 * `await sleep(JOLPICA_THROTTLE_MS)` between them.
 */

import {
  JOLPICA_BASE,
  JOLPICA_PAGE_LIMIT,
} from "./config";
import type { MRDataResponse } from "./types";

const MAX_429_RETRIES = 6;

export async function jolpicaFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  attempt = 1,
): Promise<MRDataResponse<T>> {
  const url = new URL(JOLPICA_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());

  if (res.status === 429 && attempt <= MAX_429_RETRIES) {
    const retryAfter = Number(res.headers.get("retry-after"));
    const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1000 * 2 ** (attempt - 1);
    await new Promise((r) => setTimeout(r, backoffMs));
    return jolpicaFetch<T>(path, params, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Jolpica ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as MRDataResponse<T>;
}

export async function* jolpicaPaginated<T>(
  path: string,
  opts: {
    limit?: number;
    extraParams?: Record<string, string | number | undefined>;
  } = {},
): AsyncGenerator<MRDataResponse<T>> {
  const limit = opts.limit ?? JOLPICA_PAGE_LIMIT;
  let offset = 0;
  while (true) {
    const page = await jolpicaFetch<T>(path, {
      ...opts.extraParams,
      limit,
      offset,
    });
    yield page;
    const total = Number(page.MRData.total);
    offset += limit;
    if (offset >= total) break;
  }
}
