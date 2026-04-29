import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jolpicaFetch, jolpicaPaginated } from "./client";
import type {
  MRDataResponse,
  DriverTablePayload,
  ErgastDriver,
} from "./types";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function makeDriver(id: string): ErgastDriver {
  return { driverId: id, givenName: id, familyName: id.toUpperCase() };
}

function payload(
  drivers: ErgastDriver[],
  total: number,
  offset = 0,
  limit = 30,
): MRDataResponse<DriverTablePayload> {
  return {
    MRData: {
      limit: String(limit),
      offset: String(offset),
      total: String(total),
      DriverTable: { Drivers: drivers },
    },
  };
}

describe("jolpicaFetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("J1 · retries 429 honoring Retry-After header, then returns body on 200", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" }, // zero so test runs fast
        }),
      )
      .mockResolvedValueOnce(jsonResponse(payload([makeDriver("alonso")], 1)));

    const result = await jolpicaFetch<DriverTablePayload>("/2024/drivers/");
    expect(result.MRData.DriverTable.Drivers).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("J1b · throws on non-2xx, non-429", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("kaboom", { status: 500 }),
    );
    await expect(
      jolpicaFetch<DriverTablePayload>("/2024/drivers/"),
    ).rejects.toThrow(/500/);
  });
});

describe("jolpicaPaginated", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("J2 · pages through MRData.total > limit", async () => {
    // total=5, limit=2 → 3 pages (offsets 0, 2, 4)
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse(payload([makeDriver("a"), makeDriver("b")], 5, 0, 2)),
      )
      .mockResolvedValueOnce(
        jsonResponse(payload([makeDriver("c"), makeDriver("d")], 5, 2, 2)),
      )
      .mockResolvedValueOnce(
        jsonResponse(payload([makeDriver("e")], 5, 4, 2)),
      );

    const all: ErgastDriver[] = [];
    for await (const page of jolpicaPaginated<DriverTablePayload>(
      "/2024/drivers/",
      { limit: 2 },
    )) {
      all.push(...page.MRData.DriverTable.Drivers);
    }

    expect(all.map((d) => d.driverId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("J2b · stops after one page when total <= limit", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(payload([makeDriver("a")], 1, 0, 100)),
    );
    let pages = 0;
    for await (const _page of jolpicaPaginated<DriverTablePayload>(
      "/2024/drivers/",
    )) {
      void _page;
      pages++;
    }
    expect(pages).toBe(1);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
