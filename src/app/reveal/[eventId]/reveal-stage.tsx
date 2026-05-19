"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShareButton } from "./share-button";
import { DriverPortrait } from "@/components/DriverPortrait";
import {
  driverPortraitSrc,
  isPortraitRightFacing,
} from "@/lib/design/drivers";
import { teamMeta, type TeamMeta } from "@/lib/design/teams";
import { slotOutcome, slotBadge, wrongSlotBucket } from "@/lib/computeScores";

type Driver = { id: number; code: string; full_name: string; team: string };
type User = { id: string; email: string; display_name: string | null };
type Prediction = {
  user_id: string;
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};
type Result = {
  p1_driver_id: number;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};
type Score = {
  user_id: string;
  points: number;
  exact_matches: number;
  slot_mismatches: number;
  dnf_zeros: number;
  perfect_bonus: boolean;
};

export type RevealHero = {
  short: string;
  sessionType: string;
  round: number;
  circuit: string;
  circuitKey: string;
  trackPath: string | null;
  sessionStartAt: string;
  sessionDateLabel: string;
  lengthKm: number | null;
  laps: number | null;
};

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

// Cinematic timing (seconds). Kept aligned with the design canvas:
//   title  0.0–1.4   slam in (translateX + skew + opacity)
//   sweep  0.6–2.2   livery car translates across band, blur+opacity envelope
//   draw   2.0–2.9   SVG path stroke draw
//   silence 2.9–3.3
//   podium 3.3–4.9   P3 → P2 → P1 (180ms/card stagger, 300ms each)
//   silence 4.9–5.3
//   friends 5.3–...  150ms stagger
const TITLE_DUR = 1.4;
const SWEEP_DELAY = 0.6;
const SWEEP_DUR = 1.6;
const DRAW_DELAY = 2.0;
const DRAW_DUR = 0.9;
const POST_INTRO_SILENCE = 0.4;
const PODIUM_BASE_DELAY = DRAW_DELAY + DRAW_DUR + POST_INTRO_SILENCE; // 3.3s
const PODIUM_STAGGER = 0.18;
const PODIUM_DUR = 0.3;
const POST_PODIUM_SILENCE = 0.4;
const PICK_STAGGER = 0.15;
const PICK_DUR = 0.3;

function displayName(u: User | undefined, isMe: boolean): string {
  if (!u) return "?";
  if (isMe) return "You";
  return u.display_name?.trim() || u.email.split("@")[0];
}

