import type { SupabaseClient } from "@supabase/supabase-js";
import { jolpicaFetch } from "./client";
import type { CircuitTablePayload } from "./types";
import { canonicalizeCircuit } from "@/lib/text/canonicalize";

/**
 * Populate `events.ergast_circuit_id` for the given season by joining our
 * `events.circuit` (OpenF1 short name like "Miami" or "Sakhir") to Jolpica's
 * `circuitName` ("Miami International Autodrome", "Bahrain International
 * Circuit") via canonicalization, with a locality fallback for cases where
 * the OpenF1 short name is the locality not the circuit name (e.g. "Sakhir"
 * → Bahrain International Circuit).
 */

export type ResolveCircuitsSummary = {
  season: number;
  jolpica_circuits: number;
  matched: number;
  unmatched: string[];
};

export async function resolveCircuits(
  svc: SupabaseClient,
  season: number,
): Promise<ResolveCircuitsSummary> {
  const { data: events, error } = await svc
    .from("events")
    .select("id, circuit")
    .eq("season", season);
  if (error) throw error;

  const page = await jolpicaFetch<CircuitTablePayload>(
    `/${season}/circuits/`,
    { limit: 100 },
  );
  const circuits = page.MRData.CircuitTable.Circuits;

  // Build two indexes: by canonical circuitName + by canonical locality.
  const byCircuitName = new Map<string, string>();
  const byLocality = new Map<string, string>();
  for (const c of circuits) {
    byCircuitName.set(canonicalizeCircuit(c.circuitName), c.circuitId);
    if (c.Location?.locality) {
      byLocality.set(canonicalizeCircuit(c.Location.locality), c.circuitId);
    }
  }

  // Explicit aliases for OpenF1 short names that don't appear as either
  // circuitName or locality on Jolpica. Extend as we encounter mismatches.
  const ALIAS: Record<string, string> = {
    catalunya: "catalunya",
    "spafrancorchamps": "spa",
    singapore: "marina_bay",
    interlagos: "interlagos",
    "monte carlo": "monaco",
    suzuka: "suzuka",
    "yas marina circuit": "yas_marina",
  };

  const seenCircuits = new Set<string>();
  const unmatched: string[] = [];
  let matched = 0;

  for (const ev of (events ?? []) as { id: string; circuit: string }[]) {
    const key = canonicalizeCircuit(ev.circuit);
    const aliasId = ALIAS[key];
    const ergastId =
      byCircuitName.get(key) ?? byLocality.get(key) ?? aliasId;
    if (ergastId === undefined) {
      if (!seenCircuits.has(ev.circuit)) {
        unmatched.push(ev.circuit);
        seenCircuits.add(ev.circuit);
      }
      continue;
    }
    const { error: upErr } = await svc
      .from("events")
      .update({ ergast_circuit_id: ergastId })
      .eq("id", ev.id);
    if (upErr) throw upErr;
    matched += 1;
  }

  return {
    season,
    jolpica_circuits: circuits.length,
    matched,
    unmatched,
  };
}
