#!/usr/bin/env bun
/**
 * One-shot Jolpica historical backfill.
 *
 * Usage:
 *   bun --env-file=.env.local run scripts/backfill-jolpica.ts
 *   bun --env-file=.env.local run scripts/backfill-jolpica.ts --from 2017 --to 2026
 *   bun --env-file=.env.local run scripts/backfill-jolpica.ts --season 2024
 *
 * Defaults: from = (current year - 9), to = current year (10 seasons inclusive).
 * Idempotent — re-running over the same season UPSERTs identical rows.
 *
 * Identity mapping must be in place first. Run sync-f1-data (or just call
 * resolveDrivers/resolveCircuits) before backfilling so drivers.ergast_id is
 * populated; otherwise nothing matches and the historical_results table stays
 * empty.
 */

import { createClient } from "@supabase/supabase-js";
import { backfillSeason } from "../src/lib/jolpica/backfillResults";
import { resolveDrivers } from "../src/lib/jolpica/resolveDrivers";
import { resolveCircuits } from "../src/lib/jolpica/resolveCircuits";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const svc = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const currentYear = new Date().getUTCFullYear();
const single = arg("season");
const start = single ? Number(single) : Number(arg("from") ?? currentYear - 9);
const end = single ? Number(single) : Number(arg("to") ?? currentYear);

console.log(`→ Jolpica backfill ${start}..${end}`);
console.log("  (1) resolving identity mappings for current season");
const drivers = await resolveDrivers(svc, currentYear);
console.log(
  `      drivers matched=${drivers.matched}/${drivers.jolpica_drivers}`,
);
if (drivers.unmatched.length > 0) {
  console.log(`      unmatched: ${drivers.unmatched.join(", ")}`);
}
const circuits = await resolveCircuits(svc, currentYear);
console.log(
  `      circuits matched=${circuits.matched}/${circuits.jolpica_circuits}`,
);
if (circuits.unmatched.length > 0) {
  console.log(`      unmatched: ${circuits.unmatched.join(", ")}`);
}

console.log(`  (2) backfilling ${end - start + 1} season(s)`);
for (let season = start; season <= end; season++) {
  const summary = await backfillSeason(svc, season);
  console.log(
    `      ${season} · ${summary.races} races · ${summary.raceResults} race rows · ${summary.sprintResults} sprint rows`,
  );
  if (summary.unmappedDriverIds.length > 0) {
    console.log(
      `        unmapped: ${summary.unmappedDriverIds.slice(0, 6).join(", ")}${
        summary.unmappedDriverIds.length > 6 ? "…" : ""
      }`,
    );
  }
}
console.log("✓ Done.");
