import Image from "next/image";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { teamMeta } from "@/lib/design/teams";
import {
  LeagueRowDesktop,
  displayName,
  toLeagueRowProps,
  type LeagueRowProps,
} from "./league-row";
import { LeagueMobile, type LeaguePodiumDatum } from "./league-mobile";

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

  /* One derivation of the "rest of the field" rows, two renderers. */
  const restRows: LeagueRowProps[] = rest.map((r) =>
    toLeagueRowProps(r, { leaderPts, currentUserId: me, driverCodeById }),
  );

  /* Mobile podium (design_handoff_mobile §6.2). Same rows the desktop
     section renders, reshaped: the phone stacks the leader full-bleed above
     a 2-up P2/P3 pair, so it wants them in RANK order, not the desktop's
     visual P2 | P1 | P3. `favTeam` is the raw free-form string on purpose —
     `teamMeta` alias-resolves it, and round-tripping through a slug would
     drop Kick Sauber/Audi favourites (see `toLeagueRowProps`). */
  const mobilePodium: LeaguePodiumDatum[] = podium.map((r, idx) => {
    const isMe = r.userId === me;
    const fav = teamMeta(r.user!.favorite_team);
    const favDriverCode = r.user!.favorite_driver
      ? driverCodeById.get(r.user!.favorite_driver) ?? null
      : null;
    return {
      userId: r.userId,
      pos: idx + 1,
      name: displayName(r.user!, isMe),
      points: r.points,
      perfects: r.perfects,
      teamName: fav?.name ?? null,
      teamHex: fav?.hex ?? null,
      carSrc: fav?.carSrc ?? null,
      favDriverCode,
      // Same column, not a new read: `favorite_driver` IS the permanent
      // number (the drivers table is keyed by it). Null when the code is,
      // so a driver we cannot name never shows a bare `#44`.
      favDriverNumber: favDriverCode ? r.user!.favorite_driver : null,
    };
  });

  return (
    <>
      <TopBar
        active="league"
        displayName={myDisplayName}
        email={userData.user?.email ?? null}
      />
      <MobileTabBar active="league" />
      {/*
        Gutters fork at md (pattern A, per-side longhands): base values are
        the phone's 20px gutter and the tab-bar-clearing bottom pad; `md:`
        restores the pre-fork px-8 / py-10 / pb-10 that `px-6 py-10 pb-24
        sm:px-8 md:pb-10` resolved to at every width >= md.
      */}
      <main className="mx-auto w-full max-w-[1600px] px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+24px)] md:px-8 md:py-10 md:pb-10 lg:px-12 xl:px-16">
        <LeagueMobile
          season={CURRENT_SEASON}
          revealedCount={revealedEventsCount ?? 0}
          totalRounds={totalRoundsCount ?? 24}
          podium={mobilePodium}
          rest={restRows}
        />

        {/*
          Desktop tree, unchanged. `hidden md:contents` erases this wrapper's
          box at md so every child stays a direct child of <main> — pattern
          B', the same idiom lobby-view.tsx uses.
        */}
        <div className="hidden md:contents">
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
                        <p className="mt-3 flex items-center gap-2 text-xs text-[color:var(--fg-muted)] md:whitespace-nowrap">
                          <span
                            aria-hidden
                            style={{
                              fontFamily:
                                "apple color emoji, noto color emoji, sans-serif",
                            }}
                          >
                            🔥
                          </span>
                          <span data-tabular>
                            {r.streak.current_p1_streak}
                          </span>
                          <span
                            aria-hidden
                            className="text-[color:var(--fg-subtle)]"
                          >
                            ·
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
                            P1 streak
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>,
                ];
              })}
            </section>

            {/* Rest of the field — bar chart rows. The `md:hidden` twin that
                used to sit beside this moved into `LeagueMobile`: this whole
                subtree is `hidden md:contents`, so a `md:hidden` child inside
                it could never render. */}
            {restRows.length > 0 && (
              <section className="mt-8 border border-[color:var(--border)] bg-[color:var(--surface)]">
                <div className="hidden md:block">
                  {restRows.map((r) => (
                    <LeagueRowDesktop key={r.userId} {...r} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        </div>
      </main>
    </>
  );
}
