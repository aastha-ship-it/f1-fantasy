"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrackDiagram } from "@/components/TrackDiagram";
import { shortEventName } from "@/lib/design/eventName";
import { sessionLabel } from "@/lib/sessionLabel";

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;
const STORAGE_KEY = "f1_dismissed_reveals";

export type RevealCandidate = {
  event_id: string;
  name: string;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  circuit: string;
  ergast_circuit_id: string | null;
};

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...set]),
    );
  } catch {
    /* localStorage may be disabled in private browsing — fail silent */
  }
}

/**
 * Top-of-dashboard "fresh reveals" banner. Surfaces the most recent revealed
 * event the user has a prediction for, with a single tap into the cinematic.
 * Per-event dismissal persists in localStorage so it doesn't follow the user
 * around after they've watched (or chosen to ignore it).
 */
export function RevealNotice({ candidates }: { candidates: RevealCandidate[] }) {
  // Hydrate-after-mount so SSR markup doesn't differ from client output. We
  // only know what to filter once we can read localStorage.
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // Deferred hydration: localStorage isn't available during SSR, so we mount
    // empty and reconcile on the client. Both setState calls below are
    // intentional and run exactly once. eslint-disable for the set-state-in-
    // effect rule which is over-eager for hydration patterns.
    /* eslint-disable react-hooks/set-state-in-effect */
    setDismissed(readDismissed());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (!hydrated) return null;
  const live = candidates.filter((c) => !dismissed.has(c.event_id));
  if (live.length === 0) return null;

  const top = live[0]!;
  const more = live.length - 1;

  function dismiss(eventId: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      writeDismissed(next);
      return next;
    });
  }

  const short = shortEventName(top.name);
  const session = sessionLabel(top.session_type);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={top.event_id}
        role="status"
        className="overflow-hidden bg-[color:var(--accent)]"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.45, ease: EASE_OUT_QUART }}
        data-testid="reveal-notice"
      >
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-6 py-3 text-black sm:gap-6 sm:px-8 lg:px-12 xl:px-16">
          {/* Track thumbnail — recognisable shorthand for the round. */}
          <div
            className="hidden shrink-0 sm:block"
            aria-hidden
            style={{ filter: "invert(1) brightness(0)" }}
          >
            <TrackDiagram
              circuit={top.ergast_circuit_id ?? top.circuit}
              size={48}
              stroke="currentColor"
              strokeWidth={2}
            />
          </div>

          <Link
            href={`/reveal/${top.event_id}`}
            onClick={() => dismiss(top.event_id)}
            className="flex flex-1 items-baseline gap-3"
          >
            <span
              className="leading-none"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: 18,
                letterSpacing: "0.02em",
              }}
            >
              RESULTS REVEALED
            </span>
            <span
              className="hidden text-[12px] uppercase opacity-80 sm:inline"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                letterSpacing: "0.1em",
              }}
              data-tabular
            >
              R{String(top.round).padStart(2, "0")} · {short.toUpperCase()} ·{" "}
              {session.toUpperCase()}
            </span>
            <span
              className="ml-auto text-sm font-semibold uppercase"
              style={{ letterSpacing: "0.04em" }}
            >
              Tap to watch →
            </span>
          </Link>

          {more > 0 && (
            <Link
              href="/dashboard/predict"
              className="hidden text-[11px] uppercase opacity-80 hover:opacity-100 sm:inline"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                letterSpacing: "0.1em",
              }}
              data-tabular
            >
              +{more} more →
            </Link>
          )}

          <button
            type="button"
            onClick={() => dismiss(top.event_id)}
            aria-label="Dismiss reveal notice"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-base hover:bg-black/10"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
