import Image from "next/image";
import { F1Mark } from "@/components/F1Mark";
import { GoogleSignInButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
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

      {/* Right — login form */}
      <section className="flex flex-col justify-between px-8 py-10 sm:px-16 sm:py-16">
        <div className="flex items-center gap-3 text-[color:var(--fg)]">
          <F1Mark height={28} />
          <span
            className="text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.2em" }}
            data-tabular
          >
            Fantasy · The Group
          </span>
        </div>

        <div>
          <p
            className="mb-6 text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.18em" }}
            data-tabular
          >
            Sign in to predict
          </p>
          <h1
            className="m-0 tracking-tight"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(48px, 7vw, 80px)",
              lineHeight: 1.05,
            }}
          >
            CALL THE RACE.
          </h1>
          <p className="mt-6 max-w-md text-base text-[color:var(--fg-muted)] leading-relaxed">
            Lock your podium picks before lights out. Reveal together when the
            chequered flag drops. One season. One champion.
          </p>

          <div className="mt-12 flex max-w-md flex-col gap-3">
            <GoogleSignInButton next={next} />
            <p
              className="mt-2 text-xs text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.06em" }}
              data-tabular
            >
              Invite-only league · Code already on this device ✓
            </p>
          </div>
        </div>

        <div
          className="flex justify-between text-xs uppercase text-[color:var(--fg-subtle)]"
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
