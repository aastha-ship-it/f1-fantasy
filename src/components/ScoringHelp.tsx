"use client";

import { useRef } from "react";
import { ScoringLegendBody } from "./ScoringLegend";

/**
 * Global "How Scoring Works" trigger + modal (changes.md §8).
 *
 * Lives in the TopBar (every authenticated screen), replacing the old
 * "The Group · {season}" label. Native <dialog> so the backdrop, focus
 * trap, and Esc-to-close are free; ScoringLegendBody is the single source
 * of the point-system content. Visible on mobile too — it's now the only
 * scoring-rules surface.
 *
 * Shell kept deliberately minimal/swappable: an upcoming Claude Design pass
 * will restyle the dialog without touching the TopBar wiring.
 */
export function ScoringHelp() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="cursor-pointer text-xs uppercase tracking-[0.1em] text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)] transition-colors"
        data-tabular
      >
        How Scoring Works
      </button>

      <dialog
        ref={ref}
        aria-label="How scoring works"
        onClick={(e) => {
          // Backdrop click (the dialog element itself, not its content).
          if (e.target === ref.current) ref.current?.close();
        }}
        style={{
          margin: "auto",
          padding: 0,
          border: "none",
          background: "transparent",
          width: "min(92vw, 560px)",
          maxHeight: "85vh",
          overflow: "auto",
          color: "var(--fg)",
        }}
      >
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display), ui-sans-serif",
                fontSize: 16,
                letterSpacing: "0.02em",
              }}
            >
              HOW SCORING WORKS
            </h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="cursor-pointer text-lg leading-none text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
            >
              ✕
            </button>
          </div>
          <div style={{ padding: "var(--space-md)" }}>
            <ScoringLegendBody />
          </div>
        </div>
      </dialog>
    </>
  );
}
