/**
 * Driver presentation helpers.
 *
 * The DB stores driver records keyed by smallint `id` (OpenF1 driver_number)
 * with a 3-letter `code` (VER, NOR…). Image assets are organized by code:
 *   /public/assets/drivers/{CODE}.png           — full headshot
 *   /public/assets/drivers-portrait/{CODE}.png  — circular portrait crop
 *
 * `DRIVER_META` carries presentation-only fields lifted from the design
 * canvas — country code (for nationality flags), permanent number — that
 * we don't currently store in the DB. Future enhancement: backfill via
 * Jolpica's `/drivers/{season}` payload.
 */

export type DriverPresentation = {
  /** ISO 3166-1 alpha-2 country code, e.g. "NL", "GB". */
  country: string;
};

const DRIVER_META: Record<string, DriverPresentation> = {
  VER: { country: "NL" },
  TSU: { country: "JP" },
  LEC: { country: "MC" },
  HAM: { country: "GB" },
  NOR: { country: "GB" },
  PIA: { country: "AU" },
  RUS: { country: "GB" },
  ANT: { country: "IT" },
  ALO: { country: "ES" },
  STR: { country: "CA" },
  ALB: { country: "TH" },
  SAI: { country: "ES" },
  GAS: { country: "FR" },
  DOO: { country: "AU" },
  HAD: { country: "FR" },
  LAW: { country: "NZ" },
  OCO: { country: "FR" },
  BEA: { country: "GB" },
  HUL: { country: "DE" },
  BOR: { country: "BR" },
  COL: { country: "AR" },
  PER: { country: "MX" },
  LIN: { country: "GB" },
  BOT: { country: "FI" },
};

/**
 * Codes for which we have a portrait PNG on disk. Drivers outside this set
 * (e.g. mid-season reserves COL/PER/BOT/LIN) render an initial-letter
 * fallback instead of a broken image.
 */
const PORTRAIT_CODES = new Set([
  "ALB", "ALO", "ANT", "BEA", "BOR", "BOT", "COL", "DOO", "GAS", "HAD",
  "HAM", "HUL", "LAW", "LEC", "LIN", "NOR", "OCO", "PER", "PIA", "RUS",
  "SAI", "STR", "TSU", "VER",
]);

const HEADSHOT_CODES = new Set([
  "ALB", "ALO", "ANT", "BEA", "BOR", "DOO", "GAS", "HAD", "HAM", "HUL",
  "LAW", "LEC", "NOR", "OCO", "PIA", "PER", "RUS", "SAI", "STR", "TSU", "VER",
]);

/**
 * Codes whose source portrait was shot facing right. The design canvas's
 * curated portrait set is uniformly left-facing, so we mirror these to keep
 * visual consistency in the driver grid. (BOT + LIN currently use the full
 * headshot since no curated portrait exists yet — flipping until updated.)
 */
const RIGHT_FACING_CODES = new Set(["BOT", "LIN"]);

export function hasDriverPortrait(code: string): boolean {
  return PORTRAIT_CODES.has(code.toUpperCase());
}

export function isPortraitRightFacing(code: string): boolean {
  return RIGHT_FACING_CODES.has(code.toUpperCase());
}

export function driverPortraitSrc(code: string): string | null {
  const upper = code.toUpperCase();
  return PORTRAIT_CODES.has(upper)
    ? `/assets/drivers-portrait/${upper}.png`
    : null;
}

export function driverHeadshotSrc(code: string): string | null {
  const upper = code.toUpperCase();
  return HEADSHOT_CODES.has(upper)
    ? `/assets/drivers/${upper}.png`
    : null;
}

export function driverCountry(code: string): string | null {
  return DRIVER_META[code.toUpperCase()]?.country ?? null;
}

/** Country code → Unicode flag emoji. e.g. "NL" → 🇳🇱 */
export function countryFlag(country: string | null | undefined): string {
  if (!country || country.length !== 2) return "🏳";
  const A = 0x1f1e6; // regional-indicator A
  const code = country.toUpperCase();
  return String.fromCodePoint(
    A + (code.charCodeAt(0) - 65),
    A + (code.charCodeAt(1) - 65),
  );
}
