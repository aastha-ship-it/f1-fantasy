#!/usr/bin/env bun
/**
 * OpenF1 latency gate — Phase 0 decision point.
 *
 * Fetches the most recent Race session from OpenF1 and measures the gap between
 * session end time and when session_result data becomes queryable.
 *
 * Outcome decides the Phase 3 cron strategy:
 *   < 30 min  → fast    : one-shot cron at session_end + 30m
 *   < 4 h     → medium  : hourly cron for ~4h post-session
 *   > 4 h     → slow    : skip auto-fetch, admin manual entry only
 */

type Meeting = {
  meeting_key: number;
  meeting_name: string;
  circuit_short_name: string;
  date_start: string;
};

type Session = {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  is_cancelled?: boolean;
};

type SessionResult = {
  session_key: number;
  driver_number: number;
  position: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
};

const OPENF1 = "https://api.openf1.org/v1";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<T>;
}

async function completedRaceSessions(): Promise<Session[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const thisYear = await fetchJson<Session[]>(
    `${OPENF1}/sessions?session_name=Race&year=${year}`,
  );
  const prevYear = await fetchJson<Session[]>(
    `${OPENF1}/sessions?session_name=Race&year=${year - 1}`,
  );
  return [...thisYear, ...prevYear]
    .filter((s) => new Date(s.date_end).getTime() < now.getTime())
    .filter((s) => !s.is_cancelled)
    .sort(
      (a, b) => new Date(b.date_end).getTime() - new Date(a.date_end).getTime(),
    );
}

async function tryFetchResults(sessionKey: number): Promise<SessionResult[]> {
  try {
    return await fetchJson<SessionResult[]>(
      `${OPENF1}/session_result?session_key=${sessionKey}`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) return [];
    throw err;
  }
}

async function measureLatency(): Promise<void> {
  console.log("→ Finding completed non-cancelled Race sessions…\n");
  const sessions = await completedRaceSessions();
  if (sessions.length === 0) {
    console.error("✗ No completed Race sessions found in current or previous year.");
    process.exit(1);
  }

  // Walk from most recent until one has results; record what we learn.
  let picked: Session | null = null;
  const noResultSessions: Session[] = [];
  let results: SessionResult[] = [];

  for (const s of sessions.slice(0, 5)) {
    const r = await tryFetchResults(s.session_key);
    if (r.length > 0) {
      picked = s;
      results = r;
      break;
    }
    noResultSessions.push(s);
  }

  if (!picked) {
    console.error(
      `✗ None of the 5 most-recent completed races have session_result data. OpenF1 may be very slow to publish.`,
    );
    process.exit(1);
  }

  if (noResultSessions.length > 0) {
    console.log(
      `  Skipped ${noResultSessions.length} recent session(s) with no session_result data yet:`,
    );
    for (const s of noResultSessions) {
      const hoursSinceEnd = (Date.now() - new Date(s.date_end).getTime()) / 3_600_000;
      console.log(
        `    session_key=${s.session_key} · ended ${hoursSinceEnd.toFixed(1)}h ago`,
      );
    }
    console.log();
  }

  const meeting = (
    await fetchJson<Meeting[]>(
      `${OPENF1}/meetings?meeting_key=${picked.meeting_key}`,
    )
  )[0];

  console.log(`  Measuring against:`);
  console.log(`    Meeting:      ${meeting?.meeting_name ?? "?"}`);
  console.log(`    Circuit:      ${meeting?.circuit_short_name ?? "?"}`);
  console.log(`    Session key:  ${picked.session_key}`);
  console.log(`    Session end:  ${picked.date_end}`);
  console.log(`    Now (UTC):    ${new Date().toISOString()}\n`);

  const probeStart = Date.now();
  results = await tryFetchResults(picked.session_key);
  const probeMs = Date.now() - probeStart;

  console.log(`→ /session_result?session_key=${picked.session_key}`);
  console.log(`  HTTP ok · rows: ${results.length} · probe: ${probeMs}ms\n`);
  const session = picked;

  const classified = results
    .filter((r) => r.position !== null && !r.dsq && !r.dns)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  if (classified.length === 0) {
    console.log(
      "⚠ session_result returned 0 classified rows for the most recent race.",
    );
    console.log(
      "  → OpenF1 has not yet published results for this race. Latency > time-since-race.",
    );
  } else {
    console.log(`  Classified top 3:`);
    for (const r of classified.slice(0, 3)) {
      console.log(
        `    P${r.position}  driver_number=${r.driver_number}  dnf=${r.dnf}`,
      );
    }
    console.log();
  }

  const sessionEnd = new Date(session.date_end).getTime();
  const hoursSinceEnd = (Date.now() - sessionEnd) / (1000 * 60 * 60);

  console.log(
    `  Hours since session end: ${hoursSinceEnd.toFixed(2)}h (results ${
      classified.length > 0 ? "PRESENT" : "ABSENT"
    })\n`,
  );

  console.log("─".repeat(60));
  console.log("CRON STRATEGY RECOMMENDATION");
  console.log("─".repeat(60));

  const noResultsRecentHours = noResultSessions[0]
    ? (Date.now() - new Date(noResultSessions[0].date_end).getTime()) / 3_600_000
    : null;

  if (classified.length === 0) {
    console.log("  ⚠  INCONCLUSIVE — results not yet published.");
    console.log(
      "  Rerun this script after the next race, or pick an older session_key manually.",
    );
    console.log("  Default posture: MANUAL-ONLY until proven otherwise.");
  } else if (noResultsRecentHours !== null && noResultsRecentHours > 0.5) {
    console.log(
      `  ◑ BOUND  — results for sessions ≥${noResultsRecentHours.toFixed(1)}h old are still absent,`,
    );
    console.log(
      `           but results DO appear eventually (verified at ${hoursSinceEnd.toFixed(1)}h).`,
    );
    console.log("  Phase 3 plan: manual admin entry primary.");
    console.log(
      "  Rerun post-Saudi/Miami race to refine; wire cron only if latency drops below 4h.",
    );
  } else if (hoursSinceEnd < 0.5) {
    console.log("  ✓ FAST   — results available within 30 min of session end.");
    console.log("  Phase 3 plan: single cron at session_end + 30m.");
    console.log(
      "  Vercel Hobby daily-only cron is INSUFFICIENT; use GitHub Actions or upgrade.",
    );
  } else if (hoursSinceEnd < 4) {
    console.log(`  ✓ MEDIUM — results available within ~${hoursSinceEnd.toFixed(1)}h.`);
    console.log("  Phase 3 plan: hourly cron starting at session_end, stop after 4h.");
    console.log(
      "  Vercel Hobby daily-only cron is INSUFFICIENT; use GitHub Actions.",
    );
  } else {
    console.log(`  ◑ SLOW   — results appeared after ~${hoursSinceEnd.toFixed(1)}h.`);
    console.log(
      "  Phase 3 plan: manual admin entry only. Skip auto-fetch cron entirely.",
    );
    console.log("  Vercel Hobby daily-only cron is acceptable for nightly sync.");
  }
  console.log();
}

measureLatency().catch((err) => {
  console.error("✗ Latency test failed:", err);
  process.exit(1);
});
