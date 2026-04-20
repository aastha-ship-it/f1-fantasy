import { ImageResponse } from "next/og";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sessionLabel } from "@/lib/sessionLabel";

/**
 * Public OG image route — `/api/share/<eventId>/card.png`.
 *
 * 1200×630, cached for 1 hour, no auth required (link-preview crawlers
 * need to fetch it). Renders a different image depending on reveal state:
 *   - revealed (admin or 10-min fallback) → top-3 friends for that event
 *   - pending → "Results pending — check back soon"
 *   - missing event → 404
 *
 * Public privacy trade-off is documented in the plan: the card shows
 * display names + scores. URL uses a UUID so it's unguessable.
 */

export const runtime = "nodejs";
export const revalidate = 3600;

const BG = "oklch(16% 0.012 27)";
const SURFACE = "oklch(21% 0.015 27)";
const FG = "oklch(96% 0.008 27)";
const FG_MUTED = "oklch(72% 0.015 27)";
const FG_SUBTLE = "oklch(52% 0.018 27)";
const ACCENT = "oklch(62% 0.22 27)";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const svc = createSupabaseServiceClient();

  const { data: event } = await svc
    .from("events")
    .select("id, name, circuit, round, session_type, session_start_at, revealed_at")
    .eq("id", eventId)
    .maybeSingle<{
      id: string;
      name: string;
      circuit: string;
      round: number;
      session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
      session_start_at: string;
      revealed_at: string | null;
    }>();

  if (!event) {
    return new Response("Not found", { status: 404 });
  }

  const { data: result } = await svc
    .from("results")
    .select("fetched_at")
    .eq("event_id", event.id)
    .maybeSingle<{ fetched_at: string }>();

  const nowMs = Date.now();
  const revealedAtMs = event.revealed_at
    ? new Date(event.revealed_at).getTime()
    : null;
  const fetchedAtMs = result ? new Date(result.fetched_at).getTime() : null;
  const isOpen =
    (revealedAtMs !== null && nowMs >= revealedAtMs) ||
    (fetchedAtMs !== null && nowMs - fetchedAtMs >= 10 * 60 * 1000);

  if (!isOpen) {
    return new ImageResponse(<PendingCard event={event} />, {
      width: 1200,
      height: 630,
    });
  }

  const [{ data: scores }, { data: users }] = await Promise.all([
    svc
      .from("scores")
      .select("user_id, points, perfect_bonus")
      .eq("event_id", event.id),
    svc.from("users").select("id, email, display_name"),
  ]);

  const usersById = new Map(
    (users ?? []).map((u) => [u.id as string, u as {
      id: string;
      email: string;
      display_name: string | null;
    }]),
  );
  const topThree = (scores ?? [])
    .map((s) => ({
      user: usersById.get(s.user_id as string),
      points: Number(s.points),
      perfect: s.perfect_bonus as boolean,
    }))
    .filter((r) => r.user)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return new ImageResponse(
    <RevealedCard event={event} podium={topThree} />,
    { width: 1200, height: 630 },
  );
}

function Frame({
  event,
  children,
}: {
  event: {
    name: string;
    circuit: string;
    round: number;
    session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  };
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        color: FG,
        padding: "60px 72px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 24,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: FG_SUBTLE,
          marginBottom: 12,
        }}
      >
        F1 FANTASY · R{event.round.toString().padStart(2, "0")} ·{" "}
        {sessionLabel(event.session_type).toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 92,
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        {event.name.toUpperCase()}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: FG_MUTED,
          marginBottom: 48,
        }}
      >
        {event.circuit}
      </div>
      {children}
    </div>
  );
}

function PendingCard({
  event,
}: {
  event: {
    name: string;
    circuit: string;
    round: number;
    session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  };
}) {
  return (
    <Frame event={event}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 36,
            color: FG_SUBTLE,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 16,
          }}
        >
          Results pending
        </div>
        <div style={{ display: "flex", fontSize: 48, color: FG_MUTED }}>
          Check back once the session&rsquo;s classified.
        </div>
      </div>
    </Frame>
  );
}

function RevealedCard({
  event,
  podium,
}: {
  event: {
    name: string;
    circuit: string;
    round: number;
    session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  };
  podium: {
    user: { id: string; email: string; display_name: string | null } | undefined;
    points: number;
    perfect: boolean;
  }[];
}) {
  return (
    <Frame event={event}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: FG_SUBTLE,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 8,
          }}
        >
          The group
        </div>
        {podium.length === 0 ? (
          <div style={{ display: "flex", fontSize: 40, color: FG_MUTED }}>
            No scored picks for this session yet.
          </div>
        ) : (
          podium.map((row, i) => (
            <div
              key={row.user!.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                padding: "24px 32px",
                borderRadius: 12,
                background: SURFACE,
                border: row.perfect
                  ? `2px solid ${ACCENT}`
                  : `1px solid oklch(34% 0.020 27)`,
              }}
            >
              <span
                style={{
                  display: "flex",
                  fontSize: 64,
                  fontWeight: 900,
                  width: 80,
                  color: i === 0 ? ACCENT : FG,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  display: "flex",
                  fontSize: 40,
                  flex: 1,
                  color: FG,
                }}
              >
                {(row.user!.display_name?.trim() || row.user!.email.split("@")[0]).toUpperCase()}
              </span>
              {row.perfect && (
                <span
                  style={{
                    display: "flex",
                    fontSize: 18,
                    color: ACCENT,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    padding: "6px 12px",
                    border: `1px solid ${ACCENT}`,
                    borderRadius: 6,
                  }}
                >
                  Perfect podium
                </span>
              )}
              <span
                style={{
                  display: "flex",
                  fontSize: 56,
                  fontWeight: 700,
                  color: FG,
                }}
              >
                {row.points}
              </span>
              <span
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: FG_SUBTLE,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                pts
              </span>
            </div>
          ))
        )}
      </div>
    </Frame>
  );
}
