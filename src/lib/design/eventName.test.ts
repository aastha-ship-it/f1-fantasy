import { describe, it, expect } from "vitest";
import { shortEventName, eventCountry } from "./eventName";

describe("shortEventName", () => {
  it("D10 · maps adjective forms to their country", () => {
    expect(shortEventName("Australian Grand Prix")).toBe("Australia");
    expect(shortEventName("Chinese Grand Prix")).toBe("China");
    expect(shortEventName("Japanese Grand Prix")).toBe("Japan");
    expect(shortEventName("Saudi Arabian Grand Prix")).toBe("Saudi Arabia");
    expect(shortEventName("Mexico City Grand Prix")).toBe("Mexico");
  });

  it("D11 · place names pass through after stripping", () => {
    expect(shortEventName("Miami Grand Prix")).toBe("Miami");
    expect(shortEventName("Monaco Grand Prix")).toBe("Monaco");
    expect(shortEventName("Las Vegas Grand Prix")).toBe("Las Vegas");
    expect(shortEventName("Abu Dhabi Grand Prix")).toBe("Abu Dhabi");
  });

  it("D12 · strips suffix on already-clean names + handles missing suffix", () => {
    expect(shortEventName("Imola Grand Prix")).toBe("Imola");
    expect(shortEventName("Some Custom Name")).toBe("Some Custom Name");
  });
});

describe("eventCountry", () => {
  it("D16 · resolves adjective forms via shortEventName", () => {
    expect(eventCountry("Saudi Arabian Grand Prix")).toBe("SA");
    expect(eventCountry("Australian Grand Prix")).toBe("AU");
    expect(eventCountry("Mexico City Grand Prix")).toBe("MX");
  });

  it("D17 · accepts already-shortened names + uppercases", () => {
    expect(eventCountry("miami")).toBe("US");
    expect(eventCountry("MONACO")).toBe("MC");
    expect(eventCountry("Las Vegas")).toBe("US");
  });

  it("D18 · returns null for unmapped events", () => {
    expect(eventCountry("Some Custom Name")).toBeNull();
  });
});
