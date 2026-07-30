import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "globals.css"), "utf8");

describe("globals.css design tokens", () => {
  it("pins the mobile/desktop fork to 780px via the md breakpoint", () => {
    expect(css).toMatch(/--breakpoint-md:\s*780px/);
  });

  it("never defines a --spacing-* token (would hijack p-*/max-w-* utilities)", () => {
    expect(css).not.toMatch(/--spacing-[a-z0-9-]+\s*:/);
  });
});