export function RevealStage({
  hero,
  sweepTeam,
  result,
  predictions,
  scores,
  users,
  drivers,
  currentUserId,
  isSprint,
}: {
  event: {
    id: string;
    name: string;
    revealed_at: string | null;
  };
  hero: RevealHero;
  sweepTeam: TeamMeta | null;
  result: Result;
  predictions: Prediction[];
  scores: Score[];
  users: User[];
  drivers: Driver[];
  currentUserId: string | null;
  isSprint: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  // playKey re-mounts every motion node so the whole intro replays.
  const [playKey, setPlayKey] = useState(0);

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const scoreByUser = new Map(scores.map((s) => [s.user_id, s]));

  const resultSlots = isSprint
    ? [{ pos: 1, id: result.p1_driver_id }]
    : [
        { pos: 1, id: result.p1_driver_id },
        { pos: 2, id: result.p2_driver_id },
        { pos: 3, id: result.p3_driver_id },
      ];
  // Visual order P2 | P1 | P3 (centre-leader podium block).
  const visualOrder = isSprint ? [0] : [1, 0, 2];
  // Stagger: P3 first → P2 → P1.
  const flipDelayFor = (slotPos: number): number => {
    if (isSprint) return 0;
    const order: Record<number, number> = { 3: 0, 2: 1, 1: 2 };
    return (order[slotPos] ?? 0) * PODIUM_STAGGER;
  };

  const friendRows = predictions
    .map((p) => ({
      prediction: p,
      score: scoreByUser.get(p.user_id),
      user: userById.get(p.user_id),
    }))
    .sort((a, b) => {
      const aPts = a.score?.points ?? 0;
      const bPts = b.score?.points ?? 0;
      if (aPts !== bPts) return bPts - aPts;
      return displayName(a.user, false).localeCompare(
        displayName(b.user, false),
      );
    });

  // When reduced, the cinematic is suppressed and downstream delays collapse.
  const podiumBaseDelay = reduce ? 0 : PODIUM_BASE_DELAY;
  const pickFlipBaseDelay = reduce
    ? 0
    : podiumBaseDelay +
      resultSlots.length * PODIUM_STAGGER +
      PODIUM_DUR +
      POST_PODIUM_SILENCE;

  return (
    <div className="flex flex-col gap-12">
      {reduce ? (
        <StaticHero hero={hero} />
      ) : (
        <CinematicHero
          key={`hero-${playKey}`}
          hero={hero}
          sweepTeam={sweepTeam}
          onReplay={() => setPlayKey((k) => k + 1)}
        />
      )}

      {/* PODIUM RESULT — P2 | P1 | P3 block */}
      <section>
        <motion.p
          key={`podium-eyebrow-${playKey}`}
          className="mb-4 text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
          data-tabular
          initial={reduce ? undefined : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          transition={{ duration: 0.3, delay: podiumBaseDelay - 0.2 }}
        >
          Race Result
        </motion.p>
        <div
          className="grid w-full border border-[color:var(--border)]"
          style={{
            // Three full-width podium cards spanning the hero width. Layout
            // matches `design/design-screenshots/Reveal screen.png`: top band
            // with team-tinted P{n} block, large driver portrait below.
            gridTemplateColumns: isSprint ? "1fr" : "1fr 1fr 1fr",
            gap: 1,
            background: "var(--border)",
          }}
        >
          {visualOrder.map((srcIdx) => {
            const slot = resultSlots[srcIdx];
            if (!slot) return null;
            const d = slot.id !== null ? driverById.get(slot.id) : null;
            return (
              <FlipCard
                key={`podium-${slot.pos}-${playKey}`}
                reduce={reduce}
                delay={podiumBaseDelay + flipDelayFor(slot.pos)}
                duration={PODIUM_DUR}
              >
                <PodiumCard pos={slot.pos} driver={d} />
              </FlipCard>
            );
          })}
        </div>
      </section>

      {/* THE GROUP */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <p
            className="text-2xl"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              letterSpacing: "-0.005em",
            }}
          >
            THE GROUP
          </p>
          <div className="flex items-center gap-3">
            <p
              className="text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.1em" }}
              data-tabular
            >
              {friendRows.length} pick{friendRows.length === 1 ? "" : "s"} ·{" "}
              {friendRows.filter((r) => r.score?.perfect_bonus).length} perfect
            </p>
            <ShareButton />
          </div>
        </div>

        {friendRows.length === 0 ? (
          <div className="border border-dashed border-[color:var(--border)] px-5 py-4 text-sm text-[color:var(--fg-subtle)]">
            No one submitted a pick for this session.
          </div>
        ) : (
          <ul
            className="grid border border-[color:var(--border)]"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 1,
              background: "var(--border)",
            }}
          >
            {friendRows.map((row, i) => {
              const isMe = row.user?.id === currentUserId;
              return (
                <li key={row.prediction.user_id}>
                  <FlipCard
                    key={`friend-${row.prediction.user_id}-${playKey}`}
                    reduce={reduce}
                    delay={pickFlipBaseDelay + i * PICK_STAGGER}
                    duration={PICK_DUR}
                  >
                    <FriendCard
                      user={row.user}
                      isMe={isMe}
                      prediction={row.prediction}
                      score={row.score}
                      result={result}
                      driverById={driverById}
                      isSprint={isSprint}
                    />
                  </FlipCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─── Cinematic intro ─────────────────────────────────────────────────── */

function CinematicHero({
  hero,
  sweepTeam,
  onReplay,
}: {
  hero: RevealHero;
  sweepTeam: TeamMeta | null;
  onReplay: () => void;
}) {
  return (
    <section
      className="relative overflow-hidden border-b border-[color:var(--border)]"
      style={{ minHeight: 480 }}
    >
      {/* Stripe bg */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(115deg, transparent 0 80px, oklch(58% 0.22 27 / 0.06) 80px 82px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: TITLE_DUR, ease: EASE_OUT_QUART }}
      />

      {/* Livery sweep car. Translates from left of viewport across to the
       * right — in % of its parent's width, so the motion scales with the
       * page width without measuring the viewport. Blur + opacity envelope
       * implies racing-stripe speed. */}
      {sweepTeam && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: 0, willChange: "transform, opacity, filter" }}
          initial={{ x: "-60%", opacity: 0, filter: "blur(0px)" }}
          animate={{
            x: ["-60%", "-60%", "120%", "120%"],
            opacity: [0, 1, 1, 0],
            filter: [
              "blur(0px)",
              "blur(4px)",
              "blur(4px)",
              "blur(0px)",
            ],
          }}
          transition={{
            duration: SWEEP_DUR,
            delay: SWEEP_DELAY,
            ease: "linear",
            times: [0, 0.05, 0.95, 1],
          }}
        >
          <Image
            src={sweepTeam.carSrc}
            alt=""
            width={1100}
            height={420}
            unoptimized
            className="select-none"
            style={{
              width: "min(1100px, 70vw)",
              height: "auto",
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6))",
            }}
          />
        </motion.div>
      )}

      {/* Speed-line wash following the car. Same envelope, no blur. */}
      {sweepTeam && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 -translate-y-0"
          style={{
            left: 0,
            width: "30%",
            background:
              "linear-gradient(90deg, transparent, oklch(96% 0 0 / 0.05) 60%, transparent)",
          }}
          initial={{ x: "-100%", opacity: 0 }}
          animate={{
            x: ["-100%", "-100%", "320%", "320%"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: SWEEP_DUR,
            delay: SWEEP_DELAY,
            ease: "linear",
            times: [0, 0.05, 0.95, 1],
          }}
        />
      )}

      {/* Title — slams in with skew + slide. */}
      <div className="relative px-2 py-12 sm:px-4 lg:py-16">
        <motion.p
          className="mb-3 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
          style={{ letterSpacing: "0.2em" }}
          data-tabular
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: TITLE_DUR, ease: EASE_OUT_QUART }}
        >
          <span
            aria-hidden
            className="inline-block size-2 rounded-full bg-[color:var(--accent)]"
            style={{ boxShadow: "0 0 16px var(--accent)" }}
          />
          Reveal · Round {hero.round} · {hero.sessionType.toUpperCase()}
        </motion.p>

        <motion.h1
          className="m-0 italic"
          data-tight
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: "clamp(56px, 11vw, 168px)",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
          }}
          initial={{ opacity: 0, x: -80, skewX: -8 }}
          animate={{ opacity: 1, x: 0, skewX: 0 }}
          transition={{ duration: TITLE_DUR, ease: EASE_OUT_QUART }}
        >
          {hero.short}
          <br />
          <motion.span
            className="block text-[color:var(--fg-muted)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: TITLE_DUR * 0.5 }}
          >
            Grand Prix
          </motion.span>
        </motion.h1>

        <motion.p
          className="mt-5 text-xs uppercase text-[color:var(--fg-muted)]"
          style={{ letterSpacing: "0.08em" }}
          data-tabular
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: TITLE_DUR * 0.7 }}
        >
          {hero.sessionDateLabel.toUpperCase()} · {hero.circuit.toUpperCase()}
          {hero.lengthKm != null && hero.laps != null && (
            <>
              {" · "}
              {hero.lengthKm.toFixed(3)} KM · {hero.laps} LAPS
            </>
          )}{" "}
          · RACE RESULT LOCKED IN
        </motion.p>
      </div>

      {/* Track-draw transition — sits in its own band at the bottom of the hero. */}
      <div
        className="relative flex items-center gap-4 px-4 pb-6"
        style={{ height: 56 }}
        aria-hidden
      >
        <span
          className="text-[10px] uppercase text-[color:var(--accent)]"
          style={{ letterSpacing: "0.2em" }}
          data-tabular
        >
          Sector ▸
        </span>
        <svg
          viewBox="0 0 200 120"
          preserveAspectRatio="none"
          width="100%"
          height="56"
          className="flex-1"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {hero.trackPath ? (
            <motion.path
              d={hero.trackPath}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: {
                  duration: DRAW_DUR,
                  delay: DRAW_DELAY,
                  ease: EASE_OUT_QUART,
                },
                opacity: { duration: 0.2, delay: DRAW_DELAY },
              }}
            />
          ) : (
            <motion.path
              d="M 4 60 L 196 60"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: {
                  duration: DRAW_DUR,
                  delay: DRAW_DELAY,
                  ease: EASE_OUT_QUART,
                },
                opacity: { duration: 0.2, delay: DRAW_DELAY },
              }}
            />
          )}
        </svg>
        <span
          className="text-[10px] uppercase text-[color:var(--accent)]"
          style={{ letterSpacing: "0.2em" }}
          data-tabular
        >
          ▸ Finish
        </span>
      </div>

      {/* Replay button — appears once intro completes, fades in. */}
      <motion.button
        type="button"
        onClick={onReplay}
        className="absolute right-4 top-4 px-3 py-1.5 text-[10px] uppercase text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
        style={{
          letterSpacing: "0.15em",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: DRAW_DELAY + DRAW_DUR + 0.2 }}
        aria-label="Replay reveal animation"
      >
        ↻ Replay
      </motion.button>
    </section>
  );
}

