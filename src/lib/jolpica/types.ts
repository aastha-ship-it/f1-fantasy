/**
 * Subset of Ergast / Jolpica-F1 response shapes we actually consume.
 * All numeric fields come back as strings (Ergast convention).
 */

export type MRDataResponse<T> = {
  MRData: {
    limit: string;
    offset: string;
    total: string;
  } & T;
};

export type ErgastDriver = {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality?: string;
};

export type ErgastCircuit = {
  circuitId: string;
  circuitName: string;
  Location?: { locality?: string; country?: string };
};

export type ErgastConstructor = {
  constructorId: string;
  name: string;
  nationality?: string;
};

export type ErgastFastestLap = {
  rank: string;
  lap: string;
  Time?: { time: string };
  AverageSpeed?: { units: string; speed: string };
};

export type ErgastResultRow = {
  number: string;
  position: string;            // "1".."20" or "R" / "D" / "W" for retired/disqualified/withdrawn
  positionText: string;
  points: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  grid: string;
  laps: string;
  status: string;
  FastestLap?: ErgastFastestLap;
};

/**
 * Qualifying-classification row. Same Driver/Constructor shape as race
 * results, but lap times instead of points/grid. Position 1 = pole.
 */
export type ErgastQualifyingRow = {
  number: string;
  position: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
};

export type ErgastRace = {
  season: string;
  round: string;
  raceName: string;
  date: string;                 // "YYYY-MM-DD"
  time?: string;                // "HH:MM:SSZ"
  Circuit: ErgastCircuit;
  Results?: ErgastResultRow[];      // race classification
  SprintResults?: ErgastResultRow[]; // sprint classification (subset of seasons)
  QualifyingResults?: ErgastQualifyingRow[]; // qualifying — Q1/Q2/Q3 times + position
};

export type DriverTablePayload = { DriverTable: { Drivers: ErgastDriver[] } };
export type CircuitTablePayload = { CircuitTable: { Circuits: ErgastCircuit[] } };
export type RaceTablePayload = { RaceTable: { Races: ErgastRace[] } };
