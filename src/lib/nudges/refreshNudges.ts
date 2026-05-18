import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENF1, fetchJson, sleep } from "@/lib/sync/openf1";
import { canonicalizeName } from "@/lib/text/canonicalize";
import {
  recentForm,
  qualiRaceDelta,
  type GridClassified,
} from "./computeNudges";
import { atTrackResultsFor } from "@/lib/jolpica/atTrackResults";
import { JOLPICA_HISTORY_WINDOW_YEARS } from "@/lib/jolpica/config";

// Re-export so the existing N13 test in this directory keeps working.
export { canonicalizeName };

/**
 * Nightly nudge cache builder. For each upcoming scoring event, walks recent
 * OpenF1 race + quali sessions, builds three signals per active driver, and
 * UPSERTs `driver_nudges`.
 *
 * Cross-year identity gotcha:
 *   OpenF1 keys results by `driver_number`, which F1 reassigns each season
 *   (#1 follows the WDC). Our `drivers.id` is a stable smallint set from one
 *   season's seed. Looking up historical results by our id directly attributes
 *   the wrong driver's results. We resolve this per-session by fetching
 *   `/drivers?session_key=K`, mapping that session's `driver_number` →
 *   `full_name`, and rejoining to our drivers table on `full_name`. The
 *   resulting per-session `Map<our_driver_id, position>` is what every
 *   downstream loop reads from.
 */

type OpenF1Session = {
  session_key: number;
  meeting_key: number;
  session_name: string;
  date_start: string;
  is_cancelled?: boolean;
};

type OpenF1Meeting = {
  meeting_key: number;
  circuit_short_name: string;
  year: number;
};

type OpenF1Result = {
  driver_number: number;
  position: number | null;
};

type OpenF1Driver = {
  driver_number: number;
  full_name: string;
};

type RaceSession = {
  session_key: number;
  meeting_key: number;
  date_start: string;
  circuit: string;
  year: number;
};

type EventRow = {
  id: string;
  circuit: string;
  season: number;
  session_start_at: string;
  ergast_circuit_id: string | null;
};

export type RefreshNudgesSummary = {
  event_id: string;
  drivers: number;
  race_sessions_walked: number;
  upserted: number;
};

const HISTORY_SEASONS = 4;
const RECENT_RACE_LIMIT = 5;
const THROTTLE_MS = 350;

async function loadRecentRaces(
  currentSeason: number,
  before: Date,
): Promise<RaceSession[]> {
  const seasons: number[] = [];
  for (let i = 0; i < HISTORY_SEASONS; i++) seasons.push(currentSeason - i);

  const all: RaceSession[] = [];
  for (const year of seasons) {
    await sleep(THROTTLE_MS);
    const sessions = await fetchJson<OpenF1Session[]>(
      `${OPENF1}/sessions?year=${year}&session_name=Race`,
    );
    await sleep(THROTTLE_MS);
    const meetings = await fetchJson<OpenF1Meeting[]>(
      `${OPENF1}/meetings?year=${year}`,
    );
    const meetingByKey = new Map(meetings.map((m) => [m.meeting_key, m]));
    for (const s of sessions) {
      if (s.is_cancelled) continue;
      if (new Date(s.date_start).getTime() >= before.getTime()) continue;
      const m = meetingByKey.get(s.meeting_key);
      if (!m) continue;
      all.push({
        session_key: s.session_key,
        meeting_key: s.meeting_key,
        date_start: s.date_start,
        circuit: m.circuit_short_name,
        year: m.year,
      });
    }
  }
  // Recent-first
  all.sort(
    (a, b) =>
      new Date(b.date_start).getTime() - new Date(a.date_start).getTime(),
  );
  return all;
}

/**
 * For one OpenF1 session, return a map of OpenF1's driver_number → our
 * stable drivers.id. Drivers absent from `ourIdByName` (e.g., a one-off
 * reserve driver who never raced in our seeded year) are simply omitted.
 */
async function loadDriverMap(
  sessionKey: number,
  ourIdByName: Map<string, number>,
): Promise<Map<number, number>> {
  await sleep(THROTTLE_MS);
  let rows: OpenF1Driver[];
  try {
    rows = await fetchJson<OpenF1Driver[]>(
      `${OPENF1}/drivers?session_key=${sessionKey}`,
    );
  } catch (err) {
    console.warn(`[nudges] driver-map fetch failed s=${sessionKey}`, err);
    return new Map();
  }
  const out = new Map<number, number>();
  for (const r of rows) {
    const ourId = ourIdByName.get(canonicalizeName(r.full_name));
    if (ourId !== undefined) out.set(r.driver_number, ourId);
  }
  return out;
}

