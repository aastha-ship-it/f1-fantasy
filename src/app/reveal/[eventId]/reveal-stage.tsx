"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShareButton } from "./share-button";
import { DriverPortrait } from "@/components/DriverPortrait";
import { MobButton } from "@/components/MobilePrimitives";
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

export type RevealVariant = "portrait" | "wide";

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

// Cinematic timing (seconds) — ONE table, shared by both variants.
//
// These are the mobile handoff's retimed beats (README §5.2 / the canvas's
// MOB_BEATS in design/design_handoff_mobile/design/screens-mobile-d.jsx),
// adopted at BOTH widths so portrait and wide stay in lockstep. The wide
// cinematic is deliberately quicker than it was before chunk 5b; the owner
// chose a single timeline over forking the constants, and RS "keeps exactly
// one set of timing constants" + reveal-portrait R4 both guard that.
//
//   title    0.0–1.2   slam in (translateX + skew + opacity)
//   sweep    0.4–2.0   livery car crosses the band, blur+opacity envelope
//   draw     1.4–2.1   SVG path stroke draw (wide only — §5.2's stage A
//                        has no track band, so portrait never shows it)
//   silence  2.1–2.3
//   podium   2.3–4.3   P3 → P2 → P1 (600ms/card stagger; P3/P2 600ms,
//                        P1 800ms so the leader lands with more weight)
//   silence  4.3–4.9
//   group    4.9–7.4   friend rows stagger in
//   cta      7.4–8.0
const TITLE_DUR = 1.2;
const SWEEP_DELAY = 0.4;
const SWEEP_DUR = 1.6;
const DRAW_DELAY = 1.4;
const DRAW_DUR = 0.7;
const POST_INTRO_SILENCE = 0.2;
const PODIUM_BASE_DELAY = DRAW_DELAY + DRAW_DUR + POST_INTRO_SILENCE; // 2.3s
const PODIUM_STAGGER = 0.6;
const PODIUM_DUR = 0.6;
// P1 holds longer than P3/P2 (§5.2: 3500→4300 vs 600ms each) — it is the
// beat the whole cinematic is built around.
const PODIUM_P1_DUR = 0.8;
const POST_PODIUM_SILENCE = 0.6;
// §5.2 spends 4900→7400 on the group and the canvas ramps row i over
// groupP*8 - i, i.e. eight rows each taking an eighth of the window. Deriving
// both numbers from that keeps the spec's cadence for the common case; a
// group larger than eight simply trails a little past the window.
const GROUP_DUR = 2.5;
const GROUP_ROWS_IN_WINDOW = 8;
const PICK_STAGGER = GROUP_DUR / GROUP_ROWS_IN_WINDOW; // 0.3125
const PICK_DUR = GROUP_DUR / GROUP_ROWS_IN_WINDOW;
const CTA_DELAY = 7.4;
const CTA_DUR = 0.6;

