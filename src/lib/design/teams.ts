/**
 * Team metadata — single source of truth for team-related styling.
 *
 * Source: lifted from design canvas at `design/data.jsx`. Keep hex values in
 * sync with the `--team-*-hex` CSS vars in `src/app/globals.css`.
 *
 * The DB stores `drivers.team` as a free-form string (e.g. "Red Bull Racing",
 * "RB F1 Team"). We canonicalize via `teamMeta(team)` which handles the
 * known aliases and falls back to `null` for unknown teams.
 */

export type TeamSlug =
  | "mclaren"
  | "ferrari"
  | "mercedes"
  | "redbull"
  | "aston"
  | "williams"
  | "haas"
  | "kick"
  | "alpine"
  | "vcarb"
  | "cadillac";

export type TeamMeta = {
  slug: TeamSlug;
  name: string;       // canonical display name
  short: string;      // 3-letter code (MCL, FER…)
  hex: string;        // primary livery hex
  livery: [string, string, string]; // [primary, dark, accent]
  /** Path under /public — Next can serve directly. */
  logoSrc: string;
  carSrc: string;
};

const TEAMS: Record<TeamSlug, TeamMeta> = {
  mclaren: {
    slug: "mclaren",
    name: "McLaren",
    short: "MCL",
    hex: "#FF8000",
    livery: ["#FF8000", "#0a0a0a", "#1F8FCF"],
    logoSrc: "/assets/logos/mclaren.png",
    carSrc: "/assets/cars/mclaren.png",
  },
  ferrari: {
    slug: "ferrari",
    name: "Ferrari",
    short: "FER",
    hex: "#E8002D",
    livery: ["#E8002D", "#1a0608", "#FFF200"],
    logoSrc: "/assets/logos/ferrari.png",
    carSrc: "/assets/cars/ferrari.png",
  },
  mercedes: {
    slug: "mercedes",
    name: "Mercedes",
    short: "MER",
    hex: "#27F4D2",
    livery: ["#27F4D2", "#0a1a1a", "#C0C0C0"],
    logoSrc: "/assets/logos/mercedes.png",
    carSrc: "/assets/cars/mercedes.png",
  },
  redbull: {
    slug: "redbull",
    name: "Red Bull Racing",
    short: "RBR",
    hex: "#4A77DB",
    livery: ["#4A77DB", "#1E2A6E", "#FFD400"],
    logoSrc: "/assets/logos/redbull.jpg",
    carSrc: "/assets/cars/redbull.png",
  },
  aston: {
    slug: "aston",
    name: "Aston Martin",
    short: "AST",
    hex: "#229971",
    livery: ["#229971", "#0a1a14", "#CEDC00"],
    logoSrc: "/assets/logos/aston.png",
    carSrc: "/assets/cars/aston.png",
  },
  williams: {
    slug: "williams",
    name: "Williams",
    short: "WIL",
    hex: "#1868DB",
    livery: ["#1868DB", "#0c1a2a", "#FFFFFF"],
    logoSrc: "/assets/logos/williams.png",
    carSrc: "/assets/cars/williams.png",
  },
  haas: {
    slug: "haas",
    name: "Haas F1 Team",
    short: "HAA",
    hex: "#B6BABD",
    livery: ["#B6BABD", "#0c0c0c", "#E8002D"],
    logoSrc: "/assets/logos/haas.jpg",
    carSrc: "/assets/cars/haas.png",
  },
  // 2026 rebrand — Sauber's works partner is now Audi. Slug stays `kick` so
  // CSS vars (--team-kick / --team-kick-hex) and asset filenames don't ripple.
  // Real Audi 2026 livery + assets can land later as a swap.
  kick: {
    slug: "kick",
    name: "Audi",
    short: "AUD",
    hex: "#52E252",
    livery: ["#52E252", "#0a1a0a", "#0a0a0a"],
    logoSrc: "/assets/logos/kick.png",
    carSrc: "/assets/cars/kick.png",
  },
  alpine: {
    slug: "alpine",
    name: "Alpine",
    short: "ALP",
    hex: "#0093CC",
    livery: ["#0093CC", "#0a0c1a", "#FF87BC"],
    logoSrc: "/assets/logos/alpine.png",
    carSrc: "/assets/cars/alpine.png",
  },
  vcarb: {
    slug: "vcarb",
    name: "Racing Bulls",
    short: "VCB",
    hex: "#6692FF",
    livery: ["#6692FF", "#0a0c1a", "#E8002D"],
    logoSrc: "/assets/logos/vcarb.png",
    carSrc: "/assets/cars/vcarb.png",
  },
  // New 2026 entrant — 11th constructor. Crest red + matte black, GM-backed.
  // Logo + car assets are placeholders until the real liveries ship.
  cadillac: {
    slug: "cadillac",
    name: "Cadillac F1 Team",
    short: "CAD",
    hex: "#9B0D2D",
    livery: ["#9B0D2D", "#0c0c0c", "#FFFFFF"],
    logoSrc: "/assets/logos/cadillac.png",
    carSrc: "/assets/cars/cadillac.png",
  },
};

/** Aliases: free-form team strings the DB might use → canonical slug. */
const TEAM_ALIASES: Record<string, TeamSlug> = {
  mclaren: "mclaren",
  ferrari: "ferrari",
  mercedes: "mercedes",
  "red bull": "redbull",
  "red bull racing": "redbull",
  redbull: "redbull",
  "aston martin": "aston",
  aston: "aston",
  williams: "williams",
  haas: "haas",
  "haas f1": "haas",
  "haas f1 team": "haas",
  "kick sauber": "kick",
  sauber: "kick",
  audi: "kick",        // 2026 rebrand transition
  alpine: "alpine",
  "racing bulls": "vcarb",
  "rb f1 team": "vcarb",
  rb: "vcarb",
  vcarb: "vcarb",
  cadillac: "cadillac",
  "cadillac f1": "cadillac",
  "cadillac f1 team": "cadillac",
  "general motors": "cadillac",
  "gm cadillac": "cadillac",
};

export function teamMeta(team: string | null | undefined): TeamMeta | null {
  if (!team) return null;
  const slug = TEAM_ALIASES[team.trim().toLowerCase()];
  return slug ? TEAMS[slug] : null;
}

export function teamHex(team: string | null | undefined): string {
  return teamMeta(team)?.hex ?? "#666";
}

export const ALL_TEAMS: TeamMeta[] = Object.values(TEAMS);
