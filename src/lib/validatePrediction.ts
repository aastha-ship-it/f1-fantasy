/**
 * Prediction input validation.
 *
 * Gates what reaches the DB. Enforces:
 *   - shape matches session type (race = 3 slots, sprint = 1 slot)
 *   - every driver id is in the active-drivers set
 *   - no duplicate drivers across slots
 */

export type SessionType = "quali" | "race" | "sprint_quali" | "sprint_race";

export type PredictionInput = {
  p1: number;
  p2: number | null;
  p3: number | null;
};

export type ValidationContext = {
  sessionType: SessionType;
  activeDriverIds: ReadonlySet<number>;
};

export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
  }
}

function isSprintSession(t: SessionType): boolean {
  return t === "sprint_quali" || t === "sprint_race";
}

export function validatePrediction(
  input: PredictionInput,
  ctx: ValidationContext,
): PredictionInput {
  const sprint = isSprintSession(ctx.sessionType);

  if (sprint) {
    if (input.p2 !== null || input.p3 !== null) {
      throw new ValidationError(
        "SPRINT_EXTRA_SLOTS",
        "Sprint sessions accept P1 only; P2/P3 must be null",
      );
    }
  } else {
    if (input.p2 === null || input.p3 === null) {
      throw new ValidationError(
        "RACE_MISSING_SLOTS",
        "Race/quali sessions require P1, P2, and P3",
      );
    }
  }

  const picks: number[] = [input.p1];
  if (input.p2 !== null) picks.push(input.p2);
  if (input.p3 !== null) picks.push(input.p3);

  for (const id of picks) {
    if (!Number.isInteger(id)) {
      throw new ValidationError("NOT_AN_INTEGER", `driver_id ${id} is not an integer`);
    }
    if (!ctx.activeDriverIds.has(id)) {
      throw new ValidationError(
        "UNKNOWN_DRIVER",
        `driver_id ${id} is not in the active drivers set`,
      );
    }
  }

  if (new Set(picks).size !== picks.length) {
    throw new ValidationError(
      "DUPLICATE_DRIVER",
      "Same driver cannot occupy multiple podium slots",
    );
  }

  return input;
}
