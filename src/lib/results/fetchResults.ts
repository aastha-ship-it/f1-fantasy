import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENF1, fetchJson, sleep } from "@/lib/sync/openf1";
import { writeResultsService } from "@/lib/writeResults";
import { parsePodium, type OpenF1ResultRow } from "./parsePodium";

/**
 * OpenF1 auto-fetch cron. For each event whose session_start_at is in the
 * past, has an `openf1_session_key`, and has no `results` row yet, pull the
 * session classification from OpenF1 and run the scoring pipeline.
 *
 * Manual admin entry remains the reliable primary path. This is a
 * convenience that turns "admin clicks" into "happens automatically when
 * data lands" — failures are logged + emailed, never block the manual path.
 */

const SPRINT_TYPES = new Set(["sprint_quali", "sprint_race"]);

export type FetchResultsSummary = {
  scanned: number;
  fetched: number;
  written: number;
  skipped: { event_id: string; reason: string }[];
};

type EventRow = {
  id: string;
  session_type: string;
  openf1_session_key: number | null;
  session_start_at: string;
};

export type FetchOneResult =
  | { ok: true; written: boolean; frozen?: boolean }
  | { ok: false; fetched: boolean; reason: string };

/**
 * Fetch + score one event's results from OpenF1 (source='openf1').
 * Shared by the nightly cron loop and the admin "Fetch from OpenF1" button.
 * The freeze rule (admin-entered / revealed) is enforced downstream in
 * writeResultsService, which returns `frozen` instead of overwriting.
 */
export async function fetchResultForEvent(
  svc: SupabaseClient,
  event: {
    id: string;
    session_type: string;
    openf1_session_key: number | null;
  },
): Promise<FetchOneResult> {
  if (event.openf1_session_key == null) {
    return { ok: false, fetched: false, reason: "no_session_key" };
  }

  let rows: OpenF1ResultRow[];
  try {
    await sleep(350);
    rows = await fetchJson<OpenF1ResultRow[]>(
      `${OPENF1}/session_result?session_key=${event.openf1_session_key}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[fetch-results] ${event.id}: ${message}`);
    return { ok: false, fetched: false, reason: `fetch:${message}` };
  }

  if (!rows || rows.length === 0) {
    return { ok: false, fetched: true, reason: "no_rows" };
  }

  let podium;
  try {
    podium = parsePodium(rows, SPRINT_TYPES.has(event.session_type));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, fetched: true, reason: `parse:${message}` };
  }

  const result = await writeResultsService(
    svc,
    { eventId: event.id, p1: podium.p1, p2: podium.p2, p3: podium.p3 },
    "openf1",
  );
  if (!result.ok) {
    return {
      ok: false,
      fetched: true,
      reason: `write:${result.error}:${result.message}`,
    };
  }
  if (result.frozen) {
    // Admin-entered or revealed — intentionally not overwritten.
    return { ok: true, written: false, frozen: true };
  }

  // Cache full classification for the standings page. Best-effort —
  // failure here doesn't undo the podium write.
  const classificationRows = rows.map((r) => ({
    event_id: event.id,
    driver_id: r.driver_number,
    position: r.position,
    fetched_at: new Date().toISOString(),
  }));
  const { error: classErr } = await svc
    .from("session_classifications")
    .upsert(classificationRows, { onConflict: "event_id,driver_id" });
  if (classErr) {
    console.warn(
      `[fetch-results] classification cache failed for ${event.id}: ${classErr.message}`,
    );
  }
  return { ok: true, written: true };
}

export async function fetchPendingResults(
  svc: SupabaseClient,
): Promise<FetchResultsSummary> {
  const summary: FetchResultsSummary = {
    scanned: 0,
    fetched: 0,
    written: 0,
    skipped: [],
  };

  const nowIso = new Date().toISOString();

  // Past, has session_key, no results row yet (LEFT JOIN via .not.in is awkward,
  // so do two queries and difference them client-side at friend-group scale).
  const { data: pastEvents, error: evErr } = await svc
    .from("events")
    .select("id, session_type, openf1_session_key, session_start_at")
    .lt("session_start_at", nowIso)
    .not("openf1_session_key", "is", null)
    .order("session_start_at", { ascending: false })
    .limit(20)
    .returns<EventRow[]>();
  if (evErr) throw evErr;

  const eventIds = (pastEvents ?? []).map((e) => e.id);
  if (eventIds.length === 0) return summary;

  const { data: existingResults, error: resErr } = await svc
    .from("results")
    .select("event_id")
    .in("event_id", eventIds);
  if (resErr) throw resErr;

  const haveResults = new Set(
    (existingResults ?? []).map((r) => r.event_id as string),
  );

  const pending = (pastEvents ?? []).filter((e) => !haveResults.has(e.id));
  summary.scanned = pending.length;

  for (const event of pending) {
    const r = await fetchResultForEvent(svc, event);
    if (r.ok) {
      summary.fetched += 1;
      if (r.written) summary.written += 1;
      else summary.skipped.push({ event_id: event.id, reason: "frozen" });
    } else {
      if (r.fetched) summary.fetched += 1;
      summary.skipped.push({ event_id: event.id, reason: r.reason });
    }
  }

  return summary;
}
