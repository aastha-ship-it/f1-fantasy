import Image from "next/image";
import {
  driverPortraitSrc,
  isPortraitRightFacing,
} from "@/lib/design/drivers";
import { teamHex } from "@/lib/design/teams";

/**
 * Circular driver portrait. Falls back to an initial-letter avatar tinted
 * with the driver's team color when we don't have a portrait PNG on disk
 * (e.g. mid-season reserve drivers not in the design canvas asset set).
 */
export function DriverPortrait({
  code,
  team,
  size = 48,
  className,
}: {
  code: string;
  team?: string | null;
  size?: number;
  className?: string;
}) {
  const src = driverPortraitSrc(code);
  if (src) {
    const flip = isPortraitRightFacing(code);
    return (
      <Image
        src={src}
        alt={code}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          objectPosition: "center top",
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      />
    );
  }
  const hex = teamHex(team ?? null);
  return (
    <span
      aria-label={code}
      className={`flex shrink-0 items-center justify-center rounded-full ${
        className ?? ""
      }`}
      style={{
        width: size,
        height: size,
        background: "var(--surface-2)",
        border: `1px solid ${hex}`,
        color: "var(--fg)",
        fontFamily: "var(--font-boldonse), ui-sans-serif",
        fontSize: Math.max(10, size * 0.35),
      }}
    >
      {code.charAt(0).toUpperCase()}
    </span>
  );
}
