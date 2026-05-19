"use client";

import { useState } from "react";
import Link from "next/link";
import { DriverPortrait } from "@/components/DriverPortrait";
import { teamMeta } from "@/lib/design/teams";
import { phaseLine, type PhaseTone } from "@/lib/lobby/phaseLine";
import type {
  LobbySession,
  LobbyParticipant,
  LobbySlotPick,
} from "@/lib/lobby/loadLobby";

/**
 * Lobby sessions — interactive expand/collapse island (design_handoff_phase11
 * §1/§2). Client only for the single `useState(expandedId)`; everything it
 * renders is plain serializable data, and the timezone-sensitive session
 * time is preformatted on the server (`timeLabel`) so SSR and hydration
 * render the identical string — no hydration mismatch.
 */

export type LobbySessionView = LobbySession & { timeLabel: string };

const TONE_COLOR: Record<PhaseTone, string> = {
  muted: "var(--fg-muted)",
  accent: "var(--accent)",
  success: "var(--success)",
};

const PREVIEW_GRID =
  "grid items-center gap-[var(--space-lg)] [grid-template-columns:1.2fr_1.4fr_auto_auto]";

function SessionMeta({ s }: { s: LobbySessionView }) {
  const pl = phaseLine(s);
  return (
    <>
      <div>
        <h2
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 20,
            letterSpacing: "0.005em",
          }}
        >
          {s.label.toUpperCase()}
        </h2>
        <p
          className="mt-1 text-[10px] uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.08em" }}
          data-tabular
        >
          {s.timeLabel}
        </p>
      </div>
      <p
        className="text-[11px]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          color: TONE_COLOR[pl.tone],
        }}
        data-tabular
      >
        {pl.text}
      </p>
    </>
  );
}

function LockDots({ participants }: { participants: LobbyParticipant[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {participants.map((p) => (
        <span
          key={p.userId}
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: p.locked ? "var(--success)" : "transparent",
            border: p.locked ? "none" : "1px solid var(--fg-subtle)",
          }}
        />
      ))}
    </span>
  );
}

function LockCount({ s, action }: { s: LobbySessionView; action: string }) {
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 14,
        }}
        data-tabular
      >
        {s.lockedCount}/{s.totalCount}
      </span>
      <span
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.1em" }}
        data-tabular
      >
        LOCKED · {action}
      </span>
    </span>
  );
}

function PreviewCard({
  s,
  onExpand,
}: {
  s: LobbySessionView;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={`w-full text-left ${PREVIEW_GRID}`}
      style={{
        padding: "var(--space-xl) var(--space-xl)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <SessionMeta s={s} />
      <LockDots participants={s.participants} />
      <LockCount s={s} action="Expand ▾" />
    </button>
  );
}

function LockBadge({ locked }: { locked: boolean }) {
  const base = {
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    padding: "var(--space-xs) var(--space-sm)",
  } as const;
  if (locked) {
    return (
      <span
        className="text-[10px]"
        style={{
          ...base,
          fontWeight: 600,
          background: "var(--success)",
          color: "#000",
        }}
        data-tabular
      >
        ✓ Locked
      </span>
    );
  }
  return (
    <span
      className="text-[10px] text-[color:var(--fg-subtle)]"
      style={{ ...base, border: "1px solid var(--border)" }}
      data-tabular
    >
      ✗ Not locked
    </span>
  );
}

function MiniCard({ slot }: { slot: LobbySlotPick }) {
  const hex = teamMeta(slot.team)?.hex ?? "var(--border)";
  return (
    <div
      className="grid items-center gap-2 [grid-template-columns:auto_auto_1fr]"
      style={{
        border: `1px solid ${hex}`,
        padding: "var(--space-sm)",
        background: "var(--surface)",
      }}
    >
      <span
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          letterSpacing: "0.12em",
        }}
        data-tabular
      >
        {slot.label}
      </span>
      {slot.code ? (
        <DriverPortrait code={slot.code} team={slot.team} size={28} />
      ) : (
        <span style={{ width: 28, height: 28 }} />
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <span
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 13,
          }}
        >
          {slot.code ?? "—"}
        </span>
        <span
          className="truncate text-[10px] uppercase text-[color:var(--fg-muted)]"
          data-tabular
        >
          {slot.lastName?.toUpperCase() ?? ""}
        </span>
      </span>
    </div>
  );
}

