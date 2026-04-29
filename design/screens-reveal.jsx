// Reveal screen — the cinematic peak. Multi-beat animation:
// 1) Title slam + livery sweep
// 2) Track line draws across as transition
// 3) P3 → P2 → P1 reveal cards flip with portrait + livery
// 4) Friend prediction cards flip in sequence with score breakdown
// 5) Leaderboard reorders with rank-change deltas

const { useState, useEffect, useRef, useMemo } = React;

// Beats (in ms, total ~9.5s at 1x)
const BEATS = {
  title:        { start: 0,    end: 1400 },
  sweep:        { start: 600,  end: 2200 },
  trackDraw:    { start: 2000, end: 2900 },
  podium3:      { start: 2900, end: 3500 },
  podium2:      { start: 3500, end: 4100 },
  podium1:      { start: 4100, end: 4900 },
  silence:      { start: 4900, end: 5300 },
  friends:      { start: 5300, end: 7800 },
  leaderboard:  { start: 7800, end: 9500 },
};

function RevealScreen({ playKey = 0, speed = 1, reduced = false, sweepTeam = 'mclaren', outcome = 'normal', highlightYou = 'aastha' }) {
  const [t, setT] = useState(reduced ? 99999 : 0);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (reduced) { setT(99999); return; }
    setT(0);
    startRef.current = performance.now();
    const tick = (now) => {
      const elapsed = (now - startRef.current) * speed;
      setT(elapsed);
      if (elapsed < 11000) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playKey, speed, reduced]);

  // Outcome variants
  const result = MIAMI_RESULT.podium.map(p => p.driver);
  const friendsData = useMemo(() => {
    if (outcome === 'perfect') {
      return Object.fromEntries(FRIENDS.map(f => [f.id, { picks: result, pts: 18, breakdown: '3 exact · perfect podium', perfect: true }]));
    }
    if (outcome === 'miss') {
      return Object.fromEntries(FRIENDS.map(f => [f.id, { picks: ['VER', 'HAM', 'ALO'], pts: 0, breakdown: '0 exact · 0 slot · 3 miss' }]));
    }
    return MIAMI_PREDICTIONS;
  }, [outcome, result]);

  const beat = (b) => {
    const { start, end } = BEATS[b];
    if (t < start) return 0;
    if (t >= end) return 1;
    return (t - start) / (end - start);
  };
  const easeOut = (x) => 1 - Math.pow(1 - x, 4);
  const easeOutQuart = easeOut;

  const showPodium1 = t > BEATS.podium1.start;
  const showPodium2 = t > BEATS.podium2.start;
  const showPodium3 = t > BEATS.podium3.start;
  const showFriends = t > BEATS.friends.start;
  const showLeaderboard = t > BEATS.leaderboard.start;

  const titleP = easeOut(beat('title'));
  const sweepP = beat('sweep'); // linear for sweep
  const trackP = easeOut(beat('trackDraw'));

  return (
    <div style={{
      width: SCREEN_W, height: 1600, background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, system-ui, sans-serif', position: 'relative', overflow: 'hidden',
    }}>
      {/* TopBar */}
      <div style={{ padding: '24px 64px 0' }}>
        <TopBar active="dashboard" />
      </div>

      {/* HERO BLOCK — title + sweep */}
      <div style={{ position: 'relative', height: 520, overflow: 'hidden', marginTop: 24 }}>
        {/* Stripe BG */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(115deg, transparent 0 80px, rgba(232,0,45,0.05) 80px 82px)',
          opacity: titleP,
        }} />

        {/* Sweep car — translates across the screen at racing-stripe speed */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          transform: `translateY(-50%) translateX(${-600 + sweepP * (SCREEN_W + 1200)}px)`,
          willChange: 'transform',
        }}>
          <div style={{ filter: `blur(${sweepP > 0 && sweepP < 1 ? 4 : 0}px)`, opacity: sweepP > 0 && sweepP < 1 ? 1 : 0 }}>
            <F1Car team={sweepTeam} width={1400} style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }} />
          </div>
        </div>
        {/* Speed lines following the car */}
        {sweepP > 0 && sweepP < 1 && (
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: 600,
            left: -600 + sweepP * (SCREEN_W + 1200) - 50,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05) 60%, transparent)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Title */}
        <div style={{
          position: 'relative', padding: '60px 64px',
          opacity: titleP,
          transform: `translateX(${(1 - titleP) * -80}px) skewX(${(1 - titleP) * -8}deg)`,
        }}>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 12, letterSpacing: '0.2em',
            color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', boxShadow: '0 0 16px var(--accent)' }} />
            Reveal · Round 6 · {t > BEATS.silence.end ? 'Results in' : 'LIVE'}
          </div>
          <div data-tight style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 180, lineHeight: 0.85,
            letterSpacing: '-0.02em', textTransform: 'uppercase',
            fontStyle: 'italic',
            textShadow: titleP < 1 ? '0 0 60px rgba(232,0,45,0.5)' : 'none',
          }}>Miami<br/>
            <span style={{
              WebkitTextStroke: titleP > 0.5 ? '0' : '2px var(--accent)',
              color: titleP > 0.5 ? 'var(--fg)' : 'transparent',
              transition: 'all 400ms',
            }}>Grand Prix</span>
          </div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'var(--fg-muted)',
            letterSpacing: '0.08em', marginTop: 20, textTransform: 'uppercase',
          }}>
            Sunday 04 May 2026 · Miami Int. Autodrome · 57 Laps · Race Result Locked In
          </div>
        </div>

        {/* Track draw transition — promoted out of overlap, sits below hero text in its own band */}
        <div style={{
          position: 'absolute', bottom: 24, left: 64, right: 64, height: 56,
          opacity: trackP,
          display: 'flex', alignItems: 'center', gap: 16,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 10,
            letterSpacing: '0.18em', color: 'var(--accent)',
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            Sector ▸
          </span>
          <svg viewBox="0 0 1300 56" width="100%" height="56" preserveAspectRatio="none" style={{ flex: 1 }}>
            <path d="M 0,28 L 100,28 Q 130,28 140,18 L 200,8 Q 230,8 240,22 L 320,38 Q 360,38 380,22 L 480,10 L 600,24 L 720,10 Q 760,10 780,24 L 900,32 Q 940,32 960,22 L 1100,30 L 1300,28"
                  fill="none" stroke="var(--accent)" strokeWidth="2.5"
                  strokeDasharray="2200"
                  strokeDashoffset={2200 * (1 - trackP)} />
          </svg>
          <span style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 10,
            letterSpacing: '0.18em', color: 'var(--accent)',
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            ▸ Finish
          </span>
        </div>
      </div>

      {/* PODIUM RESULT BLOCK */}
      <div style={{ padding: '40px 64px' }}>
        <div style={{
          fontFamily: 'Boldonse, sans-serif', fontSize: 28, letterSpacing: '-0.005em',
          textTransform: 'uppercase', marginBottom: 20,
          opacity: t > BEATS.podium3.start - 200 ? 1 : 0,
          transition: 'opacity 300ms',
        }}>
          Race Result
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', alignItems: 'stretch' }}>
          {[
            { pos: 2, did: result[1], show: showPodium2, isP1: false },
            { pos: 1, did: result[0], show: showPodium1, isP1: true },
            { pos: 3, did: result[2], show: showPodium3, isP1: false },
          ].map(({ pos, did, show, isP1 }) => {
            const dr = driverById[did];
            const team = TEAMS[dr.team];
            return (
              <PodiumCard key={pos} pos={pos} dr={dr} team={team} show={show} isP1={isP1} reduced={reduced} />
            );
          })}
        </div>
        {/* Fastest lap chip */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, opacity: showPodium1 ? 1 : 0, transition: 'opacity 400ms' }}>
          <span style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '6px 12px',
            border: '1px solid var(--accent)', color: 'var(--accent)',
          }}>⚡ Fastest Lap · {MIAMI_RESULT.fastestLap.driver} · {MIAMI_RESULT.fastestLap.time}</span>
        </div>
      </div>

      {/* THE GROUP — friend prediction cards */}
      <div style={{ padding: '0 64px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 32, marginBottom: 20, opacity: showFriends ? 1 : 0, transition: 'opacity 300ms' }}>
          <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 28, letterSpacing: '-0.005em', textTransform: 'uppercase' }}>
            The Group
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              8 Friends · {Object.values(friendsData).filter(f => f.perfect).length} Perfect
            </div>
            <button style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
              padding: '8px 16px', background: 'transparent', color: 'var(--fg)',
              border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'uppercase',
            }}>Share Card →</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)' }}>
          {FRIENDS.map((f, i) => {
            const data = friendsData[f.id];
            const cardStart = BEATS.friends.start + i * 280;
            const cardP = t > cardStart ? Math.min(1, (t - cardStart) / 350) : 0;
            return (
              <FriendCard key={f.id} friend={f} data={data} result={result}
                          flipP={reduced ? 1 : cardP} isYou={f.id === highlightYou} />
            );
          })}
        </div>
      </div>

      {/* LEADERBOARD reorder */}
      <div style={{ padding: '0 64px 40px', opacity: showLeaderboard ? 1 : 0, transition: 'opacity 400ms' }}>
        <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 22, letterSpacing: '-0.005em', textTransform: 'uppercase', marginBottom: 16 }}>
          Standings · Δ This Round
        </div>
        <Leaderboard friendsData={friendsData} animate={!reduced && showLeaderboard} />
      </div>
    </div>
  );
}