// Portrait stage cross-fade windows (§5.2), as fractions of the full
// timeline. Expressed as Framer Motion `times` arrays rather than the
// canvas's requestAnimationFrame clock — .impeccable.md and CLAUDE.md both
// rule out RAF here, and a keyframed opacity track reaches the same windows
// declaratively.
const TIMELINE = 8.0;
const at = (ms: number): number => ms / 1000 / TIMELINE;
// A (title+sweep) out 1900→2300 · B (podium) in 2000→2400, out 4500→4900
// · C (group) in 4600→5000.
const STAGE_A_TIMES = [0, at(1900), at(2300), 1] as const;
const STAGE_A_OPACITY = [1, 1, 0, 0];
const STAGE_B_TIMES = [0, at(2000), at(2400), at(4500), at(4900), 1] as const;
const STAGE_B_OPACITY = [0, 0, 1, 1, 0, 0];
const STAGE_C_TIMES = [0, at(4600), at(5000), 1] as const;
const STAGE_C_OPACITY = [0, 0, 1, 1];

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
  variant = "wide",
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
  variant?: RevealVariant;
}) {
  const reduce = useReducedMotion() ?? false;
  const isPortrait = variant === "portrait";
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
  // The moment the last card (P1) finishes: it starts after (n-1) staggers,
  // not n — the old expression over-counted by one stagger, which only went
  // unnoticed because the stagger was 180ms. At §5.2's 600ms it would push
  // the group a full beat late, so it is fixed here rather than absorbed.
  const podiumSettle =
    PODIUM_BASE_DELAY +
    Math.max(0, resultSlots.length - 1) * PODIUM_STAGGER +
    PODIUM_P1_DUR;
  const pickFlipBaseDelay = reduce ? 0 : podiumSettle + POST_PODIUM_SILENCE;

  // ─── Portrait: §5.2's three cross-fading stages in one viewport ───────
  // The wide tree below scrolls (hero → podium → group). A phone has no room
  // for that, so portrait holds one fixed box and cross-fades A → B → C
  // through it. Same beats, same constants — only the staging differs.
  if (isPortrait) {
    return (
      <PortraitCinematic
        key={`portrait-${playKey}`}
        hero={hero}
        sweepTeam={sweepTeam}
        reduce={reduce}
        resultSlots={resultSlots}
        driverById={driverById}
        friendRows={friendRows}
        currentUserId={currentUserId}
        pickFlipBaseDelay={pickFlipBaseDelay}
        onReplay={() => setPlayKey((k) => k + 1)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {reduce ? (
        <StaticHero hero={hero} variant={variant} />
      ) : (
        <CinematicHero
          key={`hero-${playKey}`}
          hero={hero}
          sweepTeam={sweepTeam}
          variant={variant}
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
          data-podium
          className="grid w-full border border-[color:var(--border)]"
          style={{
            // Three full-width podium cards spanning the hero width. Layout
            // matches `design/design-screenshots/Reveal screen.png`: top band
            // with team-tinted P{n} block, large driver portrait below.
            // Portrait stacks to a single full-bleed column — same reason
            // sprints do (isSprint): one card per row instead of a squeezed
            // 1-of-3 column.
            gridTemplateColumns: isSprint || isPortrait ? "1fr" : "1fr 1fr 1fr",
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
                duration={slot.pos === 1 ? PODIUM_P1_DUR : PODIUM_DUR}
              >
                <PodiumCard pos={slot.pos} driver={d} variant={variant} />
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
  variant = "wide",
  onReplay,
}: {
  hero: RevealHero;
  sweepTeam: TeamMeta | null;
  variant?: RevealVariant;
  onReplay: () => void;
}) {
  const isPortrait = variant === "portrait";
  return (
    <section
      className="relative overflow-hidden border-b border-[color:var(--border)]"
      style={{ minHeight: isPortrait ? 320 : 480 }}
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
              width: isPortrait ? "min(1100px, 150vw)" : "min(1100px, 70vw)",
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
            fontSize: isPortrait
              ? "clamp(40px, 13vw, 168px)"
              : "clamp(56px, 11vw, 168px)",
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

function StaticHero({
  hero,
  variant = "wide",
}: {
  hero: RevealHero;
  variant?: RevealVariant;
}) {
  const isPortrait = variant === "portrait";
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
            fontSize: isPortrait
              ? "clamp(40px, 13vw, 96px)"
              : "clamp(48px, 7vw, 96px)",
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
  variant = "wide",
}: {
  pos: number;
  driver: Driver | null | undefined;
  variant?: RevealVariant;
}) {
  const isPortrait = variant === "portrait";
  const isP1 = pos === 1;
  const t = driver ? teamMeta(driver.team) : null;
  const portraitSrc = driver ? driverPortraitSrc(driver.code) : null;
  const flip = driver ? isPortraitRightFacing(driver.code) : false;

  // Layout matches design/design-screenshots/Reveal screen.png:
  // each card is a vertical stack — top band carries the P{n} block tinted
  // with the team color (livery silhouette behind), bottom hero shows the
  // driver portrait. Footer line: driver code + team + #num.
  const cardMinH = isP1 ? 380 : 360;
  const topBandH = isPortrait ? (isP1 ? 104 : 92) : isP1 ? 160 : 140;

  return (
    <div
      data-podium-card
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        background: "var(--surface)",
        minHeight: isPortrait ? (isP1 ? 260 : 230) : cardMinH,
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
              // Wide: unchanged — the ghost car partially clips against the
              // narrower ~1/3-width band by design (R5 byte-parity). Portrait
              // is a single full-bleed column where 460px would overflow the
              // band's own bounds more aggressively than the clip look
              // intends, so it's contained to the band's width instead.
              maxWidth: isPortrait ? "100%" : "none",
            }}
          />
        )}
        <span
          className="absolute"
          style={{
            left: "var(--space-lg)",
            bottom: -8,
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: isPortrait
              ? isP1
                ? "clamp(72px, 22vw, 144px)"
                : "clamp(60px, 18vw, 120px)"
              : isP1
                ? 144
                : 120,
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
                fontSize: isPortrait ? (isP1 ? 26 : 22) : isP1 ? 32 : 26,
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

/* ─── Portrait cinematic (§5.2) ───────────────────────────────────────── */

type FriendRow = {
  prediction: Prediction;
  score: Score | undefined;
  user: User | undefined;
};

type ResultSlot = { pos: number; id: number | null };

/**
 * The phone cinematic: one fixed box, three stages cross-fading through it.
 *
 * Ports `📱 Reveal · Mobile 390 — LIVE animation` (the canvas's
 * `MobRevealPlayScreen`, design/design_handoff_mobile/design/screens-mobile-d.jsx)
 * and README §5.2. Two deliberate departures from that reference:
 *
 *  1. The canvas drives everything from a `requestAnimationFrame` clock
 *     ticking a `t` state. .impeccable.md and CLAUDE.md both rule out RAF on
 *     this route, so every window here is a Framer Motion keyframe track with
 *     an explicit `times` array instead. Same windows, no clock, and reduced
 *     motion can drop the whole thing structurally rather than throttling it.
 *  2. §5.2 draws the stage chrome-free at a flat 844. The owner chose to keep
 *     TopBar on this route, so the box is `100dvh - 52px` (TopBar's mobile
 *     row) rather than a hard 844 — the stages size to whatever is left.
 */
function PortraitCinematic({
  hero,
  sweepTeam,
  reduce,
  resultSlots,
  driverById,
  friendRows,
  currentUserId,
  pickFlipBaseDelay,
  onReplay,
}: {
  hero: RevealHero;
  sweepTeam: TeamMeta | null;
  reduce: boolean;
  resultSlots: ResultSlot[];
  driverById: Map<number, Driver>;
  friendRows: FriendRow[];
  currentUserId: string | null;
  pickFlipBaseDelay: number;
  onReplay: () => void;
}) {
  // `skipped` is the SKIP chip's destination and is exactly the same render
  // reduced motion gets: the end state, with no sequence at all. Keeping one
  // code path for both means SKIP can never drift from the reduced-motion
  // fallback the design calls for.
  const [skipped, setSkipped] = useState(false);
  const atEnd = reduce || skipped;

  return (
    <div
      className="relative overflow-hidden bg-[color:var(--bg)]"
      style={{
        // TopBar's mobile row is 52px (TopBar.tsx: `h-[52px]`). `dvh` so the
        // mobile browser's collapsing address bar doesn't crop stage C.
        height: "calc(100dvh - 52px)",
        minHeight: 560,
      }}
    >
      {!atEnd && (
        <>
          <PortraitStageA hero={hero} sweepTeam={sweepTeam} />
          <PortraitStageB
            resultSlots={resultSlots}
            driverById={driverById}
          />
        </>
      )}

      <PortraitStageC
        hero={hero}
        resultSlots={resultSlots}
        driverById={driverById}
        friendRows={friendRows}
        currentUserId={currentUserId}
        baseDelay={pickFlipBaseDelay}
        atEnd={atEnd}
      />

      {/* SKIP — present for the whole sequence (§5.2), then becomes the way
          to run it again, so the chip is never a dead control. Suppressed
          entirely under reduced motion: there is no sequence to skip and
          nothing a replay could show, and .impeccable.md wants the cinematic
          structurally absent for that audience rather than merely inert. */}
      {!reduce && (
      <button
        type="button"
        onClick={() => {
          if (atEnd) {
            setSkipped(false);
            onReplay();
          } else {
            setSkipped(true);
          }
        }}
        className="absolute right-[14px] top-[14px] z-10 grid h-11 place-items-center px-[9px] uppercase text-[color:var(--fg-subtle)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: "0.14em",
          border: "1px solid var(--border)",
          background: "color-mix(in oklch, var(--bg) 60%, transparent)",
        }}
      >
        {atEnd ? "↻ Replay" : "Skip"}
      </button>
      )}
    </div>
  );
}

/** Stage A — stripe field, livery sweep, title slam. Fades out 1900→2300. */
function PortraitStageA({
  hero,
  sweepTeam,
}: {
  hero: RevealHero;
  sweepTeam: TeamMeta | null;
}) {
  return (
    <motion.div
      aria-hidden
      data-stage="a"
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 1 }}
      animate={{ opacity: STAGE_A_OPACITY }}
      transition={{
        duration: TIMELINE,
        times: [...STAGE_A_TIMES],
        ease: "linear",
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(115deg, transparent 0 40px, oklch(58% 0.22 27 / 0.05) 40px 42px)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: TITLE_DUR, ease: EASE_OUT_QUART }}
      />

      {sweepTeam && (
        <motion.div
          className="absolute"
          style={{ top: "52%", left: 0, willChange: "transform, opacity" }}
          initial={{ x: -420, y: "-50%", opacity: 0, filter: "blur(3px)" }}
          animate={{ x: 450, y: "-50%", opacity: [0, 1, 1, 0] }}
          transition={{
            duration: SWEEP_DUR,
            delay: SWEEP_DELAY,
            ease: "linear",
            opacity: {
              duration: SWEEP_DUR,
              delay: SWEEP_DELAY,
              times: [0, 0.06, 0.94, 1],
            },
          }}
        >
          <Image
            src={sweepTeam.carSrc}
            alt=""
            width={620}
            height={240}
            unoptimized
            className="max-w-none select-none"
            style={{
              width: 620,
              height: "auto",
              filter: "drop-shadow(0 16px 34px rgba(0,0,0,0.6))",
            }}
          />
        </motion.div>
      )}

      <motion.div
        className="absolute inset-0 flex flex-col justify-center px-5"
        initial={{ opacity: 0, x: -50, skewX: -8 }}
        animate={{ opacity: 1, x: 0, skewX: 0 }}
        transition={{ duration: TITLE_DUR, ease: EASE_OUT_QUART }}
      >
        <p
          className="mb-[14px] uppercase text-[color:var(--accent)]"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
          }}
          data-tabular
        >
          ● Round {String(hero.round).padStart(2, "0")} · The reveal
        </p>

        <p
          className="relative m-0 italic"
          data-tight
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 58,
            lineHeight: 0.86,
            textTransform: "uppercase",
          }}
        >
          {hero.short}
          <br />
          {/* §5.2 strokes "GRAND PRIX" in accent until 60% of the title beat,
              then goes solid. A stroke width can't tween, so the solid word
              sits in flow and an outlined copy is stacked over it — the two
              swap with opacity at 0.72s (60% of TITLE_DUR). */}
          <span className="relative inline-block">
            <motion.span
              className="block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.25,
                delay: TITLE_DUR * 0.6,
                ease: EASE_OUT_QUART,
              }}
            >
              Grand Prix
            </motion.span>
            <motion.span
              aria-hidden
              className="absolute inset-0 block"
              style={{
                WebkitTextStroke: "2px var(--accent)",
                color: "transparent",
              }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{
                duration: 0.25,
                delay: TITLE_DUR * 0.6,
                ease: EASE_OUT_QUART,
              }}
            >
              Grand Prix
            </motion.span>
          </span>
        </p>

        <p
          className="mt-5 uppercase text-[color:var(--fg-muted)]"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
          data-tabular
        >
          {hero.circuit.toUpperCase()}
          {hero.laps != null && <> · {hero.laps} LAPS</>}
        </p>
      </motion.div>
    </motion.div>
  );
}

