"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useTransition } from "react";
import type { SubmitPredictionResult } from "@/lib/submitPrediction";
import { DriverPortrait } from "@/components/DriverPortrait";
import { teamMeta } from "@/lib/design/teams";
import { formatAtTrack } from "@/lib/nudges/format";

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

/** Color a single Form-L5 position pill by finish class. */
function formPillColors(token: string): { bg: string; fg: string } {
  const t = token.trim().toUpperCase();
  if (t === "DNF" || t === "DNS" || t === "DSQ" || t === "—") {
    return { bg: "color-mix(in oklch, var(--error) 18%, transparent)", fg: "var(--error)" };
  }
  const m = t.match(/^P?(\d+)$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 3)
      return {
        bg: "color-mix(in oklch, var(--success) 22%, transparent)",
        fg: "var(--success)",
      };
    if (n >= 4 && n <= 10)
      return { bg: "var(--surface-2)", fg: "var(--fg)" };
  }
  return { bg: "var(--surface-2)", fg: "var(--fg-muted)" };
}

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
      className="pb-32"
      data-testid="driver-picker"
    >
      {/* Slot cards — 1.2fr 1fr 1fr (P1 wider). Sprint shows just P1 full-width. */}
      <section
        className="mt-10 grid border border-[color:var(--border)]"
        style={{
          gridTemplateColumns: isSprint ? "1fr" : "1.2fr 1fr 1fr",
          gap: 1,
          background: "var(--border)",
        }}
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
              className="relative flex min-h-[320px] flex-col gap-5 overflow-hidden p-7"
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
                  className="pointer-events-none absolute"
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

              <div className="relative flex items-baseline justify-between">
                <span
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                    fontSize: isP1 ? 96 : 64,
                    lineHeight: 0.85,
                  }}
                  data-tight
                >
                  P{idx + 1}
                </span>
                <span
                  className="text-[10px] uppercase"
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
                  <DriverPortrait
                    code={d.code}
                    team={d.team}
                    size={72}
                  />
                  <div className="flex flex-col gap-1">
                    <span
                      className="leading-none"
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                        fontSize: 28,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {d.code}
                    </span>
                    <span className="text-sm text-[color:var(--fg-muted)]">
                      {d.full_name}
                    </span>
                    <span
                      className="mt-1 inline-block self-start px-2 py-0.5 text-[10px] uppercase"
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
                <p
                  className="relative italic text-[color:var(--fg-muted)]"
                  style={{ fontWeight: 500, fontSize: 16 }}
                >
                  Who&rsquo;s on the podium?
                </p>
              )}

              {/* Telemetry panel — lifted onto a tinted contrast surface so
                  the data row reads cleanly on top of the masked livery car.
                  Team-color top border ties the strip visually to the slot's
                  driver. */}
              <div
                className="relative mt-auto"
                aria-label={`Telemetry for ${d?.code ?? `slot P${idx + 1}`}`}
                style={{
                  zIndex: 1,
                  background: t?.hex
                    ? `color-mix(in oklch, ${t.hex} 8%, var(--surface))`
                    : "var(--surface-2)",
                  borderTop: `1px solid ${t?.hex ?? "var(--border)"}`,
                  padding: "var(--space-lg)",
                }}
              >
                <p
                  className="mb-3 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                  style={{ letterSpacing: "0.14em" }}
                  data-tabular
                >
                  Telemetry
                </p>
                {d && n ? (
                  <dl
                    className="flex flex-col text-[color:var(--fg-muted)]"
                    style={{
                      gap: "var(--space-md)",
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-xs">Form L5</dt>
                      <dd className="flex flex-wrap justify-end gap-1">
                        {(n.recent_form || "")
                          .split("·")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0)
                          .map((tok, i) => {
                            const c = formPillColors(tok);
                            return (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 text-[11px]"
                                style={{
                                  background: c.bg,
                                  color: c.fg,
                                  fontFamily:
                                    "var(--font-mono), ui-monospace, monospace",
                                  fontWeight: 600,
                                  letterSpacing: "0.04em",
                                }}
                                data-tabular
                              >
                                {tok}
                              </span>
                            );
                          })}
                        {!(n.recent_form && n.recent_form.length > 0) && (
                          <span
                            className="text-[color:var(--fg-subtle)]"
                            data-tabular
                          >
                            —
                          </span>
                        )}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-xs">
                        At {circuit ?? "track"}{" "}
                        <span className="text-[color:var(--fg-subtle)]">
                          (10y)
                        </span>
                      </dt>
                      <dd
                        className="text-sm"
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
                      <dt className="text-xs">Quali Δ Race</dt>
                      <dd
                        className="text-sm"
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
                  className="relative self-start text-[11px] uppercase text-[color:var(--fg-muted)] underline underline-offset-[3px] disabled:opacity-50"
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
        <div className="mb-4 flex items-baseline justify-between">
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
        <ul
          className="grid border border-[color:var(--border)]"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: 1,
            background: "var(--border)",
          }}
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
                  className="relative flex w-full flex-col items-center gap-1.5 px-2 py-3 text-center disabled:cursor-not-allowed"
                  style={{
                    background: "var(--surface)",
                    opacity: isClosed ? 0.45 : inPicks ? 0.4 : 1,
                    borderTop: `3px solid ${t?.hex ?? "var(--fg-subtle)"}`,
                  }}
                  aria-pressed={inPicks}
                  aria-label={`${d.code} ${d.full_name}`}
                >
                  <DriverPortrait code={d.code} team={d.team} size={48} />
                  <span
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      fontSize: 14,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {d.code}
                  </span>
                  <span
                    className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
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
            <div className="flex items-center gap-6 px-6 py-4 text-black sm:px-8">
              <span
                aria-hidden
                className="inline-block size-2.5 bg-black"
              />
              <span
                className="leading-none"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                  fontSize: 22,
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


      {/* Sticky lock bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--border)] backdrop-blur"
        style={{
          background: "color-mix(in oklch, var(--surface-2) 92%, transparent)",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-6 px-6 py-5 sm:px-8 lg:px-12 xl:px-16">
          <p
            className="text-xs sm:text-sm text-[color:var(--fg-muted)]"
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
              className="px-8 py-4 text-sm uppercase text-black transition-colors"
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
              className="px-8 py-4 text-sm uppercase text-black transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                letterSpacing: "0.04em",
                background: canSubmit ? "var(--accent)" : "var(--surface)",
                color: canSubmit ? "#000" : "var(--fg-muted)",
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
