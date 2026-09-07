import Link from "next/link";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

/**
 * Shared mobile primitives — the 390pt design system, extracted.
 *
 * Canvas reference: `design/design_handoff_mobile/design/screens-mobile.jsx`
 * lines 1–127 (`MobEyebrow`, `MobSectionHead`, `MobButton`, `MobBleed`) plus
 * the disclosure-row idiom in `screens-mobile-b.jsx`. Each of these appears
 * 11–21× across the mobile artboards, which is why they are components rather
 * than copied class strings.
 *
 * CONTRACT — mobile tree only. These carry NO `md:` classes: their values are
 * the phone values, full stop. Render them inside a `md:hidden` subtree (or a
 * route that only exists below the fork). If you need one at desktop width,
 * that is a different component, not a breakpoint bolted on here — the whole
 * point of the 780px fork is that the two trees do not negotiate.
 *
 * Sizing/spacing constants are the handoff's raw numbers (20px page gutter =
 * `px-5`/`-mx-5` on Tailwind's default 0.25rem scale). Do NOT introduce a
 * `--spacing-*` token for them: that namespace hijacks every Tailwind utility
 * of the same name (see CLAUDE.md footguns).
 *
 * Server components on purpose — none of them needs state. `MobDisclosureRow`
 * is a native `<details>` for exactly the reason `DriverStandingsRowMobile`
 * is: zero JS, free keyboard + screen-reader semantics, callers stay server
 * components.
 */

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";

function join(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */

/**
 * Mono 9 / 0.16em / uppercase caption that labels the block under it.
 *
 * `color` exists because a handful of artboards tint the eyebrow accent-red
 * to mark the live/urgent block; everything else takes the default
 * `--fg-subtle`. Pass a token (`var(--accent)`), never a literal.
 */
export function MobEyebrow({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <p
      className={join("uppercase text-[color:var(--fg-subtle)]", className)}
      data-tabular
      style={{ fontSize: 9, letterSpacing: "0.16em", color }}
    >
      {children}
    </p>
  );
}

/**
 * Section header — display title on the left, optional mono meta on the
 * right, baseline-aligned so the 16px title and 9px meta sit on one line.
 */
export function MobSectionHead({
  title,
  meta,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={join(
        "mb-3 flex items-baseline justify-between gap-3",
        className,
      )}
    >
      {/* `uppercase` is explicit rather than inherited. The global
          `.font-display, [style*="Boldonse"]` rule in globals.css is meant to
          supply it, but that attribute selector is case-sensitive and every
          call site emits `var(--font-boldonse)` in lowercase, so it matches
          nothing and never has (verified in-browser: `el.matches` is false
          and computed text-transform is `none`). Every display string that
          reads as uppercase today does so because its call site typed it that
          way or called .toUpperCase(). Section-head titles are prose the
          caller passes in, so they have to say it here. */}
      <h2
        className="uppercase"
        style={{ fontFamily: DISPLAY_FONT, fontSize: 16, lineHeight: 1 }}
      >
        {title}
      </h2>
      {meta !== undefined && meta !== null && (
        <p
          className="uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.1em" }}
        >
          {meta}
        </p>
      )}
    </div>
  );
}

/**
 * Cancels the 20px page gutter so a block can run edge-to-edge.
 *
 * Full-bleed rows and 1px hairlines that stop 20px short of the screen edge
 * are the single loudest "this is a scaled-down desktop page" tell, so the
 * handoff bleeds every list. `className` appends — callers add `border-y`,
 * a background, `overflow-hidden`.
 */
