import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveCircuits } from "./resolveCircuits";

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeFakeSvc(events: { id: string; circuit: string }[]) {
  const updates: { id: string; ergast_circuit_id: string }[] = [];
  return {
    updates,
    client: {
      from(table: string) {
        if (table !== "events") throw new Error(`unexpected table ${table}`);
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({ data: events, error: null });
              },
            };
          },
          update(patch: { ergast_circuit_id: string }) {
            return {
              eq(_col: string, id: string) {
                updates.push({ id, ergast_circuit_id: patch.ergast_circuit_id });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    } as unknown as Parameters<typeof resolveCircuits>[0],
  };
}

describe("resolveCircuits", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("J4 · matches OpenF1 short_name to Jolpica circuitName via canonicalizer + locality fallback", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonOk({
        MRData: {
          limit: "100",
          offset: "0",
          total: "3",
          CircuitTable: {
            Circuits: [
              {
                circuitId: "miami",
                circuitName: "Miami International Autodrome",
                Location: { locality: "Miami", country: "USA" },
              },
              {
                // OpenF1 calls this "Sakhir" (the locality), Jolpica uses
                // the official circuit name. Locality fallback should match.
                circuitId: "bahrain",
                circuitName: "Bahrain International Circuit",
                Location: { locality: "Sakhir", country: "Bahrain" },
              },
              {
                circuitId: "yas_marina",
                circuitName: "Yas Marina Circuit",
                Location: { locality: "Abu Dhabi", country: "UAE" },
              },
            ],
          },
        },
      }),
    );

    const fake = makeFakeSvc([
      { id: "ev-1", circuit: "Miami" },
      { id: "ev-2", circuit: "Sakhir" }, // matches via locality
      { id: "ev-3", circuit: "Yas Marina Circuit" },
      { id: "ev-4", circuit: "Unknown Mountain" }, // no match
    ]);

    const summary = await resolveCircuits(fake.client, 2024);
    expect(summary.matched).toBe(3);
    expect(summary.unmatched).toEqual(["Unknown Mountain"]);
    expect(fake.updates).toEqual([
      { id: "ev-1", ergast_circuit_id: "miami" },
      { id: "ev-2", ergast_circuit_id: "bahrain" },
      { id: "ev-3", ergast_circuit_id: "yas_marina" },
    ]);
  });
});
