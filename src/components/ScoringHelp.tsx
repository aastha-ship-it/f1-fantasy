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
        aria-label="How scoring works"
        // Padding is a class, not inline style, for the same reason SH1 moved
        // the dialog's: inline padding is unreachable by a breakpoint. Below
        // the 780px fork the trigger is the handoff's 32×32 box (`size-8
        // p-0`); `md:` restores the original pill verbatim.
        className="inline-flex cursor-pointer size-8 items-center justify-center gap-[var(--space-sm)] p-0 uppercase text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition-colors md:size-auto md:px-[var(--space-md)] md:py-[var(--space-xs)] md:text-[color:var(--fg-subtle)]"
        data-tabular
        style={{
          border: "1px solid var(--border)",
          background: "transparent",
          fontSize: 11,
          letterSpacing: "0.1em",
        }}
      >
        {/* Mobile glyph: a plain `?`, because the circled variant inside a
            32×32 box reads as a target inside a target. */}
        <span
          aria-hidden="true"
          className="md:hidden"
          data-tabular
          style={{ fontSize: 12, lineHeight: 1 }}
        >
          ?
        </span>
        <span
          aria-hidden="true"
          className="hidden items-center justify-center md:inline-flex"
          data-tabular
          style={{
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
        <span className="hidden lg:inline">How Scoring Works</span>
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
            // Padding moved off `style` so it can carry a breakpoint: 64px of
            // horizontal chrome inside a 345px dialog left ~271px of content
            // at 375px. `md:` restores the original 24px/32px verbatim.
            className="flex items-start justify-between p-[var(--space-lg)] md:px-[var(--space-2xl)] md:py-[var(--space-xl)]"
            style={{
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
          <div className="p-[var(--space-lg)] md:p-[var(--space-2xl)]">
            <ScoringLegendBody />
          </div>
        </div>
      </dialog>
    </>
  );
}
