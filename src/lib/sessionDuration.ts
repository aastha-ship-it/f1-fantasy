/**
 * Fixed session durations (changes.md §1 + §3).
 *
 * Single source of truth shared by:
 *   - the Lobby progressive-reveal gate (quali/race only)
 *   - the ICS calendar feed's DTEND fallback when session_end_at is null
 *
 * The project owner explicitly fixed Quali = 60m and Race = 90m for the
 * progressive reveal; sprint values are only ever used as a calendar DTEND
 * fallback (OpenF1 normally supplies a real date_end).
 */

export const SESSION_DURATION_MIN: Record<string, number> = {
  quali: 60,
  race: 90,
  sprint_race: 60,
  sprint_quali: 45,
};

export function sessionDurationMs(type: string): number {
  return (SESSION_DURATION_MIN[type] ?? 90) * 60_000;
}
