import { test, expect, devices, type Page, type BrowserContext } from "@playwright/test";
import path from "node:path";

/**
 * Task 15 — portrait podium: three full-bleed stacked bands.
 *
 * R2: this spec builds its own browser contexts (`browser.newContext`) with
 * explicit device descriptors, overriding whatever the ambient Playwright
 * project supplies. Running it under all 4 configured projects (Desktop
 * Chrome / iPhone 14 / Pixel 7 / iPad Mini) would execute the same contexts
 * 4× — wasted wall-clock and a misleading pass count. Constrained to run
 * once via a `beforeEach` conditional skip gated on the project name (a
 * bare module-level `test.skip(callback, ...)` has no `testInfo` yet at
 * collection time and throws — `testInfo` is only available once a test is
 * actually running, e.g. inside `beforeEach`).
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for e2e tests — load .env.local`);
  return v;
}

const INVITE_CODE = requireEnv("INVITE_CODE");
const EVIDENCE_DIR = path.resolve(
  __dirname,
  "../../.superpowers/sdd/2026-07-30-mobile-compatibility/task-15-evidence",
);

/** Signs a fresh test user in through the real /join → /login → welcome
 * flow, the same pattern used by tests/e2e/no-horizontal-overflow.spec.ts.
 * Each call mints a unique user so parallel/sequential runs never collide. */
async function signIn(page: Page, tag: string): Promise<void> {
  await page.goto("/join");
  await page.getByLabel("Invite code").fill(INVITE_CODE);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/login/);
  const email = `test+portrait-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@f1fantasy.test`;
  const resp = await page.request.post("/api/test/sign-in-password", {
    data: { email, password: "test-password-12345" },
  });
  expect(resp.ok(), `sign-in: ${resp.status()}`).toBeTruthy();
  await page.goto("/profile?welcome=1");
  await page.getByLabel("Your name (required)").fill("Portrait Test");
  await page.getByRole("button", { name: /save.+paddock/i }).click();
  await page.waitForURL((u) => u.pathname === "/dashboard");
}

/** Waits for every `[data-podium-card]`'s FlipCard wrapper to finish its
 * opacity transition — i.e. for the reveal choreography to have actually
 * landed — rather than screenshotting mid-flip. Without this, a screenshot
 * taken right after `networkidle` (which fires as soon as assets are
 * fetched, long before PODIUM_BASE_DELAY's ~3.3s cinematic delay elapses)
 * captures the pre-reveal state: FlipCard's `initial={{ opacity: 0 }}` makes
 * the whole card invisible, leaving only the parent grid's `var(--border)`
 * gap-filler visible as a blank rectangle. */
async function waitForPodiumSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>("[data-podium-card]"),
      );
      if (cards.length === 0) return false;
      return cards.every((c) => {
        const wrapper = c.parentElement;
        if (!wrapper) return false;
        return parseFloat(getComputedStyle(wrapper).opacity) >= 0.99;
      });
    },
    { timeout: 15_000 },
  );
}

/** Waits for the friend-card cascade (the section below the podium) to have
 * finished flipping in too — purely so the R1(c) evidence screenshots show
 * the fully-settled page rather than an empty "THE GROUP" grid mid-cascade.
 * Not required by any assertion; only used before the screenshot calls. */
async function waitForFriendCascadeSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const articles = Array.from(document.querySelectorAll<HTMLElement>("article"));
      if (articles.length === 0) return true;
      return articles.every((a) => {
        const wrapper = a.parentElement;
        if (!wrapper) return false;
        return parseFloat(getComputedStyle(wrapper).opacity) >= 0.99;
      });
    },
    { timeout: 15_000 },
  );
}

async function measureNoOverflow(page: Page): Promise<{ sw: number; cw: number }> {
  return page.evaluate(() => {
    const el = document.scrollingElement as HTMLElement;
    return { sw: el.scrollWidth, cw: el.clientWidth };
  });
}

/**
 * R1(a): deterministic non-sprint selection. `reveal/page.tsx` gives every
 * session pill an `aria-label="Watch ${sessionLabel} reveal"`, where
 * sessionLabel maps race → "Race", quali → "Qualifying", sprint_race →
 * "Sprint", sprint_quali → "Sprint Qualifying". "Race" and "Qualifying" are
 * both non-sprint session types (the 3-card visualOrder), and neither name
 * is a substring of a sprint label, but `exact: true` is still required —
 * without it, a loose matcher could accidentally match "Watch Sprint
 * Qualifying reveal" against a "Qualifying" query. `.first()` is safe here
 * ONLY because every element the locator can match is already guaranteed
 * non-sprint by the exact accessible name — unlike the naive
 * `a[href^="/reveal/"]`.first() in the task's illustrative Step 1 snippet,
 * which could resolve to a sprint session and fail the 3-card assertion for
 * a reason that has nothing to do with the portrait code under test.
 */
function nonSprintRaceLink(page: Page) {
  return page.getByRole("link", { name: "Watch Race reveal", exact: true }).first();
}

