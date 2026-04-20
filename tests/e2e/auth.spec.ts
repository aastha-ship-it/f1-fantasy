import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * E1 + E2 — auth + first-time-profile flow.
 *
 *   E1 valid invite → programmatic session (via admin.generateLink, standing
 *      in for the Google-OAuth round-trip we can't script) → /profile
 *      welcome mode → save display name → dashboard.
 *   E2 invalid invite → inline error, URL stays on /join.
 *
 * We can't drive the real Google consent page in CI, so E1 uses
 * supabase.auth.admin.generateLink({ type: 'magiclink' }) to mint a
 * verification URL. Navigating to it lands the browser on /auth/callback
 * with a valid ?code=... exactly as a real OAuth return would — same
 * downstream routing (welcome redirect if display_name is null).
 */

const INVITE_CODE = process.env.INVITE_CODE ?? "LECLERC-FTW-2026";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54421";
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "<redacted-supabase-local-dev-key>";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function e2eEmail(tag: string): string {
  return `test+e2e-${tag}-${Date.now()}@f1fantasy.test`;
}

async function cleanupUser(email: string): Promise<void> {
  const sql = postgres(DATABASE_URL, { max: 1 });
  try {
    await sql`delete from public.users where email = ${email}`;
    await sql`delete from auth.users where email = ${email}`;
  } finally {
    await sql.end();
  }
}

async function gateThroughInvite(page: Page) {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
}

test.describe("E2E auth", () => {
  test("E1 · valid invite → auth → welcome profile setup → dashboard", async ({
    page,
  }) => {
    const email = e2eEmail("e1");
    const password = "test-password-12345";

    // Create a confirmed user via service role. The real app flow is OAuth
    // via Google, which Playwright can't script; we stand in with a
    // password-based sign-in routed through a test-only API endpoint.
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createErr, `createUser: ${createErr?.message}`).toBeNull();
    expect(created?.user).toBeTruthy();

    try {
      // Pass the invite gate first so middleware lets us through after auth.
      await gateThroughInvite(page);

      // Sign in via the test-only password endpoint. @supabase/ssr's cookie
      // setters attach the session to Playwright's browser context. The
      // endpoint also mirrors the /auth/callback first-login upsert so
      // public.users is seeded.
      const resp = await page.request.post("/api/test/sign-in-password", {
        data: { email, password },
      });
      expect(resp.ok(), `test-sign-in: ${resp.status()}`).toBeTruthy();

      // Now that we have a session, navigate to /dashboard — the defensive
      // display_name guard should bounce us to /profile?welcome=1.
      await page.goto("/dashboard");
      await page.waitForURL(/\/profile\?welcome=1/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: "WELCOME" }),
      ).toBeVisible();

      // Fill the required name; other fields stay empty.
      await page.getByLabel("Your name (required)").fill("Test User");
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/dashboard", {
          timeout: 15_000,
        }),
        page.getByRole("button", { name: /continue/i }).click(),
      ]);
      // Dashboard toolbar shows display name + email inline, with a
      // Sign out button. Asserting on the email is the most precise check.
      await expect(page.getByText(email)).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    } finally {
      await cleanupUser(email);
    }
  });

  test("E2 · invalid invite → inline error, still on /join", async ({
    page,
  }) => {
    await page.goto("/join");
    await page.getByLabel("Invite code").fill("NOT-THE-REAL-CODE");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByTestId("invite-error")).toContainText(
      "Invalid invite code",
    );
    await expect(page).toHaveURL(/\/join/);
  });
});
