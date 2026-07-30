import { describe, expect, it } from "vitest";
import { isPhoneUA } from "./device";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

describe("isPhoneUA", () => {
  it("treats iPhone as a phone", () => {
    expect(isPhoneUA(IPHONE_SAFARI)).toBe(true);
  });

  it("treats Android with the Mobile token as a phone", () => {
    expect(isPhoneUA(ANDROID_PHONE_CHROME)).toBe(true);
  });

  it("does NOT treat iPad as a phone even though its UA contains 'Mobile'", () => {
    expect(isPhoneUA(IPAD_SAFARI)).toBe(false);
  });

  it("does NOT treat an Android tablet (no Mobile token) as a phone", () => {
    expect(isPhoneUA(ANDROID_TABLET)).toBe(false);
  });

  it("does NOT treat iPad in desktop mode as a phone", () => {
    expect(isPhoneUA(IPAD_DESKTOP_MODE)).toBe(false);
  });

  it("does NOT treat desktop Chrome as a phone", () => {
    expect(isPhoneUA(DESKTOP_CHROME)).toBe(false);
  });

  it("defaults to the wide variant when the UA header is missing", () => {
    expect(isPhoneUA(null)).toBe(false);
    expect(isPhoneUA(undefined)).toBe(false);
    expect(isPhoneUA("")).toBe(false);
  });
});
