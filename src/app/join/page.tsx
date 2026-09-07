import { F1Mark } from "@/components/F1Mark";
import { submitInviteCode } from "./actions";
import { JoinForm } from "./join-form";

/**
 * /join — invite-code gate. Ports `design/screens-aux.jsx:JoinScreen`.
 * Split layout: checkered start-line backdrop + "LIGHTS OUT." hero on the
 * left, "THE CODE" Boldonse + monospace input + Google CTA on the right.
 *
 * 390pt fork (PR-2 §5). Canvas: `screens-mobile-c.jsx:MobJoinScreen`.
 *
 * Like /login, the mobile tree is NOT a twin of the form column: there is
 * exactly one `<JoinForm>` (one `input[name="code"]`, one button whose
 * accessible name "Continue" the e2e binds to), so the column is forked BY
 * CLASSES and only the checkered hero drops out below the fork. The split
 * is `lg:`, so 780–1023 keeps today's stacked pair untouched.
 *
 * Padding forks keep base and `md:` on the SAME property granularity
 * (px/pt/pb both sides, never `p-*` against `px-*`): Tailwind sorts
 * `pt`/`pb` after `p`/`py` regardless of breakpoint, so a base `pt-6`
 * would outrank a `md:p-12` and silently ship the phone padding to 1440.
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
        className="relative hidden flex-col justify-between overflow-hidden p-12 md:flex lg:p-16"
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
          <p className="mt-8 max-w-md text-base leading-relaxed text-[color:var(--fg-muted)]">
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
      <section className="relative flex flex-col overflow-hidden bg-[color:var(--bg)] px-5 pb-6 pt-6 md:static md:justify-center md:overflow-visible md:px-12 md:pb-12 md:pt-12 lg:px-20 lg:pb-32 lg:pt-32">
        {/* The canvas's 115deg stripe wash. Mobile-only, and inside the
            section's own `overflow-hidden` so it can never scroll the page. */}
        <div
          aria-hidden
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "repeating-linear-gradient(115deg, transparent 0 50px, rgba(232,0,45,0.04) 50px 52px)",
          }}
        />

        <div className="relative flex items-center gap-2.5 text-[color:var(--fg)] md:hidden">
          <F1Mark height={18} />
          <span
            className="uppercase text-[color:var(--fg-subtle)]"
            data-tabular
            style={{ fontSize: 9, letterSpacing: "0.16em" }}
          >
            Invite only
          </span>
        </div>

        <p
          className="mb-3 hidden text-xs uppercase text-[color:var(--fg-subtle)] md:block"
          style={{ letterSpacing: "0.14em" }}
          data-tabular
        >
          Step 1 of 2 · Enter invite
        </p>

        {/* Pattern B on the headline: the desktop <h2> keeps its exact copy
            and metrics, and the phone gets the canvas's h1 — which is also
            the only <h1> on the route below the fork, since the "LIGHTS
            OUT." hero is `hidden md:flex`. Neither is a test anchor. */}
        <h1
          className="relative m-0 mt-9 md:hidden"
          data-tight
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 56,
            lineHeight: 0.86,
          }}
        >
          YOU NEED
          <br />A CODE.
        </h1>
        <p className="relative mt-4 text-sm leading-[1.55] text-[color:var(--fg-muted)] md:hidden">
          A predict-the-podium league for the group. 24 races, 8 friends, one
          season-long argument. Got the code?
        </p>

        <h2
          className="m-0 mb-8 hidden md:block"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: "clamp(40px, 5vw, 56px)",
            lineHeight: 0.9,
            letterSpacing: "-0.01em",
          }}
        >
          THE CODE
        </h2>

        <JoinForm
          action={submitInviteCode}
          next={params.next ?? "/dashboard"}
        />

        <p
          className="relative mt-3 text-[10px] leading-relaxed text-[color:var(--fg-subtle)] md:static md:mt-8 md:text-xs"
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