function StaticHero({ hero }: { hero: RevealHero }) {
  return (
    <section className="grid items-end gap-8 border-b border-[color:var(--border)] pb-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <p
          className="mb-3 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
          style={{ letterSpacing: "0.2em" }}
          data-tabular
        >
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-[color:var(--accent)]"
          />
          Reveal · Round {hero.round} · {hero.sessionType.toUpperCase()}
        </p>
        <h1
          className="m-0"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: "clamp(48px, 7vw, 96px)",
            lineHeight: 0.9,
            letterSpacing: "-0.02em",
          }}
        >
          {hero.short.toUpperCase()}
          <br />
          <span className="text-[color:var(--fg-muted)]">GRAND PRIX</span>
        </h1>
      </div>
      <p
        className="text-xs uppercase text-[color:var(--fg-muted)] lg:text-right"
        style={{ letterSpacing: "0.04em" }}
        data-tabular
      >
        {hero.sessionDateLabel.toUpperCase()}
        <br />
        {hero.circuit.toUpperCase()}
        {hero.lengthKm != null && hero.laps != null && (
          <>
            <br />
            {hero.lengthKm.toFixed(3)} KM · {hero.laps} LAPS
          </>
        )}
      </p>
    </section>
  );
}

/* ─── Cards ──────────────────────────────────────────────────────────── */

