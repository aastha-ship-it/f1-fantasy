#!/usr/bin/env bun
/**
 * Seed the active driver list from OpenF1.
 *
 * Pulls the most recent Race session's driver roster (OpenF1's /drivers is
 * scoped per session_key). Marks those drivers active; drivers not seen in
 * the latest race get `active = false` (handles mid-season swaps).
 *
 * Idempotent — UPSERTs on drivers.id (= driver_number).
 */
import { createClient } from "@supabase/supabase-js";

type OpenF1Driver = {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
  team_colour: string | null;
  headshot_url: string | null;
  session_key: number;
};

type OpenF1Session = {
  session_key: number;
  date_end: string;
  session_name: string;
  is_cancelled?: boolean;
  year: number;
};

const OPENF1 = "https://api.openf1.org/v1";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<T>;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

async function mostRecentSessionKey(): Promise<number> {
  const year = new Date().getUTCFullYear();
  const current = await fetchJson<OpenF1Session[]>(
    `${OPENF1}/sessions?session_name=Race&year=${year}`,
  );
  const previous = await fetchJson<OpenF1Session[]>(
    `${OPENF1}/sessions?session_name=Race&year=${year - 1}`,
  );
  const past = [...current, ...previous]
    .filter((s) => !s.is_cancelled)
    .filter((s) => new Date(s.date_end).getTime() < Date.now())
    .sort(
      (a, b) => new Date(b.date_end).getTime() - new Date(a.date_end).getTime(),
    );
  if (past.length === 0) throw new Error("No completed, non-cancelled Race sessions found");
  return past[0].session_key;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const sessionKey = await mostRecentSessionKey();
  console.log(`→ Seeding drivers from OpenF1 session ${sessionKey}…`);

  const drivers = await fetchJson<OpenF1Driver[]>(
    `${OPENF1}/drivers?session_key=${sessionKey}`,
  );
  // Dedupe by driver_number (some sessions have duplicate rows).
  const byNumber = new Map<number, OpenF1Driver>();
  for (const d of drivers) byNumber.set(d.driver_number, d);
  const activeNumbers = [...byNumber.keys()];

  console.log(`  Found ${byNumber.size} active drivers.\n`);

  for (const d of byNumber.values()) {
    const { error } = await supabase.from("drivers").upsert(
      {
        id: d.driver_number,
        code: d.name_acronym,
        full_name: d.full_name,
        team: d.team_name,
        active: true,
        headshot_url: d.headshot_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) console.error(`  ✗ upsert failed for #${d.driver_number}:`, error.message);
  }

  // Deactivate anyone not in the latest roster.
  if (activeNumbers.length > 0) {
    const { error } = await supabase
      .from("drivers")
      .update({ active: false, updated_at: new Date().toISOString() })
      .not("id", "in", `(${activeNumbers.join(",")})`);
    if (error) console.error("  ✗ deactivation step failed:", error.message);
  }

  console.log(`✓ Driver roster synced.`);
}

main().catch((err) => {
  console.error("✗ seed-drivers failed:", err);
  process.exit(1);
});