async function loadResults(sessionKey: number): Promise<OpenF1Result[]> {
  await sleep(THROTTLE_MS);
  try {
    return await fetchJson<OpenF1Result[]>(
      `${OPENF1}/session_result?session_key=${sessionKey}`,
    );
  } catch (err) {
    console.warn(`[nudges] result fetch failed s=${sessionKey}`, err);
    return [];
  }
}

/** Project OpenF1 result rows into our_driver_id-keyed positions. */
function rowsByOurId(
  rows: OpenF1Result[],
  driverMap: Map<number, number>,
): Map<number, number | null> {
  const out = new Map<number, number | null>();
  for (const r of rows) {
    const ourId = driverMap.get(r.driver_number);
    if (ourId === undefined) continue;
    out.set(ourId, r.position);
  }
  return out;
}

export async function refreshNudgesForEvent(
  svc: SupabaseClient,
  eventId: string,
): Promise<RefreshNudgesSummary> {
  const { data: event, error: evErr } = await svc
    .from("events")
    .select("id, circuit, season, session_start_at, ergast_circuit_id")
    .eq("id", eventId)
    .maybeSingle<EventRow>();
  if (evErr) throw evErr;
  if (!event) throw new Error(`event ${eventId} not found`);

  const { data: drivers, error: drErr } = await svc
    .from("drivers")
    .select("id, full_name")
    .eq("active", true);
  if (drErr) throw drErr;
  const driverList = (drivers ?? []) as { id: number; full_name: string }[];
  if (driverList.length === 0) {
    return {
      event_id: eventId,
      drivers: 0,
      race_sessions_walked: 0,
      upserted: 0,
    };
  }
  const driverIds = driverList.map((d) => d.id);
  const ourIdByName = new Map<string, number>();
  for (const d of driverList) {
    ourIdByName.set(canonicalizeName(d.full_name), d.id);
  }

  const before = new Date(event.session_start_at);
  const races = await loadRecentRaces(event.season, before);

  // OpenF1 race history we still need to fetch: just the recent 5. The
  // at-track signal moved to the Jolpica-backed `historical_results` table
  // (deeper window, single SQL aggregate).
  const recentSlice = races.slice(0, RECENT_RACE_LIMIT);
  const raceFetchList = recentSlice;

  // For each race session: pull its driver map (cross-year identity) and its
  // result rows, then project to our_id-keyed Map<our_id, position>.
  const raceByDriver = new Map<number, Map<number, number | null>>();
  for (const s of raceFetchList) {
    const driverMap = await loadDriverMap(s.session_key, ourIdByName);
    const rows = await loadResults(s.session_key);
    raceByDriver.set(s.session_key, rowsByOurId(rows, driverMap));
  }

  // Current-season qualifying for the grid→race delta. Same remap pattern.
  await sleep(THROTTLE_MS);
  const qualiSessions = await fetchJson<OpenF1Session[]>(
    `${OPENF1}/sessions?year=${event.season}&session_name=Qualifying`,
  );
  const qualiByMeeting = new Map<number, Map<number, number | null>>();
  for (const s of qualiSessions) {
    if (s.is_cancelled) continue;
    if (new Date(s.date_start).getTime() >= before.getTime()) continue;
    const driverMap = await loadDriverMap(s.session_key, ourIdByName);
    const rows = await loadResults(s.session_key);
    qualiByMeeting.set(s.meeting_key, rowsByOurId(rows, driverMap));
  }

  // At-track wins + podiums come from Jolpica historical_results — single SQL
  // aggregate per driver. If this event's circuit hasn't been resolved to an
  // ergast id yet, every driver gets null (UI renders `—`). The aggregator
  // also returns null when historical_races is empty for the circuit/window,
  // so a fresh dev environment without backfill reads `—` rather than `0`.
  const atTrackByDriver = new Map<
    number,
    { wins: number | null; podiums: number | null }
  >();
  if (event.ergast_circuit_id) {
    for (const driverId of driverIds) {
      try {
        const r = await atTrackResultsFor(
          svc,
          driverId,
          event.ergast_circuit_id,
          {
            windowYears: JOLPICA_HISTORY_WINDOW_YEARS,
            asOfDate: event.session_start_at,
          },
        );
        atTrackByDriver.set(
          driverId,
          r === null
            ? { wins: null, podiums: null }
            : { wins: r.wins, podiums: r.podiums },
        );
      } catch (err) {
        console.warn(
          `[nudges] at-track query failed for driver=${driverId}:`,
          err,
        );
        atTrackByDriver.set(driverId, { wins: null, podiums: null });
      }
    }
  } else {
    for (const driverId of driverIds)
      atTrackByDriver.set(driverId, { wins: null, podiums: null });
  }

  const rows = driverIds.map((driverId) => {
    const lastFinishes = recentSlice.map((s) => {
      const v = raceByDriver.get(s.session_key)?.get(driverId);
      return v ?? null;
    });

    const deltaRows: GridClassified[] = [];
    for (const s of races) {
      if (s.year !== event.season) continue;
      const grid = qualiByMeeting.get(s.meeting_key)?.get(driverId);
      if (grid == null) continue;
      const classified = raceByDriver.get(s.session_key)?.get(driverId);
      deltaRows.push({
        grid,
        classified: classified == null ? null : classified,
      });
    }

    const atTrack = atTrackByDriver.get(driverId) ?? {
      wins: null,
      podiums: null,
    };
    return {
      event_id: eventId,
      driver_id: driverId,
      recent_form: recentForm(lastFinishes),
      at_track_podiums: atTrack.podiums,
      at_track_wins: atTrack.wins,
      quali_race_delta: qualiRaceDelta(deltaRows),
      refreshed_at: new Date().toISOString(),
    };
  });

  const { error: upErr } = await svc
    .from("driver_nudges")
    .upsert(rows, { onConflict: "event_id,driver_id" });
  if (upErr) throw upErr;

  return {
    event_id: eventId,
    drivers: driverIds.length,
    race_sessions_walked: raceFetchList.length,
    upserted: rows.length,
  };
}

