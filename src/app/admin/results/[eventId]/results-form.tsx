"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeScore } from "@/lib/computeScores";
import { DriverPortrait } from "@/components/DriverPortrait";
import { teamMeta } from "@/lib/design/teams";
import type { WriteResultsResult } from "@/lib/writeResults";
import type {
  FileAndRevealResult,
  FetchFromOpenF1Result,
} from "./actions";

type Driver = {
  id: number;
  code: string;
  full_name: string;
  team: string;
};

type User = {
  id: string;
  email: string;
  display_name: string | null;
};

type Prediction = {
  user_id: string;
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

type Slot = "p1" | "p2" | "p3";
type Picks = { p1: number | null; p2: number | null; p3: number | null };

function displayName(u: User | undefined): string {
  if (!u) return "?";
  return u.display_name?.trim() || u.email.split("@")[0];
}

function breakdown(
  pred: Prediction,
  picks: Picks,
  isSprint: boolean,
): { points: number; label: string; perfect: boolean } | null {
  if (picks.p1 == null) return null;
  if (!isSprint && (picks.p2 == null || picks.p3 == null)) return null;
  const score = computeScore(
    {
      p1: pred.p1_driver_id ?? 0,
      p2: pred.p2_driver_id ?? null,
      p3: pred.p3_driver_id ?? null,
    },
    {
      p1: picks.p1,
      p2: isSprint ? null : picks.p2,
      p3: isSprint ? null : picks.p3,
    },
    isSprint,
  );
  const parts: string[] = [];
  if (score.exact_matches > 0)
    parts.push(
      `${score.exact_matches} exact${score.exact_matches === 1 ? "" : "es"}`,
    );
  if (score.slot_mismatches > 0)
    parts.push(`${score.slot_mismatches} on podium`);
  if (score.dnf_zeros > 0) parts.push(`${score.dnf_zeros} miss`);
  if (score.perfect_bonus) parts.push("perfect podium · +3");
  if (parts.length === 0) parts.push("0 hits");
  return {
    points: score.points,
    label: parts.join(" · "),
    perfect: score.perfect_bonus,
  };
}

export function ResultsForm({
  eventId,
  isSprint,
  alreadyRevealed,
  drivers,
  users,
  predictions,
  existing,
  submit,
  submitAndReveal,
  fetchFromOpenF1,
}: {
  eventId: string;
  isSprint: boolean;
  alreadyRevealed: boolean;
  drivers: Driver[];
  users: User[];
  predictions: Prediction[];
  existing: Picks;
  submit: (input: {
    eventId: string;
    p1: number;
    p2: number | null;
    p3: number | null;
  }) => Promise<WriteResultsResult>;
  submitAndReveal: (input: {
    eventId: string;
    p1: number;
    p2: number | null;
    p3: number | null;
  }) => Promise<FileAndRevealResult>;
  fetchFromOpenF1: (eventId: string) => Promise<FetchFromOpenF1Result>;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Picks>(existing);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok"; message: string } | { kind: "err"; message: string } | null
  >(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);

  const slots: Slot[] = isSprint ? ["p1"] : ["p1", "p2", "p3"];
  const filledCount = slots.filter((s) => picks[s] !== null).length;
  const allFilled = filledCount === slots.length;
  const distinctFilled =
    new Set(slots.map((s) => picks[s]).filter((v): v is number => v !== null))
      .size === filledCount;
  const canSubmit = !pending && allFilled && distinctFilled;

  const driverById = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers],
  );
  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  // Live score preview rows.
  const previewRows = useMemo(() => {
    return predictions
      .map((p) => {
        const u = userById.get(p.user_id);
        const score = breakdown(p, picks, isSprint);
        return { user: u, prediction: p, score };
      })
      .sort((a, b) => {
        const aPts = a.score?.points ?? -1;
        const bPts = b.score?.points ?? -1;
        if (aPts !== bPts) return bPts - aPts;
        return displayName(a.user).localeCompare(displayName(b.user));
      });
  }, [predictions, userById, picks, isSprint]);

  function selectDriver(slot: Slot, id: number) {
    setFeedback(null);
    setPicks((prev) => {
      const next = { ...prev };
      // If the chosen driver is already in another slot, swap.
      (["p1", "p2", "p3"] as Slot[]).forEach((s) => {
        if (s !== slot && next[s] === id) next[s] = prev[slot];
      });
      next[slot] = id;
      return next;
    });
    setEditingSlot(null);
  }

  function onSubmitOnly() {
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

  function onFetchFromOpenF1() {
    setFeedback(null);
    startTransition(async () => {
      const r = await fetchFromOpenF1(eventId);
      if (r.ok) {
        setFeedback({ kind: "ok", message: r.message });
        if (r.written) router.refresh();
      } else {
        setFeedback({ kind: "err", message: r.message });
      }
    });
  }

  function onSubmitAndReveal() {
    if (!canSubmit) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await submitAndReveal({
        eventId,
        p1: picks.p1!,
        p2: isSprint ? null : picks.p2!,
        p3: isSprint ? null : picks.p3!,
      });
      if (result.ok) {
        setFeedback({
          kind: "ok",
          message: `Saved + revealed. ${result.scoresUpdated} score${result.scoresUpdated === 1 ? "" : "s"} written. Redirecting…`,
        });
        // Redirect to the reveal page so the admin can verify.
        router.push(`/reveal/${eventId}`);
      } else {
        setFeedback({
          kind: "err",
          message: `${result.stage === "write" ? "Save" : "Reveal"} failed: ${result.message}`,
        });
      }
    });
  }

  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
      {/* LEFT — Classified podium */}
      <section>
        <h2
          className="m-0 mb-5 text-2xl"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          CLASSIFIED PODIUM
        </h2>

        <div className="flex flex-col gap-3">
          {slots.map((slot, idx) => {
            const id = picks[slot];
            const d = id != null ? driverById.get(id) : undefined;
            const t = d ? teamMeta(d.team) : null;
            const isEditing = editingSlot === slot;
            const isP1 = idx === 0;
            return (
              <div
                key={slot}
                className="relative overflow-hidden bg-[color:var(--surface)]"
                style={{
                  boxShadow: t
                    ? `inset 0 -3px 0 ${t.hex}`
                    : "inset 0 -3px 0 var(--border)",
                }}
              >
                <div
                  className="grid items-center gap-4 p-5"
                  style={{
                    gridTemplateColumns: "60px 64px minmax(0,1fr) auto",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      fontSize: 48,
                      lineHeight: 0.85,
                      color: isP1 ? "var(--accent)" : "var(--fg)",
                    }}
                    data-tight
                  >
                    P{idx + 1}
                  </div>
                  {d ? (
                    <DriverPortrait
                      code={d.code}
                      team={d.team}
                      size={56}
                    />
                  ) : (
                    <div
                      className="grid place-items-center"
                      style={{
                        width: 56,
                        height: 56,
                        background: "var(--surface-2)",
                        border: "1px dashed var(--border)",
                        color: "var(--fg-subtle)",
                        fontFamily:
                          "var(--font-mono), ui-monospace, monospace",
                        fontSize: 12,
                      }}
                    >
                      ?
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    {d && t ? (
                      <>
                        <span
                          className="leading-tight"
                          style={{
                            fontFamily:
                              "var(--font-boldonse), ui-sans-serif",
                            fontSize: 18,
                          }}
                        >
                          {d.full_name}
                        </span>
                        <span
                          className="text-[10px] uppercase"
                          style={{
                            color: t.hex,
                            letterSpacing: "0.08em",
                            fontFamily:
                              "var(--font-mono), ui-monospace, monospace",
                          }}
                          data-tabular
                        >
                          #{d.id} · {t.short}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-[color:var(--fg-muted)] italic">
                        Choose a driver
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSlot((curr) => (curr === slot ? null : slot))
                    }
                    disabled={pending}
                    className="px-3 py-2 text-[11px] uppercase transition-colors disabled:opacity-50"
                    style={{
                      background: "transparent",
                      color: "var(--fg-muted)",
                      border: "1px solid var(--border)",
                      letterSpacing: "0.06em",
                      fontFamily:
                        "var(--font-mono), ui-monospace, monospace",
                    }}
                  >
                    {isEditing ? "Cancel" : "Change"}
                  </button>
                </div>

                {isEditing && (
                  <ul
                    className="grid gap-px border-t border-[color:var(--border)] bg-[color:var(--border)]"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(120px, 1fr))",
                    }}
                  >
                    {drivers.map((opt) => {
                      const ot = teamMeta(opt.team);
                      const taken =
                        slots.some((s) => s !== slot && picks[s] === opt.id);
                      return (
                        <li key={opt.id}>
                          <button
                            type="button"
                            onClick={() => selectDriver(slot, opt.id)}
                            disabled={pending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[color:var(--surface-2)] disabled:opacity-40"
                            style={{
                              background: "var(--surface)",
                              borderTop: `2px solid ${ot?.hex ?? "var(--fg-subtle)"}`,
                              opacity: taken ? 0.5 : 1,
                            }}
                          >
                            <span
                              style={{
                                fontFamily:
                                  "var(--font-boldonse), ui-sans-serif",
                                fontSize: 12,
                                letterSpacing: "0.04em",
                              }}
                            >
                              {opt.code}
                            </span>
                            <span className="truncate text-[10px] text-[color:var(--fg-muted)]">
                              {opt.full_name}
                            </span>
                            {taken && (
                              <span
                                className="ml-auto text-[9px] uppercase text-[color:var(--fg-subtle)]"
                                data-tabular
                              >
                                used
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {!distinctFilled && allFilled && (
          <p
            role="alert"
            className="mt-4 text-sm text-[color:var(--error)]"
          >
            Same driver in two slots — fix and resubmit.
          </p>
        )}
      </section>

      {/* RIGHT — Score preview + CTAs */}
      <section>
        <h2
          className="m-0 mb-2 text-2xl"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            letterSpacing: "-0.005em",
          }}
        >
          SCORE PREVIEW
        </h2>
        <p
          className="mb-4 text-[10px] uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.12em" }}
          data-tabular
        >
          Computed from current entry · {predictions.length} prediction
          {predictions.length === 1 ? "" : "s"} · live update
        </p>

        {previewRows.length === 0 ? (
          <p className="text-sm text-[color:var(--fg-subtle)]">
            No friend predictions for this session yet.
          </p>
        ) : (
          <ul className="flex flex-col">
            {previewRows.map((row) => {
              const codes = (
                isSprint
                  ? [row.prediction.p1_driver_id]
                  : [
                      row.prediction.p1_driver_id,
                      row.prediction.p2_driver_id,
                      row.prediction.p3_driver_id,
                    ]
              ).map((id) => (id ? driverById.get(id)?.code ?? "—" : "—"));
              return (
                <li
                  key={row.prediction.user_id}
                  className="grid items-center gap-3 border-b border-[color:var(--border)] py-3"
                  style={{
                    gridTemplateColumns: "minmax(0,1fr) 56px",
                  }}
                >
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span
                        className="truncate"
                        style={{
                          fontFamily:
                            "var(--font-boldonse), ui-sans-serif",
                          fontSize: 14,
                        }}
                      >
                        {displayName(row.user)}
                      </span>
                      <span
                        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                        style={{ letterSpacing: "0.06em" }}
                        data-tabular
                      >
                        {codes.join(" · ")}
                      </span>
                    </p>
                    {row.score && (
                      <p
                        className="mt-0.5 text-[10px] uppercase"
                        style={{
                          color: row.score.perfect
                            ? "var(--accent)"
                            : "var(--fg-muted)",
                          letterSpacing: "0.06em",
                          fontFamily:
                            "var(--font-mono), ui-monospace, monospace",
                        }}
                      >
                        {row.score.label}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-right"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                      fontSize: 24,
                      color:
                        row.score == null
                          ? "var(--fg-subtle)"
                          : row.score.perfect ||
                              (row.score?.points ?? 0) >= 10
                            ? "var(--accent)"
                            : (row.score?.points ?? 0) === 0
                              ? "var(--fg-subtle)"
                              : "var(--fg)",
                    }}
                    data-tabular
                  >
                    {row.score == null ? "—" : `+${row.score.points}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Action bar */}
        <div className="mt-8 bg-[color:var(--surface-2)] p-5">
          <p
            className="text-xs leading-relaxed text-[color:var(--fg-muted)]"
            style={{ letterSpacing: "0.04em" }}
          >
            <strong className="text-[color:var(--fg)]">Save</strong> writes
            results + computes scores.{" "}
            {alreadyRevealed ? (
              <span className="text-[color:var(--fg-subtle)]">
                Already revealed — saving updates scores in place.
              </span>
            ) : (
              <>
                <strong className="text-[color:var(--fg)]">
                  Save + Reveal
                </strong>{" "}
                also flips picks visible to the group and triggers the
                cinematic.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={onFetchFromOpenF1}
            disabled={pending}
            className="mt-3 w-full px-5 py-3 text-xs uppercase transition-colors disabled:opacity-40"
            style={{
              background: "var(--surface-2)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              letterSpacing: "0.08em",
            }}
            title="Pull the classification from OpenF1 and score it. Won't overwrite admin-entered or revealed results."
          >
            {pending ? "Working…" : "↻ Fetch from OpenF1"}
          </button>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={onSubmitOnly}
              disabled={!canSubmit}
              className="flex-1 px-5 py-3 text-xs uppercase transition-colors disabled:opacity-40"
              style={{
                background: "transparent",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onSubmitAndReveal}
              disabled={!canSubmit || alreadyRevealed}
              className="flex-[2] px-5 py-3 text-xs uppercase transition-colors disabled:opacity-40"
              style={{
                background: "var(--accent)",
                color: "#000",
                border: "none",
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                letterSpacing: "0.04em",
              }}
              title={
                alreadyRevealed
                  ? "Already revealed; use Save to update scores"
                  : undefined
              }
            >
              {pending
                ? "Working…"
                : alreadyRevealed
                  ? "Already revealed"
                  : "Save + Reveal to group →"}
            </button>
          </div>
          {feedback && (
            <p
              role={feedback.kind === "err" ? "alert" : "status"}
              className={
                feedback.kind === "ok"
                  ? "mt-3 text-xs text-[color:var(--success)]"
                  : "mt-3 text-xs text-[color:var(--error)]"
              }
            >
              {feedback.message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
