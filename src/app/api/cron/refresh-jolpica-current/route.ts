import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { backfillSeason } from "@/lib/jolpica/backfillResults";
import { notifyAdmin } from "@/lib/email/notifyAdmin";
import { recordCronRun } from "@/lib/cron/recordRun";

const CRON_PATH = "refresh-jolpica-current";

/**
 * Nightly Jolpica delta — current season only. Bearer-gated.
 *
 *   Authorization: Bearer ${CRON_SECRET}
 *
 * Pulls race + sprint classifications for the current calendar year and
 * UPSERTs into `historical_races` + `historical_results`. Idempotent.
 *
 * The bigger 10-season historical backfill runs once via
 * `scripts/backfill-jolpica.ts`; this route stays tightly scoped so its
 * rate-limit budget is bounded (~7 requests).
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
  const seasonParam = request.nextUrl.searchParams.get("season");
  const season = seasonParam
    ? Number(seasonParam)
    : new Date().getUTCFullYear();

  const t0 = Date.now();
  try {
    const summary = await backfillSeason(svc, season);
    await recordCronRun(svc, CRON_PATH, "success", Date.now() - t0);
    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      ...summary,
    });
  } catch (err) {
    console.error("[cron] refresh-jolpica-current failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    await recordCronRun(svc, CRON_PATH, "error", Date.now() - t0, err);
    await notifyAdmin({
      subject: "[F1 Fantasy] refresh-jolpica-current cron failed",
      body: `Jolpica delta failed at ${new Date().toISOString()}\n\n${message}`,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
