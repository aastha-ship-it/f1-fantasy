/**
 * Seeds 4 fake friends and locks in their P1/P2/P3 picks across one or more
 * past rounds. Designed for /reveal + /league + /admin testing where the
 * single-user flow shows just one card.
 *
 * Usage:
 *   bun --env-file=.env.local run scripts/seed-fixture-picks.ts
 *     # defaults: --season=$CURRENT_YEAR --rounds=2,3 (China + Japan races)
 *
 *   bun --env-file=.env.local run scripts/seed-fixture-picks.ts --rounds 1,2,3
 *   bun --env-file=.env.local run scripts/seed-fixture-picks.ts --season 2026 --rounds 3
 *
 * Idempotent — re-running just upserts. Bypasses the predictions_lock_guard
 * trigger via `set local session_replication_role = 'replica'` so picks for
 * past sessions land cleanly.
 *
 * After running:
 *   - /admin → file results for the seeded rounds → Save + Reveal
 *   - /reveal/<eventId> shows ~5 friend cards (4 fixtures + you)
 *   - /dashboard/league populates with multiple bar-chart rows
 */
import postgres from "postgres";
import { createSupabaseServiceClient } from "../src/lib/supabase/service";
import { refreshNudgesForUpcoming } from "../src/lib/nudges/refreshNudges";

type Friend = {
  email: string;
  display: string;
  team: string;
  driverCode: string;
};

const FRIENDS: Friend[] = [
  { email: "vineet@f1fantasy.test", display: "Vineet", team: "McLaren", driverCode: "NOR" },
  { email: "priya@f1fantasy.test", display: "Priya", team: "Ferrari", driverCode: "LEC" },
  { email: "rohan@f1fantasy.test", display: "Rohan", team: "Mercedes", driverCode: "RUS" },
  { email: "tara@f1fantasy.test", display: "Tara", team: "Red Bull Racing", driverCode: "VER" },
];

/**
 * Per-friend, per-round picks. Picks are intentionally varied so the
 * reveal looks interesting (perfect podiums, near misses, total whiffs).
 *
 * Friend-name → round → [P1, P2, P3] driver codes.
 * Add new rounds here when you want to seed more.
 */
const PICKS_BY_FRIEND_BY_ROUND: Record<string, Record<number, [string, string, string]>> = {
  Vineet: {
    1: ["PIA", "NOR", "VER"],
    2: ["NOR", "PIA", "LEC"],
    3: ["PIA", "NOR", "LEC"],
  },
  Priya: {
    1: ["LEC", "HAM", "PIA"],
    2: ["LEC", "HAM", "NOR"],
    3: ["LEC", "NOR", "PIA"],
  },
  Rohan: {
    1: ["VER", "RUS", "HAM"],
    2: ["RUS", "ANT", "VER"],
    3: ["ANT", "RUS", "HAM"],
  },
  Tara: {
    1: ["NOR", "PIA", "ALO"],
    2: ["VER", "ALO", "LEC"],
    3: ["VER", "LEC", "NOR"],
  },
};

const FIXTURE_PASSWORD = "fixture-pwd-12345";

function parseArgs(): {
  season: number;
  rounds: number[];
  withNudges: boolean;
} {
  const args = process.argv.slice(2);
  let season = new Date().getUTCFullYear();
  let rounds = [2, 3];
  let withNudges = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--season" && args[i + 1]) {
      season = Number(args[i + 1]);
      i++;
    } else if (a === "--rounds" && args[i + 1]) {
      rounds = args[i + 1]!
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      i++;
    } else if (a === "--with-nudges") {
      withNudges = true;
    }
  }
  return { season, rounds, withNudges };
}