// Podium card with flip animation
function PodiumCard({ pos, dr, team, show, isP1, reduced }) {
  const [flipped, setFlipped] = useState(reduced);
  useEffect(() => {
    if (show && !reduced) {
      const id = setTimeout(() => setFlipped(true), 80);
      return () => clearTimeout(id);
    }
    if (reduced) setFlipped(true);
  }, [show, reduced]);
  return (
    <div style={{
      background: isP1 ? 'var(--surface-2)' : 'var(--surface)',
      padding: isP1 ? '40px 32px' : '28px 24px',
      minHeight: isP1 ? 320 : 260,
      perspective: 1400, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', height: '100%', minHeight: isP1 ? 280 : 220,
        transformStyle: 'preserve-3d',
        WebkitTransformStyle: 'preserve-3d',
        transform: flipped ? 'rotateY(0deg) translateZ(0)' : 'rotateY(-180deg) translateZ(0)',
        transition: reduced ? 'none' : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
        transformOrigin: 'center',
        position: 'relative',
      }}>
        {/* Front (revealed) — left: pos+driver text, right: full-bleed portrait */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(0deg) translateZ(0.01px)',
          background: `linear-gradient(135deg, ${team.livery[1]} 0%, #000 100%)`, overflow: 'hidden',
        }}>
          {/* Driver portrait — anchored right, ~55% of width */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '58%' }}>
            <img src={driverPortraitSrc(dr.id)} alt=""
                 style={{
                   width: '100%', height: '100%',
                   objectFit: 'cover',
                   objectPosition: 'center top',
                 }} />
            {/* Fade-into-card on the left edge of photo */}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%',
              background: `linear-gradient(90deg, ${team.livery[1]} 0%, transparent 100%)`,
            }} />
          </div>
          {/* Livery accent bar bottom */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: `linear-gradient(90deg, ${team.hex}, ${team.livery[2]})`, zIndex: 2 }} />

          {/* Left column — number + text, never overlaps photo */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: '52%',
            padding: isP1 ? 24 : 18,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            zIndex: 1,
          }}>
            <div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {pos === 1 ? 'Classified P1 · Winner' : `P${pos}`}
              </div>
              <div data-tight style={{
                fontFamily: 'Boldonse, sans-serif',
                fontSize: isP1 ? 180 : 130,
                lineHeight: 0.82, marginTop: 4,
                color: isP1 ? 'var(--accent)' : '#fff',
                textShadow: '0 4px 24px rgba(0,0,0,0.6)',
              }}>{pos}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: isP1 ? 36 : 24, letterSpacing: '0.02em', color: '#fff' }}>{dr.id}</span>
              <span style={{ fontWeight: 500, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{dr.first} {dr.last}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <TeamLogo team={dr.team} size={20} />
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: team.hex, fontWeight: 600 }}>{team.name}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Back (face-down) */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg) translateZ(0.01px)',
          background: `repeating-linear-gradient(45deg, ${team.hex}22 0 14px, ${team.hex}33 14px 28px)`,
          border: `1px solid ${team.hex}55`,
          display: 'grid', placeItems: 'center',
        }}>
          <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 80, color: team.hex, opacity: 0.4 }}>?</div>
        </div>
      </div>
    </div>
  );
}

