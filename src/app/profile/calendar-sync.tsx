"use client";

import { useState, useTransition } from "react";
import { enableCalendarSyncAction, type CalendarSyncResult } from "./actions";
import { MobButton, MobSectionHead } from "@/components/MobilePrimitives";

/**
 * Calendar-sync panel (changes.md §5 / design_handoff_phase11 §5).
 *
 * Two-column: left explains + (once revealed) shows the ICS URL + 3-step
 * how-to; right is a stats card whose CTA mints-if-absent then reveals the
 * per-user subscription link. Each session carries a 30-minute
 * "lock your prediction" reminder. Client only for the clipboard + the
 * reveal transition; counts are server-computed props.
 *
 * 390pt fork (PR-2 §3, canvas `screens-mobile-c.jsx:MobProfileScreen`):
 * pattern B — the two-column panel and the single stacked card are genuinely
 * different trees, so the existing <section> takes `hidden md:grid` ON
 * ITSELF (a wrapper would change the desktop box) and a `md:hidden` sibling
 * carries the phone card. Both read the same `pending` / `result` / `copied`
 * state, so the two trees cannot drift; every control in the mobile tree is
 * a stateless handler, never a duplicated field.
 *
 * The three numbered Google-Calendar steps live inside the desktop tree and
 * are therefore absent on a phone, which is what the canvas draws.
 */
