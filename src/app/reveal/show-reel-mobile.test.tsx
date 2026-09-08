// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pillFill } from "@/lib/reveal/pillFill";
import {
  ShowReelMobile,
  type ShowReelRound,
  type ShowReelSession,
} from "./show-reel-mobile";

/**
 * /reveal Show Reel, 390pt — the session-pill row (review bundle R-2).
 *
 * The acceptance checks the review names, pinned: a sprint round renders four
 * pills and a normal round two, the round total equals the sum of its pills,
 * and the sprint race is labelled `S` (never `SR`). The pill treatment —
 * accent outline, graded accent fill — is asserted too, because "falls back
 * to a `--border` outline or a `--surface-2` fill" is on the handoff's drift
 * list and is the kind of thing a later refactor does silently.
 */

const session = (
  sessionType: ShowReelSession["sessionType"],
  pillLabel: string,
  points: number | null,
  perfect = false,
): ShowReelSession => ({
  id: `${sessionType}-id`,
  sessionType,
  pillLabel,
  points,
  perfect,
});

/** Sprint weekend: SQ · S · Q · R, four revealed sessions. */
const SPRINT_ROUND: ShowReelRound = {
  round: 2,
  title: "CHINA",
  circuit: "shanghai",
  date: "MAR 22",
  totalPoints: 6 + 5 + 4 + 18,
  perfect: true,
  podium: [{ pos: 1, code: "NOR", hex: "#FF8000" }],
  sessions: [
    session("sprint_quali", "SQ", 6),
    session("sprint_race", "S", 5),
    session("quali", "Q", 4),
    session("race", "R", 18, true),
  ],
};

/** Normal weekend: Q · R, two revealed sessions. */
const NORMAL_ROUND: ShowReelRound = {
  round: 3,
  title: "JAPAN",
  circuit: "suzuka",
  date: "APR 05",
  totalPoints: 4 + 11,
  perfect: false,
  podium: [{ pos: 1, code: "VER", hex: "#3671C6" }],
  sessions: [session("quali", "Q", 4), session("race", "R", 11)],
};

function renderReel(rounds: ShowReelRound[]) {
  return render(
    <ShowReelMobile
      season={2026}
      rounds={rounds}
      sessionCount={rounds.reduce((n, r) => n + r.sessions.length, 0)}
      perfectCount={rounds.filter((r) => r.perfect).length}
      totalScore={rounds.reduce((n, r) => n + r.totalPoints, 0)}
    />,
  );
}

/** The pills are the round card's cinematic links. */
function pillsOf(card: HTMLElement): HTMLAnchorElement[] {
  return Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href^="/reveal/"]'));
}

function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("article"));
}

describe("ShowReelMobile — R-2 session pills", () => {
  it("renders one pill per revealed session: 4 on a sprint weekend, 2 on a normal one", () => {
    const { container } = renderReel([SPRINT_ROUND, NORMAL_ROUND]);
    const [sprintCard, normalCard] = cards(container);
    expect(pillsOf(sprintCard)).toHaveLength(4);
    expect(pillsOf(normalCard)).toHaveLength(2);
  });

  it("labels the sprint race S, not SR", () => {
    const { container } = renderReel([SPRINT_ROUND]);
    const labels = pillsOf(cards(container)[0]).map(
      (a) => a.firstElementChild!.textContent,
    );
    expect(labels).toEqual(["SQ", "S", "Q", "R"]);
    expect(labels).not.toContain("SR");
  });

  it("shows a round total equal to the sum of its pills", () => {
    for (const round of [SPRINT_ROUND, NORMAL_ROUND]) {
      const { container } = renderReel([round]);
      const card = cards(container)[0];
      const fromPills = pillsOf(card)
        .map((a) => Number(a.lastElementChild!.textContent!.replace("+", "")))
        .reduce((a, b) => a + b, 0);
      expect(card.textContent).toContain(`+${round.totalPoints}`);
      expect(fromPills).toBe(round.totalPoints);
    }
  });

  it("uses the desktop pill treatment — accent outline, graded accent fill", () => {
    const { container } = renderReel([SPRINT_ROUND]);
    const pills = pillsOf(cards(container)[0]);
    for (const [i, pill] of pills.entries()) {
      const s = SPRINT_ROUND.sessions[i];
      expect(pill.style.border).toBe("1px solid var(--accent)");
      expect(pill.style.background).toContain(
        `var(--accent) ${pillFill(s.perfect, s.points)}%`,
      );
    }
    // 28 (perfect) · 18 (>=10 pts) · 10 (everything else) — the three tiers
    // must actually differ, or the "graded" fill is decorative.
    expect(pillFill(true, 18)).toBe(28);
    expect(pillFill(false, 11)).toBe(18);
    expect(pillFill(false, 4)).toBe(10);
  });

  it("keeps every pill at the 44px tap-target floor", () => {
    const { container } = renderReel([SPRINT_ROUND, NORMAL_ROUND]);
    for (const card of cards(container)) {
      for (const pill of pillsOf(card)) {
        expect(pill.style.minHeight).toBe("44px");
      }
    }
  });

  it("tints the session count on sprint weekends only", () => {
    const { container } = renderReel([SPRINT_ROUND, NORMAL_ROUND]);
    const [sprintCard, normalCard] = cards(container);
    const meta = (card: HTMLElement) =>
      Array.from(card.querySelectorAll<HTMLElement>("span")).find((el) =>
        /\d+ sessions?$/.test(el.textContent ?? ""),
      )!;
    expect(meta(sprintCard).textContent).toBe("4 sessions");
    expect(meta(sprintCard).style.color).toBe("var(--warning)");
    expect(meta(normalCard).textContent).toBe("2 sessions");
    expect(meta(normalCard).style.color).toBe("var(--fg-subtle)");
  });
});
