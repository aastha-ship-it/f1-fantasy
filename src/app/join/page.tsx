import { submitInviteCode } from "./actions";
import { JoinForm } from "./join-form";

/**
 * /join — invite-code gate. Ports `design/screens-aux.jsx:JoinScreen`.
 * Split layout: checkered start-line backdrop + "LIGHTS OUT." hero on the
 * left, "THE CODE" Boldonse + monospace input + Google CTA on the right.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* Left — start-line backdrop + hero */}
      <section
        className="relative flex flex-col justify-between overflow-hidden p-12 lg:p-16"
        style={{
          background: `
            repeating-conic-gradient(#0a0608 0% 25%, #1a0a0d 0% 50%) 50% / 56px 56px,
            radial-gradient(ellipse at 30% 20%, oklch(28% 0.08 27 / 0.4), transparent 60%)
          `,
        }}
      >
        <div>
          <p
            className="mb-4 flex items-center gap-2 text-xs uppercase text-[color:var(--accent)]"
            style={{ letterSpacing: "0.18em" }}
            data-tabular
          >
            <span
              aria-hidden
              className="inline-block size-2 bg-[color:var(--accent)]"
            />
            Private League · Invite-only
          </p>
          <h1
            className="m-0"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(64px, 9vw, 128px)",
              lineHeight: 1.0,
              letterSpacing: "-0.02em",
              marginTop: "var(--space-md)",
            }}
          >
            LIGHTS
            <br />
            OUT.
          </h1>
          <p
            className="mt-8 max-w-md text-base leading-relaxed text-[color:var(--fg-muted)]"
          >
            A predict-the-podium league for the group. 24 races, 8 friends, one
            season-long argument. Got the code?
          </p>
        </div>
        <p
          className="text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.12em" }}
          data-tabular
        >
          2026 Season · Private League
        </p>
      </section>

      {/* Right — code form */}
      <section className="flex flex-col justify-center bg-[color:var(--bg)] p-12 lg:px-20 lg:py-32">
        <p
          className="mb-3 text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.14em" }}
          data-tabular
        >
          Step 1 of 2 · Enter invite
        </p>
        <h2
          className="m-0 mb-8"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: "clamp(40px, 5vw, 56px)",
            lineHeight: 0.9,
            letterSpacing: "-0.01em",
          }}
        >
          THE CODE
        </h2>

        <JoinForm action={submitInviteCode} next={params.next ?? "/dashboard"} />

        <p
          className="mt-8 text-xs leading-relaxed text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.04em" }}
        >
          Wrong code? Ask Aastha for the right one.
          <br />
          Codes rotate per season.
        </p>
      </section>
    </main>
  );
}
