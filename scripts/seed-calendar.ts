#!/usr/bin/env bun
/**
 * Seed the 2026 F1 calendar from OpenF1.
 *
 * 2-step walk:
 *   1. GET /meetings?year=2026 → one entry per GP weekend
 *   2. GET /sessions?meeting_key=<k> → per-session detail
 *
 * UPSERTs on events.openf1_session_key (idempotent; re-run safely).
 * Skips Practice/FP sessions; keeps only {Qualifying, Race, Sprint Qualifying, Sprint}.
 * Nightly reconciliation cron runs this same script in Phase 3.
 */
import { createClient } from "@supabase/supabase-js";

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

const OPENF1 = "https://api.openf1.org/v1";
const SEASON = Number(process.env.SEED_SEASON ?? "2026");

const SESSION_NAME_MAP: Record<string, "quali" | "race" | "sprint_quali" | "sprint_race"> = {
  Qualifying: "quali",
  Race: "race",
  "Sprint Qualifying": "sprint_quali",
  Sprint: "sprint_race",
};

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const res = await fetch(url);
  if (res.status === 429 && attempt <= 4) {
    const backoffMs = 1000 * 2 ** (attempt - 1);
    console.log(`  ⏳ 429 from OpenF1; backing off ${backoffMs}ms (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, backoffMs));
    return fetchJson<T>(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<T>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  console.log(`→ Seeding ${SEASON} calendar from OpenF1…`);
  const allMeetings = await fetchJson<Meeting[]>(
    `${OPENF1}/meetings?year=${SEASON}`,
  );
  // Pre-season testing doesn't score; filter before round assignment.
  const meetings = allMeetings
    .filter((m) => !/pre[-\s]?season/i.test(m.meeting_name))
    .filter((m) => !/testing/i.test(m.meeting_name))
    .sort(
      (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime(),
    );
  console.log(
    `  Found ${allMeetings.length} meetings (${meetings.length} scoring after filtering testing).\n`,
  );

  let totalEvents = 0;
  let round = 0;
  for (const m of meetings) {
    round += 1;
    await sleep(350); // throttle to avoid OpenF1 rate limiting
    const sessions = await fetchJson<OpenF1Session[]>(
      `${OPENF1}/sessions?meeting_key=${m.meeting_key}`,
    );
    const scoringSessions = sessions.filter(
      (s) => SESSION_NAME_MAP[s.session_name] && !s.is_cancelled,
    );

    for (const s of scoringSessions) {
      const sessionType = SESSION_NAME_MAP[s.session_name]!;
      const { error } = await supabase.from("events").upsert(
        {
          season: SEASON,
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
      if (error) {
        console.error(
          `  ✗ upsert failed for ${m.meeting_name} ${sessionType}:`,
          error.message,
        );
      } else {
        totalEvents += 1;
      }
    }
    console.log(
      `  R${round.toString().padStart(2, "0")} · ${m.meeting_name.padEnd(28)} · ${scoringSessions.length} scoring session(s)`,
    );
  }

  console.log(`\n✓ Upserted ${totalEvents} events across ${round} meeting(s).`);
}

main().catch((err) => {
  console.error("✗ seed-calendar failed:", err);
  process.exit(1);
});
