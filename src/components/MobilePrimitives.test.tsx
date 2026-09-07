// @vitest-environment jsdom
/**
 * MP1–MP6 — the 390pt primitives (PR-1).
 *
 * These assert the *contract* the mobile screens (PRs 2–6) will lean on, not
 * pixel values for their own sake: the bleed cancels exactly the page gutter,
 * the hairline grid's rules are gaps, the disclosure row stays a tap target
 * with an inset accent (never a border-left), and no primitive smuggles in a
 * radius or a literal colour.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MobBleed,
  MobButton,
  MobDisclosureRow,
  MobEyebrow,
  MobHairlineGrid,
  MobSectionHead,
} from "./MobilePrimitives";

describe("MobilePrimitives", () => {
  it("MP1: MobBleed cancels the 20px page gutter and appends caller classes", () => {
    const { container } = render(
      <MobBleed className="border-y border-[color:var(--border)]">x</MobBleed>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/(^|\s)-mx-5(\s|$)/);
    expect(el.className).toContain("border-y");
  });

  it("MP2: MobHairlineGrid paints its rules as 1px gaps over --border", () => {
    const { container } = render(
      <MobHairlineGrid cols={4}>
        <div>a</div>
      </MobHairlineGrid>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/(^|\s)grid(\s|$)/);
    expect(el.className).toMatch(/(^|\s)gap-px(\s|$)/);
    expect(el.className).toContain("bg-[color:var(--border)]");
    expect(el.style.gridTemplateColumns).toBe("repeat(4, minmax(0,1fr))");
  });

  it("MP2b: MobHairlineGrid tracks the requested column count", () => {
    const { container } = render(
      <MobHairlineGrid cols={2}>
        <div>a</div>
      </MobHairlineGrid>,
    );
    expect(
      (container.firstElementChild as HTMLElement).style.gridTemplateColumns,
    ).toBe("repeat(2, minmax(0,1fr))");
  });

  it("MP3: MobDisclosureRow is a native <details> with a tap-sized summary", () => {
    const { container } = render(
      <MobDisclosureRow summary={<span>Race</span>}>panel</MobDisclosureRow>,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.className).toContain("group");
    expect(details.open).toBe(false);

    const summary = details.querySelector("summary") as HTMLElement;
    expect(summary).not.toBeNull();
    // Native marker is stripped both ways, or the row grows a stray triangle.
    expect(summary.className).toMatch(/(^|\s)list-none(\s|$)/);
    expect(summary.className).toContain("[&::-webkit-details-marker]:hidden");
    // WCAG 2.5.5 — the whole row is the target.
    expect(Number(summary.style.minHeight.replace("px", ""))).toBeGreaterThanOrEqual(44);
    expect(summary.className).toMatch(/(^|\s)px-5(\s|$)/);
  });

  it("MP3b: MobDisclosureRow swaps +/− via group-open, with the accent as an inset shadow", () => {
    const { container } = render(
      <MobDisclosureRow summary={<span>Race</span>} open>
        panel
      </MobDisclosureRow>,
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);

    const summary = details.querySelector("summary") as HTMLElement;
    expect(summary.className).toContain("group-open:bg-[color:var(--surface-2)]");
    // The sanctioned idiom: an INSET box-shadow, never a border-left (banned
    // by CLAUDE.md, and a real border would shift the row's 20px gutter).
    expect(summary.className).toContain(
      "group-open:shadow-[inset_3px_0_0_0_var(--accent)]",
    );
    expect(summary.className).not.toMatch(/border-l/);
    expect(summary.getAttribute("style") ?? "").not.toMatch(/border-left/);

    const plus = screen.getByText("+");
    const minus = screen.getByText("−");
    expect(plus.className).toContain("group-open:hidden");
    expect(minus.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(minus.className).toContain("group-open:inline");
    // Decorative — the <summary> already announces expanded/collapsed.
    expect(plus).toHaveAttribute("aria-hidden");
    expect(minus).toHaveAttribute("aria-hidden");
  });

  it("MP3c: MobDisclosureRow's panel background is overridable", () => {
    const { container } = render(
      <MobDisclosureRow
        summary={<span>Race</span>}
        panelClassName="bg-[color:var(--surface)]"
        minHeight={52}
      >
        panel
      </MobDisclosureRow>,
    );
    const summary = container.querySelector("summary") as HTMLElement;
    expect(summary.style.minHeight).toBe("52px");
    const panel = container.querySelector("details > div") as HTMLElement;
    expect(panel.className).toContain("bg-[color:var(--surface)]");
  });

  it("MP4: MobButton renders <a> with href and <button> without", () => {
    const { container: linkC } = render(
      <MobButton href="/dashboard/predict">Predict</MobButton>,
    );
    const a = linkC.querySelector("a") as HTMLAnchorElement;
    expect(a).not.toBeNull();
    expect(a).toHaveAttribute("href", "/dashboard/predict");
    expect(linkC.querySelector("button")).toBeNull();

    const { container: btnC } = render(<MobButton>Lock in</MobButton>);
    const b = btnC.querySelector("button") as HTMLButtonElement;
    expect(b).not.toBeNull();
    // Never a naked submit inside someone else's <form> by accident.
    expect(b).toHaveAttribute("type", "button");
    expect(btnC.querySelector("a")).toBeNull();
  });

  it("MP4b: MobButton sizes are 52 full / 46 paired, and disabled dims", () => {
    const { container: full } = render(<MobButton>Go</MobButton>);
    expect(
      (full.querySelector("button") as HTMLElement).className,
    ).toContain("h-[52px]");

    const { container: paired } = render(
      <MobButton size="paired">Go</MobButton>,
    );
    const pairedBtn = paired.querySelector("button") as HTMLElement;
    expect(pairedBtn.className).toContain("h-[46px]");
    expect(pairedBtn.className).toContain("disabled:opacity-40");
    expect(pairedBtn.className).toMatch(/(^|\s)w-full(\s|$)/);
  });

  it("MP4c: every MobButton tone resolves to tokens, never a literal colour", () => {
    const tones = {
      accent: ["bg-[color:var(--accent)]", "text-[color:var(--fg)]"],
      ghost: ["border-[color:var(--border)]", "text-[color:var(--fg-muted)]"],
      surface: [
        "bg-[color:var(--surface-2)]",
        "border-[color:var(--border)]",
        "text-[color:var(--fg)]",
      ],
    } as const;

    for (const [tone, expected] of Object.entries(tones)) {
      const { container } = render(
        <MobButton tone={tone as keyof typeof tones}>Go</MobButton>,
      );
      const cls = (container.querySelector("button") as HTMLElement).className;
      for (const token of expected) expect(cls).toContain(token);
      // No hex, no Tailwind numeric palette shade.
      expect(cls).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
      expect(cls).not.toMatch(/-(?:50|[1-9]00)(?:\/|\s|$)/);
    }
  });

  it("MP5: MobSectionHead titles in Titillium and marks meta tabular", () => {
    const { container } = render(
      <MobSectionHead title="Scoring sessions" meta="4 · picks required" />,
    );
    const h2 = container.querySelector("h2") as HTMLElement;
    // The literal string the global `[style*="Boldonse"]` selector matches.
    expect(h2.getAttribute("style")).toContain("var(--font-boldonse)");
    expect(h2).toHaveTextContent("Scoring sessions");

    const meta = screen.getByText("4 · picks required");
    expect(meta).toHaveAttribute("data-tabular");
    expect(meta.className).toContain("text-[color:var(--fg-subtle)]");

    // Meta is optional — omitting it renders no empty sibling.
    const { container: bare } = render(<MobSectionHead title="Only" />);
    expect(bare.querySelectorAll("p")).toHaveLength(0);
  });

  it("MP5b: MobEyebrow is tabular, uppercase, and takes a token colour override", () => {
    render(<MobEyebrow color="var(--accent)">Next up</MobEyebrow>);
    const el = screen.getByText("Next up");
    expect(el).toHaveAttribute("data-tabular");
    expect(el.className).toContain("uppercase");
    expect(el.style.color).toBe("var(--accent)");
    expect(el.style.letterSpacing).toBe("0.16em");
  });

  it("MP6: no primitive emits a border-radius, in class or style", () => {
    const { container } = render(
      <div>
        <MobEyebrow>Eyebrow</MobEyebrow>
        <MobSectionHead title="Title" meta="Meta" />
        <MobBleed>bleed</MobBleed>
        <MobHairlineGrid cols={3}>
          <div>cell</div>
        </MobHairlineGrid>
        <MobDisclosureRow summary={<span>row</span>}>panel</MobDisclosureRow>
        <MobButton>Button</MobButton>
        <MobButton href="/dashboard">Link</MobButton>
      </div>,
    );
    // No radius anywhere: circles are avatars only (CLAUDE.md / .impeccable.md).
    expect(container.innerHTML).not.toMatch(/rounded-/);
    expect(container.innerHTML).not.toMatch(/border-radius/i);
    expect(container.innerHTML).not.toMatch(/borderRadius/);
  });
});
