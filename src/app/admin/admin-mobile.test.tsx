// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AdminMobile,
  type AdminEventRowDatum,
  type AdminStatusTile,
} from "./admin-mobile";

// `./actions` is a "use server" module whose transitive imports reach
// next/headers; AdminMobile only ever hands the action reference to
// RevealButton, so a stub keeps this a pure render test.
vi.mock("./actions", () => ({ revealEventAction: vi.fn() }));

// RevealButton is a client island that calls useRouter; jsdom has no app
// router mounted.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const tile = (label: string): AdminStatusTile => ({
  label,
  value: "04:00 UTC",
  valueColor: "var(--success)",
  meta: `${label} · scheduled`,
});

const ev = (
  round: number,
  over: Partial<AdminEventRowDatum> = {},
): AdminEventRowDatum => ({
  round,
  name: `Round ${round}`,
  date: "APR 19",
  stateLabel: "Revealed",
  stateColor: "var(--success)",
  needsAction: false,
  primaryAction: false,
  picksLine: "Picks 10",
  actionHref: `/reveal/e${round}`,
  actionLabel: "View reveal",
  revealEventId: null,
  ...over,
});

const TILES = ["sync-f1-data", "fetch-results"].map(tile);

describe("AdminMobile", () => {
  it("renders only below the fork", () => {
    const { container } = render(
      <AdminMobile attentionCount={0} tiles={TILES} events={[ev(1)]} />,
    );
    expect(container.firstElementChild!.className).toContain("md:hidden");
  });

  // Departure 1: the artboard's Cron/OpenF1/Friends/Picks tiles carry the
  // four production cron paths instead, because "Friends: 10 active" is not
  // loaded on this route. The 2x2 anatomy is the artboard's.
  it("lays the cron paths out 2-up with the status colour on the value", () => {
    const { container } = render(
      <AdminMobile attentionCount={0} tiles={TILES} events={[ev(1)]} />,
    );
    const grid = screen.getByText("sync-f1-data").closest("div")!.parentElement!;
    expect(grid.className).toContain("grid-cols-2");
    const value = container.querySelector<HTMLElement>(
      '[style*="font-size: 17px"]',
    )!;
    expect(value.style.color).toBe("var(--success)");
  });

  // A row needing a decision gets the warning stripe as an INSET box-shadow
  // — CLAUDE.md bans left-border stripes on cards and this is the sanctioned
  // mechanism (a real border would also shift the row's 20px gutter by 3px).
  it("marks the action row with an inset warning stripe, never a border", () => {
    const { container } = render(
      <AdminMobile
        attentionCount={1}
        tiles={TILES}
        events={[
          ev(5, {
            needsAction: true,
            primaryAction: true,
            actionLabel: "Enter results →",
          }),
        ]}
      />,
    );
    const li = container.querySelector<HTMLElement>("li")!;
    expect(li.style.boxShadow).toContain("inset");
    expect(li.style.boxShadow).toContain("var(--warning)");
    expect(li.style.borderLeft).toBe("");
  });

  // Departure 2: one button per action row, not the artboard's paired
  // ENTER RESULTS / FETCH OPENF1 — there is no /admin-level OpenF1 fetch, so
  // both buttons would point at the same round page.
  it("gives the action row exactly one button", () => {
    render(
      <AdminMobile
        attentionCount={1}
        tiles={TILES}
        events={[
          ev(5, {
            needsAction: true,
            primaryAction: true,
            actionLabel: "Enter results →",
          }),
        ]}
      />,
    );
    const cta = screen.getByRole("link", { name: /Enter results/i });
    expect(cta.className).toContain("h-[52px]");
    expect(screen.queryByText(/Fetch OpenF1/i)).toBeNull();
  });

  // Local admin state routinely has eight or nine rounds awaiting results.
  // One accent fill per row made the screen a wall of red, against both the
  // mobile design system ("one accent-filled button per screen") and
  // .impeccable.md's ~10% accent budget. Only the head of the queue is
  // accent-filled; the rest are surface-toned 46px.
  it("accent-fills only the first action row's button", () => {
    const { container } = render(
      <AdminMobile
        attentionCount={3}
        tiles={TILES}
        events={[
          ev(9, { needsAction: true, primaryAction: true, actionLabel: "Enter results →" }),
          ev(8, { needsAction: true, actionLabel: "Enter results →" }),
          ev(7, { needsAction: true, actionLabel: "Enter results →" }),
        ]}
      />,
    );
    const buttons = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("li a"),
    );
    expect(buttons.length).toBe(3);
    expect(
      buttons.filter((b) => b.className.includes("bg-[color:var(--accent)]"))
        .length,
    ).toBe(1);
    expect(buttons[0].className).toContain("h-[52px]");
    expect(buttons[1].className).toContain("h-[46px]");
    expect(buttons[2].className).toContain("h-[46px]");
  });

  // Quiet rows carry no button in the artboard, but every round must still
  // be reachable on a phone — so the whole row is the link, with a chevron
  // as the affordance and a 44px floor on the tap target.
  it("makes a quiet row a link with a 44px floor", () => {
    const { container } = render(
      <AdminMobile attentionCount={0} tiles={TILES} events={[ev(3)]} />,
    );
    const link = container.querySelector<HTMLAnchorElement>("li a")!;
    expect(link.getAttribute("href")).toBe("/reveal/e3");
    expect(link.style.minHeight).toBe("44px");
    expect(link.textContent).toContain("›");
  });

  // An `entered` round reveals in ONE tap on a phone too: the reveal is the
  // product, and routing it through the per-event page would cost a tap for
  // styling reasons alone.
  it("keeps the one-tap reveal on an entered round", () => {
    render(
      <AdminMobile
        attentionCount={1}
        tiles={TILES}
        events={[
          ev(4, {
            needsAction: true,
            primaryAction: true,
            revealEventId: "evt-4",
            actionLabel: "Reveal to group →",
          }),
        ]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Reveal to group/i });
    expect(btn.className).toContain("h-[52px]");
    expect(screen.queryByRole("link", { name: /Reveal to group/i })).toBeNull();
  });

  it("pads the round number to two digits in the row eyebrow", () => {
    render(<AdminMobile attentionCount={0} tiles={TILES} events={[ev(7)]} />);
    expect(screen.getByText(/^R07 · APR 19$/)).toBeInTheDocument();
  });
});
