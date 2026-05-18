import { type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { buildIcs, type IcsEvent } from "@/lib/calendar/buildIcs";
import { sessionLabel } from "@/lib/sessionLabel";

/**
 * Per-user ICS subscription feed (changes.md §3).
 *
 * Public by design — calendar clients fetch with no cookie. The opaque
 * per-user `calendar_token` is the only credential; an unknown token 404s.
 * Middleware exempts /api/calendar/ (see PUBLIC_PREFIXES).
 *
 * Emits every session for the current + next season, each with a 30-minute
 * "lock your prediction" alarm. Stable UIDs let clients update in place.
 */

export const runtime = "nodejs";

type EventRow = {
  id: string;
  name: string;
  session_type: string;
  session_start_at: string;
  session_end_at: string | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return new Response("Not found", { status: 404 });
  }

  const svc = createSupabaseServiceClient();

  const { data: user, error: userErr } = await svc
    .from("users")
    .select("id")
    .eq("calendar_token", token)
    .maybeSingle<{ id: string }>();
  if (userErr || !user) {
    return new Response("Not found", { status: 404 });
  }

  const year = new Date().getUTCFullYear();
  const { data: events, error: evErr } = await svc
    .from("events")
    .select("id, name, session_type, session_start_at, session_end_at")
    .in("season", [year, year + 1])
    .order("session_start_at", { ascending: true })
    .returns<EventRow[]>();
  if (evErr) {
    return new Response("Calendar temporarily unavailable", { status: 503 });
  }

  const icsEvents: IcsEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    sessionLabel: sessionLabel(e.session_type),
    sessionType: e.session_type,
    start: new Date(e.session_start_at),
    end: e.session_end_at ? new Date(e.session_end_at) : null,
  }));

  const body = buildIcs(icsEvents, { calName: "F1 Fantasy" });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="f1-fantasy.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