/** Stage B — P3 → P2 → P1 flipping in. Fades in 2000→2400, out 4500→4900. */
function PortraitStageB({
  resultSlots,
  driverById,
}: {
  resultSlots: ResultSlot[];
  driverById: Map<number, Driver>;
}) {
  // Reveal order is P3 → P2 → P1, which is also the stacking order here.
  const ordered = [...resultSlots].sort((a, b) => b.pos - a.pos);
  return (
    <motion.div
      aria-hidden
      data-stage="b"
      className="pointer-events-none absolute inset-0 px-5"
      style={{ paddingTop: 40 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: STAGE_B_OPACITY }}
      transition={{
        duration: TIMELINE,
        times: [...STAGE_B_TIMES],
        ease: "linear",
      }}
    >
      <p
        className="uppercase text-[color:var(--accent)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: "0.16em",
        }}
        data-tabular
      >
        Revealing the podium
      </p>
      {/* `data-podium` marks the one podium container on the page — the R3
          invariant in tests/e2e/reveal-portrait.spec.ts uses it to prove that
          only one choreography ever mounts, never both variants at once. */}
      <div data-podium className="mt-4 grid gap-[10px]">
        {ordered.map((slot, i) => (
          <PortraitPodiumRow
            key={slot.pos}
            pos={slot.pos}
            driver={slot.id !== null ? driverById.get(slot.id) : null}
            delay={PODIUM_BASE_DELAY + i * PODIUM_STAGGER}
            duration={slot.pos === 1 ? PODIUM_P1_DUR : PODIUM_DUR}
          />
        ))}
      </div>
    </motion.div>
  );
}

