"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WriteResultsResult } from "@/lib/writeResults";

type Driver = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

type Slot = "p1" | "p2" | "p3";
type Picks = { p1: number | null; p2: number | null; p3: number | null };

export function ResultsForm({
  eventId,
  isSprint,
  drivers,
  existing,
  submit,
}: {
  eventId: string;
  isSprint: boolean;
  drivers: Driver[];
  existing: Picks;
  submit: (input: {
    eventId: string;
    p1: number;
    p2: number | null;
    p3: number | null;
  }) => Promise<WriteResultsResult>;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Picks>(existing);
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
  const canSubmit = !pending && allFilled && distinctFilled;

  function onChange(slot: Slot, id: number) {
    setFeedback(null);
    setPicks((prev) => ({ ...prev, [slot]: id }));
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
        setFeedback({
          kind: "ok",
          message: `Saved. Scores updated for ${result.scoresUpdated} prediction${
            result.scoresUpdated === 1 ? "" : "s"
          }.`,
        });
        router.refresh();
      } else {
        setFeedback({
          kind: "err",
          message:
            result.error === "ADMIN_REQUIRED"
              ? "Admin privilege required."
              : result.error === "UNAUTHENTICATED"
                ? "Please sign in again."
                : result.error === "VALIDATION"
                  ? result.message
                  : result.message,
        });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {slots.map((slot, idx) => {
        const label = `P${idx + 1}`;
        const selectedId = picks[slot];
        const selected = drivers.find((d) => d.id === selectedId);
        return (
          <div
            key={slot}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
          >
            <p className="mb-3 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
              {label}
            </p>
            {selected ? (
              <p
                className="mb-3 text-2xl"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
                }}
              >
                {selected.full_name.toUpperCase()}{" "}
                <span className="text-sm text-[color:var(--fg-subtle)]">
                  · {selected.team}
                </span>
              </p>
            ) : (
              <p className="mb-3 text-[color:var(--fg-muted)]">Not set</p>
            )}
            <select
              value={selectedId ?? ""}
              onChange={(e) => onChange(slot, Number(e.currentTarget.value))}
              disabled={pending}
              className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2 text-[color:var(--fg)] disabled:opacity-50"
              aria-label={`Actual ${label}`}
            >
              <option value="" disabled>
                Classified driver for {label}…
              </option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.full_name} · {d.team}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] pt-6">
        <p className="text-sm text-[color:var(--fg-muted)]">
          {allFilled
            ? distinctFilled
              ? "Ready to write. Scores will compute immediately."
              : "Same driver used in two slots — fix and resubmit."
            : `${filledCount} of ${slots.length} slot${
                slots.length > 1 ? "s" : ""
              } filled`}
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded bg-[color:var(--accent)] px-6 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
        >
          {pending ? "Writing…" : "File results"}
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
