import { trackImg, trackRatio, trackPath } from "@/lib/design/tracks";

/**
 * Circuit silhouette (design_handoff_phase11/ADDENDUM §B).
 *
 * Primary render is a white-on-transparent PNG drawn via CSS `mask-image`
 * so it recolours by `backgroundColor` (the `stroke` prop — name kept for
 * call-site compatibility). Circuits with no shipped PNG fall back to the
 * legacy 200×120 SVG path; anything still unmapped renders a rounded-rect
 * placeholder, so this component never returns null.
 *
 * `circuit` accepts a Jolpica `circuit_id` ("miami") or an OpenF1
 * `circuit_short_name` ("Sakhir", "Monte Carlo") — alias-resolved.
 * `strokeWidth` only applies to the SVG fallback (no-op for the mask).
 */
export function TrackDiagram({
  circuit,
  size = 200,
  height,
  stroke = "currentColor",
  strokeWidth = 2,
  className,
  style,
}: {
  circuit: string | null | undefined;
  size?: number;
  /**
   * When supplied (design_handoff_standings § PR-2 WinnerCard), the rendered
   * tile is exactly `height` pixels tall and the width is derived from the
   * per-circuit aspect ratio. Lets multiple cards align tracks on a uniform
   * vertical band regardless of circuit shape. When omitted, behaviour is
   * unchanged: `size` is the width and height is derived from the ratio.
   */
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const img = trackImg(circuit);
  const label = circuit ? `${circuit} circuit layout` : "track diagram";

  /*
   * This component deliberately contributes NO responsive classes of its own
   * (Task 11, fix round 1). That is a measured conclusion, not an oversight.
   *
   * The cropped `/dashboard` hero was never this component's bug. A box with
   * a definite `width` contributes that width as its min-content size, so the
   * hero's ancestor grid track sized to 484px inside a 327px section and
   * `overflow: hidden` cropped the result. Two component-local fixes were
   * built and measured, and both were rejected. Both are named in PROSE
   * below, never spelled as utility class names: Tailwind scans every
   * non-gitignored file under `src/` unconditionally — globals.css's
   * `@source not` excludes only the doc tree — so a class name written in a
   * comment ships that rule to users with no call site anywhere. This comment
   * used to re-arm the exact leak globals.css warns about two lines above its
   * own `@source not`; verified in the built CSS before the fix.
   *   - a max-width:100% clamp with a max-width:none reset at the fork —
   *     inert. Ablation at 375px with the class removed: the hero still
   *     resolves to 261px with `max-width: none`, because the diagram is a
   *     flex item and `flex-shrink` already does the clamping. A dead class
   *     on 44 elements.
   *   - a width of min(100%, <the component's own width custom property>) —
   *     fixed the hero (420 -> 305.86px) but collapsed every diagram whose
   *     parent is shrink-to-fit to 0px (the four round tracks inside a
   *     display-block Link). See
   *     task-11-evidence/rejected-shrinkwidth-measurements.json.
   * The real fix was one class on the hero's own grid in
   * `src/app/dashboard/page.tsx`; with it the hero resolves to 261px at 375px
   * and nothing here is needed.
   *
   * `className` is therefore passed straight through — but it is caller-
   * supplied and consumed on BOTH render branches, so anything added here in
   * future must be MERGED with it, never substituted. TrackDiagram.test.tsx
   * locks that on both branches.
   */

  if (img) {
    const ratio = trackRatio(circuit);
    const w = height != null ? height * ratio : size;
    const h = height != null ? height : size / ratio;
    return (
      <div
        role="img"
        aria-label={label}
        className={className}
        style={{
          width: w,
          height: h,
          backgroundColor: stroke,
          WebkitMaskImage: `url(${img})`,
          maskImage: `url(${img})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          ...style,
        }}
      />
    );
  }

  const d = trackPath(circuit);
  // SVG fallback uses the legacy 200×120 viewBox aspect ratio.
  const FALLBACK_RATIO = 200 / 120;
  const svgW = height != null ? height * FALLBACK_RATIO : size;
  const svgH = height != null ? height : (size * 120) / 200;
  return (
    <svg
      viewBox="0 0 200 120"
      width={svgW}
      height={svgH}
      role="img"
      aria-label={label}
      className={className}
      style={style}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d ? (
        <path d={d} />
      ) : (
        <rect x="20" y="20" width="160" height="80" rx="40" opacity="0.4" />
      )}
    </svg>
  );
}
