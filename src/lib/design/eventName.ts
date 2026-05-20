/**
 * Strip the "Grand Prix" suffix from an event name and map adjective
 * forms to their country/place name (e.g. "Australian" → "Australia",
 * "Saudi Arabian" → "Saudi Arabia"). Falls back to the un-suffixed name.
 *
 * Per design canvas guidance: calendar cards say "Australia", "China",
 * "Monaco" — never "Australian Grand Prix".
 */

const NOUN_FORM: Record<string, string> = {
  australian: "Australia",
  chinese: "China",
  japanese: "Japan",
  canadian: "Canada",
  spanish: "Spain",
  austrian: "Austria",
  british: "Britain",
  belgian: "Belgium",
  hungarian: "Hungary",
  dutch: "Netherlands",
  italian: "Italy",
  "saudi arabian": "Saudi Arabia",
  bahraini: "Bahrain",
  mexican: "Mexico",
  "mexico city": "Mexico",
  brazilian: "Brazil",
  "são paulo": "Brazil",
  "sao paulo": "Brazil",
  "emilia romagna": "Imola",
  "emilia-romagna": "Imola",
  qatari: "Qatar",
  "united states": "USA",
  azerbaijani: "Azerbaijan",
  singaporean: "Singapore",
};

export function shortEventName(fullName: string): string {
  const stripped = fullName.replace(/\s+Grand\s+Prix\s*$/i, "").trim();
  const lookup = NOUN_FORM[stripped.toLowerCase()];
  return lookup ?? stripped;
}

/**
 * ISO 3166-1 alpha-2 country code for a `shortEventName(name)` result, or
 * `null` if we don't have a mapping. Used to render flag emojis next to
 * event names where we don't have a country stored on `events` directly.
 */
const EVENT_COUNTRY: Record<string, string> = {
  AUSTRALIA: "AU",
  CHINA: "CN",
  JAPAN: "JP",
  BAHRAIN: "BH",
  "SAUDI ARABIA": "SA",
  MIAMI: "US",
  IMOLA: "IT",
  MONACO: "MC",
  SPAIN: "ES",
  CANADA: "CA",
  AUSTRIA: "AT",
  BRITAIN: "GB",
  HUNGARY: "HU",
  BELGIUM: "BE",
  NETHERLANDS: "NL",
  ITALY: "IT",
  AZERBAIJAN: "AZ",
  SINGAPORE: "SG",
  USA: "US",
  MEXICO: "MX",
  BRAZIL: "BR",
  "LAS VEGAS": "US",
  QATAR: "QA",
  "ABU DHABI": "AE",
};

export function eventCountry(eventNameOrShort: string): string | null {
  const short = shortEventName(eventNameOrShort);
  return EVENT_COUNTRY[short.toUpperCase()] ?? null;
}

/**
 * ISO 3166-1 alpha-3 country code (e.g. `AUS`, `JPN`, `USA`) for a
 * `shortEventName(name)` result — the 3-letter "AUS"/"JPN" chip on the
 * `WinnerCard` header (design_handoff_standings § PR-2). Same alias
 * resolution as `eventCountry`. Returns null if unmapped.
 */
const EVENT_COUNTRY_3: Record<string, string> = {
  AUSTRALIA: "AUS",
  CHINA: "CHN",
  JAPAN: "JPN",
  BAHRAIN: "BHR",
  "SAUDI ARABIA": "SAU",
  MIAMI: "USA",
  IMOLA: "ITA",
  MONACO: "MCO",
  SPAIN: "ESP",
  CANADA: "CAN",
  AUSTRIA: "AUT",
  BRITAIN: "GBR",
  HUNGARY: "HUN",
  BELGIUM: "BEL",
  NETHERLANDS: "NLD",
  ITALY: "ITA",
  AZERBAIJAN: "AZE",
  SINGAPORE: "SGP",
  USA: "USA",
  MEXICO: "MEX",
  BRAZIL: "BRA",
  "LAS VEGAS": "USA",
  QATAR: "QAT",
  "ABU DHABI": "ARE",
};

export function eventCountry3(eventNameOrShort: string): string | null {
  const short = shortEventName(eventNameOrShort);
  return EVENT_COUNTRY_3[short.toUpperCase()] ?? null;
}