function PortraitPodiumRow({
  pos,
  driver,
  delay,
  duration,
}: {
  pos: number;
  driver: Driver | null | undefined;
  delay: number;
  duration: number;
}) {
  const isP1 = pos === 1;
  const t = driver ? teamMeta(driver.team) : null;
  const height = isP1 ? 168 : 116;

  return (
    <motion.div
      data-podium-card
      className="relative flex items-center gap-[14px] overflow-hidden px-4"
      style={{
        height,
        transformPerspective: 700,
        transformOrigin: "center bottom",
      }}
      initial={{
        rotateX: -70,
        opacity: 0.6,
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
      animate={{
        rotateX: 0,
        opacity: 1,
        backgroundColor: t ? t.livery[1] : "var(--surface)",
        borderColor: ["var(--accent)", "var(--accent)", "var(--border)"],
        boxShadow: [
          "inset 0 -3px 0 rgba(0,0,0,0)",
          "inset 0 -3px 0 rgba(0,0,0,0)",
          `inset 0 -3px 0 ${t?.hex ?? "rgba(0,0,0,0)"}`,
        ],
      }}
      transition={{
        duration,
        delay,
        ease: EASE_OUT_QUART,
        borderColor: { duration, delay, times: [0, 0.85, 1] },
        boxShadow: { duration, delay, times: [0, 0.85, 1] },
      }}
    >
      <span
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          position: "absolute",
          inset: 0,
          borderColor: "inherit",
          pointerEvents: "none",
        }}
      />
      <span
        className="shrink-0"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: isP1 ? 68 : 46,
          lineHeight: 0.82,
          color: "var(--fg)",
        }}
        data-tight
      >
        P{pos}
      </span>

      {/* The placeholder and the revealed content cross-fade in place rather
          than switching on a clock reading — same reason the whole file has
          no RAF. */}
      <motion.span
        className="absolute uppercase text-[color:var(--fg-subtle)]"
        style={{
          left: isP1 ? 108 : 82,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.16em",
        }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: duration * 0.4, delay }}
      >
        · · · · ·
      </motion.span>

      {driver && t && (
        <motion.span
          className="flex min-w-0 items-center gap-[14px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration * 0.6, delay: delay + duration * 0.3 }}
        >
          <DriverPortrait
            code={driver.code}
            team={driver.team}
            size={isP1 ? 64 : 52}
          />
          <span className="block min-w-0">
            <span
              className="block truncate"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: isP1 ? 24 : 20,
                textTransform: "uppercase",
              }}
            >
              {driver.full_name.split(" ").slice(-1)[0]}
            </span>
            <span
              className="mt-1 block uppercase"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 9,
                letterSpacing: "0.1em",
                color: t.hex,
              }}
              data-tabular
            >
              {t.name} · #{driver.id}
            </span>
          </span>
        </motion.span>
      )}
    </motion.div>
  );
}

