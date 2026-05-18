/**
 * Pure RFC-5545 VCALENDAR builder for the per-user F1 session feed
 * (changes.md §3). No I/O — fully unit-testable.
 *
 * One VEVENT per session with a stable UID (so subscribed clients update
 * rather than duplicate) and a single 30-minute DISPLAY alarm prompting the
 * user to lock their prediction.
 */

import { sessionDurationMs } from "../sessionDuration";

export type IcsEvent = {
  /** events.id — used verbatim in the stable UID. */
  id: string;
  /** Grand Prix / event name, e.g. "Canadian Grand Prix". */
  name: string;
  /** Human session label, e.g. "Qualifying". */
  sessionLabel: string;
  /** events.session_type — drives the DTEND fallback. */
  sessionType: string;
  /** Scheduled start (session_start_at). */
  start: Date;
  /** Scheduled end (session_end_at); null → start + fixed duration. */
  end: Date | null;
};

const REMINDER_DESCRIPTION = "Lock your F1 Fantasy prediction";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC timestamp in iCalendar form: YYYYMMDDTHHMMSSZ. */
function fmtUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Escape a TEXT value per RFC 5545 §3.3.11. */
function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long content lines to ≤75 octets with space-prefixed continuations. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return out.join("\r\n");
}

export function buildIcs(
  events: IcsEvent[],
  opts: { now?: Date; calName?: string } = {},
): string {
  const dtstamp = fmtUtc(opts.now ?? new Date());
  const calName = opts.calName ?? "F1 Fantasy";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//F1 Fantasy//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const e of events) {
    const end =
      e.end ?? new Date(e.start.getTime() + sessionDurationMs(e.sessionType));
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@f1-fantasy`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${fmtUtc(e.start)}`,
      `DTEND:${fmtUtc(end)}`,
      fold(`SUMMARY:${esc(`F1: ${e.name} — ${e.sessionLabel}`)}`),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(REMINDER_DESCRIPTION)}`,
      "TRIGGER:-PT30M",
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
