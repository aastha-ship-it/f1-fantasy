"use client";

import { useState, useTransition } from "react";
import {
  savePracticeOverrideAction,
  clearPracticeOverrideAction,
} from "./practice-actions";

/**
 * Admin FP-override editor (changes.md §6). One block per FP slot — three
 * driver selects. Saving makes that slot win over the live OpenF1 fetch in
 * the Practice banner; Clear reverts to the live fetch. Drivers only — the
 * banner's lap-time column is populated solely from OpenF1.
 *
 * Sprint weekends only ever surface FP1 in the banner (it's all OpenF1
 * exposes), but all three slots are editable for simplicity.
 */

type Driver = { id: number; code: string };
type Existing = Record<
  number,
  { p1: number; p2: number; p3: number } | undefined
>;

const FP_SLOTS = [1, 2, 3] as const;

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
    <section className="mt-12">
      <h2
        className="mb-1"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 22,
        }}
      >
        FP OVERRIDES
      </h2>
      <p className="mb-5 text-xs text-[color:var(--fg-subtle)]">
        Optional. A saved slot overrides the live OpenF1 fetch in the predict
        banner (use when OpenF1 is late, wrong, or the session was cancelled).
        Sprint weekends only show FP1.
      </p>
      <div className="grid gap-px border border-[color:var(--border)] bg-[color:var(--border)]">
        {FP_SLOTS.map((fp) => (
          <FpRow
            key={fp}
            season={season}
            round={round}
            fpIndex={fp}
            drivers={drivers}
            initial={existing[fp]}
          />
        ))}
      </div>
    </section>
  );
}

function FpRow({
  season,
  round,
  fpIndex,
  drivers,
  initial,
}: {
  season: number;
  round: number;
  fpIndex: number;
  drivers: Driver[];
  initial: { p1: number; p2: number; p3: number } | undefined;
}) {
  const [p1, setP1] = useState<number | "">(initial?.p1 ?? "");
  const [p2, setP2] = useState<number | "">(initial?.p2 ?? "");
  const [p3, setP3] = useState<number | "">(initial?.p3 ?? "");
  const [msg, setMsg] = useState<string | null>(
    initial ? "Override active" : null,
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await savePracticeOverrideAction({
        season,
        round,
        fpIndex,
        p1DriverId: Number(p1),
        p2DriverId: Number(p2),
        p3DriverId: Number(p3),
      });
      setMsg(res.ok ? "Saved · overrides OpenF1" : res.error);
    });
  }

  function clear() {
    startTransition(async () => {
      const res = await clearPracticeOverrideAction({
        season,
        round,
        fpIndex,
      });
      if (res.ok) {
        setP1("");
        setP2("");
        setP3("");
        setMsg("Cleared · using OpenF1");
      } else {
        setMsg(res.error);
      }
    });
  }

  const sel = (
    value: number | "",
    onChange: (v: number | "") => void,
    label: string,
  ) => (
    <label className="flex items-center gap-2">
      <span
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.1em" }}
        data-tabular
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="bg-[color:var(--surface-2)] px-2 py-1.5 text-sm"
        style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
      >
        <option value="">—</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.code}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-4 bg-[color:var(--surface)] px-5 py-4">
      <span
        className="w-12 shrink-0 text-sm uppercase"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          letterSpacing: "0.1em",
        }}
        data-tabular
      >
        FP{fpIndex}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {sel(p1, setP1, "P1")}
        {sel(p2, setP2, "P2")}
        {sel(p3, setP3, "P3")}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3 py-1.5 text-[11px] uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            letterSpacing: "0.08em",
            background: "var(--accent)",
            color: "#000",
            fontWeight: 600,
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "…" : "Save"}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={pending}
          className="px-3 py-1.5 text-[11px] uppercase"
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            letterSpacing: "0.08em",
            border: "1px solid var(--border)",
            color: "var(--fg-muted)",
            opacity: pending ? 0.6 : 1,
          }}
        >
          Clear
        </button>
      </div>
      {msg && (
        <span
          className="text-[11px] uppercase"
          style={{
            color: msg.includes("·")
              ? "var(--success)"
              : "var(--fg-subtle)",
            letterSpacing: "0.06em",
          }}
          data-tabular
        >
          {msg}
        </span>
      )}
    </div>
  );
}