/** Stage C — the group, scored. Fades in 4600→5000 and stays. */
function PortraitStageC({
  hero,
  resultSlots,
  driverById,
  friendRows,
  currentUserId,
  baseDelay,
  atEnd,
}: {
  hero: RevealHero;
  resultSlots: ResultSlot[];
  driverById: Map<number, Driver>;
  friendRows: FriendRow[];
  currentUserId: string | null;
  baseDelay: number;
  atEnd: boolean;
}) {
  const winnerId = resultSlots[0]?.id ?? null;
  const winner = winnerId !== null ? driverById.get(winnerId) : null;
  const winnerLast = winner?.full_name.split(" ").slice(-1)[0] ?? null;

  return (
    <motion.div
      data-stage="c"
      className="absolute inset-0 flex flex-col px-5 pb-5"
      style={{ paddingTop: 36 }}
      initial={atEnd ? false : { opacity: 0 }}
      animate={atEnd ? undefined : { opacity: STAGE_C_OPACITY }}
      transition={
        atEnd
          ? undefined
          : { duration: TIMELINE, times: [...STAGE_C_TIMES], ease: "linear" }
      }
    >
      <p
        className="m-0"
        data-tight
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 36,
          lineHeight: 0.88,
          textTransform: "uppercase",
        }}
      >
        The
        <br />
        Group
      </p>
      <p
        className="mt-2 uppercase text-[color:var(--fg-subtle)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: "0.14em",
        }}
        data-tabular
      >
        {hero.short} · {winnerLast ? `${winnerLast} wins · ` : ""}scored
      </p>

      {friendRows.length === 0 ? (
        <p className="mt-4 border border-dashed border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--fg-subtle)]">
          No one submitted a pick for this session.
        </p>
      ) : (
        // The rows scroll inside the stage when the group outgrows the
        // window. The sequence itself still never scrolls (README:297) —
        // this is a list inside stage C, not the page.
        <ul className="mt-[14px] min-h-0 flex-1 overflow-y-auto border-t border-[color:var(--border)]">
          {friendRows.map((row, i) => (
            <PortraitFriendRow
              key={row.prediction.user_id}
              row={row}
              isMe={row.user?.id === currentUserId}
              driverById={driverById}
              delay={atEnd ? 0 : baseDelay + i * PICK_STAGGER}
              atEnd={atEnd}
            />
          ))}
        </ul>
      )}

      <motion.div
        className="mt-4 shrink-0"
        initial={atEnd ? false : { opacity: 0 }}
        animate={atEnd ? undefined : { opacity: 1 }}
        transition={
          atEnd ? undefined : { duration: CTA_DUR, delay: CTA_DELAY }
        }
      >
        <MobButton href="/dashboard/league">See league table →</MobButton>
      </motion.div>
    </motion.div>
  );
}

