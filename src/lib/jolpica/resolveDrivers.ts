import type { SupabaseClient } from "@supabase/supabase-js";
import { jolpicaFetch } from "./client";
import type { DriverTablePayload } from "./types";
import { canonicalizeName } from "@/lib/text/canonicalize";

/**
 * Populate `drivers.ergast_id` by joining our active drivers' full_name to
 * Jolpica's `givenName + familyName` (canonicalized).
 *
 * Idempotent: re-running over the same season is a no-op except for fresh
 * matches (a driver added since the last sync).
 */

export type ResolveDriversSummary = {
  season: number;
  jolpica_drivers: number;
  matched: number;
  unmatched: string[];
};

export async function resolveDrivers(
  svc: SupabaseClient,
  season: number,
): Promise<ResolveDriversSummary> {
  const { data: ours, error } = await svc
    .from("drivers")
    .select("id, full_name")
    .eq("active", true);
  if (error) throw error;

  const ourDrivers = (ours ?? []) as { id: number; full_name: string }[];
  const byCanonName = new Map<string, number>();

  // Last-name index — only entries with a unique last-name across our roster
  // are eligible for fallback. If two actives share a last name, both are
  // omitted to prevent silent miss-attribution.
  const lastNameCounts = new Map<string, number>();
  const byLastName = new Map<string, number>();
  function lastName(full: string): string {
    return canonicalizeName(full).split(" ").pop() ?? "";
  }
  for (const d of ourDrivers) {
    byCanonName.set(canonicalizeName(d.full_name), d.id);
    const ln = lastName(d.full_name);
    lastNameCounts.set(ln, (lastNameCounts.get(ln) ?? 0) + 1);
    byLastName.set(ln, d.id);
  }
  for (const [ln, count] of lastNameCounts) {
    if (count > 1) byLastName.delete(ln);
  }

  const page = await jolpicaFetch<DriverTablePayload>(
    `/${season}/drivers/`,
    { limit: 100 },
  );
  const jolpicaDrivers = page.MRData.DriverTable.Drivers;

  const unmatched: string[] = [];
  let matched = 0;
  for (const j of jolpicaDrivers) {
    const fullName = `${j.givenName} ${j.familyName}`;
    let ourId = byCanonName.get(canonicalizeName(fullName));
    if (ourId === undefined) {
      // Fallback: match on last name when it's unique in our roster.
      // Catches cases like Jolpica "Andrea Kimi Antonelli" vs our "Kimi Antonelli".
      ourId = byLastName.get(canonicalizeName(j.familyName));
    }
    if (ourId === undefined) {
      unmatched.push(fullName);
      continue;
    }
    const { error: upErr } = await svc
      .from("drivers")
      .update({ ergast_id: j.driverId })
      .eq("id", ourId);
    if (upErr) throw upErr;
    matched += 1;
  }

  return {
    season,
    jolpica_drivers: jolpicaDrivers.length,
    matched,
    unmatched,
  };
}
