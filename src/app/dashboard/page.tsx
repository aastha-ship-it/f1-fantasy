import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatLocal, sessionLabel } from "@/lib/sessionLabel";
import { signOutAction } from "@/app/signout/actions";

type EventLite = {
  id: string;
  name: string;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
  lock_at: string;
  revealed_at: string | null;
};

type ScoreLite = { user_id: string; points: number; event_id: string };
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
  let myDisplayName = "";
  if (myId) {
    const { data: me } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", myId)
      .maybeSingle<{ display_name: string | null }>();
    myDisplayName = me?.display_name?.trim() ?? "";
    if (!myDisplayName) {
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

  // Top-3 leaderboard preview + recently-revealed list (last 3).
  const [{ data: scores }, { data: users }, { data: revealed }] =
    await Promise.all([
      supabase
        .from("scores")
        .select("user_id, points, event_id"),
      supabase.from("users").select("id, email, display_name"),
      supabase
        .from("events")
        .select("id, name, session_type, revealed_at")
        .not("revealed_at", "is", null)
        .order("revealed_at", { ascending: false })
        .limit(3),
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

  // My score per revealed event (to render as a small badge on the
  // "Recently revealed" card).
  const myScoreByEvent = new Map<string, number>();
  for (const s of (scores ?? []) as ScoreLite[]) {
    if (s.user_id === myId) myScoreByEvent.set(s.event_id, Number(s.points));
  }

  const primary = revealWaiting
    ? ({ kind: "reveal", event: revealWaiting.event } as const)
    : nextOpen
      ? ({ kind: "predict", event: nextOpen } as const)
      : ({ kind: "empty" } as const);

  // Server-render snapshot — the countdown isn't live; it shows a fresh
  // delta on each request. Real-time ticking lives on the predict page.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const nextLockCountdown = nextOpen
    ? formatDelta(new Date(nextOpen.lock_at).getTime() - nowMs)
    : null;

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8 lg:px-12 xl:px-16">
      {/* Compact top toolbar — wordmark left, user cluster right. */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border)] pb-6">
        <h1
          className="text-2xl leading-none sm:text-3xl"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        >
          F1 FANTASY
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-baseline gap-2 text-[color:var(--fg-muted)]">
            <span className="text-[color:var(--fg)]">{myDisplayName}</span>
            <span className="hidden text-[color:var(--fg-subtle)] sm:inline">
              · {userData.user?.email}
            </span>
          </div>
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
      </header>

      {/* Dense 3-col hero row: primary CTA | leaderboard preview | recently revealed. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Primary card */}
        {primary.kind === "reveal" ? (
          <PrimaryCard
            tone="accent"
            eyebrow="Reveal waiting"
            title={primary.event.name}
            subtitle={`${sessionLabel(primary.event.session_type)} · results filed · waiting on admin.`}
            href={`/reveal/${primary.event.id}`}
            cta="Open reveal →"
          />
        ) : primary.kind === "predict" ? (
          <PrimaryCard
            tone="default"
            eyebrow="Next session"
            title={primary.event.name}
            subtitle={`${sessionLabel(primary.event.session_type)} · ${formatLocal(primary.event.session_start_at)}`}
            href="/dashboard/predict"
            cta="Lock in your picks →"
            countdown={nextLockCountdown}
          />
        ) : (
          <EmptyPrimary />
        )}

        {/* Leaderboard preview */}
        <section className="flex min-h-full flex-col rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
              The group
            </p>
            <Link
              href="/dashboard/league"
              className="text-xs text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
            >
              Full →
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
                    className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded px-2 py-2 ${
                      isMe
                        ? "bg-[color:var(--surface-2)]"
                        : ""
                    }`}
                  >
                    <span
                      data-tabular
                      className="text-lg"
                      style={{
                        fontFamily: "var(--font-boldonse), ui-sans-serif",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate text-sm text-[color:var(--fg)]">
                      {personName(r.user, isMe)}
                    </span>
                    <span
                      className="text-lg"
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

        {/* Recently revealed */}
        <section className="flex min-h-full flex-col rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
              Recently revealed
            </p>
          </div>
          {(revealed ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--fg-subtle)]">
              Nothing yet. First reveal lights this up.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(revealed ?? []).map((e) => {
                const myPoints = myScoreByEvent.get(e.id as string);
                return (
                  <li
                    key={e.id as string}
                    className="flex items-center justify-between gap-3 rounded px-2 py-2 hover:bg-[color:var(--surface-2)]"
                  >
                    <Link
                      href={`/reveal/${e.id}`}
                      className="flex min-w-0 flex-1 flex-col gap-0.5"
                    >
                      <span className="truncate text-sm text-[color:var(--fg)]">
                        {e.name as string}
                      </span>
                      <span className="text-xs text-[color:var(--fg-subtle)]">
                        {sessionLabel(e.session_type as string)}
                      </span>
                    </Link>
                    {typeof myPoints === "number" && (
                      <span
                        data-tabular
                        className="rounded bg-[color:var(--surface-2)] px-2 py-1 text-xs text-[color:var(--fg-muted)]"
                        title="Your points for this event"
                      >
                        {myPoints} pt
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Inline footer nav: section links + live countdown pinned right. */}
      <nav className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--border)] pt-6 text-sm">
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href="/dashboard/predict"
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          >
            Upcoming sessions
          </Link>
          <Link
            href="/dashboard/league"
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/dashboard/standings"
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          >
            F1 standings
          </Link>
        </div>
        {nextLockCountdown && (
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Next lock in{" "}
            <span
              data-tabular
              className="ml-1 text-[color:var(--fg-muted)]"
            >
              {nextLockCountdown}
            </span>
          </p>
        )}
      </nav>
    </main>
  );
}

function PrimaryCard({
  tone,
  eyebrow,
  title,
  subtitle,
  href,
  cta,
  countdown,
}: {
  tone: "accent" | "default";
  eyebrow: string;
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  countdown?: string | null;
}) {
  const border =
    tone === "accent"
      ? "border-[color:var(--accent-muted)]"
      : "border-[color:var(--border)]";
  const eyebrowColor =
    tone === "accent"
      ? "text-[color:var(--accent)]"
      : "text-[color:var(--fg-subtle)]";
  return (
    <section
      className={`flex flex-col justify-between gap-6 rounded-lg border ${border} bg-[color:var(--surface)] p-6 lg:p-8`}
    >
      <div>
        <p
          className={`text-xs uppercase tracking-wider ${eyebrowColor}`}
        >
          {eyebrow}
        </p>
        <p
          className="mt-3 text-4xl leading-none lg:text-5xl"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        >
          {title.toUpperCase()}
        </p>
        <p className="mt-3 text-sm text-[color:var(--fg-muted)]">
          <span data-tabular>{subtitle}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={href}
          className="rounded bg-[color:var(--accent)] px-5 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)]"
        >
          {cta}
        </Link>
        {countdown && (
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Lock in{" "}
            <span
              data-tabular
              className="ml-1 text-[color:var(--fg-muted)]"
            >
              {countdown}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}

function EmptyPrimary() {
  return (
    <section className="flex flex-col justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 lg:p-8">
      <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        Quiet week
      </p>
      <p
        className="mt-3 text-3xl leading-none"
        style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
      >
        NO OPEN SESSIONS
      </p>
      <p className="mt-3 text-sm text-[color:var(--fg-muted)]">
        The next predict window opens when the following round&rsquo;s
        schedule lands.
      </p>
    </section>
  );
}

function formatDelta(msUntil: number): string {
  if (msUntil <= 0) return "Locked";
  const totalSec = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours.toString().padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}