function sprintQualiLink(page: Page) {
  return page
    .getByRole("link", { name: "Watch Sprint Qualifying reveal", exact: true })
    .first();
}

function sprintRaceLink(page: Page) {
  return page.getByRole("link", { name: "Watch Sprint reveal", exact: true }).first();
}

test.describe("reveal portrait choreography", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "R2: this spec builds its own explicit browser contexts (iPhone 14 / Desktop Chrome) — running it again under the other 3 device projects would only re-execute the same contexts.",
    );
  });

  let phoneCtx: BrowserContext;
  let wideCtx: BrowserContext;

  test.afterEach(async () => {
    await phoneCtx?.close();
    await wideCtx?.close();
  });

  test("phone UA stacks the podium into one full-bleed column (non-sprint, R1a)", async ({
    browser,
  }) => {
    phoneCtx = await browser.newContext({ ...devices["iPhone 14"] });
    const page = await phoneCtx.newPage();
    await signIn(page, "portrait-race");
    await page.goto("/reveal");
    const link = nonSprintRaceLink(page);
    await expect(link, "no non-sprint 'Race' reveal found in fixture data").toHaveCount(
      1,
    );
    await link.click();
    await page.waitForURL(/\/reveal\/[^/]+$/);
    await page.waitForLoadState("networkidle");

    // R3: exactly one podium container — proves only one choreography (the
    // portrait one) mounted, never both.
    const podiums = page.locator("[data-podium]");
    await expect(podiums).toHaveCount(1);

    // 3 cards for a non-sprint event, stacked (identical left edge).
    const cards = page.locator("[data-podium-card]");
    await expect(cards).toHaveCount(3);
    const lefts = await cards.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size, "portrait cards must share a left edge").toBe(1);

    const { sw, cw } = await measureNoOverflow(page);
    expect(sw).toBeLessThanOrEqual(cw + 1);

    // Not required by any R1–R6 resolution — extra evidence beyond the two
    // mandatory sprint screenshots, showing the 3-card stacked shape too.
    await waitForPodiumSettled(page);
    await waitForFriendCascadeSettled(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "non-sprint-race-portrait.png"),
      fullPage: true,
    });
  });

  test("wide UA keeps the three-across podium (non-sprint, R1a)", async ({
    browser,
  }) => {
    wideCtx = await browser.newContext({ ...devices["Desktop Chrome"] });
    const page = await wideCtx.newPage();
    await signIn(page, "wide-race");
    await page.goto("/reveal");
    const link = nonSprintRaceLink(page);
    await expect(link, "no non-sprint 'Race' reveal found in fixture data").toHaveCount(
      1,
    );
    await link.click();
    await page.waitForURL(/\/reveal\/[^/]+$/);
    await page.waitForLoadState("networkidle");

    const podiums = page.locator("[data-podium]");
    await expect(podiums).toHaveCount(1);

    const cards = page.locator("[data-podium-card]");
    await expect(cards).toHaveCount(3);
    const lefts = await cards.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size, "wide cards must sit side by side").toBe(3);

    // Extra evidence (not required by any R1–R6 resolution): the desktop
    // 3-across shape, for visual comparison against the portrait screenshots.
    await waitForPodiumSettled(page);
    await waitForFriendCascadeSettled(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "non-sprint-race-wide.png"),
      fullPage: true,
    });
  });

  /**
   * R1(b) + R1(c): a sprint reveal is a supported shape, not an edge case —
   * it renders exactly ONE podium card (visualOrder = [0]), and it must be
   * full-bleed and overflow-free in portrait just like the 3-card path.
   * Covers both sprint session types the local fixture data has
   * (sprint_quali AND sprint_race — R1(c) requires portrait screenshots of
   * both), and saves a screenshot of each into the evidence directory.
   */
  for (const [tag, linkFn, shotName] of [
    ["sprint_quali", sprintQualiLink, "sprint-quali-portrait.png"],
    ["sprint_race", sprintRaceLink, "sprint-race-portrait.png"],
  ] as const) {
    test(`sprint (${tag}) renders exactly one full-bleed podium card in portrait (R1b/R1c)`, async ({
      browser,
    }) => {
      phoneCtx = await browser.newContext({ ...devices["iPhone 14"] });
      const page = await phoneCtx.newPage();
      await signIn(page, `portrait-${tag}`);
      await page.goto("/reveal");
      const link = linkFn(page);
      await expect(link, `no ${tag} reveal found in fixture data`).toHaveCount(1);
      await link.click();
      await page.waitForURL(/\/reveal\/[^/]+$/);
      await page.waitForLoadState("networkidle");

      const podiums = page.locator("[data-podium]");
      await expect(podiums).toHaveCount(1);

      const cards = page.locator("[data-podium-card]");
      await expect(cards).toHaveCount(1);
      // Settle the flip choreography before measuring/screenshotting — see
      // waitForPodiumSettled's doc comment for why this can't be skipped.
      await waitForPodiumSettled(page);

      const cardBox = await cards.first().boundingBox();
      const containerBox = await podiums.first().boundingBox();
      expect(cardBox, "sprint podium card has no bounding box").not.toBeNull();
      expect(containerBox, "[data-podium] container has no bounding box").not.toBeNull();
      // "Full-bleed" — the single card fills the whole podium container's
      // single grid column, not a squeezed 1-of-3 column. (The container
      // itself sits inside the page's own gutter padding, same as every
      // other section on the page, so the comparison is against the
      // container — not the raw viewport width.)
      expect(cardBox!.width).toBeGreaterThanOrEqual(containerBox!.width - 4);

      const { sw, cw } = await measureNoOverflow(page);
      expect(sw).toBeLessThanOrEqual(cw + 1);

      await waitForFriendCascadeSettled(page);
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, shotName),
        fullPage: true,
      });
    });
  }

  /**
   * R6 — reduced motion is a real audience, not a fallback. StaticHero (the
   * prefers-reduced-motion path) must get the same portrait treatment as
   * the cinematic path, verified with a real `emulateMedia` at a phone
   * viewport rather than by reading the diff.
   */
  test("reduced motion at a phone viewport renders StaticHero with portrait sizing intact (R6)", async ({
    browser,
  }) => {
    phoneCtx = await browser.newContext({ ...devices["iPhone 14"] });
    const page = await phoneCtx.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page, "reduced-motion");
    await page.goto("/reveal");
    const link = nonSprintRaceLink(page);
    await expect(link).toHaveCount(1);
    await link.click();
    await page.waitForURL(/\/reveal\/[^/]+$/);
    await page.waitForLoadState("networkidle");

    // The CinematicHero-only "Replay" button proves which hero mounted.
    // Its absence, plus the static heading text, proves StaticHero mounted.
    await expect(
      page.getByRole("button", { name: "Replay reveal animation" }),
    ).toHaveCount(0);
    await expect(page.getByText("GRAND PRIX")).toBeVisible();

    // Portrait clamp: clamp(40px, 13vw, 96px) at a 390px-wide iPhone 14
    // viewport evaluates to 13vw = 50.7px — inside the clamp's floor/ceiling,
    // so this pins the actual formula rather than merely "some font-size".
    const h1FontPx = await page
      .locator("h1")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const viewportWidth = page.viewportSize()!.width;
    const expectedPx = (13 / 100) * viewportWidth;
    expect(Math.abs(h1FontPx - expectedPx)).toBeLessThan(1);

    const { sw, cw } = await measureNoOverflow(page);
    expect(sw).toBeLessThanOrEqual(cw + 1);

    // Podium underneath is unaffected by reduced motion — still one
    // full-bleed stacked column for the non-sprint race event.
    await expect(page.locator("[data-podium]")).toHaveCount(1);
    const cards = page.locator("[data-podium-card]");
    await expect(cards).toHaveCount(3);
    const lefts = await cards.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().left)),
    );
    expect(new Set(lefts).size).toBe(1);
  });

  /**
   * R4 — timing must not fork. PODIUM_BASE_DELAY / PODIUM_STAGGER /
   * PODIUM_DUR stay one shared source of truth; portrait only changes
   * geometry/type scale. This programmatically asserts the acceptance test
   * from the brief's Step 5 hand-check item 4 ("total runtime matches a
   * desktop viewer's within ~0.2s") by measuring, from navigation to the
   * moment the LAST (P1) podium card's flip transition finishes, in both a
   * phone-portrait and a desktop-wide context, and diffing the two
   * elapsed durations.
   */
  test("portrait and wide podium timelines finish within ~0.2s of each other (R4)", async ({
    browser,
  }) => {
    async function measureRuntimeMs(
      device: Parameters<typeof browser.newContext>[0],
      tag: string,
    ): Promise<number> {
      const ctx = await browser.newContext(device);
      const page = await ctx.newPage();
      await signIn(page, tag);
      await page.goto("/reveal");
      const link = nonSprintRaceLink(page);
      await expect(link).toHaveCount(1);
      const t0 = Date.now();
      await link.click();
      await page.waitForURL(/\/reveal\/[^/]+$/);
      // The moment every card settles is PODIUM_BASE_DELAY + 2*PODIUM_STAGGER
      // + PODIUM_DUR after mount (P1 lands last) — identical in both variants
      // because Task 15 changes geometry only, never PODIUM_BASE_DELAY /
      // PODIUM_STAGGER / PODIUM_DUR.
      await waitForPodiumSettled(page);
      const elapsed = Date.now() - t0;
      await ctx.close();
      return elapsed;
    }

    const portraitMs = await measureRuntimeMs(
      { ...devices["iPhone 14"] },
      "runtime-portrait",
    );
    const wideMs = await measureRuntimeMs(
      { ...devices["Desktop Chrome"] },
      "runtime-wide",
    );

    expect(
      Math.abs(portraitMs - wideMs),
      `portrait ${portraitMs}ms vs wide ${wideMs}ms — PODIUM_* timing constants must not fork between variants`,
    ).toBeLessThan(200);
  });
});
