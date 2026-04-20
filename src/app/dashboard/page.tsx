import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatLocal, sessionLabel } from "@/lib/sessionLabel";
import { signOutAction } from "@/app/signout/actions";

/**
 * State-aware smart home.
 *
 *   1. If the user has a prediction for an event with results filed but the
 *      reveal not yet triggered, show a "Reveal waiting" card.
 *   2. Otherwise, if there's an upcoming unlocked session, show the predict
 *      card with the "Lock in your picks" CTA.
 *   3. Otherwise, quiet empty state.
 *
 * Below the primary card: a condensed top-3 leaderboard preview + links to
 * the full league + standings pages.
 */

type EventLite = {
  id: string;
  name: string;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  lock_at: string;
  revealed_at: string | null;
};

type ScoreLite = { user_id: string; points: number };
type UserLite = { id: string; email: string; display_name: string | null };

function personName(u: UserLite | undefined, isMe: boolean): string {
  if (!u) return "?";
  if (isMe) return "You";
  return u.display_name?.trim() || u.email.split("@")[0];
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;

  // Defensive guard: anyone without a display_name gets pushed into the
  // first-time profile setup flow, even if they navigate here directly.
  if (myId) {
    const { data: me } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", myId)
      .maybeSingle<{ display_name: string | null }>();
    if (!me?.display_name?.trim()) {
      redirect("/profile?welcome=1");
    }
  }

  const nowIso = new Date().toISOString();

  // Next unlocked session (primary CTA candidate).
  const { data: nextOpen } = await supabase
    .from("events")
    .select("id, name, session_type, session_start_at, lock_at, revealed_at")
    .gt("lock_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(1)
    .maybeSingle<EventLite>();

  // Most recent event the user predicted, with results in but not yet revealed.
  let revealWaiting: { event: EventLite } | null = null;
  if (myId) {
    const { data: myPredictions } = await supabase
      .from("predictions")
      .select("event_id")
      .eq("user_id", myId);
    const predictedIds = (myPredictions ?? [])
      .map((p) => p.event_id as string)
      .filter(Boolean);
    if (predictedIds.length > 0) {
      const { data: resultIds } = await supabase
        .from("results")
        .select("event_id")
        .in("event_id", predictedIds);
      const withResults = (resultIds ?? []).map((r) => r.event_id as string);
      if (withResults.length > 0) {
        const { data: candidate } = await supabase
          .from("events")
          .select(
            "id, name, session_type, session_start_at, lock_at, revealed_at",
          )
          .in("id", withResults)
          .is("revealed_at", null)
          .order("session_start_at", { ascending: false })
          .limit(1)
          .maybeSingle<EventLite>();
        if (candidate) revealWaiting = { event: candidate };
      }
    }
  }

  // Top-3 leaderboard preview.
  const [{ data: scores }, { data: users }] = await Promise.all([
    supabase.from("scores").select("user_id, points"),
    supabase.from("users").select("id, email, display_name"),
  ]);
  const usersById = new Map(
    (users ?? []).map((u) => [u.id as string, u as UserLite]),
  );
  const totals = new Map<string, number>();
  for (const s of (scores ?? []) as ScoreLite[]) {
    totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + Number(s.points));
  }
  const topThree = [...totals.entries()]
    .map(([userId, points]) => ({
      userId,
      points,
      user: usersById.get(userId),
    }))
    .filter((r) => r.user)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <h1
        className="mb-4 text-5xl leading-none"
        style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
      >
        F1 FANTASY
      </h1>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[color:var(--fg-muted)]">
          Signed in as{" "}
          <span className="text-[color:var(--fg)]">{userData.user?.email}</span>
        </p>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/profile"
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          >
            Edit profile
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
      {/* Primary card — reveal-waiting takes precedence over predict. */}
      {revealWaiting ? (
        <section className="rounded-lg border border-[color:var(--accent-muted)] bg-[color:var(--surface)] p-6">
          <p className="text-xs uppercase tracking-wider text-[color:var(--accent)]">
            Reveal waiting
          </p>
          <p
            className="mt-2 text-3xl"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {revealWaiting.event.name.toUpperCase()}
          </p>
          <p className="mt-1 text-sm text-[color:var(--fg-muted)]">
            {sessionLabel(revealWaiting.event.session_type)} · results filed ·
            waiting on admin to trigger the group reveal.
          </p>
          <Link
            href={`/reveal/${revealWaiting.event.id}`}
            className="mt-6 inline-block rounded bg-[color:var(--accent)] px-5 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)]"
          >
            Open reveal →
          </Link>
        </section>
      ) : nextOpen ? (
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Next session
          </p>
          <p
            className="mt-2 text-3xl"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {nextOpen.name.toUpperCase()}
          </p>
          <p className="mt-1 text-sm text-[color:var(--fg-muted)]">
            {sessionLabel(nextOpen.session_type)} ·{" "}
            <span data-tabular>{formatLocal(nextOpen.session_start_at)}</span>
          </p>
          <Link
            href="/dashboard/predict"
            className="mt-6 inline-block rounded bg-[color:var(--accent)] px-5 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)]"
          >
            Lock in your picks →
          </Link>
        </section>
      ) : (
        <section className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <p className="text-sm text-[color:var(--fg-muted)]">
            No open sessions right now.
          </p>
        </section>
      )}

      {/* Leaderboard preview */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            The group
          </p>
          <Link
            href="/dashboard/league"
            className="text-sm text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          >
            Full leaderboard →
          </Link>
        </div>
        {topThree.length === 0 ? (
          <p className="text-sm text-[color:var(--fg-subtle)]">
            Leaderboard lights up after the first reveal.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {topThree.map((r, i) => {
              const isMe = r.userId === myId;
              return (
                <li
                  key={r.userId}
                  className={`grid grid-cols-[40px_1fr_auto] items-center gap-4 rounded-lg border px-4 py-3 ${
                    isMe
                      ? "border-[color:var(--accent-muted)] bg-[color:var(--surface-2)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)]"
                  }`}
                >
                  <span
                    data-tabular
                    className="text-xl"
                    style={{
                      fontFamily: "var(--font-boldonse), ui-sans-serif",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[color:var(--fg)]">
                    {personName(r.user, isMe)}
                  </span>
                  <span
                    className="text-xl"
                    data-tabular
                    style={{
                      fontFamily:
                        "var(--font-mono), ui-monospace, monospace",
                    }}
                  >
                    {r.points}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>

      <nav className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link
          href="/dashboard/predict"
          className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
        >
          Upcoming sessions →
        </Link>
        <Link
          href="/dashboard/league"
          className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
        >
          Leaderboard →
        </Link>
        <Link
          href="/dashboard/standings"
          className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
        >
          F1 standings →
        </Link>
      </nav>
    </main>
  );
}
