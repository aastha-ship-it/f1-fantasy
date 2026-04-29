/**
 * Bucket every Supabase `events` row of a season into one entry per `round`,
 * with the sessions sorted chronologically. Used by `/dashboard/predict`,
 * `/dashboard/predict/round/[round]`, and (via re-implementation) `/admin`.
 *
 * The "primary" session is the lowest-priority pickable session present in
 * the round — sprint_quali → sprint_race → quali → race. For sprint
 * weekends with all sessions still unlocked, primary = sprint_quali.
 */

export type SessionType = "race" | "quali" | "sprint_race" | "sprint_quali";

export type GroupableEvent = {
  id: string;
  name: string;
  circuit: string;
  round: number;
  session_type: SessionType;
  session_start_at: string;
  lock_at: string;
  revealed_at: string | null;
  ergast_circuit_id: string | null;
};

export type RoundEntry<E extends GroupableEvent = GroupableEvent> = {
  round: number;
  name: string;
  circuit: string;
  ergast_circuit_id: string | null;
  weekendStart: string;
  weekendEnd: string;
  hasSprint: boolean;
  primarySession: E | null;
  sessions: E[];
};

const SESSION_PRIORITY: Record<SessionType, number> = {
  sprint_quali: 0,
  sprint_race: 1,
  quali: 2,
  race: 3,
};

export function groupByRound<E extends GroupableEvent>(
  rows: E[],
  order: "asc" | "desc",
): RoundEntry<E>[] {
  const byRound = new Map<number, E[]>();
  for (const r of rows) {
    const list = byRound.get(r.round) ?? [];
    list.push(r);
    byRound.set(r.round, list);
  }
  const entries: RoundEntry<E>[] = [];
  for (const [round, sessions] of byRound) {
    sessions.sort(
      (a, b) =>
        new Date(a.session_start_at).getTime() -
        new Date(b.session_start_at).getTime(),
    );
    const first = sessions[0]!;
    const last = sessions[sessions.length - 1]!;
    const sortedByPriority = [...sessions].sort(
      (a, b) =>
        SESSION_PRIORITY[a.session_type] - SESSION_PRIORITY[b.session_type],
    );
    entries.push({
      round,
      name: first.name,
      circuit: first.circuit,
      ergast_circuit_id: first.ergast_circuit_id,
      weekendStart: first.session_start_at,
      weekendEnd: last.session_start_at,
      hasSprint: sessions.some(
        (s) =>
          s.session_type === "sprint_race" ||
          s.session_type === "sprint_quali",
      ),
      primarySession: sortedByPriority[0] ?? null,
      sessions,
    });
  }
  entries.sort((a, b) => {
    const cmp =
      new Date(a.weekendStart).getTime() - new Date(b.weekendStart).getTime();
    return order === "asc" ? cmp : -cmp;
  });
  return entries;
}