function PlaceholderRow({ label, note }: { label: string; note: string }) {
  return (
    <div
      className="grid items-center gap-2 [grid-template-columns:auto_1fr_auto]"
      style={{
        border: "1px dashed var(--border)",
        padding: "var(--space-sm)",
        opacity: 0.6,
      }}
    >
      <span
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          letterSpacing: "0.12em",
        }}
        data-tabular
      >
        {label}
      </span>
      <span
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.08em" }}
      >
        {note}
      </span>
      <span className="text-[color:var(--fg-subtle)]" data-tabular>
        —
      </span>
    </div>
  );
}

function ParticipantBlock({ p }: { p: LobbyParticipant }) {
  const me = p.isMe;
  const hasRevealed = p.revealed.length > 0;
  const shown = new Set(p.revealed.map((r) => r.label));
  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: 220,
        background: "var(--surface-2)",
        border: `1px solid ${me ? "var(--accent)" : "var(--border)"}`,
        outline: me
          ? "2px solid color-mix(in oklch, var(--accent) 30%, transparent)"
          : undefined,
      }}
    >
      <div
        className="flex items-center justify-between gap-2"
        style={{
          padding: "var(--space-md)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 16,
            color: me ? "var(--accent)" : "var(--fg)",
          }}
        >
          {p.name}
          {me ? " (you)" : ""}
        </span>
        <LockBadge locked={p.locked} />
      </div>

      <div
        className="flex flex-1 flex-col gap-2"
        style={{ padding: "var(--space-md)" }}
      >
        {hasRevealed ? (
          <>
            {p.revealed.map((slot) => (
              <MiniCard key={slot.label} slot={slot} />
            ))}
            {!shown.has("P2") && (
              <PlaceholderRow label="P2" note="Reveals soon" />
            )}
            <PlaceholderRow label="P1" note="Reveals in the cinematic" />
          </>
        ) : (
          <div
            className="flex flex-1 items-center justify-center"
            style={{ border: "1px dashed var(--border)" }}
          >
            <span
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: 56,
                color: p.locked ? "var(--success)" : "var(--fg-subtle)",
                opacity: p.locked ? 1 : 0.6,
              }}
            >
              {p.locked ? "✓" : "✕"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedCard({
  s,
  onCollapse,
}: {
  s: LobbySessionView;
  onCollapse: () => void;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--accent)",
        outline: "4px solid color-mix(in oklch, var(--accent) 12%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={onCollapse}
        className={`w-full text-left ${PREVIEW_GRID}`}
        style={{
          padding: "var(--space-xl) var(--space-xl)",
          borderBottom: "1px solid var(--border)",
          background: "transparent",
        }}
      >
        <SessionMeta s={s} />
        <LockDots participants={s.participants} />
        <LockCount s={s} action="Collapse ▴" />
      </button>

      <div
        className="grid gap-[var(--space-lg)] [grid-template-columns:repeat(3,1fr)]"
        style={{ padding: "var(--space-xl)" }}
      >
        {s.participants.map((p) => (
          <ParticipantBlock key={p.userId} p={p} />
        ))}
      </div>

      {s.progressive && s.sessionOver && (
        <div style={{ padding: "var(--space-lg) var(--space-xl)" }}>
          <Link
            href={`/reveal/${s.eventId}`}
            className="inline-block text-[11px] uppercase"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              letterSpacing: "0.08em",
              padding: "var(--space-sm) var(--space-lg)",
              background: "var(--accent)",
              color: "#000",
            }}
          >
            P1 &amp; final results await in the Reveal →
          </Link>
        </div>
      )}
    </section>
  );
}

export function LobbySessions({ sessions }: { sessions: LobbySessionView[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="mt-10">
        <p className="text-sm text-[color:var(--fg-muted)]">
          No scoring sessions locked in for this weekend yet. The roster opens
          as soon as the schedule firms up — check back closer to track time.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 grid gap-6">
      {sessions.map((s) =>
        expandedId === s.eventId ? (
          <ExpandedCard
            key={s.eventId}
            s={s}
            onCollapse={() => setExpandedId(null)}
          />
        ) : (
          <PreviewCard
            key={s.eventId}
            s={s}
            onExpand={() => setExpandedId(s.eventId)}
          />
        ),
      )}
    </div>
  );
}
