/**
 * Seeds a reveal-ready fixture for the Japan GP 2026 race so /reveal/[id]
 * has multiple friend cards to render.
 *
 *   - Creates 4 fake users (idempotent — re-running just re-grabs them)
 *   - Submits a P1/P2/P3 prediction per user against Japan GP race
 *   - Bypasses the predictions_lock_guard trigger via session_replication_role
 *
 * After running:
 *   - Open /admin in the browser, click into Japan GP race, file results,
 *     trigger reveal. The friend gallery will have 4 cards (or 5 with you).
 *
 * Re-run is safe: predictions UPSERT on (user_id, event_id) and the user
 * creator is "find or create" via admin.listUsers.
 */
import postgres from "postgres";
import { createSupabaseServiceClient } from "../src/lib/supabase/service";

const JAPAN_RACE_ID = "3e56e331-82c4-4067-adb8-5d7d00fc7c15";

type Friend = {
  email: string;
  display: string;
  team: string;
  driver: number;
  picks: [string, string, string]; // P1, P2, P3 by driver code
};

// Different shapes of picks so the reveal is interesting:
//   - one perfect podium variant
//   - one all-wrong
//   - one mixed
//   - one P1-correct only
const FRIENDS: Friend[] = [
  {
    email: "vineet@f1fantasy.test",
    display: "Vineet",
    team: "McLaren",
    driver: 4,
    picks: ["NOR", "PIA", "LEC"],
  },
  {
    email: "priya@f1fantasy.test",
    display: "Priya",
    team: "Ferrari",
    driver: 16,
    picks: ["LEC", "HAM", "VER"],
  },
  {
    email: "rohan@f1fantasy.test",
    display: "Rohan",
    team: "Mercedes",
    driver: 63,
    picks: ["VER", "ALO", "RUS"],
  },
  {
    email: "tara@f1fantasy.test",
    display: "Tara",
    team: "Red Bull Racing",
    driver: 1,
    picks: ["ALO", "STR", "GAS"],
  },
];

async function main() {
  const svc = createSupabaseServiceClient();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  // Resolve driver codes → ids
  const { data: drivers } = await svc
    .from("drivers")
    .select("id, code")
    .eq("active", true);
  const idByCode = new Map<string, number>(
    (drivers ?? []).map((d) => [d.code as string, d.id as number]),
  );

  for (const f of FRIENDS) {
    // Find or create user
    const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 });
    let user = list?.users.find((u) => u.email === f.email);
    if (!user) {
      const { data: created, error } = await svc.auth.admin.createUser({
        email: f.email,
        password: "fixture-pwd-12345",
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${f.email}: ${error.message}`);
      user = created.user!;
      console.log(`created ${f.email}`);
    } else {
      console.log(`found  ${f.email}`);
    }

    // Mirror into public.users with display name + favorites
    await svc.from("users").upsert(
      {
        id: user.id,
        email: f.email,
        display_name: f.display,
        favorite_team: f.team,
        favorite_driver: f.driver,
      },
      { onConflict: "id" },
    );

    // Resolve picks to driver_id
    const ids = f.picks.map((c) => {
      const id = idByCode.get(c);
      if (!id) throw new Error(`unknown driver code ${c}`);
      return id;
    });

    // UPSERT prediction with the lock-guard trigger disabled. Service-role
    // toggling session_replication_role is the standard "bypass app triggers
    // for fixture seeding" pattern.
    await sql.begin(async (tx) => {
      await tx`set local session_replication_role = 'replica'`;
      await tx`
        insert into public.predictions
          (user_id, event_id, p1_driver_id, p2_driver_id, p3_driver_id)
        values (${user.id}, ${JAPAN_RACE_ID}, ${ids[0]}, ${ids[1]}, ${ids[2]})
        on conflict (user_id, event_id) do update
          set p1_driver_id = excluded.p1_driver_id,
              p2_driver_id = excluded.p2_driver_id,
              p3_driver_id = excluded.p3_driver_id
      `;
    });
    console.log(
      `  picks ${f.display}: ${f.picks.join(" · ")}`,
    );
  }

  await sql.end();
  console.log(`\ndone. ${FRIENDS.length} friends locked in for Japan GP race.`);
  console.log(`next: /admin → Japanese Grand Prix → file results → reveal.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
