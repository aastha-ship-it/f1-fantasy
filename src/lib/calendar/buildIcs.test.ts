import { describe, it, expect } from "vitest";
import { buildIcs, type IcsEvent } from "./buildIcs";

const NOW = new Date("2026-05-18T00:00:00Z");

const QUALI: IcsEvent = {
  id: "evt-abc",
  name: "Canadian Grand Prix",
  sessionLabel: "Qualifying",
  sessionType: "quali",
  start: new Date("2026-06-13T20:00:00Z"),
  end: new Date("2026-06-13T21:00:00Z"),
};

describe("buildIcs", () => {
  it("emits a well-formed VCALENDAR with CRLF and a trailing newline", () => {
    const ics = buildIcs([QUALI], { now: NOW });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("X-WR-CALNAME:F1 Fantasy");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT12H");
  });

  it("uses a stable UID and UTC timestamps", () => {
    const ics = buildIcs([QUALI], { now: NOW });
    expect(ics).toContain("UID:evt-abc@f1-fantasy");
    expect(ics).toContain("DTSTAMP:20260518T000000Z");
    expect(ics).toContain("DTSTART:20260613T200000Z");
    expect(ics).toContain("DTEND:20260613T210000Z");
  });

  it("attaches a single 30-minute lock-prediction alarm per event", () => {
    const ics = buildIcs([QUALI], { now: NOW });
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("DESCRIPTION:Lock your F1 Fantasy prediction");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(1);
  });

  it("falls back to a fixed duration when end is null (race = 90m)", () => {
    const ics = buildIcs(
      [
        {
          ...QUALI,
          sessionType: "race",
          sessionLabel: "Race",
          start: new Date("2026-06-14T19:00:00Z"),
          end: null,
        },
      ],
      { now: NOW },
    );
    expect(ics).toContain("DTSTART:20260614T190000Z");
    expect(ics).toContain("DTEND:20260614T203000Z");
  });

  it("escapes special characters in the summary", () => {
    const ics = buildIcs(
      [{ ...QUALI, name: "São Paulo; Grand, Prix" }],
      { now: NOW },
    );
    expect(ics).toContain(
      "SUMMARY:F1: São Paulo\\; Grand\\, Prix — Qualifying",
    );
  });

  it("emits one VEVENT per session", () => {
    const ics = buildIcs(
      [QUALI, { ...QUALI, id: "evt-def", sessionLabel: "Race" }],
      { now: NOW },
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:evt-abc@f1-fantasy");
    expect(ics).toContain("UID:evt-def@f1-fantasy");
  });
});
