import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { syncCalendar } from "@/lib/sync/syncCalendar";
import { syncDrivers } from "@/lib/sync/syncDrivers";
import { resolveDrivers } from "@/lib/jolpica/resolveDrivers";
import { resolveCircuits } from "@/lib/jolpica/resolveCircuits";
import { notifyAdmin } from "@/lib/email/notifyAdmin";
import { recordCronRun } from "@/lib/cron/recordRun";

const CRON_PATH = "sync-f1-data";

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

  const t0 = Date.now();
  try {
    const [calendar, drivers] = await Promise.all([
      syncCalendar(svc, { season }),
      syncDrivers(svc),
    ]);

    // Best-effort identity mapping. A failure here shouldn't abort the
    // OpenF1 sync — it's a nice-to-have for the historical layer. Log + move on.
    let driverMap, circuitMap;
    try {
      driverMap = await resolveDrivers(svc, season);
    } catch (err) {
      console.warn("[cron] resolveDrivers failed:", err);
    }
    try {
      circuitMap = await resolveCircuits(svc, season);
    } catch (err) {
      console.warn("[cron] resolveCircuits failed:", err);
    }

    await recordCronRun(svc, CRON_PATH, "success", Date.now() - t0);
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      calendar,
      drivers,
      driver_map: driverMap,
      circuit_map: circuitMap,
    });
  } catch (err) {
    console.error("[cron] sync failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(svc, CRON_PATH, "error", Date.now() - t0, err);
    await notifyAdmin({
      subject: "[F1 Fantasy] sync-f1-data cron failed",
      body: `Season ${season} sync failed at ${new Date().toISOString()}\n\n${message}`,
    });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
