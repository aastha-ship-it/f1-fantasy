import { describe, it, expect } from "vitest";
import {
  validateInviteCode,
  InviteCodeError,
} from "./validateInviteCode";

describe("validateInviteCode", () => {
  it("U11 · wrong code → throws InviteCodeError", () => {
    expect(() =>
      validateInviteCode("hunter2", { envCode: "LECLERC-FTW" }),
    ).toThrow(InviteCodeError);
  });

  it("U12 · correct code → passes (no throw)", () => {
    expect(() =>
      validateInviteCode("LECLERC-FTW", { envCode: "LECLERC-FTW" }),
    ).not.toThrow();
  });

  it("edge · empty input → throws InviteCodeError", () => {
    expect(() =>
      validateInviteCode("", { envCode: "LECLERC-FTW" }),
    ).toThrow(InviteCodeError);
  });

  it("edge · env code unset → throws InviteCodeError (misconfig is not a pass)", () => {
    expect(() =>
      validateInviteCode("anything", { envCode: undefined }),
    ).toThrow(InviteCodeError);
  });

  it("edge · length mismatch doesn't short-circuit (guards timing attack)", () => {
    // A naive `===` would early-out on length, leaking length via timing.
    // We verify behavioral correctness here; the constant-time property
    // is asserted by construction in the implementation (crypto.timingSafeEqual).
    expect(() =>
      validateInviteCode("x", { envCode: "LECLERC-FTW" }),
    ).toThrow(InviteCodeError);
  });
});
