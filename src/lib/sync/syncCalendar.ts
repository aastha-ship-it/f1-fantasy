import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENF1, fetchJson, sleep } from "./openf1";

type Meeting = {
  meeting_key: number;
  meeting_name: string;
  circuit_short_name: string;
  date_start: string;
  year: number;
};

type OpenF1Session = {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  is_cancelled?: boolean;
};

const SESSION_NAME_MAP: Record<
  string,
  "quali" | "race" | "sprint_quali" | "sprint_race"
> = {
  Qualifying: "quali",
  Race: "race",
  "Sprint Qualifying": "sprint_quali",
  Sprint: "sprint_race",
};

export type CalendarSyncSummary = {
  season: number;
  meetings_total: number;
  meetings_scoring: number;
  events_upserted: number;
  rounds: {
    round: number;
    meeting: string;
    scoring_sessions: number;
  }[];
};

export async function syncCalendar(
  svc: SupabaseClient,
  opts: { season: number; throttleMs?: number } = { season: 2026 },
): Promise<CalendarSyncSummary> {
  const throttleMs = opts.throttleMs ?? 350;

  const allMeetings = await fetchJson<Meeting[]>(
    `${OPENF1}/meetings?year=${opts.season}`,
  );
  const meetings = allMeetings
    .filter((m) => !/pre[-\s]?season/i.test(m.meeting_name))
    .filter((m) => !/testing/i.test(m.meeting_name))
    .sort(
      (a, b) =>
        new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
    );

  const summary: CalendarSyncSummary = {
    season: opts.season,
    meetings_total: allMeetings.length,
    meetings_scoring: meetings.length,
    events_upserted: 0,
    rounds: [],
  };

  let round = 0;
  for (const m of meetings) {
    round += 1;
    await sleep(throttleMs);
    const sessions = await fetchJson<OpenF1Session[]>(
      `${OPENF1}/sessions?meeting_key=${m.meeting_key}`,
    );
    const scoring = sessions.filter(
      (s) => SESSION_NAME_MAP[s.session_name] && !s.is_cancelled,
    );
    summary.rounds.push({
      round,
      meeting: m.meeting_name,
      scoring_sessions: scoring.length,
    });
    for (const s of scoring) {
      const sessionType = SESSION_NAME_MAP[s.session_name]!;
      const { error } = await svc.from("events").upsert(
        {
          season: opts.season,
          round,
          name: m.meeting_name,
          circuit: m.circuit_short_name,
          session_type: sessionType,
          session_start_at: s.date_start,
          session_end_at: s.date_end,
          openf1_meeting_key: m.meeting_key,
          openf1_session_key: s.session_key,
        },
        { onConflict: "openf1_session_key" },
      );
      if (!error) summary.events_upserted += 1;
    }
  }
  return summary;
}