type NudgeEventRef = { id: string; session_start_at: string };

/**
 * Union the near-term window events with the next upcoming round's events,
 * dedupe by id, and order by session_start_at ascending so the most
 * imminent (and most likely to be picked) events compute first — a partial
 * timeout then degrades gracefully. Pure; unit-tested (N14–N16).
 */
export function selectNudgeEventIds(
  windowEvents: NudgeEventRef[],
  nextRoundEvents: NudgeEventRef[],
): string[] {
  const ordered = [...windowEvents, ...nextRoundEvents].sort(
    (a, b) =>
      new Date(a.session_start_at).getTime() -
      new Date(b.session_start_at).getTime(),
  );
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const e of ordered) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    ids.push(e.id);
  }
  return ids;
}

export async function refreshNudgesForUpcoming(
  svc: SupabaseClient,
  opts: { withinDays?: number } = {},
): Promise<RefreshNudgesSummary[]> {
  const horizonMs = (opts.withinDays ?? 10) * 24 * 60 * 60 * 1000;
  const now = new Date();
  const nowIso = now.toISOString();
  const horizon = new Date(now.getTime() + horizonMs).toISOString();

  // Near-term safety window (existing behaviour).
  const { data: windowEvents, error } = await svc
    .from("events")
    .select("id, session_start_at")
    .gte("session_start_at", nowIso)
    .lte("session_start_at", horizon)
    .order("session_start_at", { ascending: true });
  if (error) throw error;

  // Always cover the next upcoming round in full, however far away it is, so
  // a user picking for the next race weekend always has telemetry. Resolve
  // the round of the earliest future session, then take all its sessions.
  const { data: nextEvent, error: nextErr } = await svc
    .from("events")
    .select("season, round")
    .gte("session_start_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ season: number; round: number }>();
  if (nextErr) throw nextErr;

  let nextRoundEvents: { id: string; session_start_at: string }[] = [];
  if (nextEvent) {
    const { data: roundEvents, error: roundErr } = await svc
      .from("events")
      .select("id, session_start_at")
      .eq("season", nextEvent.season)
      .eq("round", nextEvent.round)
      .order("session_start_at", { ascending: true });
    if (roundErr) throw roundErr;
    nextRoundEvents = (roundEvents ?? []) as {
      id: string;
      session_start_at: string;
    }[];
  }

  const ids = selectNudgeEventIds(
    (windowEvents ?? []) as { id: string; session_start_at: string }[],
    nextRoundEvents,
  );

  const out: RefreshNudgesSummary[] = [];
  for (const id of ids) {
    out.push(await refreshNudgesForEvent(svc, id));
  }
  return out;
}
