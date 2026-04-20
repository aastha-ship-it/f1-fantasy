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
