/**
 * Centralized human-facing copy for session types + date formatting.
 * Used by the dashboard, predict list, predict picker, and admin pages so
 * users see the same names and formats everywhere.
 */

export type SessionType = "race" | "quali" | "sprint_race" | "sprint_quali";

export const SESSION_LABEL: Record<SessionType, string> = {
  race: "Race",
  quali: "Qualifying",
  sprint_race: "Sprint",
  sprint_quali: "Sprint Qualifying",
};

export function sessionLabel(t: string): string {
  return SESSION_LABEL[t as SessionType] ?? t;
}

export function formatLocal(date: string | Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(typeof date === "string" ? new Date(date) : date);
  } catch {
    return String(date);
  }
}

/**
 * "SAT 16:30 IST" — the compact session clock the 390pt artboards draw
 * (`screens-mobile-b.jsx` §4.1 session rows).
 *
 * Weekday + 24h time + timezone abbreviation, because on a phone the row has
 * no space for `formatLocal`'s "2 May 2026, 2:00 AM" and the weekend is the
 * only date context a reader needs — the hero already names the round.
 *
 * `hourCycle: "h23"` rather than `hour12: false`: the latter renders midnight
 * as "24:00" in several locales. The timezone abbreviation is whatever the
 * runtime locale resolves — "IST" under en-IN, "GMT+5:30" under en-US — so
 * this is server-computed and handed to the client as a string, exactly like
 * `formatLocal`, or SSR and hydration would disagree.
 */
export function formatSessionClock(date: string | Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    })
      .format(typeof date === "string" ? new Date(date) : date)
      .replace(/,/g, "")
      .toUpperCase();
  } catch {
    return String(date);
  }
}
