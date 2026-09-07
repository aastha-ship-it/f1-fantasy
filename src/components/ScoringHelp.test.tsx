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

/**
 * SH2 — the trigger's 780px fork (PR-1).
 *
 * Same inline-padding trap SH1 hit, one level up: the trigger's padding was
 * `style`, so no breakpoint could turn the desktop pill into the handoff's
 * 32×32 mobile box. Moving it to classes is what makes the fork possible, so
 * the "not inline" assertion is the load-bearing one here.
 */
describe("ScoringHelp trigger fork (PR-1)", () => {
  function trigger(container: HTMLElement) {
    const btn = container.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="dialog"]',
    );
    if (!btn) throw new Error("trigger not rendered");
    return btn;
  }

  it("SH2: trigger padding is classes, base is a 32x32 box, md: restores the pill", () => {
    const { container } = render(<ScoringHelp />);
    const btn = trigger(container);

    // Inline padding wins over every class and every media query.
    expect(btn.style.padding).toBe("");
    expect(btn.style.paddingLeft).toBe("");

    // Base (<780) — the canvas's 32×32 square, matching the ⏻ beside it.
    expect(btn.className).toMatch(/(^|\s)size-8(\s|$)/);
    expect(btn.className).toMatch(/(^|\s)p-0(\s|$)/);
    expect(btn.className).toMatch(/(^|\s)justify-center(\s|$)/);
    expect(btn.className).toContain("text-[color:var(--fg-muted)]");

    // >=780 — exactly the original pill.
    expect(btn.className).toMatch(/(^|\s)md:size-auto(\s|$)/);
    expect(btn.className).toMatch(/(^|\s)md:px-\[var\(--space-md\)\](\s|$)/);
    expect(btn.className).toMatch(/(^|\s)md:py-\[var\(--space-xs\)\](\s|$)/);
    expect(btn.className).toContain("md:text-[color:var(--fg-subtle)]");

    // Border/background/type scale are identical at both widths, so they stay
    // inline where they already were.
    expect(btn.style.border).toBe("1px solid var(--border)");
    expect(btn.style.fontSize).toBe("11px");
  });

  it("SH2b: circled glyph is md-only, plain ? is mobile-only, aria-label intact", () => {
    const { container } = render(<ScoringHelp />);
    const btn = trigger(container);
    const glyphs = Array.from(btn.children).filter(
      (el) => el.getAttribute("aria-hidden") === "true",
    ) as HTMLElement[];
    expect(glyphs).toHaveLength(2);

    const plain = glyphs.find((g) => g.style.borderRadius === "")!;
    const circled = glyphs.find((g) => g.style.borderRadius === "50%")!;

    expect(plain.className).toMatch(/(^|\s)md:hidden(\s|$)/);
    expect(plain.style.fontSize).toBe("12px");
    expect(plain).toHaveAttribute("data-tabular");

    // `display` had to leave the inline style or `hidden` could never win.
    expect(circled.style.display).toBe("");
    expect(circled.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(circled.className).toContain("md:inline-flex");

    // The accessible name never depended on either glyph.
    expect(btn).toHaveAttribute("aria-label", "How scoring works");
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    const label = container.querySelector("button > span:last-child")!;
    expect(label.className).toContain("lg:inline");
  });
});
