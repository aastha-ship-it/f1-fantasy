// @vitest-environment jsdom
/**
 * SH1 — `<ScoringHelp>` modal padding fork (Task 11).
 *
 * The dialog shell is already fluid (`min(92vw, 720px)`), but its header and
 * body carried `var(--space-2xl)` (32px) padding as *inline* style, which no
 * breakpoint can reach — 64px of horizontal chrome out of a 345px dialog at
 * 375px. The fork moves both to classes so the padding can relax below the
 * 780px fork and restore exactly at `md:`.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ScoringHelp } from "./ScoringHelp";

function dialogCard(container: HTMLElement) {
  const dlg = container.querySelector("dialog");
  if (!dlg) throw new Error("dialog not rendered");
  const card = dlg.firstElementChild as HTMLElement;
  return {
    header: card.children[0] as HTMLElement,
    body: card.children[1] as HTMLElement,
  };
}

describe("ScoringHelp modal padding fork (Task 11)", () => {
  it("SH1: header and body padding are classes, not inline — relaxed base, md: restoration", () => {
    const { container } = render(<ScoringHelp />);
    const { header, body } = dialogCard(container);

    // Inline padding wins over every class and every media query.
    expect(header.style.padding).toBe("");
    expect(body.style.padding).toBe("");

    // Base (below the 780px fork) — one step down from --space-2xl.
    expect(header.className).toMatch(/(^|\s)p-\[var\(--space-lg\)\](\s|$)/);
    expect(body.className).toMatch(/(^|\s)p-\[var\(--space-lg\)\](\s|$)/);

    // Desktop restoration — exactly the original 24px/32px.
    expect(header.className).toMatch(
      /(^|\s)md:px-\[var\(--space-2xl\)\](\s|$)/,
    );
    expect(header.className).toMatch(/(^|\s)md:py-\[var\(--space-xl\)\](\s|$)/);
    expect(body.className).toMatch(/(^|\s)md:p-\[var\(--space-2xl\)\](\s|$)/);
  });
});
