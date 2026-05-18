#!/usr/bin/env bun
/**
 * One-shot: re-score every event under the current scoring rules.
 *
 * Usage:
 *   bun --env-file=.env.local run scripts/recompute-all-scores.ts
 *
 * Run once after a scoring-rule change (changes.md §4 — new point system).
 * Walks every `results` row and re-invokes the idempotent
 * `writeResultsService` with the stored actual podium, which recomputes
 * `scores` (new computeScore) and `user_streaks` for all affected users.
 * Predictions are read fresh inside the service, so nothing else is touched.
 * Safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import { writeResultsService } from "../src/lib/writeResults";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const svc = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ResultRow = {
  event_id: string;
  p1_driver_id: number;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

async function main() {
  const { data: results, error } = await svc
    .from("results")
    .select("event_id, p1_driver_id, p2_driver_id, p3_driver_id")
    .returns<ResultRow[]>();
  if (error) {
    console.error("failed to read results:", error.message);
    process.exit(1);
  }

  const rows = results ?? [];
  console.log(`Recomputing scores for ${rows.length} event(s)…`);

  let ok = 0;
  let totalScores = 0;
  for (const r of rows) {
    const res = await writeResultsService(svc, {
      eventId: r.event_id,
      p1: r.p1_driver_id,
      p2: r.p2_driver_id,
      p3: r.p3_driver_id,
    });
    if (res.ok) {
      ok += 1;
      totalScores += res.scoresUpdated;
      console.log(
        `  ✓ ${r.event_id} — ${res.scoresUpdated} score(s) rewritten`,
      );
    } else {
      console.error(`  ✗ ${r.event_id} — ${res.error}: ${res.message}`);
    }
  }

  console.log(
    `Done. ${ok}/${rows.length} events recomputed, ${totalScores} score rows rewritten.`,
  );
  if (ok !== rows.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