function PortraitFriendRow({
  row,
  isMe,
  driverById,
  delay,
  atEnd,
}: {
  row: FriendRow;
  isMe: boolean;
  driverById: Map<number, Driver>;
  delay: number;
  atEnd: boolean;
}) {
  const name = displayName(row.user, isMe);
  const pts = row.score?.points ?? 0;
  const perfect = row.score?.perfect_bonus ?? false;
  const picks = [
    row.prediction.p1_driver_id,
    row.prediction.p2_driver_id,
    row.prediction.p3_driver_id,
  ]
    .map((id) => (id !== null ? driverById.get(id)?.code : null))
    .filter((c): c is string => Boolean(c));

  return (
    <motion.li
      className="grid items-center gap-2 border-b border-[color:var(--border)] pr-2"
      style={{
        gridTemplateColumns: "24px minmax(0,1fr) auto 40px",
        height: 46,
        background: isMe ? "var(--surface-2)" : "transparent",
        // The sanctioned 3px prediction-row edge (CLAUDE.md's exception to
        // the left-stripe ban), in accent because this row is *yours*.
        boxShadow: isMe ? "inset 3px 0 0 0 var(--accent)" : "none",
        paddingLeft: isMe ? 8 : 0,
      }}
      initial={atEnd ? false : { opacity: 0, y: 12 }}
      animate={atEnd ? undefined : { opacity: 1, y: 0 }}
      transition={atEnd ? undefined : { duration: PICK_DUR, delay }}
    >
      <span
        className="grid size-[22px] place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-2)]"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 9,
        }}
        aria-hidden
      >
        {name.charAt(0).toUpperCase()}
      </span>

      <span className="block min-w-0">
        <span className="block truncate text-xs font-medium">
          {name}
          {isMe && (
            <span
              className="ml-1.5 text-[color:var(--accent)]"
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 8,
                letterSpacing: "0.12em",
              }}
            >
              YOU
            </span>
          )}
        </span>
        <span
          className="mt-0.5 block truncate text-[color:var(--fg-subtle)]"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 8,
            letterSpacing: "0.08em",
          }}
          data-tabular
        >
          {picks.join(" · ") || "—"}
        </span>
      </span>

      {perfect ? (
        <span
          className="border px-1 py-0.5 uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 8,
            letterSpacing: "0.1em",
            color: "var(--success)",
            borderColor: "var(--success)",
          }}
        >
          PP
        </span>
      ) : (
        <span />
      )}

      <span
        className="text-right"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 15,
          color:
            pts === 0
              ? "var(--fg-subtle)"
              : perfect
                ? "var(--success)"
                : "var(--fg)",
        }}
        data-tabular
      >
        +{pts}
      </span>
    </motion.li>
  );
}
