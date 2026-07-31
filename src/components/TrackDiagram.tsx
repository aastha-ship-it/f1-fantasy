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
   * Mobile width clamp (Task 11), released again at the 780px fork so the
   * desktop tree computes identically (verified: getComputedStyle width /
   * height / max-width byte-identical on all 44 diagrams rendered across
   * /dashboard, /dashboard/{lobby,predict,standings}, /reveal and
   * /dashboard/predict/round/13, at both 1024px and 1280px).
   *
   * `max-width` is a different property from the inline `width`, so a class
   * *can* constrain it; the inline `height` is untouchable from CSS and is
   * deliberately left alone — `mask-size: contain` and the SVG's default
   * `preserveAspectRatio` letterbox the silhouette inside a narrower box
   * rather than distorting it.
   *
   * Known limit, measured, not papered over: this is a safety net for
   * properly-constrained containers, and on today's call sites it changes no
   * geometry at 375px — every TrackDiagram's containing block is already at
   * least as wide as the diagram. The one genuine mobile defect (the
   * `/dashboard` hero asks for 420px and is cropped by the section's
   * `overflow: hidden`) is NOT fixable from here: a box with a *definite*
   * width contributes that width as its min-content size, so the ancestor
   * grid track sizes to 484px and a percentage max-width then resolves
   * against that oversized containing block. Making the width itself
   * shrinkable (`min(100%, var(--td-w))`) does fix the hero but collapses
   * every diagram whose parent is shrink-to-fit — measured: the four
   * revealed-round tracks inside `<Link className="block">` went to 0px.
   * The real fix belongs in the dashboard hero's grid, not in this component.
   *
   * `className` is caller-supplied and must be MERGED, not replaced — on both
   * render branches.
   */
  const cls = ["max-w-full md:max-w-none", className].filter(Boolean).join(" ");

  if (img) {
    const ratio = trackRatio(circuit);
    const w = height != null ? height * ratio : size;
    const h = height != null ? height : size / ratio;
    return (
      <div
        role="img"
        aria-label={label}
        className={cls}
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
      className={cls}
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
