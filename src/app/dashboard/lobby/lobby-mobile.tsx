import {
  MobBleed,
  MobDisclosureRow,
  MobEyebrow,
  MobSectionHead,
} from "@/components/MobilePrimitives";
import { ScoringLegendBody } from "@/components/ScoringLegend";
import { teamMeta } from "@/lib/design/teams";
import { formatLockDelta } from "@/lib/design/lockDelta";
import type { LobbyParticipant, LobbySession } from "@/lib/lobby/loadLobby";
import type { LobbySessionView } from "./lobby-sessions";

/**
 * Lobby — the 390pt tree. Canvas: `screens-mobile-b.jsx:MobLobbyScreen`
 * (spec §4.1) plus the phase matrix in `screens-mobile-d.jsx` (§4.2), which
 * documents the same disclosure in its three pre-cinematic phases.
 *
 * SERVER component, and deliberately not a fork of `lobby-sessions.tsx`.
 * That file is a client island whose only state is `expandedId` (single-open
 * accordion); below the fork the artboard draws independent `+`/`−` rows, so
 * this tree uses `MobDisclosureRow` — native `<details>`, zero JS, free
 * keyboard and screen-reader semantics. Keeping the two trees in separate
 * files is what makes the desktop render provably byte-identical: nothing in
 * `lobby-sessions.tsx` changed.
 *
 * The request-time countdown is a server snapshot (`formatLockDelta`), the
 * same treatment the dashboard and predict-list heroes use. It does not tick.
 */

const MONO = "var(--font-mono), ui-monospace, monospace";
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";

/** Slot columns a session actually takes picks for (CLAUDE.md: sprints score P1 only). */
function slotLabelsFor(sessionType: string): ("P1" | "P2" | "P3")[] {
  return sessionType === "sprint_quali" || sessionType === "sprint_race"
    ? ["P1"]
    : ["P1", "P2", "P3"];
}

/**
 * Panel header copy. The artboard only draws the "P3 revealed" phase; §4.2
 * enumerates the rest, so the phases are derived from the same server gate
 * flags the desktop tree reads rather than hardcoding one of them.
 *
 * P1 is absent from every branch on purpose — `loadLobby` never puts it in
 * `revealed`, so it stays hidden right up to the cinematic.
 */
function phaseCopy(
  s: LobbySession,
  slotCount: number,
): { title: string; hidden: string } {
  // A sprint takes one pick, so calling its panel "podium picks" would
  // contradict the single P1 column right beneath it.
  const noun = slotCount === 1 ? "Winner pick" : "Podium picks";
  if (!s.progressive) {
    return { title: `${noun} · sealed`, hidden: "P1 hidden" };
  }
  if (s.showP2) {
    return { title: `${noun} · P3 + P2 revealed`, hidden: "P1 hidden" };
  }
  if (s.showP3) {
    return { title: `${noun} · P3 revealed`, hidden: "P2 · P1 hidden" };
  }
  return { title: `${noun} · locked`, hidden: "P3 · P2 · P1 hidden" };
}

/**
 * The roster's column template, in ONE place.
 *
 * `RosterHead` and `RosterRow` both call it, so the header can never drift
 * out of sync with the cells underneath it. The review handoff calls this
 * out by name: a row that emits five children over a six-column template
 * silently shifts every pick under the wrong header, and that regressed
 * once already. Column count is `3 + slots.length` — avatar, name, lock,
 * then one cell per slot the session takes picks for.
 */
function rosterTemplate(slotCount: number): string {
  return `26px minmax(0,1fr) 22px repeat(${slotCount}, 40px)`;
}

/**
 * Lock cell (§R-3) — the column that tells an unlocked friend apart from a
 * locked one whose picks are still hidden. The desktop `ParticipantBlock`
 * has carried a `✓ Locked / ✗ Not locked` badge since phase 11; the phone
 * roster had nothing, so every row read as "waiting".
 *
 * `title` rather than a visible word: at 22px the glyph is the whole cell,
 * and the legend above the roster spells both states out in full.
 */
function LockCell({ locked }: { locked: boolean }) {
  return (
    <span
      className="grid place-items-center"
      title={locked ? "Locked" : "Not locked"}
      data-tabular
      style={{
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 600,
        color: locked ? "var(--success)" : "var(--fg-subtle)",
      }}
    >
      {locked ? "✓" : "✗"}
    </span>
  );
}

/**
 * 40×26 slot cell — revealed takes the driver's team colour, hidden stays
 * dashed.
 *
 * LOCK STATE AND REVEAL STATE ARE INDEPENDENT (§R-3). The cell reads the
 * participant's `locked` flag and the reveal gate's `revealed` list as two
 * separate facts and never derives one from the other:
 *
 *   locked + revealed    → the driver's code on their team colour
 *   locked, not revealed → `· · ·`, i.e. "there is a pick, you can't see it"
 *   not locked           → `—`, i.e. "there is nothing to reveal"
 *
 * Collapsing those last two into one glyph is exactly the ambiguity this
 * PR exists to remove.
 */
