/**
 * Stylized track outlines, lifted verbatim from `design/data.jsx:TRACKS`.
 * Each path is normalized to a 200×120 viewBox.
 *
 * Keyed by Jolpica `circuitId` (set on `events.ergast_circuit_id` by the
 * mapper). For OpenF1-only circuits we add a few aliases.
 */

const TRACK_PATHS: Record<string, string> = {
  miami: "M30,90 L30,40 Q30,25 45,25 L130,25 Q150,25 155,40 L165,55 Q170,65 165,75 L160,85 Q155,95 145,95 L120,95 L115,75 L95,75 L85,95 L70,95 Q55,95 50,85 Z",
  albert_park: "M25,30 L25,90 Q25,100 35,100 L160,100 Q175,100 175,85 L175,55 Q175,40 160,40 L100,40 L100,30 Q100,20 90,20 L40,20 Q25,20 25,30 Z",
  shanghai: "M30,50 L30,40 Q30,25 45,25 L80,25 Q90,25 90,35 L90,55 Q90,65 100,65 L140,65 Q160,65 165,80 L165,90 Q165,100 150,100 L60,100 Q40,100 35,90 L30,75 Q25,65 30,50 Z",
  suzuka: "M30,60 Q30,40 50,35 L90,30 Q100,30 95,45 L85,65 Q80,75 90,80 L130,85 Q150,87 155,75 L165,55 Q170,40 155,35 L130,30 Q120,28 125,40 L130,55",
  bahrain: "M30,60 L30,40 Q30,25 45,25 L100,25 L100,50 L140,50 L150,30 Q160,25 170,35 L170,80 Q170,95 155,95 L60,95 Q40,95 35,80 Z",
  jeddah: "M25,90 L25,55 Q30,35 50,35 L75,40 Q90,45 95,30 L100,20 L120,30 L135,25 L150,40 Q170,55 165,75 L160,90 Q155,100 140,95 L70,90 Q50,95 35,95 Z",
  imola: "M30,80 L30,40 Q30,25 50,30 L90,40 Q100,45 105,30 L115,15 L135,25 L145,45 L160,55 Q170,65 160,75 L150,90 Q140,100 125,95 L60,90 Q40,90 30,80 Z",
  monaco: "M40,90 L30,70 Q25,55 35,45 L55,30 Q70,20 85,30 L100,40 L120,30 L140,25 Q155,25 155,40 L150,55 L165,65 Q170,75 160,85 L130,95 Q90,100 70,90 Z",
  catalunya: "M30,75 L30,40 Q30,25 50,30 L100,40 L120,30 Q140,25 145,40 L150,60 L160,70 Q165,80 155,90 L120,95 Q60,100 40,95 Q25,90 30,75 Z",
  montreal: "M30,90 L30,30 Q30,20 45,20 L70,30 Q90,40 100,30 L130,15 L160,25 Q175,30 170,50 L165,75 Q160,90 145,95 L60,95 Q35,95 30,90 Z",
  spielberg: "M30,80 L30,55 Q30,35 50,30 L80,35 Q95,40 105,30 L130,15 Q150,15 155,35 L160,60 Q160,80 145,90 L70,95 Q35,95 30,80 Z",
  silverstone: "M30,80 L30,45 Q30,30 50,30 L90,35 L100,25 L130,30 L155,20 Q170,25 170,45 L165,75 Q160,90 145,90 L70,95 Q35,95 30,80 Z",
};

// OpenF1 circuit_short_name → Jolpica circuit_id alias for tracks where
// the events table only has the OpenF1 short name set.
const ALIAS: Record<string, string> = {
  melbourne: "albert_park",
  sakhir: "bahrain",
  "monte carlo": "monaco",
  barcelona: "catalunya",
  "spa-francorchamps": "silverstone", // no spa path yet; use silverstone shape as placeholder
  spa: "silverstone",
};

function resolveKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const normalized = key.trim().toLowerCase();
  if (TRACK_PATHS[normalized]) return normalized;
  return ALIAS[normalized] ?? null;
}

export function trackPath(key: string | null | undefined): string | null {
  const resolved = resolveKey(key);
  return resolved ? TRACK_PATHS[resolved]! : null;
}
