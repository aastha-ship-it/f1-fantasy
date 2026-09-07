/**
 * Format "time until this session locks" for the pre-lock countdown copy.
 *
 *   formatLockDelta(2 * 86_400_000 + 14 * 3_600_000)        → "2d 14h"
 *   formatLockDelta(90 * 60_000)                            → "1h 30m"
 *   formatLockDelta(0)                                      → "Locked"
 *
 * Extracted on its third call site (dashboard hero, predict-list hero, mobile
 * lobby lock-progress card) per the design-handoff rule. The two copies it
 * replaces had DRIFTED — the dashboard's days branch carried a minutes term
 * and the predict list's did not — so this takes a flag rather than picking a
 * winner and silently changing one of them.
 *
 * `precise` is that flag: it adds the minutes term to the days branch
 * ("2d 14h 23m"). Dashboard hero passes it, predict-list hero does not, and
 * both render exactly what they rendered before. Mobile lobby §4.1 draws the
 * three-unit form, so it passes it too.
 *
 * The value is a SERVER snapshot at request time — it does not tick. The
 * authoritative ticking countdown is `lock-countdown.tsx`.
 */
export function formatLockDelta(
  msUntil: number,
  opts?: { precise?: boolean },
): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  if (days > 0) return opts?.precise ? `${days}d ${hh}h ${mm}m` : `${days}d ${hh}h`;
  if (hours > 0) return `${hours}h ${mm}m`;
  return `${minutes}m`;
}
