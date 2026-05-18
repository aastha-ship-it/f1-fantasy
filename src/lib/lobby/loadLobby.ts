/**
 * Lobby data loader (changes.md §1).
 *
 * Uses the SERVICE client deliberately: the all-or-nothing `preds_select`
 * RLS would hide every friend's pick before the Reveal, but the Lobby needs
 * a time-gated partial view. The gating is enforced HERE, in app code, so the
 * trust boundary is this module — it must never put a slot into its return
 * value unless `revealState` opened it, and it never returns P1 at all.
 *
 * Pre-reveal, the only thing exposed about other users is a boolean
 * (locked / not locked) plus, once the clock opens them, their P3 then P2
 * picks for quali/race. Sprint sessions expose the roster only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { groupByRound, type GroupableEvent } from "../predict/groupByRound";
import { sessionLabel } from "../sessionLabel";
import { revealState } from "./revealGate";

export type LobbySlotPick = { label: "P2" | "P3"; code: string | null };

export type LobbyParticipant = {
  userId: string;
  name: string;
  isMe: boolean;
  locked: boolean;
  /** Only the slots the gate has opened. Never contains P1. */
  revealed: LobbySlotPick[];
};

export type LobbySession = {
  eventId: string;
  sessionType: string;
  label: string;
  sessionStartAt: string;
  lockAt: string;
  progressive: boolean;
  showP3: boolean;
  showP2: boolean;
  sessionOver: boolean;
  lockedCount: number;
  totalCount: number;
  participants: LobbyParticipant[];
};

export type LobbyWeekend = {
  round: number;
  name: string;
  circuit: string;
  ergastCircuitId: string | null;
  weekendStart: string;
  weekendEnd: string;
  hasSprint: boolean;
  sessions: LobbySession[];
};

type UserRow = {
  id: string;
  display_name: string | null;
  email: string;
};
type PredictionRow = {
  user_id: string;
  event_id: string;
  p1_driver_id: number | null;
  p2_driver_id: number | null;
  p3_driver_id: number | null;
};

function displayName(u: UserRow): string {
  return u.display_name?.trim() || u.email.split("@")[0] || "?";
}

/**
 * Resolve the weekend to focus when no round is given: the round of the next
 * upcoming session, else the most recent past round.
 */
export async function resolveFocusRound(
  svc: SupabaseClient,
  season: number,
  now: Date = new Date(),
): Promise<number | null> {
  const { data } = await svc
    .from("events")
    .select("round, session_start_at")
    .eq("season", season)
    .order("session_start_at", { ascending: true })
    .returns<{ round: number; session_start_at: string }[]>();
  if (!data || data.length === 0) return null;

  const nowMs = now.getTime();
  const upcoming = data.find(
    (e) => new Date(e.session_start_at).getTime() >= nowMs,
  );
  if (upcoming) return upcoming.round;
  return data[data.length - 1]!.round;
}

export async function loadLobbyWeekend(
  svc: SupabaseClient,
  opts: {
    season: number;
    round: number;
    myUserId: string | null;
    now?: Date;
  },
): Promise<LobbyWeekend | null> {
  const now = opts.now ?? new Date();

  const { data: roundSessions } = await svc
    .from("events")
    .select(
      "id, name, circuit, round, session_type, session_start_at, lock_at, revealed_at, ergast_circuit_id",
    )
    .eq("season", opts.season)
    .eq("round", opts.round)
    .order("session_start_at", { ascending: true })
    .returns<GroupableEvent[]>();

  if (!roundSessions || roundSessions.length === 0) return null;
  const [grouped] = groupByRound(roundSessions, "asc");
  if (!grouped) return null;

  const sessionIds = grouped.sessions.map((s) => s.id);

  const [{ data: users }, { data: predictions }, { data: drivers }] =
    await Promise.all([
      svc
        .from("users")
        .select("id, display_name, email")
        .order("display_name", { ascending: true })
        .returns<UserRow[]>(),
      svc
        .from("predictions")
        .select("user_id, event_id, p1_driver_id, p2_driver_id, p3_driver_id")
        .in("event_id", sessionIds)
        .returns<PredictionRow[]>(),
      svc
        .from("drivers")
        .select("id, code")
        .returns<{ id: number; code: string }[]>(),
    ]);

  const roster = users ?? [];
  const codeById = new Map(
    (drivers ?? []).map((d) => [d.id, d.code]),
  );
  // (eventId → userId → prediction row)
  const predByEvent = new Map<string, Map<string, PredictionRow>>();
  for (const p of predictions ?? []) {
    let m = predByEvent.get(p.event_id);
    if (!m) {
      m = new Map();
      predByEvent.set(p.event_id, m);
    }
    m.set(p.user_id, p);
  }

  const sessions: LobbySession[] = grouped.sessions.map((s) => {
    const gate = revealState(s.session_type, s.session_start_at, now);
    const byUser = predByEvent.get(s.id) ?? new Map<string, PredictionRow>();

    const participants: LobbyParticipant[] = roster.map((u) => {
      const pred = byUser.get(u.id);
      const revealed: LobbySlotPick[] = [];
      // Only quali/race ever reveal picks, and only the opened slots.
      // P1 is intentionally never read into the response.
      if (gate.progressive && pred) {
        if (gate.showP3) {
          revealed.push({
            label: "P3",
            code:
              pred.p3_driver_id != null
                ? (codeById.get(pred.p3_driver_id) ?? null)
                : null,
          });
        }
        if (gate.showP2) {
          revealed.push({
            label: "P2",
            code:
              pred.p2_driver_id != null
                ? (codeById.get(pred.p2_driver_id) ?? null)
                : null,
          });
        }
      }
      return {
        userId: u.id,
        name: displayName(u),
        isMe: u.id === opts.myUserId,
        locked: pred != null,
        revealed,
      };
    });

    return {
      eventId: s.id,
      sessionType: s.session_type,
      label: sessionLabel(s.session_type),
      sessionStartAt: s.session_start_at,
      lockAt: s.lock_at,
      progressive: gate.progressive,
      showP3: gate.showP3,
      showP2: gate.showP2,
      sessionOver: gate.sessionOver,
      lockedCount: participants.filter((p) => p.locked).length,
      totalCount: participants.length,
      participants,
    };
  });

  return {
    round: grouped.round,
    name: grouped.name,
    circuit: grouped.circuit,
    ergastCircuitId: grouped.ergast_circuit_id,
    weekendStart: grouped.weekendStart,
    weekendEnd: grouped.weekendEnd,
    hasSprint: grouped.hasSprint,
    sessions,
  };
}
