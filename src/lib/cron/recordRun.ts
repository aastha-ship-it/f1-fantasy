import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append a row to `cron_runs`. Called from each cron route's success path
 * AND its catch path so the admin dashboard can render an honest
 * "last run · ✓ success" / "last run · ✗ error" chip.
 *
 * Failures here are swallowed — telemetry must never crash the cron itself.
 *
 * Pattern usage:
 *
 *   const t0 = Date.now();
 *   try {
 *     // … the actual cron work …
 *     await recordCronRun(svc, "sync-f1-data", "success", Date.now() - t0);
 *     return NextResponse.json({ ok: true });
 *   } catch (err) {
 *     await recordCronRun(svc, "sync-f1-data", "error", Date.now() - t0, err);
 *     return NextResponse.json({ ok: false }, { status: 500 });
 *   }
 */
export async function recordCronRun(
  svc: SupabaseClient,
  path: string,
  status: "success" | "error",
  durationMs: number,
  errorOrMessage?: unknown,
): Promise<void> {
  let errorMsg: string | null = null;
  if (errorOrMessage != null) {
    errorMsg =
      errorOrMessage instanceof Error
        ? errorOrMessage.message
        : String(errorOrMessage);
  }
  try {
    await svc.from("cron_runs").insert({
      path,
      status,
      duration_ms: durationMs,
      error: errorMsg,
    });
  } catch (insertErr) {
    console.warn("[cron-telemetry] insert failed:", insertErr);
  }
}

export type CronLastRun = {
  path: string;
  ran_at: string;
  status: "success" | "error";
  duration_ms: number | null;
  error: string | null;
};

/**
 * Read the latest run per known cron path. Used by /admin to render the
 * status strip. PostgREST doesn't have native "DISTINCT ON" so we fetch
 * a window and dedupe client-side; cron_runs is small (≤4×N rows where
 * N is days since deployment).
 */
export async function listLatestCronRuns(
  svc: SupabaseClient,
  paths: string[],
): Promise<Map<string, CronLastRun>> {
  const out = new Map<string, CronLastRun>();
  if (paths.length === 0) return out;
  const { data } = await svc
    .from("cron_runs")
    .select("path, ran_at, status, duration_ms, error")
    .in("path", paths)
    .order("ran_at", { ascending: false })
    .limit(paths.length * 5);
  for (const r of (data ?? []) as CronLastRun[]) {
    if (!out.has(r.path)) out.set(r.path, r);
  }
  return out;
}
