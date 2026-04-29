# Design port — Claude design canvas → production

**Date:** 2026-04-28 · **Owner:** Aastha
**Source:** `design/` Claude-design canvas (data.jsx, screens-*.jsx, F1 Fantasy.html)
**Out of scope:** No DB changes. All deltas are component / asset / styling work.

## Scope (4 passes)

### Pass 1 — Foundation (no UI change visible yet)

1. Copy `design/assets/{drivers,drivers-portrait,cars,logos}/*` → `public/assets/{...}` so Next serves them.
2. Add design tokens to `src/app/globals.css`:
   - Boldonse line-height + padding fix (prevents ascender clipping on hero text)
   - Team hex CSS vars (`--team-mclaren-hex: #FF8000`, etc.) for inline borders/badges
   - `--ease-out-quart`, `--ease-in-out-cubic` motion curves
3. New module `src/lib/design/teams.ts`: `TEAM_META` map keyed by canonical team string ("McLaren", "Ferrari", ...) → `{ slug, hex, livery, logoSrc, carSrc, short }`. Single source of truth for team styling everywhere downstream.
4. New module `src/lib/design/drivers.ts`: helpers `driverPortraitSrc(code)` (`/assets/drivers-portrait/${code}.png`), `driverHeadshotSrc(code)`, plus a static `DRIVER_META` map keyed by 3-letter code → `{ country, num }` lifted from `data.jsx` (data we don't currently store in DB but need for the design).
5. New component `src/components/TopBar.tsx` — used on every authenticated screen. Tabs: Calendar (dashboard) · Predict · Standings · League · Profile. User initial avatar right.
6. New component `src/components/TrackDiagram.tsx` — wraps the SVG path data lifted from `design/data.jsx:TRACKS`, accepts `circuit` prop (string we map to slug) and renders the path.

### Pass 2 — Core authenticated screens

7. **Login** (`src/app/login/page.tsx`): split layout, left cinematic hero (rotated F1 car SVG, diagonal stripes, lock countdown footer), right form column ("CALL THE RACE" title, Google button).
8. **Profile** (`src/app/profile/page.tsx`): full design — TopBar, hero + 5×2 team grid + 5×2 driver grid + "All-Time Hero" past-driver card, footer save row.
9. **Dashboard** (`src/app/dashboard/page.tsx`): hero next-race card with track diagram + countdown, 4-col calendar grid (round + flag + city + diagram + status badge), driver-standings + constructor-standings preview rails (top 6 each).
10. **Predict list** (`src/app/dashboard/predict/page.tsx`): 3-column hero next-event card (round info | track diagram | picks-needed + lock countdown + continue CTA), then two-column "Revealed · 5 races" / "Upcoming" lists below.

### Pass 3 — Standings + Predict-detail · ☑ (shipped 2026-04-28)

11. **Predict detail** (`src/app/dashboard/predict/[eventId]/page.tsx` + `driver-picker.tsx`) ✅: 3-col hero (round info | track diagram | live countdown). Slot cards with team-livery watermark cars (`/assets/cars/{slug}.png` at 32% opacity), big Boldonse `P1/P2/P3` numerals, portrait + driver chip + team badge, per-slot telemetry strip (form L5, at-track podiums (10y), quali Δ race). 10-col driver grid (auto-fill min 96px) with team-color top border, check overlay on picked drivers + 0.4 opacity dim. Sticky bottom lock bar with live countdown that pulses amber inside T-60s.
12. **World standings** (`src/app/dashboard/standings/page.tsx`) ✅: TopBar + Boldonse "WORLD STANDINGS" hero + Championship Leader card (team-livery bg, driver portrait, hex-tinted team line, pts/wins/podiums tally). Two-column main: drivers (1.5fr) with left-edge team-color stripe, portrait, gap-to-leader, team logo + short, W/POD/PTS columns. Constructors (1fr) with bar-chart-of-leader background fill + team logo + short tally line.
13. **League standings** (`src/app/dashboard/league/page.tsx`) ✅: TopBar + Boldonse "LEAGUE STANDINGS" hero + 3-col podium block (P2 | P1 wider centered with accent-red numeral | P3). Each podium card uses the user's `favorite_team` car as a watermark and tints the team line with the team hex. Positions 4–N render as bar-chart rows below (rank | initial circle bordered with fav-team hex | name + team line + PP + 🔥 streak | bar showing % of leader points | total pts).

### Pass 4 — Reveal · ☑ (shipped 2026-04-28, full cinematic complete)

14. **Reveal** (`src/app/reveal/[eventId]/page.tsx` + `reveal-stage.tsx`) ✅ full canvas:
    - TopBar + cinematic intro hero owned by `RevealStage` (client). Five animated layers driven entirely by Framer Motion (no RAF loop):
      - **Stripe wash bg** fades in 0–1.4s (accent-tint repeating diagonal gradient).
      - **Title slam** 0–1.4s: Boldonse italic name slides in from `x: -80, skewX: -8°` on `EASE_OUT_QUART`, accent eyebrow + datetime copy fade in alongside.
      - **Livery sweep car** 0.6–2.2s: winner's `teamMeta(p1).carSrc` translates from `x:-60%` to `x:120%` over 1.6s linear, with blur+opacity envelope `[0,1,1,0]` × `times: [0, 0.05, 0.95, 1]`. A sibling speed-line gradient strip rides the same envelope, no blur.
      - **Track-draw** 2.0–2.9s: full-width SVG using the existing `trackPath()` library, animating `motion.path` `pathLength: 0 → 1` over 0.9s.
      - **Replay button** fades in at 2.9s; bumps a `playKey` state appended to every motion node's `key` to re-mount and replay the full ~9.5s sequence.
    - Race result podium (3.3s onward): 3-col P2 | P1 (wider 1.4fr, accent-red number + bigger portrait) | P3 with team-livery car watermarks at 18%. Stagger P3 → P2 → P1 at 180ms.
    - Friend pick gallery (cascades after podium): auto-fill 280px-min cards. Display name in Boldonse + points in mono (accent-red on perfect podium) + per-slot rows with portrait + code + team-tinted border.
    - **Reduced-motion path** suppresses the cinematic entirely (renders `StaticHero` instead) and collapses all delays to 0 so podium + friends appear instantly. Not throttled motion — structurally absent.

## Files modified (high level)

- `src/app/globals.css` — tokens
- `src/lib/design/{teams,drivers}.ts` — new modules
- `src/components/{TopBar,TrackDiagram,DriverPortrait,F1Car}.tsx` — new components
- `src/app/{dashboard,login,profile,reveal,...}/**/*.tsx` — screens

## Risks

- **Boldonse rendering** — `[style*="Boldonse"]` selector in globals is broad; verify it doesn't bleed into Geist headings.
- **Asset weight** — 60+ PNGs for drivers/cars/logos. Total ~MB. Vercel CDN handles, but cold-loads will be larger. Consider WebP later.
- **Trademark** — F1 / team logos are trademarked. We're a private friend league; documented in CLAUDE.md "What NOT to do" already (default to color-dot + 3-letter code if it ever opens up). Going to use the design's PNG logos in this build because the user supplied them.
- **3D flip choreography** — Already mostly there in `reveal-stage.tsx`. Pass 4 is timing tweaks + portrait imagery, not a rewrite.
- **TopBar on existing pages** — adding it changes every authenticated layout's vertical rhythm. Pages currently start with `← Dashboard` link; TopBar replaces that pattern.

## Verification per pass

After each pass: `bun run typecheck && bun run lint && bun run build` clean. Browser screenshot of each modified screen via Playwright.
