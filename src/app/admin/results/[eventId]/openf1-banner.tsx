"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OpenF1BannerState } from "@/lib/results/bannerState";
import type {
  FetchFromOpenF1Result,
  AcceptAsOfficialResult,
} from "./actions";
import type { RevealEventResult } from "@/lib/revealEvent";

/**
 * Admin OpenF1-fetch banner (design_handoff_phase11 §7) — sits above the
 * manual-entry form. Four states (idle / provisional / official / revealed),
 * derived server-side by `openF1BannerState`; this island only wires the
 * CTAs (reuses `fetchFromOpenF1Action`, the new `acceptAsOfficialAction`,
 * and `revealEventAction`). Tag/title/sub copy is verbatim from the canvas
 * `OpenF1FetchBanner`; the meta line is server-derived from real
 * `fetched_at`/`revealed_at` (the canvas's "6h ago / session_key 9621 /
 * cron in 4h 12m" is fabricated demo data — not rendered).
 */

type Variant = {
  tone: string;
  tag: string;
  tagBg: string;
  tagFg: string;
  title: string;
  sub: string;
};

const VARIANTS: Record<OpenF1BannerState, Variant> = {
  idle: {
    tone: "var(--accent)",
    tag: "No data yet",
    tagBg: "var(--accent)",
    tagFg: "#000",
    title: "Pull P1 / P2 / P3 from OpenF1",
    sub: "One click fetches the classified podium + fastest lap and runs the scoring pipeline. The nightly cron is a fallback.",
  },
  provisional: {
    tone: "var(--warning)",
    tag: "Provisional",
    tagBg: "var(--warning)",
    tagFg: "#000",
    title: "OpenF1 returned · provisional results",
    sub: "Scores written. Treat as provisional — OpenF1 may revise the classification (penalties, stewards). Refetching overwrites until you accept it as official.",
  },
  official: {
    tone: "var(--success)",
    tag: "Official",
    tagBg: "var(--success)",
    tagFg: "#000",
    title: "Results frozen as official",
    sub: "Manual entry or accepted OpenF1 fetch. Auto-fetch will no longer touch this row. Reveal the cinematic when the group is gathered.",
  },
  revealed: {
    tone: "var(--fg-subtle)",
    tag: "Frozen · revealed",
    tagBg: "var(--surface-2)",
    tagFg: "var(--fg-muted)",
    title: "Cinematic shipped — results frozen",
    sub: "The reveal has fired. No further fetches will overwrite this row, and the predictions RLS is no longer gated by the 1-hour fallback.",
  },
};

function ctaStyle(primary: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    letterSpacing: "0.06em",
    fontSize: 11,
    fontWeight: 600,
    padding: "12px 18px",
    textTransform: "uppercase",
    cursor: "pointer",
    background: primary ? "var(--accent)" : "transparent",
    color: primary ? "#000" : "var(--fg)",
    border: primary ? "none" : "1px solid var(--border)",
  };
}

export function OpenF1FetchBanner({
  state,
  eventId,
  metaText,
  formAnchor,
  fetchFromOpenF1,
  acceptAsOfficial,
  revealEvent,
}: {
  state: OpenF1BannerState;
  eventId: string;
  metaText: string;
  formAnchor: string;
  fetchFromOpenF1: (eventId: string) => Promise<FetchFromOpenF1Result>;
  acceptAsOfficial: (eventId: string) => Promise<AcceptAsOfficialResult>;
  revealEvent: (input: { eventId: string }) => Promise<RevealEventResult>;
}) {
  const v = VARIANTS[state];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.message ?? "Something went wrong.");
      else router.refresh();
    });
  }

  function confirmReveal() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Reveal this event to the whole group? Everyone's picks will open simultaneously.",
      )
    ) {
      return;
    }
    run(() => revealEvent({ eventId }));
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "var(--space-xl)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.05,
          background: `radial-gradient(ellipse at top right, ${v.tone}, transparent 60%)`,
        }}
      />
      <div
        className="relative grid items-center"
        style={{
          gridTemplateColumns: "auto 1fr auto",
          gap: "var(--space-xl)",
        }}
      >
        <div
          className="flex flex-col items-start"
          style={{ gap: "var(--space-sm)", minWidth: 130 }}
        >
          <div
            className="flex items-center"
            style={{ gap: "var(--space-sm)" }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                display: "inline-block",
                background: v.tone,
              }}
            />
            <span
              className="uppercase text-[color:var(--fg-subtle)]"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 10,
                letterSpacing: "0.14em",
              }}
              data-tabular
            >
              OpenF1 status
            </span>
          </div>
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.1em",
              padding: "4px 10px",
              background: v.tagBg,
              color: v.tagFg,
              fontWeight: 600,
            }}
            data-tabular
          >
            {v.tag}
          </span>
        </div>

        <div
          className="flex min-w-0 flex-col"
          style={{ gap: "var(--space-sm)" }}
        >
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 18,
              letterSpacing: "0.005em",
            }}
          >
            {v.title}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "var(--fg-muted)",
              lineHeight: 1.55,
              maxWidth: 600,
            }}
          >
            {v.sub}
          </span>
          <span
            className="text-[color:var(--fg-subtle)]"
            style={{
              marginTop: "var(--space-xs)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.06em",
            }}
            data-tabular
          >
            {metaText}
          </span>
          {err && (
            <span
              style={{
                marginTop: "var(--space-xs)",
                fontSize: 12,
                color: "var(--error)",
              }}
            >
              {err}
            </span>
          )}
        </div>

        <div
          className="flex flex-col items-stretch"
          style={{ gap: "var(--space-sm)", minWidth: 200 }}
        >
          {state === "idle" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => fetchFromOpenF1(eventId))}
              style={{ ...ctaStyle(true), opacity: pending ? 0.6 : 1 }}
            >
              {pending ? "Working…" : "Fetch from OpenF1 →"}
            </button>
          )}
          {state === "provisional" && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => fetchFromOpenF1(eventId))}
                style={{ ...ctaStyle(false), opacity: pending ? 0.6 : 1 }}
              >
                {pending ? "Working…" : "Refetch from OpenF1"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => acceptAsOfficial(eventId))}
                style={{ ...ctaStyle(false), opacity: pending ? 0.6 : 1 }}
              >
                Accept as official →
              </button>
            </>
          )}
          {state === "official" && (
            <>
              <a href={formAnchor} style={ctaStyle(false)}>
                Edit manually
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={confirmReveal}
                style={{ ...ctaStyle(true), opacity: pending ? 0.6 : 1 }}
              >
                {pending ? "Revealing…" : "Reveal to group →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
