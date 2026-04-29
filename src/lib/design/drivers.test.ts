import { describe, it, expect } from "vitest";
import {
  driverPortraitSrc,
  driverHeadshotSrc,
  driverCountry,
  countryFlag,
} from "./drivers";

describe("driver presentation helpers", () => {
  it("D7 · portrait + headshot src use uppercase code; null for unknown", () => {
    expect(driverPortraitSrc("ver")).toBe("/assets/drivers-portrait/VER.png");
    expect(driverHeadshotSrc("Ham")).toBe("/assets/drivers/HAM.png");
    expect(driverPortraitSrc("XYZ")).toBeNull();
    expect(driverHeadshotSrc("XYZ")).toBeNull();
  });

  it("D8 · driverCountry returns ISO code or null", () => {
    expect(driverCountry("VER")).toBe("NL");
    expect(driverCountry("ham")).toBe("GB");
    expect(driverCountry("ZZZ")).toBeNull();
  });

  it("D9 · countryFlag converts ISO to flag emoji", () => {
    expect(countryFlag("NL")).toBe("🇳🇱");
    expect(countryFlag("gb")).toBe("🇬🇧");
    expect(countryFlag(null)).toBe("🏳");
    expect(countryFlag("X")).toBe("🏳");
  });
});
