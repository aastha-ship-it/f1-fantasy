import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { teamMeta } from "@/lib/design/teams";

type ScoreRow = { user_id: string; points: number; perfect_bonus: boolean };
type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  favorite_team: string | null;
  favorite_driver: number | null;
};
type StreakRow = {
  user_id: string;
  current_p1_streak: number;
  longest_p1_streak: number;
  current_podium_streak: number;
  total_perfect_podiums: number;
};

function displayName(u: UserRow, isMe: boolean): string {
  if (isMe) return "You";
  return u.display_name?.trim() || u.email.split("@")[0];
}

const CURRENT_SEASON = new Date().getUTCFullYear();

export default async function LeaguePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id ?? null;

  let myDisplayName: string | null = null;
  if (me) {
    const { data: meRow } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", me)
      .maybeSingle<{ display_name: string | null }>();
    myDisplayName = meRow?.display_name?.trim() ?? null;
    if (!myDisplayName) redirect("/profile?welcome=1");
  }

  const [
    { data: scores },
    { data: users },
    { data: streaks },
    { data: drivers },
    { count: revealedEventsCount },
    { count: totalRoundsCount },
  ] = await Promise.all([
    supabase.from("scores").select("user_id, points, perfect_bonus"),
    supabase
      .from("users")
      .select("id, email, display_name, favorite_team, favorite_driver"),
    supabase
      .from("user_streaks")
      .select(
        "user_id, current_p1_streak, longest_p1_streak, current_podium_streak, total_perfect_podiums",
      ),
    supabase.from("drivers").select("id, code"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("session_type", "race")
      .eq("season", CURRENT_SEASON)
      .not("revealed_at", "is", null),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("session_type", "race")
      .eq("season", CURRENT_SEASON),
  ]);

  const usersById = new Map(
    (users ?? []).map((u) => [u.id as string, u as UserRow]),
  );
  const streaksById = new Map(
    (streaks ?? []).map((s) => [s.user_id as string, s as StreakRow]),
  );
  const driverCodeById = new Map(
    (drivers ?? []).map((d) => [
      d.id as number,
      d.code as string,
    ]),
  );

  const totals = new Map<
    string,
    { points: number; perfects: number; events: number }
  >();
  for (const s of (scores ?? []) as ScoreRow[]) {
    const t = totals.get(s.user_id) ?? { points: 0, perfects: 0, events: 0 };
    t.points += Number(s.points);
    t.events += 1;
    if (s.perfect_bonus) t.perfects += 1;
    totals.set(s.user_id, t);
  }
  for (const u of users ?? []) {
    if (!totals.has(u.id as string)) {
      totals.set(u.id as string, { points: 0, perfects: 0, events: 0 });
    }
  }

  const rows = [...totals.entries()]
    .map(([userId, t]) => ({
      userId,
      ...t,
      user: usersById.get(userId),
      streak: streaksById.get(userId),
    }))
    .filter((r) => r.user)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.perfects !== a.perfects) return b.perfects - a.perfects;
      return displayName(a.user!, false).localeCompare(
        displayName(b.user!, false),
      );
    });

  const ranked = rows.map((r, i, arr) => {
    let rank = i + 1;
    if (
      i > 0 &&
      arr[i - 1].points === r.points &&
      arr[i - 1].perfects === r.perfects
    ) {
      rank = (arr[i - 1] as typeof r & { rank?: number }).rank ?? rank;
    }
    return { ...r, rank };
  });

  const podium = [ranked[0], ranked[1], ranked[2]].filter(Boolean) as (typeof ranked)[number][];
  const rest = ranked.slice(3);
  const leaderPts = ranked[0]?.points ?? 0;

  return (
    <>
      <TopBar
        active="league"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
        {/* Hero */}
        <section className="grid items-end gap-8 border-b border-[color:var(--border)] pb-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <p
              className="mb-3 text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.18em" }}
              data-tabular
            >
              The Group · Season {CURRENT_SEASON}
            </p>
            <h1
              className="m-0"
              style={{
                fontFamily: "var(--font-boldonse), ui-sans-serif",
                fontSize: "clamp(48px, 7vw, 88px)",
                lineHeight: 0.9,
                letterSpacing: "-0.015em",
              }}
            >
              LEAGUE
              <br />
              STANDINGS
            </h1>
          </div>
          <div className="lg:text-right">
            <p
              className="text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              After {revealedEventsCount ?? 0} of {totalRoundsCount ?? 24}
            </p>
            <p
              className="leading-none"
              data-tabular
              style={{
                fontFamily: "var(--font-mono), ui-monospace, monospace",
                fontSize: 36,
                fontWeight: 500,
              }}
            >
              {revealedEventsCount ?? 0} / {totalRoundsCount ?? 24}
            </p>
          </div>
        </section>

        {ranked.length === 0 ? (
          <section className="mt-12 border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-10">
            <p
              className="text-xs uppercase text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.12em" }}
              data-tabular
            >
              No reveals yet
            </p>
            <p className="mt-3 text-[color:var(--fg-muted)]">
              The leaderboard lights up after the first reveal. Make picks for
              the next round to get on the board.
            </p>
          </section>
        ) : (
          <>
            {/* Podium block — 3 columns; centre is wider + leader. */}
            <section
              className="mt-10 grid border border-[color:var(--border)]"
              style={{
                gridTemplateColumns:
                  podium.length === 1
                    ? "1fr"
                    : podium.length === 2
                      ? "1fr 1.3fr"
                      : "1fr 1.3fr 1fr",
                gap: 1,
                background: "var(--border)",
              }}
            >
              {/* Render in P2 | P1 | P3 visual order. */}
              {[1, 0, 2].flatMap((idx) => {
                const r = podium[idx];
                if (!r || !r.user) return [];
                const pos = idx + 1;
                const isLeader = idx === 0;
                const fav = teamMeta(r.user.favorite_team);
                const favDriverCode = r.user.favorite_driver
                  ? driverCodeById.get(r.user.favorite_driver) ?? null
                  : null;
                const isMe = r.userId === me;
                return [
                  <div
                    key={r.userId}
                    className="relative flex flex-col gap-4 overflow-hidden p-7 lg:p-9"
                    style={{
                      background: isLeader ? "var(--surface-2)" : "var(--surface)",
                      outline: isMe ? "1px solid var(--accent-muted)" : "none",
                      outlineOffset: "-1px",
                      minHeight: isLeader ? 360 : 320,
                    }}
                  >
                    {fav && (
                      <Image
                        aria-hidden
                        src={fav.carSrc}
                        alt=""
                        width={isLeader ? 480 : 360}
                        height={isLeader ? 180 : 130}
                        unoptimized
                        className="pointer-events-none absolute select-none"
                        style={{
                          right: -40,
                          top: isLeader ? "30%" : "20%",
                          opacity: isLeader ? 0.4 : 0.18,
                          width: isLeader ? 480 : 360,
                          height: "auto",
                          maxWidth: "none",
                        }}
                      />
                    )}

                    <div className="relative flex items-baseline justify-between">
                      <span
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: isLeader ? 144 : 96,
                          lineHeight: 0.85,
                          color: isLeader ? "var(--accent)" : "var(--fg)",
                        }}
                        data-tight
                      >
                        {pos}
                      </span>
                      <span
                        className="text-[11px] uppercase text-[color:var(--fg-subtle)]"
                        style={{ letterSpacing: "0.1em" }}
                        data-tabular
                      >
                        {r.perfects} PP
                      </span>
                    </div>

                    <div className="relative mt-auto">
                      <p
                        className="leading-tight"
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: isLeader ? 36 : 28,
                          letterSpacing: "-0.005em",
                        }}
                      >
                        {displayName(r.user, isMe).toUpperCase()}
                      </p>
                      <p
                        className="mt-1.5 text-[11px] uppercase"
                        style={{
                          letterSpacing: "0.1em",
                          color: fav?.hex ?? "var(--fg-subtle)",
                        }}
                        data-tabular
                      >
                        {fav ? `Team ${fav.name}` : "No favorite team"}
                        {favDriverCode && ` · ${favDriverCode}`}
                      </p>
                      <p
                        className="mt-4 leading-none"
                        data-tabular
                        style={{
                          fontFamily:
                            "var(--font-mono), ui-monospace, monospace",
                          fontSize: isLeader ? 56 : 44,
                          fontWeight: 500,
                        }}
                      >
                        {r.points}
                        <span
                          className="ml-2 text-xs uppercase text-[color:var(--fg-subtle)]"
                          style={{ letterSpacing: "0.12em" }}
                        >
                          PTS
                        </span>
                      </p>
                      {r.streak?.current_p1_streak ? (
                        <p
                          className="mt-3 flex items-center gap-2 whitespace-nowrap text-xs text-[color:var(--fg-muted)]"
                          style={{
                            fontFamily:
                              "apple color emoji, noto color emoji, sans-serif",
                          }}
                        >
                          🔥
                          <span data-tabular>
                            {r.streak.current_p1_streak}
                          </span>
                          <span
                            aria-hidden
                            className="text-[color:var(--fg-subtle)]"
                          >
                            ·
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.06em] text-[color:var(--fg-subtle)]">
                            P1 streak
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>,
                ];
              })}
            </section>

            {/* Rest of the field — bar chart rows */}
            {rest.length > 0 && (
              <section className="mt-8 border border-[color:var(--border)] bg-[color:var(--surface)]">
                {rest.map((r) => {
                  const fav = teamMeta(r.user!.favorite_team);
                  const favDriverCode = r.user!.favorite_driver
                    ? driverCodeById.get(r.user!.favorite_driver) ?? null
                    : null;
                  const pct =
                    leaderPts > 0 ? (r.points / leaderPts) * 100 : 0;
                  const isMe = r.userId === me;
                  return (
                    <div
                      key={r.userId}
                      className="grid items-center gap-6 border-b border-[color:var(--border)] px-6 py-4 last:border-b-0"
                      style={{
                        gridTemplateColumns:
                          "60px 40px minmax(0,1fr) minmax(120px,200px) 80px",
                        background: isMe ? "var(--surface-2)" : "transparent",
                      }}
                    >
                      <span
                        className="leading-none"
                        style={{
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 24,
                        }}
                        data-tabular
                      >
                        {r.rank}
                      </span>
                      <span
                        className="grid place-items-center rounded-full"
                        style={{
                          width: 36,
                          height: 36,
                          background: "var(--surface-2)",
                          border: `1px solid ${fav?.hex ?? "var(--border)"}`,
                          fontFamily: "var(--font-boldonse), ui-sans-serif",
                          fontSize: 14,
                        }}
                      >
                        {displayName(r.user!, isMe).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base">
                          {displayName(r.user!, isMe)}
                        </p>
                        <p
                          className="text-[10px] uppercase"
                          style={{
                            color: fav?.hex ?? "var(--fg-subtle)",
                            letterSpacing: "0.1em",
                          }}
                          data-tabular
                        >
                          {fav ? `Team ${fav.name}` : "No favorite team"}
                          {favDriverCode && ` · ${favDriverCode}`}
                          {r.perfects > 0 && ` · ${r.perfects} PP`}
                          {r.streak?.current_p1_streak
                            ? ` · 🔥 ${r.streak.current_p1_streak}`
                            : ""}
                        </p>
                      </div>
                      <div
                        className="relative h-1.5"
                        style={{ background: "var(--bg)" }}
                        aria-hidden
                      >
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${pct}%`,
                            background: fav?.hex ?? "var(--fg-subtle)",
                          }}
                        />
                      </div>
                      <span
                        className="text-right"
                        style={{
                          fontFamily:
                            "var(--font-mono), ui-monospace, monospace",
                          fontSize: 22,
                        }}
                        data-tabular
                      >
                        {r.points}
                      </span>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
