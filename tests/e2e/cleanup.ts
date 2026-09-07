import postgres from "postgres";

/**
 * Throwaway-user bookkeeping for the e2e suite.
 *
 * Every spec that exercises an authenticated route mints a brand-new user
 * per test (a fresh sign-in is the only way to reach the first-time-profile
 * flow, and unique emails are what keep `fullyParallel` workers from
 * colliding in `admin.createUser`). Historically none of them deleted those
 * users again, so a single `bun run e2e` left ~51-57 rows behind in
 * `auth.users` — permanently.
 *
 * That is not merely untidy. `/dashboard/lobby`, `/dashboard/league` and
 * `/dashboard/standings` all render the `public.users` roster, so every e2e
 * run visibly changes what those pages draw. The mobile program's pixel
 * harness compares 1440 screenshots at `maxDiffPixels: 0` against a checked-in
 * baseline; an e2e run between a baseline and a compare produces a large diff
 * on routes the change under test never touched. That failure mode reads
 * exactly like a regression and has cost real debugging time.
 *
 * So: specs register the users they mint here, and delete them in an
 * `afterAll`. `auth.spec.ts` already did this per-test with its own local
 * `cleanupUser`; this is the same idea, shared, for the specs that did not.
 *
 * Deleting rows is the one genuinely destructive thing the test suite does,
 * so this module is deliberately paranoid — see the three guards below.
 */

/** `test+<tag>@f1fantasy.test` — the documented shape of a throwaway user. */
const THROWAWAY = /^test\+[A-Za-z0-9._%+-]+@f1fantasy\.test$/;

/**
 * Per-worker set. Playwright runs each spec file in a worker process, so
 * this collects only the users that this worker actually created — a
 * concurrent worker's users are invisible here and are its own to clean up.
 */
const minted = new Set<string>();

/**
 * Records an email so `deleteMintedUsers()` will remove it later, and returns
 * it — designed to wrap the literal at the point it is constructed:
 *
 *   const email = trackMintedUser(`test+nav-${Date.now()}-${rand}@f1fantasy.test`);
 *
 * Throws on an address outside the throwaway namespace rather than tracking
 * it, so a future typo can never queue a real account for deletion.
 */
export function trackMintedUser(email: string): string {
  if (!THROWAWAY.test(email)) {
    throw new Error(
      `trackMintedUser: "${email}" is not a throwaway address. Only ` +
        "test+<tag>@f1fantasy.test may be registered for deletion.",
    );
  }
  minted.add(email);
  return email;
}

/**
 * Deletes every user this worker minted. Call from a top-level
 * `test.afterAll` in any spec that calls `trackMintedUser`.
 *
 * `public.users.id` is `references auth.users(id) on delete cascade`, so
 * deleting the auth row takes the profile, predictions and scores with it.
 * The predictions lock trigger is `before insert or update` only, so a
 * delete passes even for a locked event.
 *
 * Best-effort by design: a cleanup failure is reported to the console but
 * never fails the run. Leftover rows are a nuisance; a red suite that
 * actually passed is worse.
 */
export async function deleteMintedUsers(): Promise<void> {
  if (minted.size === 0) return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[e2e cleanup] DATABASE_URL unset — skipping user cleanup.");
    return;
  }
  // Guard 2: refuse to delete against anything but the local fixture DB.
  // Mirrors the same check in admin-mobile.spec.ts's seed helper.
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(
      "[e2e cleanup] refusing to delete users — DATABASE_URL does not point " +
        "at 127.0.0.1 or localhost. The e2e suite must only ever run against " +
        "the local Supabase fixture.",
    );
  }

  const emails = [...minted];
  const sql = postgres(url, { max: 1 });
  try {
    // Guard 3: never delete an admin, whatever the address looks like. The
    // suite signs in as ADMIN_EMAIL (admin-mobile.spec.ts) and that account
    // must survive; this is the backstop if one ever gets tracked by mistake.
    //
    // `in ${sql(list)}` and not `= any(${sql.array(list)})`: postgres.js
    // serialises a bare array without a type annotation, and Postgres then
    // rejects the comparison with "op ANY/ALL (array) requires array on right
    // side" (42809). The `in` form expands to a plain value tuple and needs no
    // element type. Both call sites below are guarded against an empty list,
    // which would expand to an invalid `in ()`.
    const admins = await sql<{ email: string }[]>`
      select u.email
        from auth.users u
        join public.admins a on a.user_id = u.id
       where u.email in ${sql(emails)}
    `;
    const protectedEmails = new Set(admins.map((r) => r.email));
    const deletable = emails.filter((e) => !protectedEmails.has(e));
    if (protectedEmails.size > 0) {
      console.warn(
        `[e2e cleanup] refusing to delete ${protectedEmails.size} admin ` +
          `account(s): ${[...protectedEmails].join(", ")}`,
      );
    }
    if (deletable.length > 0) {
      const deleted = await sql<{ email: string }[]>`
        delete from auth.users
         where email in ${sql(deletable)}
        returning email
      `;
      console.log(`[e2e cleanup] deleted ${deleted.length} throwaway user(s).`);
    }
  } catch (err) {
    console.warn("[e2e cleanup] failed to delete throwaway users:", err);
  } finally {
    await sql.end();
    minted.clear();
  }
}
