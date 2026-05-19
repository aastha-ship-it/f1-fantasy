/**
 * Free Practice banner loader (changes.md §6).
 *
 * On-demand: fetches the weekend's FP1/FP2/FP3 top-3 live from OpenF1, cached
 * ~15 min via Next's Data Cache (no cron, no events/enum changes). An admin
 * override row for an FP slot wins over the live fetch (covers OpenF1 being
 * late, down, wrong, or the session cancelled).
 *
 * Best-effort by construction: every fetch is wrapped so an OpenF1 outage
 * yields fewer/zero FP rows — never a thrown error into the predict round
 * page (the critical path for locking predictions). The caller also guards.
 *
 * Reuses `OPENF1`/`fetchJson`/`sleep` and the cross-year-safe
 * driver_number → drivers.id mapping pattern (canonicalizeName) established by
 * refreshNudges.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENF1, fetchJson, sleep } from "@/lib/sync/openf1";
import { canonicalizeName } from "@/lib/text/canonicalize";
import { formatLocal } from "@/lib/sessionLabel";
import { parsePractice, type FpPodiumEntry } from "./parsePractice";

const REVALIDATE = { next: { revalidate: 900 } } as const; // ~15 min
const THROTTLE_MS = 350;

const PRACTICE_INDEX: Record<string, 1 | 2 | 3> = {
  "Practice 1": 1,
  "Practice 2": 2,
  "Practice 3": 3,
};

export type FpSource = "openf1" | "admin";
export type FpSession = {
  fpIndex: 1 | 2 | 3;
  label: string;
  source: FpSource;
  /** Server-formatted session start (TZ-safe — never recomputed client-side). */
  startLabel: string | null;
  top3: FpPodiumEntry[];
};

type OpenF1Session = {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
};
type OpenF1Driver = { driver_number: number; full_name: string };
type DriverRow = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};
type OverrideRow = {
  fp_index: number;
  p1_driver_id: number;
  p2_driver_id: number;
  p3_driver_id: number;
};

export async function loadPracticeForRound(
  svc: SupabaseClient,
  opts: {
    season: number;
    round: number;
    meetingKey: number | null;
    now?: Date;
  },
): Promise<FpSession[]> {
  if (opts.meetingKey == null) return [];
  const now = opts.now ?? new Date();

  try {
    const [{ data: overrides }, { data: drivers }] = await Promise.all([
      svc
        .from("practice_overrides")
        .select("fp_index, p1_driver_id, p2_driver_id, p3_driver_id")
        .eq("season", opts.season)
        .eq("round", opts.round)
        .returns<OverrideRow[]>(),
      svc
        .from("drivers")
        .select("id, code, full_name, team")
        .returns<DriverRow[]>(),
    ]);

    const byId = new Map<number, { id: number; code: string; team: string }>();
    const byName = new Map<
      string,
      { id: number; code: string; team: string }
    >();
    for (const d of drivers ?? []) {
      const v = { id: d.id, code: d.code, team: d.team };
      byId.set(d.id, v);
      byName.set(canonicalizeName(d.full_name), v);
    }

    const overrideByIndex = new Map<number, OverrideRow>();
    for (const o of overrides ?? []) overrideByIndex.set(o.fp_index, o);

    let sessions: OpenF1Session[];
    try {
      sessions = await fetchJson<OpenF1Session[]>(
        `${OPENF1}/sessions?meeting_key=${opts.meetingKey}`,
        REVALIDATE,
      );
    } catch {
      sessions = [];
    }

    const fpSessions = sessions
      .map((s) => ({ s, idx: PRACTICE_INDEX[s.session_name] }))
      .filter(
        (x): x is { s: OpenF1Session; idx: 1 | 2 | 3 } =>
          x.idx != null && new Date(x.s.date_end).getTime() <= now.getTime(),
      )
      .sort((a, b) => a.idx - b.idx);

    const out: FpSession[] = [];

    for (const { s, idx } of fpSessions) {
      const ov = overrideByIndex.get(idx);
      if (ov) {
        const top3: FpPodiumEntry[] = [];
        [ov.p1_driver_id, ov.p2_driver_id, ov.p3_driver_id].forEach(
          (driverId, i) => {
            const d = byId.get(driverId);
            if (d)
              top3.push({
                pos: i + 1,
                driverId: d.id,
                code: d.code,
                team: d.team,
                lapSeconds: null, // admin override carries no lap time
              });
          },
        );
        if (top3.length > 0)
          out.push({
            fpIndex: idx,
            label: `FP${idx}`,
            source: "admin",
            startLabel: formatLocal(s.date_start),
            top3,
          });
        continue;
      }

      // Live OpenF1 — best-effort per session.
      try {
        await sleep(THROTTLE_MS);
        const drvRows = await fetchJson<OpenF1Driver[]>(
          `${OPENF1}/drivers?session_key=${s.session_key}`,
          REVALIDATE,
        );
        const driverMap = new Map<
          number,
          { id: number; code: string; team: string }
        >();
        for (const r of drvRows) {
          const ours = byName.get(canonicalizeName(r.full_name));
          if (ours) driverMap.set(r.driver_number, ours);
        }

        await sleep(THROTTLE_MS);
        const resultRows = await fetchJson<
          Parameters<typeof parsePractice>[0]
        >(
          `${OPENF1}/session_result?session_key=${s.session_key}`,
          REVALIDATE,
        );

        const top3 = parsePractice(resultRows, driverMap);
        if (top3.length > 0)
          out.push({
            fpIndex: idx,
            label: `FP${idx}`,
            source: "openf1",
            startLabel: formatLocal(s.date_start),
            top3,
          });
      } catch {
        // Skip this FP; the banner just shows the others (or nothing).
      }
    }

    return out;
  } catch {
    return [];
  }
}
