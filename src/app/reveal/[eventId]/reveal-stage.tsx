"use client";

import { motion, useReducedMotion } from "framer-motion";

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

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

const TEAM_TOKEN: Record<string, string> = {
  McLaren: "var(--team-mclaren)",
  Ferrari: "var(--team-ferrari)",
  Mercedes: "var(--team-mercedes)",
  "Red Bull Racing": "var(--team-redbull)",
  "Aston Martin": "var(--team-aston)",
  Williams: "var(--team-williams)",
  "Haas F1 Team": "var(--team-haas)",
  "Kick Sauber": "var(--team-kick)",
  Alpine: "var(--team-alpine)",
  "Racing Bulls": "var(--team-vcarb)",
  "RB F1 Team": "var(--team-vcarb)",
};

function teamDot(team: string): string {
  return TEAM_TOKEN[team] ?? "var(--fg-subtle)";
}

function displayName(u: User | undefined, isMe: boolean): string {
  if (!u) return "?";
  if (isMe) return "You";
  return u.display_name?.trim() || u.email.split("@")[0];
}

export function RevealStage({
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
  result: Result;
  predictions: Prediction[];
  scores: Score[];
  users: User[];
  drivers: Driver[];
  currentUserId: string | null;
  isSprint: boolean;
}) {
  const reduce = useReducedMotion() ?? false;

  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const scoreByUser = new Map(scores.map((s) => [s.user_id, s]));

  const resultSlots = isSprint
    ? [{ label: "P1", id: result.p1_driver_id }]
    : [
        { label: "P1", id: result.p1_driver_id },
        { label: "P2", id: result.p2_driver_id },
        { label: "P3", id: result.p3_driver_id },
      ];

  // Friend picks sorted by points desc, then by display name.
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
      return displayName(a.user, false).localeCompare(displayName(b.user, false));
    });

  const RESULT_DURATION = reduce ? 0 : 0.3;
  const RESULT_STAGGER = reduce ? 0 : 0.2;
  const SILENCE = reduce ? 0 : 0.4;
  const PICK_STAGGER = reduce ? 0 : 0.15;
  const PICK_DURATION = reduce ? 0 : 0.3;

  const pickFlipBaseDelay =
    resultSlots.length * RESULT_STAGGER + RESULT_DURATION + SILENCE;

  return (
    <div className="flex flex-col gap-12">
      {/* RESULT CARDS */}
      <section>
        <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
          Classified
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {resultSlots.map((slot, i) => {
            const d = slot.id !== null ? driverById.get(slot.id) : null;
            return (
              <FlipCard
                key={slot.label}
                reduce={reduce}
                delay={i * RESULT_STAGGER}
                duration={RESULT_DURATION}
              >
                <ResultCard label={slot.label} driver={d} />
              </FlipCard>
            );
          })}
        </div>
      </section>

      {/* FRIEND PICKS */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            The group
          </p>
          <p className="text-sm text-[color:var(--fg-subtle)]" data-tabular>
            {friendRows.length} {friendRows.length === 1 ? "pick" : "picks"}
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {friendRows.map((row, i) => {
            const isMe = row.user?.id === currentUserId;
            return (
              <FlipCard
                key={row.prediction.user_id}
                reduce={reduce}
                delay={pickFlipBaseDelay + i * PICK_STAGGER}
                duration={PICK_DURATION}
              >
                <FriendRow
                  user={row.user}
                  isMe={isMe}
                  prediction={row.prediction}
                  score={row.score}
                  driverById={driverById}
                  isSprint={isSprint}
                />
              </FlipCard>
            );
          })}
          {friendRows.length === 0 && (
            <li className="rounded border border-dashed border-[color:var(--border)] px-5 py-4 text-sm text-[color:var(--fg-subtle)]">
              No one submitted a pick for this session.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

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
    return <div>{children}</div>;
  }
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{
        duration,
        delay,
        ease: EASE_OUT_QUART,
      }}
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

function ResultCard({
  label,
  driver,
}: {
  label: string;
  driver: Driver | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]" data-tabular>
        {label}
      </p>
      {driver ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-3 rounded-full"
              style={{ background: teamDot(driver.team) }}
            />
            <p className="text-sm uppercase tracking-wider text-[color:var(--fg-muted)]" data-tabular>
              {driver.code}
            </p>
          </div>
          <p
            className="mt-1 text-2xl leading-tight"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {driver.full_name.toUpperCase()}
          </p>
        </>
      ) : (
        <p className="mt-3 text-[color:var(--fg-muted)]">—</p>
      )}
    </div>
  );
}

function FriendRow({
  user,
  isMe,
  prediction,
  score,
  driverById,
  isSprint,
}: {
  user: User | undefined;
  isMe: boolean;
  prediction: Prediction;
  score: Score | undefined;
  driverById: Map<number, Driver>;
  isSprint: boolean;
}) {
  const name = displayName(user, isMe);
  const picks = isSprint
    ? [{ label: "P1", id: prediction.p1_driver_id }]
    : [
        { label: "P1", id: prediction.p1_driver_id },
        { label: "P2", id: prediction.p2_driver_id },
        { label: "P3", id: prediction.p3_driver_id },
      ];
  const points = score?.points ?? 0;
  const perfect = score?.perfect_bonus ?? false;
  return (
    <li
      className={`rounded-lg border p-5 ${
        isMe
          ? "border-[color:var(--accent-muted)] bg-[color:var(--surface-2)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)]"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p
          className="text-xl"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        >
          {name.toUpperCase()}
        </p>
        <div className="flex items-center gap-3">
          {perfect && (
            <span className="rounded border border-[color:var(--accent)] px-2 py-1 text-xs uppercase tracking-wider text-[color:var(--accent)]">
              Perfect podium
            </span>
          )}
          <p
            className="text-2xl"
            data-tabular
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
            }}
          >
            {points}
          </p>
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            pts
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {picks.map((p) => {
          const d = p.id !== null ? driverById.get(p.id) : null;
          return (
            <div
              key={p.label}
              className="flex items-center gap-3 rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2"
            >
              <span
                data-tabular
                className="w-6 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]"
              >
                {p.label}
              </span>
              {d ? (
                <>
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: teamDot(d.team) }}
                  />
                  <span className="text-sm text-[color:var(--fg)]">
                    {d.full_name}
                  </span>
                </>
              ) : (
                <span className="text-sm text-[color:var(--fg-subtle)]">—</span>
              )}
            </div>
          );
        })}
      </div>
    </li>
  );
}
