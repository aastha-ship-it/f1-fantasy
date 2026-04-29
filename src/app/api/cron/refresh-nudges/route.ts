import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { refreshNudgesForUpcoming } from "@/lib/nudges/refreshNudges";
import { notifyAdmin } from "@/lib/email/notifyAdmin";
import { recordCronRun } from "@/lib/cron/recordRun";

const CRON_PATH = "refresh-nudges";

/**
 * Nightly nudge refresh. Bearer-gated.
 *
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Walks every event whose session_start_at is within the next 10 days and
 * rebuilds the `driver_nudges` cache for it. Idempotent.
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
  const within = Number(
    request.nextUrl.searchParams.get("within_days") ?? 10,
  );

  const t0 = Date.now();
  try {
    const summaries = await refreshNudgesForUpcoming(svc, {
      withinDays: Number.isFinite(within) ? within : 10,
    });
    await recordCronRun(svc, CRON_PATH, "success", Date.now() - t0);
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      events: summaries,
    });
  } catch (err) {
    console.error("[cron] nudge refresh failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(svc, CRON_PATH, "error", Date.now() - t0, err);
    await notifyAdmin({
      subject: "[F1 Fantasy] refresh-nudges cron failed",
      body: `Nudge refresh failed at ${new Date().toISOString()}\n\n${message}`,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
