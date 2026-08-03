import { test, expect } from "@playwright/test";
import { createSupabaseServiceClient } from "../../src/lib/supabase/service";
import { writeResultsService } from "../../src/lib/writeResults";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}
const INVITE_CODE = requireEnv("INVITE_CODE");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Files results (source='admin') for one past, not-yet-revealed race
 * session through the real `writeResultsService` pipeline — the same
 * function the admin manual-entry action and the OpenF1 cron fetcher call.
 * No raw SQL, no bypassing the scoring pipeline.
 *
 * This is what makes the round render "Entered · Not revealed" and a real
 * "Reveal to group" button on /admin (`page.tsx`'s `deriveState()` only
 * derives round state from the race session, so nothing else short of an
 * un-revealed race with results produces that button). Without this, the
 * test's headline assertion depends on whichever race a human happened to
 * seed by hand in this checkout — true on this machine right now, false on
 * a fresh `supabase db reset` or a CI database.
 *
 * Idempotent and safe to call from any DB state:
 *   - the candidate race is chosen deterministically (earliest past,
 *     un-revealed race session) — the same row every time, never a
 *     different one on repeat runs
 *   - `revealed_at IS NULL` is part of the selection filter, so this can
 *     never touch an already-revealed event (source='admin' has no freeze
 *     check and would otherwise silently overwrite one)
 *   - `writeResultsService` UPSERTs `results` on the `event_id` primary
 *     key, so re-running against a race that already has results (e.g.
 *     one seeded by a previous run of this same function) just re-writes
 *     the same row — it never double-files or corrupts scores
 */
async function seedOneEnteredRound(): Promise<void> {
  const svc = createSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const { data: races, error: racesErr } = await svc
    .from("events")
    .select("id, session_start_at")
    .eq("session_type", "race")
    .is("revealed_at", null)
    .lt("session_start_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(1);
  if (racesErr) {
    throw new Error(`seedOneEnteredRound: events query failed: ${racesErr.message}`);
  }
  const race = races?.[0] as { id: string } | undefined;
  if (!race) {
    throw new Error(
      "seedOneEnteredRound: no past, un-revealed race session found — the " +
        "seeded calendar has no candidate to file results for",
    );
  }

  const { data: drivers, error: driversErr } = await svc
    .from("drivers")
    .select("id, code")
    .in("code", ["ALB", "ALO", "ANT"]);
  if (driversErr) {
    throw new Error(`seedOneEnteredRound: drivers query failed: ${driversErr.message}`);
  }
  const byCode = new Map(
    (drivers ?? []).map((d) => [d.code as string, d.id as number]),
  );
  const p1 = byCode.get("ALB");
  const p2 = byCode.get("ALO");
  const p3 = byCode.get("ANT");
  if (p1 == null || p2 == null || p3 == null) {
    throw new Error(
      "seedOneEnteredRound: expected driver codes ALB/ALO/ANT not found in `drivers`",
    );
  }

  const result = await writeResultsService(
    svc,
    { eventId: race.id, p1, p2, p3 },
    "admin",
  );
  if (!result.ok) {
    throw new Error(`seedOneEnteredRound: writeResultsService failed: ${result.message}`);
  }
}

test.describe("admin on mobile", () => {
  test.beforeAll(async () => {
    if (!ADMIN_EMAIL) return; // whole test skips below; don't bother seeding
    await seedOneEnteredRound();
  });

  test("session list and reveal action fit a phone", async ({ page }) => {
    test.skip(!ADMIN_EMAIL, "ADMIN_EMAIL not set — cannot reach /admin");
    // This test's whole point is the phone-width rendering — the 44px tap
    // target is a phone requirement, not a desktop one (at `md:` and up the
    // reveal button is deliberately back to its original 36px, matching
    // R5's desktop-parity requirement). The "Desktop Chrome" project's
    // default viewport (1280x720) is above the `md` fork, so — same as
    // `mobile-nav.spec.ts` — this must force a phone-width viewport
    // regardless of which project runs it.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/join");
    await page.getByLabel("Invite code").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/login/);
    const resp = await page.request.post("/api/test/sign-in-password", {
      data: { email: ADMIN_EMAIL, password: "test-password-12345" },
    });
    expect(resp.ok(), `admin sign-in: ${resp.status()}`).toBeTruthy();

    await page.goto("/admin");
    const { sw, cw } = await page.evaluate(() => {
      const el = document.scrollingElement as HTMLElement;
      return { sw: el.scrollWidth, cw: el.clientWidth };
    });
    expect(sw, "/admin must not scroll horizontally").toBeLessThanOrEqual(cw + 1);

    // The reveal tap is the Sunday-evening action the whole product gates
    // on — its presence is asserted unconditionally (R2), not behind an
    // `if (count())` guard that would silently vanish if it stopped
    // rendering. `beforeAll` above files results for one past round through
    // the real scoring pipeline, so a genuine "entered" round — and its
    // Reveal to group button — always exists before this assertion runs,
    // regardless of what state this checkout's DB started in.
    const reveal = page.getByRole("button", { name: /reveal to group/i }).first();
    await expect(reveal, "a Reveal to group control must render on /admin").toBeVisible();
    const box = (await reveal.boundingBox())!;
    expect(box.height, "reveal control must be a comfortable tap target").toBeGreaterThanOrEqual(44);
  });
});
