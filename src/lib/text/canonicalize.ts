/**
 * String canonicalizers for cross-source identity matching.
 *
 * `canonicalizeName` — driver/person names. Lowercase, trim, collapse
 *   internal whitespace. Used to join OpenF1's `full_name` ("Max VERSTAPPEN")
 *   with Jolpica's `givenName + familyName` and similar.
 *
 * `canonicalizeCircuit` — circuit names. Lowercase, strip non-alphanumerics
 *   except spaces, collapse whitespace. Used to join OpenF1's
 *   `circuit_short_name` ("Sakhir", "Yas Marina Circuit") with Jolpica's
 *   `circuitName` ("Bahrain International Circuit", "Yas Marina Circuit").
 *
 * Both are *fuzzy* on purpose — exact key parity is impossible across two
 * sources. They're the wide-net step; explicit alias maps handle the rest.
 */

// Strip diacritics: "Pérez" → "perez", "Hülkenberg" → "hulkenberg".
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function canonicalizeName(name: string): string {
  return stripDiacritics(name).trim().toLowerCase().replace(/\s+/g, " ");
}

export function canonicalizeCircuit(name: string): string {
  return stripDiacritics(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}
