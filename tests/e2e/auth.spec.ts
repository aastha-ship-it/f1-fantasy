import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * E1 + E2 — auth flow end-to-end.
 *
 *   E1 valid invite → magic link → dashboard
 *   E2 invalid invite → inline error, URL still on /join
 *
 * Magic links are intercepted from Mailpit's REST API — the local Supabase
 * stack pipes every outbound email there on port 54424.
 */

const INVITE_CODE = process.env.INVITE_CODE ?? "LECLERC-FTW-2026";
const MAILPIT_BASE = "http://127.0.0.1:54424";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54422/postgres";

function e2eEmail(tag: string): string {
  return `test+e2e-${tag}-${Date.now()}@f1fantasy.test`;
}

async function fetchLatestMagicLink(forEmail: string): Promise<string> {
  // Poll Mailpit for up to ~10 seconds — Supabase sends async.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await fetch(`${MAILPIT_BASE}/api/v1/messages?limit=20`);
    if (!res.ok) throw new Error(`Mailpit list failed: ${res.status}`);
    const json = (await res.json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const match = json.messages.find((m) =>
      m.To?.some((t) => t.Address.toLowerCase() === forEmail.toLowerCase()),
    );
    if (match) {
      const body = await fetch(`${MAILPIT_BASE}/api/v1/message/${match.ID}`);
      const detail = (await body.json()) as { Text?: string; HTML?: string };
      const text = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;
      const link = text.match(
        /https?:\/\/[^\s<>"']+\/auth\/v1\/verify[^\s<>"']+/,
      );
      if (link) return link[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No magic link arrived for ${forEmail}`);
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
  test("E1 · valid invite → magic link → dashboard", async ({ page }) => {
    const email = e2eEmail("e1");

    await gateThroughInvite(page);

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send magic link" }).click();

    await expect(page.getByTestId("login-sent")).toContainText(
      /check your email/i,
    );

    const link = await fetchLatestMagicLink(email);
    await page.goto(link);
    await page.waitForURL(/\/dashboard/);

    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await cleanupUser(email);
  });

  test("E2 · invalid invite → inline error, still on /join", async ({
    page,
  }) => {
    await page.goto("/join");
    await page.getByLabel("Invite code").fill("NOT-THE-REAL-CODE");
    await page.getByRole("button", { name: "Continue" }).click();

    // Server action re-renders the page with the error. URL stays on /join.
    await expect(page.getByTestId("invite-error")).toContainText(
      "Invalid invite code",
    );
    await expect(page).toHaveURL(/\/join/);
  });
});
