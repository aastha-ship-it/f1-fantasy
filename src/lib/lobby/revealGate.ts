/**
 * Progressive-reveal gate for the Lobby tab (changes.md §1).
 *
 * Pure + unit-tested. Decides which prediction slots are visible for a
 * session at a given instant. The clock keys off the SCHEDULED start plus a
 * FIXED duration (Quali 60m, Race 90m — project owner's decision), never the
 * actual session timing.
 *
 *   - P3 picks reveal at start + 1/3 duration
 *   - P2 picks reveal at start + 2/3 duration
 *   - P1 picks NEVER reveal here — they belong to the Reveal cinematic
 *   - Sprint Quali / Sprint Race: no pick reveal at all (roster only)
 *
 * SECURITY: callers must use this to decide what leaves the server. Never
 * return a slot whose flag is false; in particular P1 is never exposed.
 */

import { SESSION_DURATION_MIN } from "../sessionDuration";

export type RevealState = {
  /** True only for quali/race — sprint sessions show the roster only. */
  progressive: boolean;
  showP3: boolean;
  showP2: boolean;
  /** Scheduled window has elapsed (drives the "P1 in the Reveal" CTA). */
  sessionOver: boolean;
};

const PROGRESSIVE_TYPES = new Set(["quali", "race"]);

export function revealState(
  sessionType: string,
  scheduledStartAt: string | Date,
  now: Date = new Date(),
): RevealState {
  const start =
    typeof scheduledStartAt === "string"
      ? new Date(scheduledStartAt)
      : scheduledStartAt;

  if (!PROGRESSIVE_TYPES.has(sessionType)) {
    return {
      progressive: false,
      showP3: false,
      showP2: false,
      sessionOver: false,
    };
  }

  const durationMs = SESSION_DURATION_MIN[sessionType]! * 60_000;
  const elapsed = now.getTime() - start.getTime();

  return {
    progressive: true,
    showP3: elapsed >= durationMs / 3,
    showP2: elapsed >= (durationMs * 2) / 3,
    sessionOver: elapsed >= durationMs,
  };
}
