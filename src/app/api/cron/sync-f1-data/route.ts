import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { syncCalendar } from "@/lib/sync/syncCalendar";
import { syncDrivers } from "@/lib/sync/syncDrivers";

/**
 * Nightly reconciliation cron. Intended to be triggered by Vercel Cron.
 *
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Runs the same calendar + drivers sync as the CLI seed scripts, so a
 * mid-season calendar change (cancellation, driver swap) propagates within
 * 24h even without touching the app.
 *
 * Vercel cron configuration is deferred to Phase 6 deployment.
 */

export const runtime = "nodejs";

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
  const season = Number(
    request.nextUrl.searchParams.get("season") ??
      new Date().getUTCFullYear(),
  );

  try {
    const [calendar, drivers] = await Promise.all([
      syncCalendar(svc, { season }),
      syncDrivers(svc),
    ]);
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      calendar,
      drivers,
    });
  } catch (err) {
    console.error("[cron] sync failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
