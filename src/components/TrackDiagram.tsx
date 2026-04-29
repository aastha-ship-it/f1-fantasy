import { trackPath } from "@/lib/design/tracks";

/**
 * Stylized 200×120 SVG track diagram. Falls back to a thin rounded box if the
 * circuit isn't in our path library yet.
 *
 * `circuit` accepts either Jolpica `circuit_id` ("miami") or the OpenF1
 * `circuit_short_name` ("Sakhir", "Monte Carlo") — alias-resolved.
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
  const d = trackPath(circuit);
  return (
    <svg
      viewBox="0 0 200 120"
      width={size}
      height={(size * 120) / 200}
      role="img"
      aria-label={circuit ? `${circuit} track diagram` : "track diagram"}
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
