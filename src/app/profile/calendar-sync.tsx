"use client";

import { useState, useTransition } from "react";
import {
  enableCalendarSyncAction,
  type CalendarSyncResult,
} from "./actions";

/**
 * Calendar-sync panel (changes.md §3). Mints/reveals the per-user ICS
 * subscription URL and explains how to add it to Google Calendar — the same
 * pattern as F1's own "Add F1 calendar". Each session carries a 30-minute
 * "lock your prediction" reminder.
 */
export function CalendarSync({ hasToken }: { hasToken: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CalendarSyncResult | null>(null);
  const [copied, setCopied] = useState(false);

  function reveal() {
    startTransition(async () => {
      setResult(await enableCalendarSyncAction());
    });
  }

  const url = result?.ok ? result.httpsUrl : null;

  return (
    <section
      className="mt-12"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "var(--space-lg)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display), ui-sans-serif",
          fontSize: 14,
          letterSpacing: "0.02em",
        }}
      >
        SYNC TO GOOGLE CALENDAR
      </h2>
      <p
        className="mt-2 text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        Subscribe to the F1 session calendar and get a reminder{" "}
        <span style={{ color: "var(--fg)" }}>30 minutes before</span> every
        session to lock your prediction.
      </p>

      {!url && (
        <button
          type="button"
          onClick={reveal}
          disabled={pending}
          className="mt-4 px-4 py-2 text-sm"
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
            borderRadius: 4,
            fontWeight: 600,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending
            ? "Working…"
            : hasToken
              ? "Show my calendar link"
              : "Generate my calendar link"}
        </button>
      )}

      {result && !result.ok && (
        <p className="mt-3 text-sm" style={{ color: "var(--error)" }}>
          {result.error}
        </p>
      )}

      {url && (
        <div className="mt-4" style={{ display: "grid", gap: "var(--space-md)" }}>
          <div
            className="flex items-center gap-2"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "var(--space-sm) var(--space-md)",
            }}
          >
            <code
              className="flex-1 truncate text-xs"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                color: "var(--fg-muted)",
              }}
            >
              {url}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="text-xs"
              style={{
                color: "var(--accent)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <ol
            className="text-sm"
            style={{
              color: "var(--fg-muted)",
              listStyle: "decimal",
              paddingLeft: "1.25rem",
              display: "grid",
              gap: "var(--space-xs)",
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
              .
            </li>
            <li>Paste the link above and click “Add calendar”.</li>
            <li>
              You’ll get a notification 30 minutes before every F1 session.
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}