export function MobBleed({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={join("-mx-5", className)}>{children}</div>;
}

/**
 * N-column grid whose 1px gaps ARE the rules between cells.
 *
 * `gap-px` over a `--border`-coloured background paints every internal
 * hairline in one declaration — no per-cell `border-r`/`:last-child` reset,
 * and the lines stay exactly 1px at any DPR.
 *
 * Children MUST paint their own opaque background (`bg-[color:var(--surface)]`
 * or `--surface-2`), otherwise the border colour shows through and every cell
 * reads as filled. Outer border, when wanted, comes from the caller:
 * `className="border border-[color:var(--border)]"`.
 */
export function MobHairlineGrid({
  cols,
  children,
  className,
}: {
  /** Integer 2–5; the artboards never go wider on a 390pt screen. */
  cols: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={join("grid gap-px bg-[color:var(--border)]", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
    >
      {children}
    </div>
  );
}

/**
 * Tap-to-expand list row — lobby sessions, standings rows, league members.
 *
 * Native `<details>`/`<summary>`, matching `DriverStandingsRowMobile`: no
 * client component, no state, and the open/closed swap is pure CSS via
 * `group-open:`. The caller owns everything inside `summary` (they know their
 * own columns); this component owns the row box, the marker reset, the `+`/`−`
 * affordance and the open treatment.
 *
 * Open = `--surface-2` plus `inset 3px 0 0 0 var(--accent)`. That is an INSET
 * BOX-SHADOW, not a `border-left`: CLAUDE.md bans left-accent stripes on
 * cards, and the sanctioned exception is exactly this — a shadow that marks
 * the one row that matters, the same mechanism `MobileTabBar` uses for its
 * active tab. A real border would also reflow the row's 20px gutter by 3px.
 *
 * `minHeight` defaults to 60 (the handoff's row) and callers pass 52–68; it
 * must never go below 44 (tap target).
 */
export function MobDisclosureRow({
  summary,
  children,
  open,
  minHeight = 60,
  panelClassName,
  className,
}: {
  /** The collapsed row's content. Lay out your own columns inside it. */
  summary: ReactNode;
  children: ReactNode;
  /** SSR-expanded row (e.g. "your session"), maps to the `open` attribute. */
  open?: boolean;
  minHeight?: number;
  /** Panel background override — lobby wants `--surface`, not `--surface-2`. */
  panelClassName?: string;
  className?: string;
}) {
  return (
    <details
      className={join("group border-b border-[color:var(--border)]", className)}
      open={open}
    >
      <summary
        className="relative grid cursor-pointer list-none items-center gap-3 px-5 group-open:bg-[color:var(--surface-2)] group-open:shadow-[inset_3px_0_0_0_var(--accent)] [&::-webkit-details-marker]:hidden"
        style={{ minHeight, gridTemplateColumns: "minmax(0,1fr) auto" }}
      >
        {summary}
        {/* Two glyphs swapped by `group-open:` rather than one rotated one:
            `+`/`−` is what the artboards draw, and a rotation would need a
            character that reads as both states. Inside <summary> on purpose —
            only the first <summary> lands in <details>'s always-visible slot,
            so a marker outside it would vanish while collapsed. */}
        <span
          aria-hidden
          className="leading-none group-open:hidden"
          data-tabular
          style={{ fontSize: 11, color: "var(--fg-subtle)" }}
        >
          +
        </span>
        <span
          aria-hidden
          className="hidden leading-none group-open:inline"
          data-tabular
          style={{ fontSize: 11, color: "var(--fg-subtle)" }}
        >
          −
        </span>
      </summary>

      <div
        className={join(
          "bg-[color:var(--surface-2)] px-5 pb-4",
          panelClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}

type MobButtonTone = "accent" | "ghost" | "surface";
type MobButtonSize = "full" | "paired";

/**
 * `tone` maps to tokens only — no literals, no `-500` shades.
 *
 * NOTE (flagged in the PR-1 plan): the canvas puts `--fg` on the accent
 * button; every pre-mobile accent CTA in this app uses `text-black`. At 13px
 * this is ~3.3:1. Following the canvas here; one line to change back.
 */
const TONES: Record<MobButtonTone, string> = {
  accent: "bg-[color:var(--accent)] text-[color:var(--fg)]",
  ghost: "border border-[color:var(--border)] text-[color:var(--fg-muted)]",
  surface:
    "bg-[color:var(--surface-2)] border border-[color:var(--border)] text-[color:var(--fg)]",
};

/** 52 = the lone full-width primary; 46 = two buttons sharing a row. */
const SIZES: Record<MobButtonSize, string> = {
  full: "h-[52px]",
  paired: "h-[46px]",
};

const MOB_BUTTON_BASE =
  "grid w-full place-items-center uppercase disabled:opacity-40";

const MOB_BUTTON_STYLE: CSSProperties = {
  fontFamily: DISPLAY_FONT,
  fontSize: 13,
  letterSpacing: "0.04em",
};

type MobButtonOwn = {
  children: ReactNode;
  tone?: MobButtonTone;
  size?: MobButtonSize;
  className?: string;
};

type MobButtonAsLink = MobButtonOwn &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof MobButtonOwn | "style"> & {
    href: string;
  };

type MobButtonAsButton = MobButtonOwn &
  Omit<ComponentPropsWithoutRef<"button">, keyof MobButtonOwn | "style" | "href">;

/**
 * The mobile screens' one control shape: full-width, display-cased, 52 tall.
 *
 * Renders `next/link`'s `<Link>` when `href` is given and a `<button>`
 * otherwise, because half the artboard CTAs navigate ("View the reveal") and
 * half submit ("Lock in picks") — one visual, two elements, so callers never
 * hand-roll an anchor styled as a button.
 */
export function MobButton(props: MobButtonAsLink | MobButtonAsButton) {
  // Each branch destructures its own props rather than sharing one `rest`:
  // the union's two rests are different shapes, and `href` has to reach the
  // <Link> while never reaching the <button>.
  if ("href" in props) {
    const { children, tone = "accent", size = "full", className, ...rest } =
      props;
    return (
      <Link
        {...rest}
        className={join(MOB_BUTTON_BASE, SIZES[size], TONES[tone], className)}
        style={MOB_BUTTON_STYLE}
      >
        {children}
      </Link>
    );
  }

  const { children, tone = "accent", size = "full", className, ...rest } = props;
  return (
    // `type` first so a caller-supplied `type="submit"` still wins.
    <button
      type="button"
      {...rest}
      className={join(MOB_BUTTON_BASE, SIZES[size], TONES[tone], className)}
      style={MOB_BUTTON_STYLE}
    >
      {children}
    </button>
  );
}
