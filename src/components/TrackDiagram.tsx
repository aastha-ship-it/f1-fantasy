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
  stroke = "currentColor",
  strokeWidth = 2,
  className,
  style,
}: {
  circuit: string | null | undefined;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const img = trackImg(circuit);
  const label = circuit ? `${circuit} circuit layout` : "track diagram";

  if (img) {
    const ratio = trackRatio(circuit);
    return (
      <div
        role="img"
        aria-label={label}
        className={className}
        style={{
          width: size,
          height: size / ratio,
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
  return (
    <svg
      viewBox="0 0 200 120"
      width={size}
      height={(size * 120) / 200}
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
