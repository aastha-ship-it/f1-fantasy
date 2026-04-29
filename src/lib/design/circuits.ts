/**
 * Static circuit metadata — track length and race lap count.
 *
 * Why static: neither OpenF1 (`/meetings`, `/sessions`) nor Jolpica
 * (`/{season}/circuits`) returns track length or scheduled lap count on
 * their schedule payloads. Lap count *is* available on completed-race rows
 * (`historical_results.laps`) but that's only after a race has finished —
 * useless for the dashboard's "next race" hero.
 *
 * Source: hand-curated from FIA-published track data + the design canvas's
 * `TRACK_LENGTH` table. Keyed by Jolpica `circuit_id` (mirrors what we set
 * on `events.ergast_circuit_id` via the resolver).
 */

export type CircuitMeta = {
  /** Length in kilometres */
  lengthKm: number;
  /** Scheduled race laps */
  laps: number;
};

const CIRCUITS: Record<string, CircuitMeta> = {
  albert_park: { lengthKm: 5.278, laps: 58 },
  shanghai: { lengthKm: 5.451, laps: 56 },
  suzuka: { lengthKm: 5.807, laps: 53 },
  bahrain: { lengthKm: 5.412, laps: 57 },
  jeddah: { lengthKm: 6.174, laps: 50 },
  miami: { lengthKm: 5.412, laps: 57 },
  imola: { lengthKm: 4.909, laps: 63 },
  monaco: { lengthKm: 3.337, laps: 78 },
  catalunya: { lengthKm: 4.657, laps: 66 },
  villeneuve: { lengthKm: 4.361, laps: 70 },
  red_bull_ring: { lengthKm: 4.318, laps: 71 },
  silverstone: { lengthKm: 5.891, laps: 52 },
  hungaroring: { lengthKm: 4.381, laps: 70 },
  spa: { lengthKm: 7.004, laps: 44 },
  zandvoort: { lengthKm: 4.259, laps: 72 },
  monza: { lengthKm: 5.793, laps: 53 },
  baku: { lengthKm: 6.003, laps: 51 },
  marina_bay: { lengthKm: 4.94, laps: 62 },
  americas: { lengthKm: 5.513, laps: 56 },
  rodriguez: { lengthKm: 4.304, laps: 71 },
  interlagos: { lengthKm: 4.309, laps: 71 },
  vegas: { lengthKm: 6.201, laps: 50 },
  losail: { lengthKm: 5.419, laps: 57 },
  yas_marina: { lengthKm: 5.281, laps: 58 },
};

// OpenF1 short names → Jolpica id, where they differ enough that the
// alias map in `tracks.ts` doesn't catch every casing.
const ALIAS: Record<string, string> = {
  melbourne: "albert_park",
  sakhir: "bahrain",
  "monte carlo": "monaco",
  barcelona: "catalunya",
  "spa-francorchamps": "spa",
  spielberg: "red_bull_ring",
  "mexico city": "rodriguez",
  "são paulo": "interlagos",
  "sao paulo": "interlagos",
  "las vegas": "vegas",
  lusail: "losail",
  austin: "americas",
  zandvoort: "zandvoort",
  hungaroring: "hungaroring",
  baku: "baku",
};

function resolveKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const lower = key.trim().toLowerCase();
  if (CIRCUITS[lower]) return lower;
  return ALIAS[lower] ?? null;
}

export function circuitMeta(key: string | null | undefined): CircuitMeta | null {
  const resolved = resolveKey(key);
  return resolved ? CIRCUITS[resolved]! : null;
}
