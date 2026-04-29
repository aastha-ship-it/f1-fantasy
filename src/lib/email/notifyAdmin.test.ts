import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyAdmin } from "./notifyAdmin";

const ORIGINAL_ENV = { ...process.env };

describe("notifyAdmin", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "evt_x" }), { status: 200 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...ORIGINAL_ENV };
  });

  it("E1 · returns skipped=true when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await notifyAdmin({
      subject: "test",
      body: "hello",
    });
    if (result.sent) throw new Error("expected sent=false");
    expect(result.reason).toBe("RESEND_API_KEY missing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("E2 · returns skipped=true when ADMIN_EMAIL is missing", async () => {
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.ADMIN_EMAIL;
    const result = await notifyAdmin({ subject: "x", body: "y" });
    if (result.sent) throw new Error("expected sent=false");
    expect(result.reason).toBe("ADMIN_EMAIL missing");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("E3 · POSTs to Resend with auth + payload when configured", async () => {
    process.env.RESEND_API_KEY = "re_secret";
    process.env.ADMIN_EMAIL = "admin@example.com";
    process.env.RESEND_FROM = "F1 <noreply@f1.example.com>";

    const result = await notifyAdmin({
      subject: "Cron failed",
      body: "OpenF1 returned 500",
    });

    expect(result.sent).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_secret");
    const body = JSON.parse(init?.body as string);
    expect(body.to).toEqual(["admin@example.com"]);
    expect(body.from).toBe("F1 <noreply@f1.example.com>");
    expect(body.subject).toBe("Cron failed");
    expect(body.text).toBe("OpenF1 returned 500");
  });

  it("E4 · returns sent=false when Resend returns non-2xx", async () => {
    process.env.RESEND_API_KEY = "re_secret";
    process.env.ADMIN_EMAIL = "admin@example.com";
    fetchSpy.mockResolvedValueOnce(
      new Response("rate limited", { status: 429 }),
    );

    const result = await notifyAdmin({ subject: "x", body: "y" });
    if (result.sent) throw new Error("expected sent=false");
    expect(result.reason).toContain("429");
  });
});
