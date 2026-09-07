import Image from "next/image";
import { F1Mark } from "@/components/F1Mark";
import { GoogleSignInButton } from "./google-button";

/**
 * 390pt fork (PR-2 §4). Canvas: `screens-mobile-c.jsx:MobLoginScreen`.
 *
 * NOT the plan's "hide the whole form column and build a mobile twin": there
 * is exactly ONE `<GoogleSignInButton>` on this route and it must be visible
 * at every width, so a second subtree would either duplicate the client
 * island (two controls named "Sign in with Google") or leave one width
 * without a sign-in. So the form column is forked BY CLASSES (pattern A) and
 * the only new subtree is the canvas's 300px livery band, which is
 * `md:hidden` and therefore invisible to the >=780 render.
 *
 * The desktop split is `lg:`, so 780–1023 keeps today's single stacked
 * column exactly as it is.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    /* `grid-rows` only exists below the fork, where the band is row 1 and the
       column takes the rest; `md:grid-rows-none` is the CSS initial value, so
       the >=780 grid is the one-implicit-row grid it is today. */
    <main className="grid min-h-dvh grid-cols-1 grid-rows-[300px_1fr] md:grid-rows-none lg:grid-cols-[1.1fr_1fr]">
      {/* Mobile-only livery band — the desktop left column, compressed into
          the top 300px. `overflow-hidden` is load-bearing: the 520px car is
          wider than a 390pt screen on purpose (cinematic crop) and the clip
          is what keeps the page from scrolling sideways. */}
      <section
        aria-hidden
        className="relative grid place-items-center overflow-hidden border-b border-[color:var(--border)] bg-[#0a0608] md:hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(115deg, transparent 0 40px, rgba(232,0,45,0.05) 40px 42px)",
          }}
        />
        <div
          className="relative"
          style={{ transform: "rotate(-8deg)", opacity: 0.95 }}
        >
          <Image
            src="/assets/cars/ferrari.png"
            alt=""
            width={520}
            height={156}
            unoptimized
            priority
            className="select-none"
            style={{
              width: 520,
              height: "auto",
              maxWidth: "none",
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.7))",
            }}
          />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, rgba(10,6,8,0.85) 100%)",
          }}
        />
        <div className="absolute left-5 top-5 flex items-center gap-2.5 text-[color:var(--fg)]">
          <F1Mark height={18} />
          <span
            className="uppercase text-[color:var(--fg-subtle)]"
            data-tabular
            style={{ fontSize: 9, letterSpacing: "0.16em" }}
          >
            Fantasy · The Group
          </span>
        </div>
        <p
          className="absolute bottom-4 left-5 m-0 uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.16em" }}
        >
          2026 Season · Round 6 · Miami GP — May 4
        </p>
      </section>

      {/* Left — cinematic livery panel */}
      <section className="relative hidden overflow-hidden bg-[#0a0608] lg:flex lg:items-center lg:justify-center">
        {/* Diagonal stripes */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(115deg, transparent 0 60px, rgba(232,0,45,0.04) 60px 62px)",
          }}
        />
        {/* Rotated Ferrari — design canvas spec: width 1100px, rotated -8deg,
         * translated -40px. The car deliberately overflows the panel for a
         * cinematic crop. Don't try to fit it inside the panel.
         */}
        <div
          aria-hidden
          className="relative"
          style={{
            transform: "rotate(-8deg) translateX(-40px)",
            opacity: 0.95,
            filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.7))",
          }}
        >
          <Image
            src="/assets/cars/ferrari.png"
            alt=""
            width={1100}
            height={330}
            priority
            className="h-auto w-[1100px] max-w-none"
          />
        </div>
        {/* Right-edge fade */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, transparent 70%, rgba(0,0,0,0.7) 100%)",
          }}
        />
        {/* Bottom edge text */}
        <p
          className="absolute bottom-8 left-8 text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.15em" }}
          data-tabular
        >
          2026 Season · Round 6 · Miami GP — May 4
        </p>
      </section>

      {/* Right — login form. Forked by classes; today's >=780 values are
          `sm:px-16 sm:py-16` (the base `px-8 py-10` was only ever visible
          below 640), so `md:px-16 md:py-16` reproduces them exactly. */}
      <section className="flex flex-col px-5 pb-6 pt-7 md:justify-between md:px-16 md:pb-16 md:pt-16">
        <div className="hidden items-center gap-3 text-[color:var(--fg)] md:flex">
          <F1Mark height={28} />
          <span
            className="text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.2em" }}
            data-tabular
          >
            Fantasy · The Group
          </span>
        </div>

        {/* `flex-1` below the fork so the CTA block's `mt-auto` can push the
            sign-in to the bottom of the screen; `md:block md:flex-initial`
            is the plain <div> it is today. */}
        <div className="flex flex-1 flex-col md:block md:flex-initial">
          <p
            className="mb-3.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--fg-subtle)] md:mb-6 md:text-xs md:tracking-[0.18em]"
            data-tabular
          >
            Sign in to predict
          </p>
          {/* Same two tricks as the profile h1: the 48px clamp floor was
              already dead at >=780 (7vw is 54.6px there), so lowering it to
              the canvas's 54 changes nothing above the fork; and line-height
              has to stay inline — the global `[style*="Boldonse"]` rule is
              unlayered and outranks every utility — so it reads a custom
              property the breakpoint switches. The <br/> is `md:hidden`, so
              the desktop headline is still one line. */}
          <h1
            className="m-0 tracking-tight [--h1-lh:0.88] md:[--h1-lh:1.05]"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(54px, 7vw, 80px)",
              lineHeight: "var(--h1-lh)",
            }}
          >
            CALL
            <br className="md:hidden" /> THE RACE.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-[1.55] text-[color:var(--fg-muted)] md:mt-6 md:text-base md:leading-relaxed">
            Lock your podium picks before lights out. Reveal together when the
            chequered flag drops. One season. One champion.
          </p>

          <div className="mt-auto flex max-w-md flex-col gap-3 md:mt-12">
            <GoogleSignInButton next={next} />
            <p
              className="mt-2 text-center text-[9px] text-[color:var(--fg-subtle)] md:text-left md:text-xs"
              style={{ letterSpacing: "0.06em" }}
              data-tabular
            >
              Invite-only league · Code already on this device ✓
            </p>
          </div>
        </div>

        <div
          className="hidden justify-between text-xs uppercase text-[color:var(--fg-subtle)] md:flex"
          style={{ letterSpacing: "0.08em" }}
          data-tabular
        >
          <span>Pre-season</span>
          <span>Season 2026 · 19 rounds left</span>
        </div>
      </section>
    </main>
  );
}
