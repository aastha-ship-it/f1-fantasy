"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import type { SubmitPredictionResult } from "@/lib/submitPrediction";
import { DriverPortrait } from "@/components/DriverPortrait";
import { MobSectionHead } from "@/components/MobilePrimitives";
import { teamMeta } from "@/lib/design/teams";
import { formatAtTrack } from "@/lib/nudges/format";
import { formPillColor } from "@/lib/nudges/formColor";
import { orderRecentForm } from "@/lib/nudges/recentForm";

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

type Driver = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

type Slot = "p1" | "p2" | "p3";
type Picks = { p1: number | null; p2: number | null; p3: number | null };

export type DriverNudge = {
  recent_form: string;
  at_track_podiums: number | null;
  at_track_wins: number | null;
  quali_race_delta: number | null;
};

function formatLockDelta(msUntil: number): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0)
    return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m`;
  if (hours > 0)
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  if (minutes > 0)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return `${seconds}s`;
}

function nudgeDeltaLabel(delta: number | null): string {
  if (delta == null) return "—";
  if (delta > 0) return `+${delta.toFixed(1)}`;
  if (delta < 0) return `−${Math.abs(delta).toFixed(1)}`;
  return "0.0";
}

function nudgeDeltaColor(delta: number | null): string {
  if (delta == null) return "var(--fg-muted)";
  if (delta > 0) return "var(--success)";
  if (delta < 0) return "var(--warning)";
  return "var(--fg)";
}

export function DriverPicker({
  eventId,
  round,
  sessionLabel,
  isSprint,
  lockAt,
  drivers,
  initialPicks,
  nudges,
  circuit,
  hotPicks,
  submit,
}: {
  eventId: string;
  round: number;
  sessionLabel: string;
  isSprint: boolean;
  lockAt: string | Date;
  drivers: Driver[];
  initialPicks: Picks;
  nudges?: Record<number, DriverNudge>;
  circuit?: string;
  hotPicks?: { p1: string[]; p2: string[]; p3: string[] };
  submit: (input: {
    eventId: string;
    p1: number;
    p2: number | null;
    p3: number | null;
  }) => Promise<SubmitPredictionResult>;
}) {
  const target =
    typeof lockAt === "string" ? new Date(lockAt).getTime() : lockAt.getTime();
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);
  const msUntil = target - now;
  const isClosed = msUntil <= 0;
  const isWarning = !isClosed && msUntil <= 60_000;

  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "err"; message: string } | null
  >(null);
  const [justSaved, setJustSaved] = useState<{ at: Date } | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  // Auto-dismiss the F1 banner after 4s (matches reveal-cinematic cadence).
  useEffect(() => {
    if (!bannerOpen) return;
    const t = setTimeout(() => setBannerOpen(false), 4000);
    return () => clearTimeout(t);
  }, [bannerOpen]);

  const slots: Slot[] = isSprint ? ["p1"] : ["p1", "p2", "p3"];
  const filledCount = slots.filter((s) => picks[s] !== null).length;
  const allFilled = filledCount === slots.length;
  const distinctFilled =
    new Set(
      slots.map((s) => picks[s]).filter((v): v is number => v !== null),
    ).size === filledCount;
  const canSubmit = !isClosed && !pending && allFilled && distinctFilled;

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const pickedIds = new Set(
    slots.map((s) => picks[s]).filter((v): v is number => v !== null),
  );

  function fillNextEmpty(driverId: number) {
    if (isClosed || pending) return;
    setFeedback(null);
    setJustSaved(null);
    setPicks((prev) => {
      // If already picked, remove it (toggle off).
      const slotWith = slots.find((s) => prev[s] === driverId);
      if (slotWith) return { ...prev, [slotWith]: null };
      // Fill earliest empty slot.
      const empty = slots.find((s) => prev[s] === null);
      if (!empty) return prev;
      return { ...prev, [empty]: driverId };
    });
  }

  function clearSlot(slot: Slot) {
    if (isClosed || pending) return;
    setFeedback(null);
    setJustSaved(null);
    setPicks((prev) => ({ ...prev, [slot]: null }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await submit({
        eventId,
        p1: picks.p1!,
        p2: isSprint ? null : picks.p2!,
        p3: isSprint ? null : picks.p3!,
      });
      if (result.ok) {
        setJustSaved({ at: new Date() });
        setBannerOpen(true);
      } else {
        const msg =
          result.error === "LOCKED"
            ? "Predictions closed."
            : result.error === "VALIDATION"
              ? result.message
              : result.error === "UNAUTHENTICATED"
                ? "Please sign in again."
                : result.message;
        setFeedback({ kind: "err", message: msg });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      /* The form's bottom padding is what keeps the last row of THE GRID
         above the fixed lock bar. Below the fork the lock bar now sits one
         tab-bar height higher, so the padding has to grow by exactly that
         much or the offset would trade a covered button for a covered last
         driver row. `md:pb-32` is the original value, byte-for-byte, at and
         above the fork where MobileTabBar is hidden. */
      className="pb-[calc(8rem+var(--tabbar-h)+env(safe-area-inset-bottom,0px))] md:pb-32"
      data-testid="driver-picker"
    >
      {/* Slot cards — single full-width column below md; 1.2fr 1fr 1fr
          (P1 wider) at md and up. Sprint shows just P1 full-width at every
          width. */}
      {/* Below the fork the canvas draws three separately-bordered cards
          stacked with a 10px gap; at md this is the original 1px-hairline
          grid (gap-px over a --border ground, cards borderless). Gap and
          ground moved out of the inline style so they can fork at all. */}
      <section
        className={`mt-10 grid gap-2.5 border-0 border-[color:var(--border)] bg-transparent md:gap-px md:border md:bg-[color:var(--border)] ${
          isSprint
            ? "grid-cols-[1fr]"
            : "grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr]"
        }`}
      >
        {slots.map((slot, idx) => {
          const id = picks[slot];
          const d = id != null ? driverById.get(id) : undefined;
          const t = d ? teamMeta(d.team) : null;
          const isP1 = idx === 0;
          const n = d && nudges ? nudges[d.id] : undefined;

          return (
            <div
              key={slot}
              className="relative flex min-h-[96px] flex-col gap-2 overflow-hidden border border-[color:var(--border)] p-4 md:min-h-[320px] md:gap-5 md:border-0 md:p-7"
              style={{
                background: isP1 ? "var(--surface-2)" : "var(--surface)",
              }}
            >
              {/* Watermark livery car. Wrapped in a mask div that fades the
                  bottom ~45% to transparent so the telemetry panel below it
                  reads on clean surface, not bodywork. */}
              {d && t && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute hidden md:block"
                  style={{
                    right: -40,
                    top: 40,
                    width: 460,
                    height: 180,
                    maskImage:
                      "linear-gradient(180deg, black 55%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(180deg, black 55%, transparent 100%)",
                  }}
                >
                  <Image
                    src={t.carSrc}
                    alt=""
                    width={460}
                    height={180}
                    unoptimized
                    className="select-none"
                    style={{
                      opacity: 0.32,
                      width: 460,
                      height: "auto",
                      maxWidth: "none",
                    }}
                  />
                </div>
              )}

              {/* Phone watermark (canvas §3.2: `F1Car` at opacity .26,
                  right -70, bottom -14). A separate element, not a class fork
                  on the one above: the desktop version is masked and top-
                  anchored, this one is bottom-anchored and unmasked, so they
                  share no geometry. Both live inside the card's
                  `overflow-hidden`, so the negative right offset clips rather
                  than adding document width — the offsets the README bans are
                  the ones on track art, which must stay inset. */}
              {d && t && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute md:hidden"
                  style={{ right: -70, bottom: -14 }}
                >
                  <Image
                    src={t.carSrc}
                    alt=""
                    width={300}
                    height={118}
                    unoptimized
                    className="select-none"
                    style={{
                      opacity: 0.26,
                      width: 300,
                      height: "auto",
                      maxWidth: "none",
                    }}
                  />
                </div>
              )}

              {/* Pattern B' — contents-wrapped fork. The canvas puts `P{n}`
                  and the driver block on ONE row; the desktop stacks them.
                  `md:contents` removes this wrapper's box entirely above the
                  fork, so both children become direct flex-column children of
                  the card again and the 1440 render is byte-identical. */}
              <div className="relative flex items-center gap-3.5 md:contents">
              <div className="relative flex shrink-0 items-baseline justify-between md:shrink">
                <span
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    // Minimums are the canvas's mobile sizes (52 / 40).
                    // At >=780 `12vw`/`10vw` are already 93.6/78, so the
                    // clamp resolves exactly as before above the fork — the
                    // minimum only bites below ~433px.
                    fontSize: isP1
                      ? "clamp(52px, 12vw, 96px)"
                      : "clamp(40px, 10vw, 64px)",
                    lineHeight: 0.85,
                  }}
                  data-tight
                >
                  P{idx + 1}
                </span>
                {/* The canvas drops this label on mobile — the slot's
                    filled/empty state is already unambiguous at 390. */}
                <span
                  className="hidden text-[10px] uppercase md:inline"
                  style={{
                    letterSpacing: "0.1em",
                    color: d ? "var(--fg-muted)" : "var(--fg-subtle)",
                  }}
                  data-tabular
                >
                  {d ? "Picked" : "Tap a driver"}
                </span>
              </div>

              {d && t ? (
                <div className="relative flex items-center gap-4">
                  {/* B' again: DriverPortrait writes `size` to inline
                      width/height, which no class can override. */}
                  <div className="hidden md:contents">
                    <DriverPortrait code={d.code} team={d.team} size={72} />
                  </div>
                  <div className="shrink-0 md:hidden">
                    <DriverPortrait code={d.code} team={d.team} size={52} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[20px] leading-none md:text-[28px]"
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {d.code}
                    </span>
                    <span className="text-xs text-[color:var(--fg-muted)] md:text-sm">
                      {d.full_name}
                    </span>
                    <span
                      className="mt-1 inline-block self-start px-2 py-0.5 text-[9px] uppercase md:text-[10px]"
                      style={{
                        letterSpacing: "0.1em",
                        border: `1px solid ${t.hex}`,
                        color: t.hex,
                      }}
                      data-tabular
                    >
                      {t.name}
                    </span>
                  </div>
                </div>
              ) : (
                // `md:contents` so the <p> stays the card's own direct
                // child above the fork — the wrapper exists only to hang the
                // canvas's accent prompt underneath at phone width.
                <div className="relative md:contents">
                  <p
                    className="relative italic text-[color:var(--fg-muted)]"
                    style={{ fontWeight: 500, fontSize: 16 }}
                  >
                    Who&rsquo;s on the podium?
                  </p>
                  <p
                    className="mt-1.5 uppercase text-[color:var(--accent)] md:hidden"
                    data-tabular
                    style={{ fontSize: 9, letterSpacing: "0.12em" }}
                  >
                    Tap to pick →
                  </p>
                </div>
              )}
              </div>

              {/* Telemetry panel — lifted onto a tinted contrast surface so
                  the data row reads cleanly on top of the masked livery car.
                  Team-color top border ties the strip visually to the slot's
                  driver. */}
              {/* The tinted ground + team-hex top border are the desktop
                  treatment; the canvas draws a plain hairline on the card
                  ground at 390. Both computed colours are inline-only values,
                  so they move to custom properties and the CLASSES fork.
                  Padding is written per side on both sides of the fork:
                  Tailwind sorts the `p-*` shorthand BEFORE `pt-*`/`pb-*`, so
                  a base longhand would outlive an `md:` shorthand. */}
              <div
                className="relative mt-1.5 border-t border-[color:var(--border)] bg-transparent px-0 pt-3 pb-0 md:mt-auto md:border-t-[color:var(--tele-edge)] md:bg-[var(--tele-tint)] md:px-[var(--space-lg)] md:pt-[var(--space-lg)] md:pb-[var(--space-lg)]"
                aria-label={`Telemetry for ${d?.code ?? `slot P${idx + 1}`}`}
                style={
                  {
                    zIndex: 1,
                    "--tele-tint": t?.hex
                      ? `color-mix(in oklch, ${t.hex} 8%, var(--surface))`
                      : "var(--surface-2)",
                    "--tele-edge": t?.hex ?? "var(--border)",
                  } as React.CSSProperties
                }
              >
                <p
                  className="mb-2 text-[9px] uppercase text-[color:var(--fg-subtle)] md:mb-3 md:text-[10px]"
                  style={{ letterSpacing: "0.14em" }}
                  data-tabular
                >
                  Telemetry
                </p>
                {d && n ? (
                  <dl
                    className="flex flex-col gap-[7px] text-[10px] text-[color:var(--fg-muted)] md:flex-col md:gap-3 md:text-base"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[9px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] md:text-xs md:normal-case md:tracking-normal md:text-[color:var(--fg-muted)]">Form L5</dt>
                      <dd className="flex items-center justify-end gap-1">
                        {(() => {
                          // Oldest-left → latest-right (sports convention —
                          // changes.md §2 / design_handoff_phase11 §11).
                          // Ordering is the unit-locked `orderRecentForm`.
                          const toks = orderRecentForm(n.recent_form);
                          if (toks.length === 0) {
                            return (
                              <span
                                className="text-[color:var(--fg-subtle)]"
                                data-tabular
                              >
                                —
                              </span>
                            );
                          }
                          return (
                            <>
                              {toks.map((tok, i) => {
                                const latest = i === toks.length - 1;
                                return (
                                  <span
                                    key={i}
                                    className="min-w-[22px] text-[9px] md:min-w-6 md:text-[11px]"
                                    data-tabular
                                    style={{
                                      display: "inline-flex",
                                      justifyContent: "center",
                                      padding: "2px 5px",
                                      fontFamily:
                                        "var(--font-mono), ui-monospace, monospace",
                                      fontWeight: 600,
                                      letterSpacing: "0.04em",
                                      color: formPillColor(tok),
                                      background: latest
                                        ? "var(--surface-2)"
                                        : "transparent",
                                      border: latest
                                        ? "1px solid var(--border)"
                                        : "1px solid transparent",
                                    }}
                                  >
                                    {tok}
                                  </span>
                                );
                              })}
                              <span
                                aria-hidden
                                data-tabular
                                className="uppercase text-[color:var(--fg-subtle)]"
                                style={{
                                  fontFamily:
                                    "var(--font-mono), ui-monospace, monospace",
                                  fontSize: 8,
                                  letterSpacing: "0.1em",
                                }}
                              >
                                ↑ LATEST
                              </span>
                            </>
                          );
                        })()}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[9px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] md:text-xs md:normal-case md:tracking-normal md:text-[color:var(--fg-muted)]">
                        At {circuit ?? "track"}{" "}
                        <span className="text-[color:var(--fg-subtle)]">
                          (10y)
                        </span>
                      </dt>
                      <dd
                        className="text-[10px] md:text-sm"
                        style={{
                          fontWeight: 600,
                          color:
                            n.at_track_wins != null && n.at_track_wins > 0
                              ? "var(--accent)"
                              : "var(--fg)",
                        }}
                        data-tabular
                      >
                        {formatAtTrack(n.at_track_wins, n.at_track_podiums)}
                      </dd>
                    </div>

                    <div
                      className="flex items-center justify-between gap-4"
                      title="Average difference between qualifying grid spot and race finish position so far this season. Positive = gains places on race day."
                    >
                      <dt className="text-[9px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)] md:text-xs md:normal-case md:tracking-normal md:text-[color:var(--fg-muted)]">
                        Quali Δ Race{" "}
                        <span className="text-[color:var(--fg-subtle)] md:hidden">
                          (grid→finish)
                        </span>
                      </dt>
                      <dd
                        className="text-[10px] md:text-sm"
                        data-tabular
                        style={{
                          fontWeight: 600,
                          color: nudgeDeltaColor(n.quali_race_delta),
                        }}
                      >
                        {nudgeDeltaLabel(n.quali_race_delta)}
                      </dd>
                    </div>
                  </dl>
                ) : hotPicks && hotPicks[slot].length > 0 ? (
                  <div
                    className="text-xs text-[color:var(--fg-muted)]"
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                    }}
                  >
                    Group&rsquo;s hot picks for P{idx + 1}:
                    <br />
                    <span
                      className="text-[color:var(--fg)]"
                      data-tabular
                      style={{ fontWeight: 600 }}
                    >
                      {hotPicks[slot].join(" · ")}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-[color:var(--fg-subtle)]">
                    Pick a driver to see form, at-track history, and grid→race
                    delta.
                  </p>
                )}
              </div>

              {d && (
                <button
                  type="button"
                  onClick={() => clearSlot(slot)}
                  disabled={isClosed || pending}
                  /* The canvas omits this control; we keep it because
                     `clearSlot` is the only non-toggle way to empty a slot.
                     It is an 11px text button, so it gets the 44px tap floor
                     below the fork and its original box back at `md:`. */
                  className="relative flex min-h-[44px] items-center self-start text-[11px] uppercase text-[color:var(--fg-muted)] underline underline-offset-[3px] disabled:opacity-50 md:block md:min-h-0"
                  style={{ letterSpacing: "0.04em", zIndex: 1 }}
                  data-tabular
                >
                  Change pick
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* The Grid — 10 (or 5 on smaller breakpoints) col driver picker */}
      <section className="mt-10">
        <div className="md:hidden">
          <MobSectionHead
            title="The Grid"
            meta={`2026 · ${drivers.length} drivers`}
          />
        </div>
        <div className="mb-4 hidden items-baseline justify-between md:flex">
          <p
            className="text-2xl"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              letterSpacing: "-0.005em",
            }}
          >
            THE GRID
          </p>
          <span
            className="text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.1em" }}
            data-tabular
          >
            2026 · {drivers.length} drivers
          </span>
        </div>
        {/* 4-across and full-bleed at 390 (README §3.2); the desktop
            auto-fill template is restored at `md:`. Both are the same
            `grid-cols-*` utility, so the variant wins cleanly. Side borders
            drop below the fork so the bled list reads as hairline rules. */}
        <ul
          className="-mx-5 grid grid-cols-[repeat(4,minmax(0,1fr))] border-x-0 border-y border-[color:var(--border)] md:mx-0 md:grid-cols-[repeat(auto-fill,minmax(96px,1fr))] md:border-x"
          style={{ gap: 1, background: "var(--border)" }}
        >
          {drivers.map((d) => {
            const t = teamMeta(d.team);
            const inPicks = pickedIds.has(d.id);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => fillNextEmpty(d.id)}
                  disabled={isClosed || pending}
                  className="relative flex min-h-[92px] w-full flex-col items-center gap-[5px] px-1 pt-2.5 pb-3 text-center disabled:cursor-not-allowed md:min-h-[44px] md:gap-1.5 md:px-2 md:pt-3 md:pb-3"
                  style={{
                    background: "var(--surface)",
                    opacity: isClosed ? 0.45 : inPicks ? 0.4 : 1,
                    borderTop: `3px solid ${t?.hex ?? "var(--fg-subtle)"}`,
                  }}
                  aria-pressed={inPicks}
                  aria-label={`${d.code} ${d.full_name}`}
                >
                  {/* B' — see the slot card. One <button> (it carries the
                      aria-label three e2e specs click); only the portrait
                      forks, because `size` lands in inline width/height. */}
                  <div className="hidden md:contents">
                    <DriverPortrait code={d.code} team={d.team} size={48} />
                  </div>
                  <div className="md:hidden">
                    <DriverPortrait code={d.code} team={d.team} size={40} />
                  </div>
                  <span
                    className="text-[13px] md:text-[14px]"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {d.code}
                  </span>
                  <span
                    className="text-[8px] uppercase text-[color:var(--fg-subtle)] md:text-[10px]"
                    style={{ letterSpacing: "0.1em" }}
                    data-tabular
                  >
                    #{d.id}
                  </span>
                  {inPicks && (
                    <span
                      className="absolute right-1.5 top-1.5 text-[9px]"
                      style={{
                        color: "var(--accent)",
                        fontFamily:
                          "var(--font-mono), ui-monospace, monospace",
                        letterSpacing: "0.1em",
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {feedback && (
        <p
          role="alert"
          className="mt-6 text-sm text-[color:var(--error)]"
        >
          {feedback.message}
        </p>
      )}

      {/* F1-style picks-locked banner — full-width strip below the grid.
          Earned motion: only mounts on a real submit success. Auto-dismisses
          after 4s; the "Lock in for other events" CTA below stays. */}
      <AnimatePresence>
        {bannerOpen && justSaved && (
          <motion.div
            key="picks-banner"
            role="status"
            className="mt-8 overflow-hidden bg-[color:var(--accent)]"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE_OUT_QUART }}
            data-testid="picks-locked-banner"
          >
            {/* Stacks below the fork so the 22px display string + the
                mono timestamp cannot overflow 390. `md:px-8` carries the 32px
                the old `sm:px-8` gave from 640 up. */}
            <div className="flex flex-col items-start gap-2 px-5 py-3.5 text-black md:flex-row md:items-center md:gap-6 md:px-8 md:py-4">
              <span
                aria-hidden
                className="inline-block size-2.5 bg-black"
              />
              <span
                className="text-[18px] leading-none md:text-[22px]"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                PICKS LOCKED IN
              </span>
              <span
                className="text-[11px] uppercase opacity-80"
                style={{
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  letterSpacing: "0.1em",
                }}
                data-tabular
              >
                Saved{" "}
                {justSaved.at
                  .toISOString()
                  .slice(11, 16)}{" "}
                UTC · {sessionLabel}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Sticky lock bar.
          Below the 780px fork this sits ON TOP of MobileTabBar, which is
          `fixed bottom-0 z-30` — same anchor, higher stacking context, so at
          plain `bottom-0` the tab bar covered the bottom third of the submit
          button and taps there navigated away instead of locking in picks.
          Offset by the tab bar's own height variable (globals.css
          `--tabbar-h`, which tracks MobileTabBar's min-height) plus the
          device safe-area inset, which on an iPhone 14 is another 34px.
          `md:bottom-0` restores the original desktop anchor verbatim — the
          tab bar is `md:hidden`, so there is nothing to clear at/above the
          fork. Guarded by "the predict submit button is clickable, not
          covered by the tab bar" in tests/e2e/mobile-nav.spec.ts. */}
      <div
        className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))] z-20 border-t border-[color:var(--border)] backdrop-blur md:bottom-0"
        style={{
          background: "color-mix(in oklch, var(--surface-2) 92%, transparent)",
        }}
      >
        {/* Below md the status text stacks above the CTA (narrow phones
            don't have room for both side by side without wrapping the CTA
            label — measured 74-94px tall before this stack). `md:flex-row
            md:justify-between md:gap-6 md:px-8 md:py-5` restores the
            original desktop row byte-for-byte — but note this row DROPPED
            `sm:px-8`, which used to be the sole source of 32px horizontal
            padding across 640-1023px. `md:px-8` is now the ONLY thing
            carrying that value in the 780-1023px band; it is load-bearing,
            not a no-op, and must not be "cleaned up" as a duplicate of a
            class that no longer exists on this element. `lg:`/`xl:`
            padding is untouched. */}
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-stretch gap-2.5 px-5 pt-3 pb-3.5 md:flex-row md:items-center md:justify-between md:gap-6 md:px-8 md:pt-5 md:pb-5 lg:px-12 xl:px-16">
          <p
            className="font-mono text-[10px] text-[color:var(--fg-muted)] md:[font-family:inherit] md:text-sm"
            style={{ letterSpacing: "0.04em" }}
            data-testid="lock-bar-status"
          >
            {isClosed
              ? "Predictions closed."
              : !distinctFilled && allFilled
                ? "Same driver in two slots — fix and resubmit."
                : `${filledCount} of ${slots.length} slot${
                    slots.length > 1 ? "s" : ""
                  } picked · saves on lock-in · final lock in `}
            {!isClosed && (
              <span
                className={
                  isWarning
                    ? "text-[color:var(--warning)]"
                    : "text-[color:var(--fg)]"
                }
                data-tabular
                data-phase={isWarning ? "warning" : "normal"}
                style={{
                  animation: isWarning
                    ? "lockBarPulse 0.5s var(--ease-out-quart) infinite alternate"
                    : undefined,
                }}
              >
                {formatLockDelta(msUntil)}
              </span>
            )}
          </p>
          {justSaved ? (
            <Link
              href={`/dashboard/predict/round/${round}`}
              className="flex h-[52px] w-full items-center justify-center px-5 text-[13px] uppercase text-[color:var(--fg)] transition-colors md:block md:h-auto md:min-h-[48px] md:w-auto md:px-8 md:py-4 md:text-center md:text-sm md:text-black"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                letterSpacing: "0.04em",
                background: "var(--accent)",
              }}
              data-testid="lock-in-other-events"
            >
              Lock in for other events →
            </Link>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className={`flex h-[52px] w-full items-center justify-center px-5 text-[13px] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:block md:h-auto md:min-h-[48px] md:w-auto md:px-8 md:py-4 md:text-center md:text-sm ${
                canSubmit
                  ? "text-[color:var(--fg)] md:text-black"
                  : "text-[color:var(--fg-muted)]"
              }`}
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                letterSpacing: "0.04em",
                background: canSubmit ? "var(--accent)" : "var(--surface)",
                border: canSubmit ? "none" : "1px solid var(--border)",
              }}
              data-testid="submit-picks"
            >
              {pending ? "Saving…" : "Lock in picks →"}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes lockBarPulse {
          from { opacity: 1; }
          to { opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-phase="warning"] { animation: none !important; }
        }
      `}</style>
    </form>
  );
}
