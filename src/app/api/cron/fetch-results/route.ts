import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { fetchPendingResults } from "@/lib/results/fetchResults";
import { notifyAdmin } from "@/lib/email/notifyAdmin";
import { recordCronRun } from "@/lib/cron/recordRun";

const CRON_PATH = "fetch-results";

/**
 * OpenF1 results fetcher. Bearer-gated.
 *
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Walks past sessions that have an `openf1_session_key` but no `results`
 * row yet, pulls the classification from OpenF1, and runs the scoring
 * pipeline via service role. Manual admin entry remains the primary path —
 * this is a convenience for steady-state operation.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401 },
  );
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron] CRON_SECRET is not set");
    return unauthorized();
  }
  if (auth !== `Bearer ${expected}`) {
    return unauthorized();
  }

  const svc = createSupabaseServiceClient();

  const t0 = Date.now();
  try {
    const summary = await fetchPendingResults(svc);
    if (summary.skipped.length > 0) {
      const lines = summary.skipped
        .map((s) => `  - ${s.event_id} :: ${s.reason}`)
        .join("\n");
      console.warn(
        `[fetch-results] ${summary.skipped.length} skipped:\n${lines}`,
      );
    }
    await recordCronRun(svc, CRON_PATH, "success", Date.now() - t0);
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      ...summary,
    });
  } catch (err) {
    console.error("[cron] fetch-results failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(svc, CRON_PATH, "error", Date.now() - t0, err);
    await notifyAdmin({
      subject: "[F1 Fantasy] fetch-results cron failed",
      body: `OpenF1 results fetch failed at ${new Date().toISOString()}\n\n${message}`,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