function SlotCell({
  label,
  participant,
}: {
  label: "P1" | "P2" | "P3";
  participant: LobbyParticipant;
}) {
  const slot =
    label === "P1"
      ? undefined
      : participant.revealed.find((r) => r.label === label);
  // An unlocked friend has no picks, so nothing of theirs can be shown even
  // if the gate is open for everyone else.
  const shown = participant.locked ? slot : undefined;
  const hex = shown ? (teamMeta(shown.team)?.hex ?? "var(--fg-muted)") : null;

  return (
    <div
      className="grid place-items-center uppercase"
      data-tabular
      style={{
        height: 26,
        fontFamily: MONO,
        fontSize: 9,
        letterSpacing: "0.06em",
        border: hex ? `1px solid ${hex}` : "1px dashed var(--border)",
        color: hex ?? "var(--fg-subtle)",
        background: hex ? "var(--surface-2)" : "transparent",
      }}
    >
      {shown?.code ?? (participant.locked ? "· · ·" : "—")}
    </div>
  );
}

function RosterRow({
  p,
  slots,
}: {
  p: LobbyParticipant;
  slots: ("P1" | "P2" | "P3")[];
}) {
  const hex = teamMeta(p.team)?.hex ?? "var(--border)";
  return (
    <div
      className="grid items-center gap-[6px]"
      style={{
        gridTemplateColumns: rosterTemplate(slots.length),
        // §R-3: an unlocked row is still information — who has not picked —
        // so it recedes rather than disappearing.
        opacity: p.locked ? undefined : 0.6,
      }}
    >
      <span
        aria-hidden
        className="grid place-items-center uppercase"
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--surface-2)",
          border: `1px solid ${hex}`,
          fontFamily: DISPLAY_FONT,
          fontSize: 10,
        }}
      >
        {p.name.slice(0, 1).toUpperCase()}
      </span>
      <span
        className="truncate"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: p.isMe ? "var(--accent)" : "var(--fg)",
        }}
      >
        {p.name}
        {p.isMe ? " (you)" : ""}
      </span>
      <LockCell locked={p.locked} />
      {slots.map((label) => (
        <SlotCell key={label} label={label} participant={p} />
      ))}
    </div>
  );
}