async function main() {
  const { season, rounds, withNudges } = parseArgs();
  console.log(
    `→ seeding fixture picks: season=${season} rounds=${rounds.join(",")}${
      withNudges ? " --with-nudges" : ""
    }`,
  );

  const svc = createSupabaseServiceClient();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  // Resolve every session of every requested round. Sprint weekends carry
  // 4 sessions (sprint_quali, sprint_race, quali, race); race-only weekends
  // carry 2 (quali, race). We seed each one — sprint sessions take P1 only,
  // quali + race take the full P1/P2/P3.
  type SessionRow = {
    id: string;
    round: number;
    name: string;
    session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  };
  const { data: events } = await svc
    .from("events")
    .select("id, round, name, session_type")
    .eq("season", season)
    .in("round", rounds)
    .returns<SessionRow[]>();
  const sessionsByRound = new Map<number, SessionRow[]>();
  for (const e of events ?? []) {
    const list = sessionsByRound.get(e.round) ?? [];
    list.push(e);
    sessionsByRound.set(e.round, list);
  }
  for (const r of rounds) {
    const list = sessionsByRound.get(r);
    if (!list || list.length === 0) {
      throw new Error(
        `No sessions found for season ${season} round ${r}. ` +
          `Run scripts/seed-calendar.ts first.`,
      );
    }
  }

  // Resolve all driver codes we need to driver_id.
  const { data: drivers } = await svc
    .from("drivers")
    .select("id, code")
    .eq("active", true);
  const idByCode = new Map<string, number>(
    (drivers ?? []).map((d) => [d.code as string, d.id as number]),
  );

  // Validate every code we'll use exists.
  for (const friend of FRIENDS) {
    const friendPicks = PICKS_BY_FRIEND_BY_ROUND[friend.display];
    if (!friendPicks) {
      throw new Error(`No picks defined for friend "${friend.display}"`);
    }
    for (const r of rounds) {
      const codes = friendPicks[r];
      if (!codes) {
        throw new Error(
          `No picks defined for ${friend.display} at round ${r}. ` +
            `Add an entry to PICKS_BY_FRIEND_BY_ROUND.`,
        );
      }
      for (const c of codes) {
        if (!idByCode.has(c)) {
          throw new Error(
            `Unknown driver code "${c}" — not in active drivers table.`,
          );
        }
      }
    }
  }

  // Find or create each friend; mirror to public.users with display_name + favorites.
  for (const f of FRIENDS) {
    const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 });
    let user = list?.users.find((u) => u.email === f.email);
    if (!user) {
      const { data: created, error } = await svc.auth.admin.createUser({
        email: f.email,
        password: FIXTURE_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${f.email}: ${error.message}`);
      user = created.user!;
      console.log(`  created  ${f.email}`);
    } else {
      console.log(`  found    ${f.email}`);
    }

    await svc.from("users").upsert(
      {
        id: user.id,
        email: f.email,
        display_name: f.display,
        favorite_team: f.team,
        favorite_driver: idByCode.get(f.driverCode),
      },
      { onConflict: "id" },
    );

    // UPSERT predictions for every session of every requested round.
    for (const r of rounds) {
      const sessions = sessionsByRound.get(r)!;
      const codes = PICKS_BY_FRIEND_BY_ROUND[f.display][r]!;
      const ids = codes.map((c) => idByCode.get(c)!);

      for (const s of sessions) {
        const isSprint =
          s.session_type === "sprint_quali" ||
          s.session_type === "sprint_race";
        const p1 = ids[0];
        const p2 = isSprint ? null : ids[1];
        const p3 = isSprint ? null : ids[2];

        // Bypass predictions_lock_guard via session_replication_role.
        // The trigger rejects writes where now() > lock_at; past rounds are
        // always locked, so without this we'd be stuck.
        await sql.begin(async (tx) => {
          await tx`set local session_replication_role = 'replica'`;
          await tx`
            insert into public.predictions
              (user_id, event_id, p1_driver_id, p2_driver_id, p3_driver_id)
            values (${user.id}, ${s.id}, ${p1}, ${p2}, ${p3})
            on conflict (user_id, event_id) do update
              set p1_driver_id = excluded.p1_driver_id,
                  p2_driver_id = excluded.p2_driver_id,
                  p3_driver_id = excluded.p3_driver_id
          `;
        });
        const slotsLabel = isSprint
          ? codes[0]
          : codes.join(" · ");
        console.log(
          `    R${String(r).padStart(2, "0")} ${s.session_type.padEnd(13)} :: ${slotsLabel}`,
        );
      }
    }
  }

  // Optional: populate driver_nudges for upcoming events. Off by default
  // because the OpenF1 fetch chain (~50 throttled requests per event × 350ms
  // = ~30-60s per event in next 30d) makes the seed feel frozen for a few
  // minutes. Pass --with-nudges to opt in, or trigger manually via:
  //   curl -H "Authorization: Bearer $CRON_SECRET" \
  //     http://localhost:3001/api/cron/refresh-nudges
  if (withNudges) {
    console.log(
      `\n→ refreshing driver_nudges for upcoming events (~30d window)`,
    );
    console.log(
      `  (this hits OpenF1 throttled at 350ms/req × ~50 per event — be patient)`,
    );
    try {
      const summaries = await refreshNudgesForUpcoming(svc, {
        withinDays: 30,
      });
      const totalUpserts = summaries.reduce(
        (acc, s) => acc + (s.upserted ?? 0),
        0,
      );
      console.log(
        `  ✓ refreshed ${summaries.length} event${
          summaries.length === 1 ? "" : "s"
        } · ${totalUpserts} nudge row${totalUpserts === 1 ? "" : "s"}`,
      );
    } catch (err) {
      console.warn(
        `  ⚠ nudge refresh failed (continuing): ${(err as Error).message}`,
      );
    }
  } else {
    console.log(
      `\n→ skipping nudge refresh (pass --with-nudges to populate the predict telemetry strip,`,
    );
    console.log(
      `   or trigger via curl — see the cheatsheet line below)`,
    );
  }

  await sql.end();
  console.log(
    `\n✓ done. ${FRIENDS.length} friends · ${rounds.length} round${rounds.length === 1 ? "" : "s"} seeded across all sessions.`,
  );
  console.log(
    `  next: /admin → file results for the seeded rounds → Save + Reveal.`,
  );
  console.log(
    `  to refresh nudges manually: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/refresh-nudges`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
