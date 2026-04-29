/**
 * Pure helper. Maps an OpenF1 `/session_result` payload to the podium shape
 * our `writeResultsService` expects.
 *
 * - Race / quali: returns { p1, p2, p3 }, throws if fewer than three classified.
 * - Sprint: returns { p1, p2: null, p3: null }, throws if no classified winner.
 */

export type OpenF1ResultRow = {
  driver_number: number;
  position: number | null;
};

export type Podium = {
  p1: number;
  p2: number | null;
  p3: number | null;
};

export function parsePodium(rows: OpenF1ResultRow[], isSprint: boolean): Podium {
  const classified = rows
    .filter((r) => r.position !== null)
    .sort((a, b) => (a.position as number) - (b.position as number));

  if (isSprint) {
    if (classified.length === 0) {
      throw new Error("Sprint result has no winner classified");
    }
    return { p1: classified[0]!.driver_number, p2: null, p3: null };
  }

  if (classified.length < 3) {
    throw new Error(
      `Race podium incomplete: only ${classified.length} classified finishers`,
    );
  }
  return {
    p1: classified[0]!.driver_number,
    p2: classified[1]!.driver_number,
    p3: classified[2]!.driver_number,
  };
}
