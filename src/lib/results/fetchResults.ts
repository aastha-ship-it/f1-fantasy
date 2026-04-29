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
    if (event.openf1_session_key == null) {
      summary.skipped.push({ event_id: event.id, reason: "no_session_key" });
      continue;
    }

    let rows: OpenF1ResultRow[];
    try {
      await sleep(350);
      rows = await fetchJson<OpenF1ResultRow[]>(
        `${OPENF1}/session_result?session_key=${event.openf1_session_key}`,
      );
      summary.fetched += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[fetch-results] ${event.id}: ${message}`);
      summary.skipped.push({ event_id: event.id, reason: `fetch:${message}` });
      continue;
    }

    if (!rows || rows.length === 0) {
      summary.skipped.push({ event_id: event.id, reason: "no_rows" });
      continue;
    }

    let podium;
    try {
      podium = parsePodium(rows, SPRINT_TYPES.has(event.session_type));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.skipped.push({ event_id: event.id, reason: `parse:${message}` });
      continue;
    }

    const result = await writeResultsService(svc, {
      eventId: event.id,
      p1: podium.p1,
      p2: podium.p2,
      p3: podium.p3,
    });
    if (!result.ok) {
      summary.skipped.push({
        event_id: event.id,
        reason: `write:${result.error}:${result.message}`,
      });
      continue;
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
    summary.written += 1;
  }

  return summary;
}
