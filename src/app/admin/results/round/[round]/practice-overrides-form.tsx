"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { teamMeta } from "@/lib/design/teams";
import {
  overrideBadge,
  type OverrideStatus,
} from "@/lib/practice/overrideBadge";
import {
  savePracticeOverrideAction,
  clearPracticeOverrideAction,
} from "./practice-actions";

/**
 * Admin FP-override editor (changes.md §6 / design_handoff_phase11 §8).
 *
 * One row per FP slot — three driver `<select>`s. Saving makes that slot
 * win over the live OpenF1 fetch in the predict-round Practice banner;
 * Clear reverts to the live fetch. Drivers only — the banner's lap-time
 * column is OpenF1-sourced. Status badge: persistent `Using OpenF1` /
 * `Override active`, with a transient ~2s `✓ Saved …` / `✓ Cleared …`
 * flash after the action (owner decision; canvas-faithful). The badge
 * label/colour is the unit-locked pure `overrideBadge`; the
 * persistent/transient *timing* lives here.
 */

type Driver = { id: number; code: string; team: string; full_name: string };
type Existing = Record<
  number,
  { p1: number; p2: number; p3: number } | undefined
>;

const FP_SLOTS = [1, 2, 3] as const;
const SUBTITLE_REVERT_MS = 2000;

export function PracticeOverridesForm({
  season,
  round,
  drivers,
  existing,
}: {
  season: number;
  round: number;
  drivers: Driver[];
  existing: Existing;
}) {
  return (
    <section
      style={{
        marginTop: "var(--space-3xl)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <header
        className="flex items-baseline justify-between"
        style={{
          padding: "var(--space-xl) var(--space-2xl)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <h2
            className="m-0 uppercase"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: 20,
              letterSpacing: "0.02em",
            }}
          >
            FP Overrides
          </h2>
          <p
            style={{
              margin: "var(--space-xs) 0 0",
              fontSize: 12,
              color: "var(--fg-muted)",
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            Override the live OpenF1 podium for any FP session. All three
            slots must be filled with distinct drivers — blanks and
            duplicates are rejected. Saved overrides win over the live fetch
            on the participant banner at{" "}
            <code style={{ color: "var(--accent)" }}>
              /dashboard/predict/round/{round}
            </code>
            .
          </p>
        </div>
      </header>

      <div
        className="grid items-center uppercase text-[color:var(--fg-subtle)]"
        style={{
          gridTemplateColumns: "120px repeat(3, 1fr) auto auto",
          gap: "var(--space-lg)",
          padding: "var(--space-md) var(--space-2xl)",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.14em",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
        data-tabular
      >
        <span>Session</span>
        <span>P1</span>
        <span>P2</span>
        <span>P3</span>
        <span className="text-right">Status</span>
        <span className="text-right">Actions</span>
      </div>

      {FP_SLOTS.map((fp, i) => (
        <FpRow
          key={fp}
          season={season}
          round={round}
          fpIndex={fp}
          drivers={drivers}
          initial={existing[fp]}
          isLast={i === FP_SLOTS.length - 1}
        />
      ))}
    </section>
  );
}

function FpRow({
  season,
  round,
  fpIndex,
  drivers,
  initial,
  isLast,
}: {
  season: number;
  round: number;
  fpIndex: number;
  drivers: Driver[];
  initial: { p1: number; p2: number; p3: number } | undefined;
  isLast: boolean;
}) {
  const [p1, setP1] = useState<number | "">(initial?.p1 ?? "");
  const [p2, setP2] = useState<number | "">(initial?.p2 ?? "");
  const [p3, setP3] = useState<number | "">(initial?.p3 ?? "");
  const [status, setStatus] = useState<OverrideStatus>(
    initial ? "active" : "using",
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const revertRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revertRef.current) clearTimeout(revertRef.current);
    };
  }, []);

  function flash(transient: OverrideStatus, settled: OverrideStatus) {
    setStatus(transient);
    if (revertRef.current) clearTimeout(revertRef.current);
    revertRef.current = setTimeout(
      () => setStatus(settled),
      SUBTITLE_REVERT_MS,
    );
  }

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await savePracticeOverrideAction({
        season,
        round,
        fpIndex,
        p1DriverId: Number(p1),
        p2DriverId: Number(p2),
        p3DriverId: Number(p3),
      });
      if (res.ok) flash("saved", "active");
      else setErr(res.error);
    });
  }

  function clear() {
    setErr(null);
    startTransition(async () => {
      const res = await clearPracticeOverrideAction({ season, round, fpIndex });
      if (res.ok) {
        setP1("");
        setP2("");
        setP3("");
        flash("cleared", "using");
      } else {
        setErr(res.error);
      }
    });
  }

  const byId = new Map(drivers.map((d) => [d.id, d]));
  const empty = !p1 && !p2 && !p3;
  const badge = overrideBadge(status);

  function slot(value: number | "", onChange: (v: number | "") => void) {
    const d = value === "" ? null : byId.get(Number(value));
    const hex = d ? (teamMeta(d.team)?.hex ?? null) : null;
    return (
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="w-full text-sm"
        style={{
          background: "var(--surface-2)",
          color: d ? "var(--fg)" : "var(--fg-subtle)",
          border: "1px solid var(--border)",
          borderLeft: hex
            ? `3px solid ${hex}`
            : "1px solid var(--border)",
          padding: "8px 12px",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
        }}
        data-tabular
      >
        <option value="">Pick driver</option>
        {drivers.map((dr) => (
          <option key={dr.id} value={dr.id}>
            {dr.code} · {dr.full_name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: "120px repeat(3, 1fr) auto auto",
        gap: "var(--space-lg)",
        padding: "var(--space-lg) var(--space-2xl)",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <span
        className="uppercase"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 16,
          letterSpacing: "0.02em",
        }}
      >
        FP{fpIndex}
      </span>

      {slot(p1, setP1)}
      {slot(p2, setP2)}
      {slot(p3, setP3)}

      <span
        className="justify-self-end uppercase"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.08em",
          color: err ? "var(--error)" : badge.color,
          background: err ? "transparent" : badge.bg,
          padding: badge.bg === "transparent" || err ? 0 : "5px 10px",
          border:
            badge.bg === "transparent" || err
              ? "none"
              : "1px solid var(--border)",
          whiteSpace: "nowrap",
        }}
        data-tabular
      >
        {err ?? badge.label}
      </span>

      <div className="flex justify-self-end gap-2">
        <button
          type="button"
          onClick={clear}
          disabled={empty || pending}
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            padding: "8px 14px",
            background: "transparent",
            color: empty ? "var(--fg-subtle)" : "var(--fg)",
            border: "1px solid var(--border)",
            cursor: empty ? "not-allowed" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            padding: "8px 14px",
            background: "var(--accent)",
            color: "#000",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "…" : "Save"}
        </button>
      </div>
    </div>
  );
}