function FlipCard({
  children,
  reduce,
  delay,
  duration,
}: {
  children: React.ReactNode;
  reduce: boolean;
  delay: number;
  duration: number;
}) {
  if (reduce) {
    return <div className="h-full">{children}</div>;
  }
  return (
    <motion.div
      className="h-full"
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration, delay, ease: EASE_OUT_QUART }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000,
        backfaceVisibility: "hidden",
      }}
    >
      {children}
    </motion.div>
  );
}

function PodiumCard({
  pos,
  driver,
}: {
  pos: number;
  driver: Driver | null | undefined;
}) {
  const isP1 = pos === 1;
  const t = driver ? teamMeta(driver.team) : null;
  const portraitSrc = driver ? driverPortraitSrc(driver.code) : null;
  const flip = driver ? isPortraitRightFacing(driver.code) : false;

  // Layout matches design/design-screenshots/Reveal screen.png:
  // each card is a vertical stack — top band carries the P{n} block tinted
  // with the team color (livery silhouette behind), bottom hero shows the
  // driver portrait. Footer line: driver code + team + #num.
  const cardMinH = isP1 ? 380 : 360;
  const topBandH = isP1 ? 160 : 140;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        background: "var(--surface)",
        minHeight: cardMinH,
      }}
    >
      {/* TOP BAND — team-tinted slab carrying the P{n} block. Livery car
          silhouette ghosts in behind on the right. */}
      <div
        className="relative overflow-hidden"
        style={{
          height: topBandH,
          background: t?.hex
            ? `color-mix(in oklch, ${t.hex} 24%, var(--surface-2))`
            : "var(--surface-2)",
        }}
      >
        {t && (
          <Image
            aria-hidden
            src={t.carSrc}
            alt=""
            width={460}
            height={180}
            unoptimized
            className="pointer-events-none absolute select-none"
            style={{
              right: -40,
              top: 0,
              opacity: 0.32,
              width: 460,
              height: "auto",
              maxWidth: "none",
            }}
          />
        )}
        <span
          className="absolute"
          style={{
            left: "var(--space-lg)",
            bottom: -8,
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: isP1 ? 144 : 120,
            lineHeight: 0.85,
            color: isP1 ? "var(--accent)" : "var(--fg)",
          }}
          data-tight
        >
          P{pos}
        </span>
      </div>

      {/* PORTRAIT — fills the lower hero region of the card. */}
      <div className="relative flex-1 overflow-hidden">
        {driver && portraitSrc ? (
          <Image
            src={portraitSrc}
            alt={driver.full_name}
            width={500}
            height={500}
            unoptimized
            className="select-none"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 20%",
              transform: flip ? "scaleX(-1)" : undefined,
            }}
          />
        ) : driver && t ? (
          <span
            className="flex h-full w-full items-end justify-center"
            style={{
              background: `linear-gradient(180deg, transparent, ${t.hex}33)`,
              color: t.hex,
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 96,
              paddingBottom: "0.05em",
            }}
          >
            {driver.code.charAt(0)}
          </span>
        ) : null}
      </div>

      {/* FOOTER — driver code + team + #num. Sits over the bottom of the
          portrait via a soft surface gradient so text stays readable on
          any livery. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          padding: "var(--space-lg)",
          background:
            "linear-gradient(180deg, transparent, color-mix(in oklch, var(--bg) 78%, transparent))",
        }}
      >
        {driver && t ? (
          <>
            <p
              className="leading-none"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: isP1 ? 32 : 26,
                letterSpacing: "0.005em",
              }}
            >
              {driver.code}
            </p>
            <p
              className="mt-2 text-[10px] uppercase"
              style={{
                letterSpacing: "0.14em",
                color: t.hex,
              }}
              data-tabular
            >
              {t.name} · #{driver.id}
            </p>
          </>
        ) : (
          <p className="text-sm text-[color:var(--fg-muted)]">—</p>
        )}
      </div>
    </div>
  );
}

function FriendCard({
  user,
  isMe,
  prediction,
  score,
  result,
  driverById,
  isSprint,
}: {
  user: User | undefined;
  isMe: boolean;
  prediction: Prediction;
  score: Score | undefined;
  result: Result;
  driverById: Map<number, Driver>;
  isSprint: boolean;
}) {
  const name = displayName(user, isMe);
  const picks: Array<{
    label: string;
    pos: "p1" | "p2" | "p3";
    id: number | null;
  }> = isSprint
    ? [{ label: "P1", pos: "p1", id: prediction.p1_driver_id }]
    : [
        { label: "P1", pos: "p1", id: prediction.p1_driver_id },
        { label: "P2", pos: "p2", id: prediction.p2_driver_id },
        { label: "P3", pos: "p3", id: prediction.p3_driver_id },
      ];
  const actual = {
    p1: result.p1_driver_id,
    p2: result.p2_driver_id,
    p3: result.p3_driver_id,
  };
  const points = score?.points ?? 0;
  const perfect = score?.perfect_bonus ?? false;
  const exact = score?.exact_matches ?? 0;
  const wrongSlot = score?.slot_mismatches ?? 0;
  // §10 card-score colour tiers.
  const scoreColor =
    points >= 10
      ? "var(--success)"
      : points > 0
        ? "var(--fg)"
        : "var(--fg-subtle)";

  return (
    <article
      className="relative flex h-full flex-col gap-3 p-5"
      style={{
        background: "var(--surface)",
        // design_handoff_phase11/ADDENDUM §C: the outline is the "you"
        // indicator (2px accent, offset -2). The perfect-podium accent
        // outline is retained too (owner decision) at the original 1px/-1.
        outline: isMe
          ? "2px solid var(--accent)"
          : perfect
            ? "1px solid var(--accent)"
            : "none",
        outlineOffset: isMe ? "-2px" : "-1px",
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="truncate"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 18,
            letterSpacing: "0.01em",
          }}
        >
          {name.toUpperCase()}
        </p>
        <div className="flex items-baseline gap-1">
          <span
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 32,
              color: scoreColor,
            }}
          >
            {points}
          </span>
          <span
            className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.12em" }}
          >
            pts
          </span>
        </div>
      </div>

      {perfect && (
        <p
          className="inline-block self-start border border-[color:var(--accent)] text-[10px] uppercase text-[color:var(--accent)]"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            letterSpacing: "0.18em",
            background: "transparent",
            padding: "var(--space-xs) var(--space-sm)",
          }}
          data-tabular
        >
          ★ Perfect Podium · +3 bonus
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {picks.map((p) => {
          const d = p.id !== null ? driverById.get(p.id) : null;
          const t = d ? teamMeta(d.team) : null;
          const o = slotOutcome(p.id, actual, p.pos);
          const badge = slotBadge(o);
          return (
            <li
              key={p.label}
              className="flex items-center gap-3 px-3 py-2"
              style={{
                background: "var(--bg)",
                border: t
                  ? `1px solid ${t.hex}55`
                  : "1px solid var(--border)",
              }}
            >
              <span
                data-tabular
                className="w-6 shrink-0 text-[10px] uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.12em" }}
              >
                {p.label}
              </span>
              {d ? (
                <>
                  <DriverPortrait code={d.code} team={d.team} size={28} />
                  <span
                    className="shrink-0 text-sm"
                    style={{
                      color: "var(--fg)",
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {d.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--fg-muted)]">
                    {d.full_name}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-sm text-[color:var(--fg-subtle)]">
                  —
                </span>
              )}
              <span
                data-tabular
                className="ml-auto shrink-0 text-[10px]"
                style={{
                  fontFamily: "var(--font-mono), ui-monospace, monospace",
                  letterSpacing: "0.08em",
                  color: badge.color,
                  fontWeight: badge.weight,
                }}
              >
                {badge.text}
              </span>
            </li>
          );
        })}
      </ul>

      {wrongSlot > 0 && exact < 3 && (
        <div
          className="flex items-center justify-between"
          style={{
            border: "1px dashed var(--border)",
            background: "var(--surface-2)",
            padding: "var(--space-sm) var(--space-md)",
          }}
        >
          <span
            data-tabular
            className="text-[11px] text-[color:var(--fg-muted)]"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
            }}
          >
            {wrongSlot} on podium (wrong slot) bucket
          </span>
          <span
            data-tabular
            className="text-[11px]"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontWeight: 600,
              color: "var(--warning)",
            }}
          >
            +{wrongSlotBucket(wrongSlot)}
          </span>
        </div>
      )}
    </article>
  );
}