/** Column header from §4.2 — three unlabelled cells are unreadable without it. */
function RosterHead({ slots }: { slots: ("P1" | "P2" | "P3")[] }) {
  return (
    <div
      className="grid items-center gap-[6px] uppercase text-[color:var(--fg-subtle)]"
      data-tabular
      style={{
        gridTemplateColumns: rosterTemplate(slots.length),
        fontFamily: MONO,
        fontSize: 8,
        letterSpacing: "0.12em",
      }}
    >
      <span />
      <span>Friend</span>
      <span className="text-center">Lk</span>
      {slots.map((label) => (
        <span key={label} className="text-center">
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Lock legend (§R-3) — spells out what the `✓`/`✗` column means, once, above
 * the roster instead of per row.
 *
 * Full-bleed (`-mx-5` cancels `MobDisclosureRow`'s panel gutter) so it reads
 * as a strip separating the panel header from the roster, which is where the
 * artboard puts it. Counts come from the session's own `lockedCount` /
 * `totalCount` — the same two numbers the collapsed row and the lock-progress
 * card already show, so the three can never disagree.
 */
function LockLegend({ locked, total }: { locked: number; total: number }) {
  return (
    <div
      className="-mx-5 mb-[10px] flex items-center gap-[14px] uppercase text-[color:var(--fg-subtle)]"
      data-tabular
      style={{
        padding: "7px 14px",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        fontFamily: MONO,
        fontSize: 8,
        letterSpacing: "0.1em",
      }}
    >
      <span>
        <span style={{ color: "var(--success)", fontWeight: 600 }}>✓</span>{" "}
        Locked {locked}
      </span>
      <span>
        <span style={{ fontWeight: 600 }}>✗</span> Not locked {total - locked}
      </span>
    </div>
  );
}

function SessionRow({ s }: { s: LobbySessionView }) {
  const slots = slotLabelsFor(s.sessionType);
  const phase = phaseCopy(s, slots.length);

  return (
    <MobDisclosureRow
      panelClassName="bg-[color:var(--surface)] pt-3"
      summary={
        <span
          className="grid items-center gap-3"
          style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
        >
          <span className="block min-w-0">
            <span
              className="block truncate uppercase"
              style={{ fontFamily: DISPLAY_FONT, fontSize: 14 }}
            >
              {s.label}
            </span>
            <span
              className="mt-[3px] block uppercase text-[color:var(--fg-subtle)]"
              data-tabular
              style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em" }}
            >
              {s.clockLabel}
            </span>
          </span>
          <span
            className="whitespace-nowrap uppercase"
            data-tabular
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              padding: "4px 8px",
              border: "1px solid var(--border)",
              color: s.sessionOver ? "var(--fg-subtle)" : "var(--fg)",
            }}
          >
            {s.lockedCount}/{s.totalCount}
            <span
              className="ml-1 text-[color:var(--fg-subtle)]"
              style={{ fontSize: 8, letterSpacing: "0.1em" }}
            >
              LOCKED
            </span>
          </span>
        </span>
      }
    >
      <div className="mb-[10px] flex items-center justify-between gap-3">
        <MobEyebrow>{phase.title}</MobEyebrow>
        <span
          className="uppercase"
          data-tabular
          style={{
            fontFamily: MONO,
            fontSize: 8,
            letterSpacing: "0.12em",
            color: "var(--warning)",
          }}
        >
          {phase.hidden}
        </span>
      </div>
      <LockLegend locked={s.lockedCount} total={s.totalCount} />
      <div className="grid gap-[6px]">
        <RosterHead slots={slots} />
        {s.participants.map((p) => (
          <RosterRow key={p.userId} p={p} slots={slots} />
        ))}
      </div>
    </MobDisclosureRow>
  );
}

/**
 * Lock-progress card — one 6px segment per friend, filled with THAT friend's
 * favourite-team colour once they have locked.
 *
 * The artboard fills the first N segments by index; here the fill tracks the
 * actual `locked` flag, so the bar reads as a roster rather than a bar chart.
 */
function LockProgress({ s, nowMs }: { s: LobbySessionView; nowMs: number }) {
  const msUntil = new Date(s.lockAt).getTime() - nowMs;
  const delta = formatLockDelta(msUntil, { precise: true });
  const open = msUntil > 0;

  return (
    <div
      className="mt-[18px] border border-[color:var(--border)] bg-[color:var(--surface)]"
      style={{ padding: 16 }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <MobEyebrow>{s.label} picks locked</MobEyebrow>
          <p
            className="mt-1"
            data-tabular
            style={{ fontFamily: MONO, fontSize: 30, lineHeight: 1.1 }}
          >
            {s.lockedCount}
            <span style={{ color: "var(--fg-subtle)", fontSize: 18 }}>
              /{s.totalCount}
            </span>
          </p>
        </div>
        <p
          className="text-right uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.1em",
            lineHeight: 1.6,
          }}
        >
          {open ? "Locks in" : "Locked"}
          <br />
          <span style={{ color: "var(--fg)", fontSize: 12 }}>
            {open ? delta : s.clockLabel}
          </span>
        </p>
      </div>
      <div className="mt-[14px] flex gap-[3px]">
        {s.participants.map((p) => (
          <span
            key={p.userId}
            aria-hidden
            className="flex-1"
            style={{
              height: 6,
              background: p.locked
                ? (teamMeta(p.team)?.hex ?? "var(--fg-muted)")
                : "var(--surface-2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function LobbyMobile({
  round,
  title,
  hasSprint,
  sessions,
  nowMs,
}: {
  round: number;
  /** Already shortened + uppercased by the caller. */
  title: string;
  hasSprint: boolean;
  sessions: LobbySessionView[];
  nowMs: number;
}) {
  // The card headlines the session the group is actually waiting on: the
  // Race, which is the last to lock and the one the artboard names.
  const headline =
    sessions.find((s) => s.sessionType === "race") ??
    sessions[sessions.length - 1];

  return (
    <div className="md:hidden">
      <MobEyebrow
        color="var(--accent)"
        className="flex items-center gap-[6px]"
      >
        <span
          aria-hidden
          className="inline-block rounded-full bg-[color:var(--accent)]"
          style={{ width: 5, height: 5 }}
        />
        Lobby · Round {String(round).padStart(2, "0")} ·{" "}
        {hasSprint ? "Sprint weekend" : "Race weekend"}
      </MobEyebrow>
      <h1
        className="uppercase"
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 40,
          lineHeight: 0.9,
          margin: "10px 0 0",
        }}
      >
        {title}
        <br />
        <span style={{ color: "var(--fg-muted)" }}>Grand Prix</span>
      </h1>

      {headline && <LockProgress s={headline} nowMs={nowMs} />}

      <div className="mt-6">
        <MobSectionHead
          title="Scoring sessions"
          meta={`${sessions.length} · picks required`}
        />
        {sessions.length === 0 ? (
          <p className="text-sm text-[color:var(--fg-muted)]">
            No scoring sessions locked in yet. The roster opens as soon as the
            schedule firms up.
          </p>
        ) : (
          <MobBleed className="border-t border-[color:var(--border)]">
            {sessions.map((s) => (
              <SessionRow key={s.eventId} s={s} />
            ))}
          </MobBleed>
        )}
        <p
          className="mt-[10px] text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em" }}
        >
          Free practice takes no picks — pace only, see Predict.
        </p>
      </div>

      <MobBleed className="mt-5 border-t border-[color:var(--border)]">
        <MobDisclosureRow
          minHeight={52}
          panelClassName="bg-[color:var(--surface)] pt-3"
          summary={
            <span
              className="uppercase"
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 12,
                letterSpacing: "0.04em",
              }}
            >
              How scoring works
            </span>
          }
        >
          <ScoringLegendBody />
        </MobDisclosureRow>
      </MobBleed>
    </div>
  );
}
