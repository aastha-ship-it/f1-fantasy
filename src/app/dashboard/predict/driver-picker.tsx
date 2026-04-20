"use client";

import { useEffect, useState, useTransition } from "react";
import type { SubmitPredictionResult } from "@/lib/submitPrediction";

type Driver = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

type Slot = "p1" | "p2" | "p3";
type Picks = { p1: number | null; p2: number | null; p3: number | null };

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

export function DriverPicker({
  eventId,
  isSprint,
  lockAt,
  drivers,
  initialPicks,
  submit,
}: {
  eventId: string;
  isSprint: boolean;
  lockAt: string | Date;
  drivers: Driver[];
  initialPicks: Picks;
  submit: (input: {
    eventId: string;
    p1: number;
    p2: number | null;
    p3: number | null;
  }) => Promise<SubmitPredictionResult>;
}) {
  const target =
    typeof lockAt === "string" ? new Date(lockAt).getTime() : lockAt.getTime();
  const [isClosed, setIsClosed] = useState(false);
  useEffect(() => {
    const tick = () => setIsClosed(Date.now() >= target);
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [target]);

  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok"; message: string } | { kind: "err"; message: string } | null
  >(null);

  const slots: Slot[] = isSprint ? ["p1"] : ["p1", "p2", "p3"];
  const filledCount = slots.filter((s) => picks[s] !== null).length;
  const allFilled = filledCount === slots.length;
  const distinctFilled =
    new Set(slots.map((s) => picks[s]).filter((v): v is number => v !== null))
      .size === filledCount;
  const canSubmit = !isClosed && !pending && allFilled && distinctFilled;

  function chooseDriver(slot: Slot, id: number) {
    setFeedback(null);
    setPicks((prev) => {
      // Swap if the same driver is already placed in another slot.
      const next = { ...prev };
      (["p1", "p2", "p3"] as Slot[]).forEach((s) => {
        if (s !== slot && next[s] === id) next[s] = prev[slot];
      });
      next[slot] = id;
      return next;
    });
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
        setFeedback({ kind: "ok", message: "Picks saved." });
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
      className="flex flex-col gap-6"
      data-testid="driver-picker"
    >
      {slots.map((slot, idx) => {
        const selectedId = picks[slot];
        const selected = drivers.find((d) => d.id === selectedId);
        const label = `P${idx + 1}`;
        return (
          <div
            key={slot}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <p
                className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]"
                data-tabular
              >
                {label}
              </p>
              {!distinctFilled &&
                selectedId !== null &&
                slots.filter((s) => picks[s] === selectedId).length > 1 && (
                  <p className="text-xs text-[color:var(--error)]">
                    Driver already picked
                  </p>
                )}
            </div>
            {selected ? (
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-block size-3 rounded-full"
                  style={{ background: teamDot(selected.team) }}
                />
                <p
                  className="text-3xl"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                  }}
                >
                  {selected.full_name.toUpperCase()}
                </p>
                <p
                  className="text-sm uppercase text-[color:var(--fg-subtle)]"
                  data-tabular
                >
                  {selected.code}
                </p>
              </div>
            ) : (
              <p className="text-[color:var(--fg-muted)]">No pick yet</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                value={selectedId ?? ""}
                onChange={(e) =>
                  chooseDriver(slot, Number(e.currentTarget.value))
                }
                disabled={isClosed || pending}
                className="min-w-52 rounded border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 text-[color:var(--fg)] disabled:opacity-50"
                aria-label={`Choose ${label}`}
              >
                <option value="" disabled>
                  Pick a driver…
                </option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.full_name} · {d.team}
                  </option>
                ))}
              </select>
              {selectedId !== null && (
                <button
                  type="button"
                  onClick={() =>
                    setPicks((prev) => ({ ...prev, [slot]: null }))
                  }
                  disabled={isClosed || pending}
                  className="rounded border border-[color:var(--border)] bg-transparent px-3 py-2 text-sm text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)] hover:text-[color:var(--fg)] disabled:opacity-50"
                >
                  Change pick
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-4 border-t border-[color:var(--border)] bg-[color:var(--bg)] px-6 py-4">
        <p
          className="text-sm text-[color:var(--fg-muted)]"
          data-testid="lock-bar-status"
        >
          {isClosed
            ? "Predictions closed."
            : allFilled
              ? distinctFilled
                ? "Ready to lock in."
                : "Same driver in two slots — fix and resubmit."
              : `${filledCount} of ${slots.length} slot${
                  slots.length > 1 ? "s" : ""
                } picked · picks save on submit`}
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-[color:var(--accent)] px-6 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
          data-testid="submit-picks"
        >
          {pending ? "Saving…" : "Lock in picks"}
        </button>
      </div>

      {feedback && (
        <p
          role={feedback.kind === "err" ? "alert" : "status"}
          className={
            feedback.kind === "ok"
              ? "text-sm text-[color:var(--success)]"
              : "text-sm text-[color:var(--error)]"
          }
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}
