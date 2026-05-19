/**
 * Free-Practice banner lap-cell variant (design_handoff_phase11 §6).
 *
 * Pure decision: which of the three cell forms a podium row renders.
 *   - admin override          → OVR  (lap time never shown for overrides)
 *   - OpenF1, leader (pos 1)  → absolute M:SS.mmm
 *   - OpenF1, non-leader      → "+gap" to the leader (e.g. +0.124)
 *   - OpenF1, no time yet     → Awaiting
 * Unit-locked FP-L1..FP-L4. Reuses formatLapTime for the absolute case.
 */
import { formatLapTime } from "./formatLapTime";
import type { FpSource } from "./loadPractice";

export type LapCell =
  | { kind: "time"; text: string }
  | { kind: "ovr" }
  | { kind: "awaiting" };

export function lapCell(
  entry: { pos: number; lapSeconds: number | null },
  leaderLapSeconds: number | null,
  source: FpSource,
): LapCell {
  if (source === "admin") return { kind: "ovr" };
  const lap = entry.lapSeconds;
  if (lap == null || !Number.isFinite(lap) || lap <= 0) {
    return { kind: "awaiting" };
  }
  if (entry.pos === 1) return { kind: "time", text: formatLapTime(lap) };
  if (
    leaderLapSeconds != null &&
    Number.isFinite(leaderLapSeconds) &&
    leaderLapSeconds > 0
  ) {
    return { kind: "time", text: `+${(lap - leaderLapSeconds).toFixed(3)}` };
  }
  return { kind: "time", text: formatLapTime(lap) };
}