export function CalendarSync({
  eventCount,
  sessionCount,
}: {
  eventCount: number;
  sessionCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CalendarSyncResult | null>(null);
  const [copied, setCopied] = useState(false);

  function reveal() {
    startTransition(async () => {
      setResult(await enableCalendarSyncAction());
    });
  }

  const url = result?.ok ? result.httpsUrl : null;

  // Hoisted out of the desktop button's inline handler so both trees share
  // one implementation (and one `copied` flag) — see the fork note above.
  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      {/* Mobile card — section head, glyph + copy, URL row, one surface CTA. */}
      <div className="mt-[26px] md:hidden">
        <MobSectionHead title="Calendar sync" meta="Beta" />
        <div className="border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <CalendarGlyph size={34} />
            <p
              className="m-0 text-[color:var(--fg-muted)]"
              style={{ fontSize: 12, lineHeight: 1.5 }}
            >
              <span data-tabular>
                {eventCount} events · {sessionCount} sessions
              </span>
              . Reminder{" "}
              <span className="font-semibold text-[color:var(--fg)]">
                30 minutes before
              </span>{" "}
              every session so you never miss a lock.
            </p>
          </div>

          {result && !result.ok && (
            <p className="mt-3 text-xs text-[color:var(--error)]">
              {result.error}
            </p>
          )}

          {url && (
            <div
              className="mt-3.5 flex items-center gap-2.5 border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 9,
                color: "var(--fg-muted)",
              }}
            >
              <span className="flex-1 truncate">{url}</span>
              {/* A real 44px target, not the canvas's bare text: this is the
                  only way to get the link off a phone. */}
              <button
                type="button"
                onClick={copy}
                className="min-h-[44px] shrink-0 cursor-pointer uppercase"
                style={{
                  color: "var(--accent)",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          <div className="mt-3">
            <MobButton tone="surface" onClick={reveal} disabled={pending}>
              {pending ? "Working…" : "Add to Google Calendar"}
            </MobButton>
          </div>
        </div>
      </div>

      <section
        className="hidden grid-cols-1 items-start gap-[var(--space-xl)] md:grid md:grid-cols-[1fr_auto] md:gap-[var(--space-2xl)]"
        style={{
          marginTop: "var(--space-3xl)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "var(--space-2xl)",
        }}
      >
        <div>
          <div
            className="flex items-center"
            style={{
              gap: "var(--space-md)",
              marginBottom: "var(--space-sm)",
            }}
          >
            <span
              className="uppercase"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: 16,
                letterSpacing: "0.04em",
              }}
            >
              Sync to Google Calendar
            </span>
            <span
              className="uppercase text-[color:var(--fg-subtle)]"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 9,
                letterSpacing: "0.14em",
                padding: "3px 8px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
              data-tabular
            >
              Beta · uses your Google account
            </span>
          </div>

          <p
            className="m-0"
            style={{
              color: "var(--fg-muted)",
              fontSize: 14,
              lineHeight: 1.55,
              maxWidth: 560,
            }}
          >
            Subscribe to the F1 session calendar and get a reminder{" "}
            <span style={{ color: "var(--fg)", fontWeight: 600 }}>
              30 minutes before
            </span>{" "}
            every session — Friday FP through Sunday race — so you never miss a
            lock.
          </p>

          {result && !result.ok && (
            <p
              className="text-sm"
              style={{ color: "var(--error)", marginTop: "var(--space-lg)" }}
            >
              {result.error}
            </p>
          )}

          {url && (
            <>
              <div
                className="flex items-center"
                style={{
                  marginTop: "var(--space-lg)",
                  padding: "10px 14px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  gap: "var(--space-md)",
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--fg-muted)",
                }}
              >
                <span className="flex-1 truncate">{url}</span>
                <button
                  type="button"
                  onClick={copy}
                  className="cursor-pointer md:whitespace-nowrap"
                  style={{ color: "var(--accent)", fontWeight: 600 }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <ol
                style={{
                  marginTop: "var(--space-lg)",
                  paddingLeft: 18,
                  color: "var(--fg-muted)",
                  fontSize: 13,
                  lineHeight: 1.7,
                  listStyle: "decimal",
                }}
              >
                <li>
                  Open{" "}
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    Google Calendar → Other calendars → From URL
                  </a>
                </li>
                <li>
                  Paste the link above and click{" "}
                  <span style={{ color: "var(--fg)" }}>Add calendar</span>
                </li>
                <li>
                  You&apos;ll get a notification 30 minutes before every F1
                  session
                </li>
              </ol>
            </>
          )}
        </div>

        <div
          className="flex flex-col items-center"
          style={{
            gap: "var(--space-md)",
            padding: "var(--space-xl)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            minWidth: 240,
          }}
        >
          <CalendarGlyph size={44} />
          <div
            className="uppercase text-center text-[color:var(--fg-subtle)]"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
            data-tabular
          >
            {eventCount} events · {sessionCount} sessions
            <br />
            30-min lock alarms
          </div>
          <button
            type="button"
            onClick={reveal}
            disabled={pending}
            className="cursor-pointer uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              letterSpacing: "0.06em",
              padding: "10px 18px",
              background: "var(--accent)",
              color: "#000",
              border: "none",
              fontSize: 11,
              fontWeight: 600,
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? "Working…" : "Show my calendar link"}
          </button>
        </div>
      </section>
    </>
  );
}

/**
 * The handoff's calendar glyph. Two call sites (34 on the phone card, 44 in
 * the desktop stats card) that differ only in size, so it is one local
 * component rather than the same 8 nodes typed twice.
 */
function CalendarGlyph({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="6"
        y="10"
        width="36"
        height="32"
        fill="none"
        stroke="var(--fg-muted)"
        strokeWidth="2"
      />
      <line
        x1="6"
        y1="18"
        x2="42"
        y2="18"
        stroke="var(--fg-muted)"
        strokeWidth="2"
      />
      <line
        x1="16"
        y1="6"
        x2="16"
        y2="14"
        stroke="var(--fg-muted)"
        strokeWidth="2"
      />
      <line
        x1="32"
        y1="6"
        x2="32"
        y2="14"
        stroke="var(--fg-muted)"
        strokeWidth="2"
      />
      <circle
        cx="34"
        cy="32"
        r="7"
        fill="var(--bg)"
        stroke="var(--accent)"
        strokeWidth="2"
      />
      <path
        d="M34 28 L34 32 L37 34"
        stroke="var(--accent)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
