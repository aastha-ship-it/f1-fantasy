import Link from "next/link";

/**
 * Driver + constructor standings. Stubbed until the nightly OpenF1
 * standings-sync job lands. Deferred per Phase 4 cut order — the reveal
 * animation and leaderboard took priority.
 */
export default function StandingsPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← Dashboard
      </Link>
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        F1 World Championship
      </p>
      <h1
        className="mb-8 leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: "clamp(40px, 4.5vw, 72px)",
        }}
      >
        STANDINGS
      </h1>
      <section className="rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-8">
        <p className="text-sm uppercase tracking-wider text-[color:var(--fg-subtle)]">
          Coming soon
        </p>
        <p className="mt-3 text-[color:var(--fg-muted)]">
          Driver and constructor standings will pull from OpenF1 on a nightly
          job. Part of the Day 10.5 polish pass before Miami.
        </p>
        <p className="mt-4 text-sm text-[color:var(--fg-subtle)]">
          In the meantime, the{" "}
          <Link
            href="/dashboard/league"
            className="underline hover:text-[color:var(--fg)]"
          >
            friend leaderboard
          </Link>{" "}
          is where the season drama actually lives.
        </p>
      </section>
    </main>
  );
}
