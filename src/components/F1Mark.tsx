/**
 * F1 wordmark — white "F1" lettering plus three red speed bars.
 * Lifted from `design/data.jsx:F1Mark`. Pure SVG, no external asset.
 */
export function F1Mark({
  height = 28,
  color = "var(--team-ferrari-hex, #E8002D)",
}: {
  height?: number;
  color?: string;
}) {
  const width = height * 2.5;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 40"
      role="img"
      aria-label="F1"
      style={{ display: "block" }}
    >
      {/* F */}
      <path
        d="M 6,32 L 14,8 L 38,8 L 36,14 L 22,14 L 20,20 L 32,20 L 30,26 L 18,26 L 16,32 Z"
        fill="currentColor"
      />
      {/* 1 */}
      <path
        d="M 44,8 L 56,8 L 56,32 L 50,32 L 50,14 L 44,14 Z"
        fill="currentColor"
      />
      {/* speed bars */}
      <path
        d="M 64,8 L 96,8 L 94,12 L 66,12 Z M 62,16 L 94,16 L 92,20 L 64,20 Z M 60,24 L 92,24 L 90,28 L 62,28 Z"
        fill={color}
      />
    </svg>
  );
}
