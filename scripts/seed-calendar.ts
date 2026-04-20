#!/usr/bin/env bun
/**
 * CLI wrapper around syncCalendar. Runs interactively against .env.local.
 * Cron uses the same lib function under /api/cron/sync-f1-data.
 */
import { createClient } from "@supabase/supabase-js";
import { syncCalendar } from "../src/lib/sync/syncCalendar";

const SEASON = Number(process.env.SEED_SEASON ?? "2026");

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

async function main() {
  const svc = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  console.log(`→ Seeding ${SEASON} calendar from OpenF1…`);
  const summary = await syncCalendar(svc, { season: SEASON });
  console.log(
    `  ${summary.meetings_total} meetings (${summary.meetings_scoring} scoring after filter).\n`,
  );
  for (const r of summary.rounds) {
    console.log(
      `  R${r.round.toString().padStart(2, "0")} · ${r.meeting.padEnd(28)} · ${r.scoring_sessions} scoring session(s)`,
    );
  }
  console.log(
    `\n✓ Upserted ${summary.events_upserted} events across ${summary.rounds.length} meeting(s).`,
  );
}

main().catch((err) => {
  console.error("✗ seed-calendar failed:", err);
  process.exit(1);
});
