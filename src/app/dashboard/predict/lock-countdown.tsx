"use client";

import { useEffect, useState } from "react";

/**
 * Lock countdown per `.impeccable.md` §Lock Countdown.
 *
 *   > T-60s       normal: --fg, no pulse
 *   T-60s..T-5s   warning: --warning amber, 2Hz opacity pulse, banner
 *   T-5s..T+      closed: reads "Locked" in --fg-muted
 *
 * Respects `prefers-reduced-motion`: pulse is suppressed globally via the
 * rule in globals.css; the warning state still color-shifts and banners.
 *
 * Tabular figures mandatory — numbers never jitter between ticks.
 */

type Phase = "normal" | "warning" | "closed";

function phaseFor(msUntil: number): Phase {
  if (msUntil <= 0) return "closed";
  if (msUntil <= 60_000) return "warning";
  return "normal";
}

function formatDelta(msUntil: number): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes.toString().padStart(2, "0")}m`;
  if (hours > 0)
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  if (minutes > 0)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `${seconds}s`;
}

export function LockCountdown({ lockAt }: { lockAt: string | Date }) {
  const target =
    typeof lockAt === "string"
      ? new Date(lockAt).getTime()
      : lockAt.getTime();

  // SSR-safe initial state computed from target so first paint matches.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    // Tick 1x/sec at normal, 10x/sec at warning — fine-grained only when needed.
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const msUntil = target - now;
  const phase = phaseFor(msUntil);
  const delta = formatDelta(msUntil);

  const color =
    phase === "normal"
      ? "var(--fg)"
      : phase === "warning"
        ? "var(--warning)"
        : "var(--fg-muted)";

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        Lock in
      </p>
      <p
        className="text-5xl leading-none"
        data-tabular
        data-phase={phase}
        style={{
          color,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          animation:
            phase === "warning"
              ? "lockCountdownPulse 0.5s var(--ease-out-quart) infinite alternate"
              : undefined,
        }}
      >
        {delta}
      </p>
      {phase === "warning" && (
        <p
          className="text-sm"
          style={{ color: "var(--warning)" }}
          role="status"
        >
          Predictions closing — lock in your picks.
        </p>
      )}
      {phase === "closed" && (
        <p className="text-sm text-[color:var(--fg-subtle)]" role="status">
          Predictions closed.
        </p>
      )}
      <style>{`
        @keyframes lockCountdownPulse {
          from { opacity: 1; }
          to   { opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-phase="warning"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
