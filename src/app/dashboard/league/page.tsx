import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ScoreRow = { user_id: string; points: number; perfect_bonus: boolean };
type UserRow = { id: string; email: string; display_name: string | null };
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

export default async function LeaguePage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: scores },
    { data: users },
    { data: streaks },
    { data: currentUser },
  ] = await Promise.all([
    supabase.from("scores").select("user_id, points, perfect_bonus"),
    supabase.from("users").select("id, email, display_name"),
    supabase
      .from("user_streaks")
      .select(
        "user_id, current_p1_streak, longest_p1_streak, current_podium_streak, total_perfect_podiums",
      ),
    supabase.auth.getUser(),
  ]);

  const me = currentUser.user?.id ?? null;
  const usersById = new Map(
    (users ?? []).map((u) => [u.id as string, u as UserRow]),
  );
  const streaksById = new Map(
    (streaks ?? []).map((s) => [s.user_id as string, s as StreakRow]),
  );

  // Aggregate points + perfect podiums per user.
  const totals = new Map<
    string,
    { points: number; perfects: number; events: number }
  >();
  for (const s of (scores ?? []) as ScoreRow[]) {
    const t = totals.get(s.user_id) ?? {
      points: 0,
      perfects: 0,
      events: 0,
    };
    t.points += Number(s.points);
    t.events += 1;
    if (s.perfect_bonus) t.perfects += 1;
    totals.set(s.user_id, t);
  }
  // Include every league member, even if they haven't scored yet.
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

  // Compute ranks, honoring ties.
  const ranked = rows.map((r, i, arr) => {
    let rank = i + 1;
    if (i > 0 && arr[i - 1].points === r.points && arr[i - 1].perfects === r.perfects) {
      // Tied — inherit prior rank.
      rank = (arr[i - 1] as typeof r & { rank?: number }).rank ?? rank;
    }
    return { ...r, rank };
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← Dashboard
      </Link>
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        League
      </p>
      <h1
        className="mb-10 leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: "clamp(40px, 4.5vw, 72px)",
        }}
      >
        LEADERBOARD
      </h1>

      {ranked.length === 0 ? (
        <p className="text-[color:var(--fg-muted)]">
          Nobody&rsquo;s on the board yet. The leaderboard lights up after the
          first reveal.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ranked.map((r) => {
            const isMe = r.userId === me;
            return (
              <li
                key={r.userId}
                className={`grid grid-cols-[60px_1fr_auto_auto] items-center gap-4 rounded-lg border px-5 py-4 ${
                  isMe
                    ? "border-[color:var(--accent-muted)] bg-[color:var(--surface-2)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)]"
                }`}
              >
                <span
                  className="text-2xl leading-none"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
                  }}
                  data-tabular
                >
                  {r.rank}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-base text-[color:var(--fg)]">
                    {displayName(r.user!, isMe)}
                  </p>
                  {r.events > 0 ? (
                    <p className="text-xs text-[color:var(--fg-subtle)]" data-tabular>
                      {r.events} event{r.events === 1 ? "" : "s"}
                    </p>
                  ) : (
                    <p className="text-xs text-[color:var(--fg-subtle)]">
                      No scored events yet
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[color:var(--fg-muted)]">
                  {r.streak?.current_p1_streak ? (
                    <span
                      className="rounded bg-[color:var(--surface-2)] px-2 py-1"
                      title={`${r.streak.current_p1_streak} consecutive correct P1`}
                      style={{
                        fontFamily:
                          "apple color emoji, noto color emoji, sans-serif",
                      }}
                    >
                      🔥<span data-tabular className="ml-1">{r.streak.current_p1_streak}</span>
                    </span>
                  ) : null}
                  {r.perfects > 0 && (
                    <span className="rounded border border-[color:var(--accent)] px-2 py-1 text-[color:var(--accent)]">
                      <span data-tabular>{r.perfects}</span> PP
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className="text-2xl"
                    data-tabular
                    style={{
                      fontFamily: "var(--font-mono), ui-monospace, monospace",
                    }}
                  >
                    {r.points}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
                    pts
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