// Friend prediction card with flip + score breakdown
function FriendCard({ friend, data, result, flipP, isYou }) {
  const flipped = flipP > 0.5;
  return (
    <div style={{
      background: data.perfect ? 'linear-gradient(180deg, rgba(232,0,45,0.10), var(--surface) 50%)' : 'var(--surface)',
      padding: 20, perspective: 1200, minHeight: 220, position: 'relative',
      outline: isYou ? '1px solid var(--accent)' : 'none',
      outlineOffset: -1,
    }}>
      {isYou && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>YOU</div>
      )}
      <div style={{
        width: '100%', height: '100%', minHeight: 200,
        transformStyle: 'preserve-3d',
        WebkitTransformStyle: 'preserve-3d',
        transform: flipped ? 'rotateY(0deg) translateZ(0)' : 'rotateY(-180deg) translateZ(0)',
        transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
        position: 'relative',
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(0deg) translateZ(0.01px)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 22, letterSpacing: '-0.005em' }}>{friend.name}</div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 26, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: data.pts >= 10 ? 'var(--success)' : data.pts === 0 ? 'var(--fg-subtle)' : 'var(--fg)' }}>{data.pts}</div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
            padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          }}>
            {data.picks.map((pid, i) => {
              const correctSlot = result[i] === pid;
              const wrongSlot = !correctSlot && result.includes(pid);
              const miss = !correctSlot && !wrongSlot;
              const dr = driverById[pid];
              const t = TEAMS[dr.team];
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>P{i + 1}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DriverPhoto driverId={pid} size={28} />
                    <span style={{
                      fontFamily: 'Boldonse, sans-serif', fontSize: 14, letterSpacing: '0.02em',
                      color: correctSlot ? 'var(--success)' : wrongSlot ? 'var(--warning)' : 'var(--fg-subtle)',
                      textDecoration: miss ? 'line-through' : 'none',
                    }}>{pid}</span>
                  </div>
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: correctSlot ? 'var(--success)' : wrongSlot ? 'var(--warning)' : 'var(--fg-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {correctSlot ? '✓ exact +5' : wrongSlot ? '⊙ slot +2' : '× miss'}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.04em' }}>
            {data.breakdown}
          </div>
          {data.perfect && (
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent)', padding: '4px 10px', border: '1px solid var(--accent)', alignSelf: 'flex-start' }}>
              ★ Perfect Podium
            </span>
          )}
        </div>
        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg) translateZ(0.01px)',
          background: `repeating-linear-gradient(45deg, ${TEAMS[friend.team].hex}22 0 12px, ${TEAMS[friend.team].hex}33 12px 24px)`,
          border: `1px solid ${TEAMS[friend.team].hex}55`,
          display: 'grid', placeItems: 'center',
        }}>
          <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 44, color: TEAMS[friend.team].hex, opacity: 0.5 }}>{friend.name[0]}</div>
        </div>
      </div>
    </div>
  );
}

