import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveDrivers } from "./resolveDrivers";

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeFakeSvc(seedDrivers: { id: number; full_name: string }[]) {
  const updates: { id: number; ergast_id: string }[] = [];
  return {
    updates,
    client: {
      from(table: string) {
        if (table !== "drivers") throw new Error(`unexpected table ${table}`);
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({ data: seedDrivers, error: null });
              },
            };
          },
          update(patch: { ergast_id: string }) {
            return {
              eq(_col: string, id: number) {
                updates.push({ id, ergast_id: patch.ergast_id });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    } as unknown as Parameters<typeof resolveDrivers>[0],
  };
}

describe("resolveDrivers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("J3b · falls back to last-name match when full canonical names differ (Jolpica givenName drift)", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "2",
          DriverTable: {
            Drivers: [
              {
                // Jolpica spelling: 3 names. DB stores "Kimi Antonelli".
                driverId: "antonelli",
                givenName: "Andrea Kimi",
                familyName: "Antonelli",
              },
              {
                driverId: "verstappen",
                givenName: "Max",
                familyName: "Verstappen",
              },
            ],
          },
        },
      }),
    );

    const fake = makeFakeSvc([
      { id: 12, full_name: "Kimi Antonelli" },
      { id: 1, full_name: "Max Verstappen" },
    ]);

    const summary = await resolveDrivers(fake.client, 2026);
    expect(summary.matched).toBe(2);
    expect(summary.unmatched).toEqual([]);
    expect(fake.updates).toEqual(
      expect.arrayContaining([
        { id: 12, ergast_id: "antonelli" },
        { id: 1, ergast_id: "verstappen" },
      ]),
    );
  });

  it("J3 · matches drivers by canonicalized full name; unmatched stay null", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "3",
          DriverTable: {
            Drivers: [
              {
                driverId: "max_verstappen",
                givenName: "Max",
                familyName: "Verstappen",
              },
              {
                driverId: "norris",
                givenName: "Lando",
                familyName: "Norris",
              },
              {
                // not in our drivers table
                driverId: "schumacher",
                givenName: "Mick",
                familyName: "Schumacher",
              },
            ],
          },
        },
      }),
    );

    const fake = makeFakeSvc([
      { id: 3, full_name: "Max VERSTAPPEN" },
      { id: 1, full_name: "Lando NORRIS" },
      { id: 16, full_name: "Charles LECLERC" },
    ]);

    const summary = await resolveDrivers(fake.client, 2024);
    expect(summary).toEqual({
      season: 2024,
      jolpica_drivers: 3,
      matched: 2,
      unmatched: ["Mick Schumacher"],
    });
    expect(fake.updates).toEqual([
      { id: 3, ergast_id: "max_verstappen" },
      { id: 1, ergast_id: "norris" },
    ]);
  });
});
