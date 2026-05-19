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
 * Design pass (Phase 14 PR 1 — design_handoff_phase11 §9): bordered trigger
 * with a circular "?" glyph; modal shell is a 720px card (no border-radius),
 * header = "Reference" caption + Boldonse "How scoring works" title + an
 * "ESC ✕" close button; scrim + blur live in globals.css. Built to README
 * §9 prose (no canvas artboard exists for the modal). Native <dialog> kept
 * deliberately over a useState overlay — free top-layer/focus-trap/Esc.
 */
export function ScoringHelp() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-[var(--space-sm)] uppercase text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)] transition-colors"
        data-tabular
        style={{
          border: "1px solid var(--border)",
          background: "transparent",
          padding: "var(--space-xs) var(--space-md)",
          fontSize: 11,
          letterSpacing: "0.1em",
        }}
      >
        <span
          aria-hidden="true"
          data-tabular
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "1px solid var(--fg-muted)",
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          ?
        </span>
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
          width: "min(92vw, 720px)",
          maxHeight: "85vh",
          overflow: "auto",
          color: "var(--fg)",
        }}
      >
        <div
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="flex items-start justify-between"
            style={{
              padding: "var(--space-xl) var(--space-2xl)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <p
                className="uppercase text-[color:var(--fg-subtle)]"
                data-tabular
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  marginBottom: "var(--space-sm)",
                }}
              >
                Reference
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-display), ui-sans-serif",
                  fontSize: 32,
                  lineHeight: 0.9,
                  letterSpacing: "-0.01em",
                }}
              >
                How scoring works
              </h2>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              data-tabular
              className="cursor-pointer text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
              style={{
                fontSize: 11,
                border: "1px solid var(--border)",
                padding: "var(--space-sm) var(--space-lg)",
              }}
            >
              ESC ✕
            </button>
          </div>
          <div style={{ padding: "var(--space-2xl)" }}>
            <ScoringLegendBody />
          </div>
        </div>
      </dialog>
    </>
  );
}
