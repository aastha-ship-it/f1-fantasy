#!/usr/bin/env bun
/**
 * CLI wrapper around syncDrivers.
 */
import { createClient } from "@supabase/supabase-js";
import { syncDrivers } from "../src/lib/sync/syncDrivers";

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
  console.log(`→ Seeding drivers from OpenF1…`);
  const summary = await syncDrivers(svc);
  console.log(
    `  session_key=${summary.session_key_used} · ${summary.roster_size} active · ${summary.deactivated} deactivated.`,
  );
  console.log(`✓ Driver roster synced.`);
}

main().catch((err) => {
  console.error("✗ seed-drivers failed:", err);
  process.exit(1);
});