// Leaderboard with rank-change deltas
function Leaderboard({ friendsData, animate }) {
  const [step, setStep] = useState(animate ? 0 : 2);
  useEffect(() => {
    if (!animate) { setStep(2); return; }
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 100);
    const t2 = setTimeout(() => setStep(2), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [animate]);

  // Pre-round and post-round standings
  const ranked = useMemo(() => {
    const arr = FRIENDS.map(f => {
      const newPts = f.points + (friendsData[f.id]?.pts ?? 0);
      return { ...f, newPts };
    });
    const before = [...arr].sort((a, b) => b.points - a.points)
      .map((f, i) => ({ id: f.id, rank: i + 1 }));
    const after = [...arr].sort((a, b) => b.newPts - a.newPts);
    const beforeMap = Object.fromEntries(before.map(b => [b.id, b.rank]));
    return after.map((f, i) => ({ ...f, newRank: i + 1, oldRank: beforeMap[f.id], delta: beforeMap[f.id] - (i + 1) }));
  }, [friendsData]);

  const rowH = 56;
  const display = step === 0
    ? [...ranked].sort((a, b) => a.oldRank - b.oldRank)
    : ranked;

  return (
    <div style={{ position: 'relative', height: ranked.length * rowH, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {ranked.map((f) => {
        const t = TEAMS[f.team];
        const idx = display.findIndex(d => d.id === f.id);
        const data = friendsData[f.id];
        return (
          <div key={f.id} style={{
            position: 'absolute', left: 0, right: 0, height: rowH,
            top: idx * rowH,
            display: 'grid', gridTemplateColumns: '60px 60px 40px 1fr 60px 80px 80px', gap: 16,
            padding: '0 24px', alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            background: idx === 0 ? 'var(--surface-2)' : 'transparent',
            transition: animate ? 'top 700ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}>
            <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 22, color: idx === 0 ? 'var(--accent)' : 'var(--fg)' }}>{f.newRank}</span>
            {step === 2 && f.delta !== 0 ? (
              <span style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 12, fontWeight: 500,
                color: f.delta > 0 ? 'var(--success)' : 'var(--error)',
                letterSpacing: '0.04em',
              }}>
                {f.delta > 0 ? `▲${f.delta}` : `▼${Math.abs(f.delta)}`}
              </span>
            ) : <span />}
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontFamily: 'Boldonse, sans-serif', fontSize: 13, border: `1px solid ${t.hex}` }}>{f.name[0]}</div>
            <div>
              <span style={{ fontWeight: 500, fontSize: 15 }}>{f.name}</span>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: t.hex, letterSpacing: '0.1em', textTransform: 'uppercase', marginLeft: 12 }}>Team {TEAMS[f.team].name}</span>
            </div>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: data?.pts >= 10 ? 'var(--success)' : 'var(--fg-muted)', textAlign: 'right' }}>
              +{data?.pts ?? 0}
            </span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{step === 0 ? f.points : f.newPts}</span>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--fg-subtle)', textAlign: 'right', letterSpacing: '0.06em', textTransform: 'uppercase' }}>PTS</span>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { RevealScreen });
