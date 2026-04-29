// F1 World Championship Standings — mirrors formula1.com/en/results/2026
// Driver standings, constructor standings, wins, podiums, fastest laps.

function WorldStandingsScreen() {
  // Mock 2026 driver season — 5 races completed, points per official 2026 scale.
  // Sums roughly approximate a McLaren/Ferrari early-season fight.
  const driverSeason = [
    { id: "PIA", pts: 113, wins: 3, podiums: 4, poles: 2, fast: 1 },
    { id: "NOR", pts: 99,  wins: 1, podiums: 4, poles: 2, fast: 2 },
    { id: "LEC", pts: 87,  wins: 1, podiums: 3, poles: 1, fast: 0 },
    { id: "VER", pts: 71,  wins: 0, podiums: 2, poles: 0, fast: 1 },
    { id: "RUS", pts: 58,  wins: 0, podiums: 1, poles: 0, fast: 0 },
    { id: "HAM", pts: 52,  wins: 0, podiums: 1, poles: 0, fast: 1 },
    { id: "ANT", pts: 41,  wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "ALO", pts: 28,  wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "SAI", pts: 22,  wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "ALB", pts: 19,  wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "TSU", pts: 14,  wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "GAS", pts: 11,  wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "HAD", pts: 9,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "BEA", pts: 6,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "STR", pts: 5,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "OCO", pts: 4,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "HUL", pts: 3,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "LAW", pts: 2,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "BOR", pts: 1,   wins: 0, podiums: 0, poles: 0, fast: 0 },
    { id: "DOO", pts: 0,   wins: 0, podiums: 0, poles: 0, fast: 0 },
  ];

  // Constructor standings — sum each team's two drivers
  const constructorSeason = Object.keys(TEAMS).map(team => {
    const drivers = driverSeason.filter(d => driverById[d.id].team === team);
    return {
      team,
      pts: drivers.reduce((s, d) => s + d.pts, 0),
      wins: drivers.reduce((s, d) => s + d.wins, 0),
      podiums: drivers.reduce((s, d) => s + d.podiums, 0),
      drivers: drivers.map(d => d.id),
    };
  }).sort((a, b) => b.pts - a.pts);

  const leaderPts = driverSeason[0].pts;
  const constructorLeaderPts = constructorSeason[0].pts;

  return (
    <div style={{
      padding: '40px 56px 56px',
      background: 'var(--bg)',
      minHeight: '100%',
      color: 'var(--fg)',
      fontFamily: 'Geist, sans-serif',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {/* Top nav strip — F1.com style */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 16, borderBottom: '1px solid var(--border)',
        fontFamily: 'Geist Mono, monospace', fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--fg-subtle)',
      }}>
        <span>F1 Fantasy · The Group · 2026</span>
        <span style={{ display: 'flex', gap: 24 }}>
          <span style={{ color: 'var(--fg)' }}>F1 World Standings</span>
          <span>The Group</span>
          <span>Predict</span>
          <span>Calendar</span>
        </span>
      </div>

      {/* Hero */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 64,
        marginTop: 40, marginBottom: 56,
        paddingBottom: 32, borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 12,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fg-subtle)', marginBottom: 12,
          }}>
            2026 FIA Formula One World Championship · Round 5 of 24 complete
          </div>
          <h1 style={{
            fontFamily: 'Boldonse, sans-serif',
            fontSize: 88, lineHeight: 0.9, letterSpacing: '-0.015em',
            textTransform: 'uppercase', margin: 0,
          }}>
            World<br/>Standings
          </h1>
          <div style={{
            marginTop: 20, fontFamily: 'Geist Mono, monospace', fontSize: 13,
            color: 'var(--fg-muted)', letterSpacing: '0.04em',
          }}>
            After Saudi Arabia GP · Next: Miami · 04 May
          </div>
        </div>

        {/* Right — championship leader card */}
        <div style={{
          background: TEAMS[driverById[driverSeason[0].id].team].livery[1],
          padding: '24px 28px',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
          position: 'relative', overflow: 'hidden',
          boxShadow: `inset 0 -3px 0 ${TEAMS[driverById[driverSeason[0].id].team].hex}`,
        }}>
          <div>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 10,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)', marginBottom: 8,
            }}>
              Championship leader
            </div>
            <div style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 32,
              lineHeight: 1, color: '#fff',
            }}>
              {driverById[driverSeason[0].id].first}<br/>{driverById[driverSeason[0].id].last}
            </div>
            <div style={{
              marginTop: 12, fontFamily: 'Geist Mono, monospace', fontSize: 11,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: TEAMS[driverById[driverSeason[0].id].team].hex,
            }}>
              {TEAMS[driverById[driverSeason[0].id].team].name} · #{driverById[driverSeason[0].id].num}
            </div>
            <div style={{
              marginTop: 16, display: 'flex', gap: 24,
              fontFamily: 'Geist Mono, monospace', fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
            }}>
              <span><strong style={{ color: '#fff', fontSize: 18 }}>{driverSeason[0].pts}</strong> pts</span>
              <span><strong style={{ color: '#fff', fontSize: 18 }}>{driverSeason[0].wins}</strong> wins</span>
              <span><strong style={{ color: '#fff', fontSize: 18 }}>{driverSeason[0].podiums}</strong> podiums</span>
            </div>
          </div>
          <div style={{ width: 140, height: 140, position: 'relative' }}>
            <DriverPhoto driverId={driverSeason[0].id} size={140} />
          </div>
        </div>
      </div>

      {/* Two-column main: drivers (wide) + constructors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 48, marginBottom: 56 }}>

        {/* DRIVER STANDINGS */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 20,
          }}>
            <h2 style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 28,
              letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0,
            }}>
              Driver Standings
            </h2>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              20 drivers
            </span>
          </div>

          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 64px 1fr 90px 60px 60px 60px 80px',
            gap: 12, padding: '8px 12px',
            fontFamily: 'Geist Mono, monospace', fontSize: 10,
            color: 'var(--fg-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Pos</span>
            <span></span>
            <span>Driver</span>
            <span>Team</span>
            <span style={{ textAlign: 'right' }}>Wins</span>
            <span style={{ textAlign: 'right' }}>Pod</span>
            <span style={{ textAlign: 'right' }}>FL</span>
            <span style={{ textAlign: 'right' }}>Pts</span>
          </div>

          {driverSeason.map((row, idx) => {
            const dr = driverById[row.id];
            const t = TEAMS[dr.team];
            const isLeader = idx === 0;
            const gap = idx === 0 ? null : `+${leaderPts - row.pts}`;
            return (
              <div key={row.id} style={{
                display: 'grid',
                gridTemplateColumns: '40px 64px 1fr 90px 60px 60px 60px 80px',
                gap: 12, padding: '14px 12px',
                alignItems: 'center',
                borderBottom: '1px solid var(--border)',
                background: isLeader ? 'var(--surface-2)' : 'transparent',
                position: 'relative',
              }}>
                {/* team color stripe (left edge) */}
                <span style={{
                  position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
                  background: t.hex,
                }} />
                <span style={{
                  fontFamily: 'Boldonse, sans-serif', fontSize: 22,
                  color: isLeader ? 'var(--accent)' : 'var(--fg)',
                  paddingLeft: 8,
                }}>
                  {idx + 1}
                </span>
                <DriverPhoto driverId={row.id} size={48} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 16, letterSpacing: '0.02em' }}>
                    {dr.first} {dr.last}
                  </span>
                  <span style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 10,
                    letterSpacing: '0.08em', color: 'var(--fg-subtle)',
                  }}>
                    #{dr.num} · {dr.country} · {gap || 'LEADER'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TeamLogo team={dr.team} size={20} />
                  <span style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 11,
                    color: t.hex, letterSpacing: '0.06em', fontWeight: 600,
                  }}>{t.short}</span>
                </div>
                <span style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 14, textAlign: 'right',
                  color: row.wins > 0 ? 'var(--fg)' : 'var(--fg-subtle)',
                }}>{row.wins}</span>
                <span style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 14, textAlign: 'right',
                  color: row.podiums > 0 ? 'var(--fg)' : 'var(--fg-subtle)',
                }}>{row.podiums}</span>
                <span style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 14, textAlign: 'right',
                  color: row.fast > 0 ? 'var(--fg)' : 'var(--fg-subtle)',
                }}>{row.fast}</span>
                <span style={{
                  fontFamily: 'Boldonse, sans-serif', fontSize: 22, textAlign: 'right',
                  color: 'var(--fg)',
                }}>{row.pts}</span>
              </div>
            );
          })}
        </div>

        {/* CONSTRUCTOR STANDINGS */}
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 20,
          }}>
            <h2 style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 28,
              letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0,
            }}>
              Constructors
            </h2>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              10 teams
            </span>
          </div>

          {constructorSeason.map((row, idx) => {
            const t = TEAMS[row.team];
            const pctOfLeader = row.pts / constructorLeaderPts;
            return (
              <div key={row.team} style={{
                padding: '18px 16px', marginBottom: 8,
                background: 'var(--surface)',
                position: 'relative', overflow: 'hidden',
                boxShadow: `inset 0 -3px 0 ${t.hex}`,
              }}>
                {/* Background bar showing relative points */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pctOfLeader * 100}%`,
                  background: `linear-gradient(90deg, ${t.hex}22, transparent)`,
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'relative',
                  display: 'grid', gridTemplateColumns: '32px 32px 1fr auto', gap: 12,
                  alignItems: 'center',
                }}>
                  <span style={{
                    fontFamily: 'Boldonse, sans-serif', fontSize: 22,
                    color: idx === 0 ? 'var(--accent)' : 'var(--fg)',
                  }}>
                    {idx + 1}
                  </span>
                  <TeamLogo team={row.team} size={28} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      fontFamily: 'Boldonse, sans-serif', fontSize: 16,
                      letterSpacing: '0.02em', color: '#fff',
                    }}>
                      {t.name}
                    </span>
                    <span style={{
                      fontFamily: 'Geist Mono, monospace', fontSize: 10,
                      letterSpacing: '0.08em', color: 'var(--fg-subtle)',
                    }}>
                      {row.drivers.join(' · ')} · {row.wins}W · {row.podiums}P
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'Boldonse, sans-serif', fontSize: 28,
                    color: 'var(--fg)',
                  }}>
                    {row.pts}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Season summary stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1,
        background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: 56,
      }}>
        {[
          { label: 'Races complete', value: '5', sub: 'of 24' },
          { label: 'Different winners', value: '3', sub: 'PIA · NOR · LEC' },
          { label: 'Pole sitters', value: '3', sub: 'PIA × 2 · NOR × 2 · LEC' },
          { label: 'Fastest laps', value: '5', sub: 'NOR × 2 · others × 1' },
          { label: 'DNFs total', value: '11', sub: '2.2 per race' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)', padding: '24px 20px',
          }}>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 10,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--fg-subtle)',
            }}>{s.label}</div>
            <div style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 48, lineHeight: 1,
              marginTop: 8, color: 'var(--fg)',
            }}>{s.value}</div>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-muted)', marginTop: 6,
            }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent winners strip */}
      <div>
        <h2 style={{
          fontFamily: 'Boldonse, sans-serif', fontSize: 24,
          letterSpacing: '-0.01em', textTransform: 'uppercase', margin: '0 0 20px',
        }}>
          Recent Winners
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[
            { round: 1, gp: 'Australia', flag: '🇦🇺', winner: 'PIA', track: 'albert_park' },
            { round: 2, gp: 'China',     flag: '🇨🇳', winner: 'NOR', track: 'shanghai' },
            { round: 3, gp: 'Japan',     flag: '🇯🇵', winner: 'PIA', track: 'suzuka' },
            { round: 4, gp: 'Bahrain',   flag: '🇧🇭', winner: 'LEC', track: 'bahrain' },
            { round: 5, gp: 'Saudi Arabia', flag: '🇸🇦', winner: 'PIA', track: 'jeddah' },
          ].map(r => {
            const dr = driverById[r.winner];
            const t = TEAMS[dr.team];
            return (
              <div key={r.round} style={{
                background: 'var(--surface)', padding: 16,
                borderTop: `3px solid ${t.hex}`,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 12,
                }}>
                  <span style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 10,
                    letterSpacing: '0.1em', color: 'var(--fg-subtle)',
                  }}>R{String(r.round).padStart(2, '0')}</span>
                  <span style={{ fontSize: 16 }}>{r.flag}</span>
                </div>
                <div style={{
                  fontFamily: 'Boldonse, sans-serif', fontSize: 14,
                  letterSpacing: '0.01em', textTransform: 'uppercase',
                  color: 'var(--fg)', marginBottom: 16,
                }}>
                  {r.gp}
                </div>
                <TrackDiagram trackId={r.track} color="var(--fg-subtle)" width={140} strokeWidth={1.5} />
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginTop: 12, paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                }}>
                  <DriverPhoto driverId={r.winner} size={32} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontFamily: 'Boldonse, sans-serif', fontSize: 13,
                    }}>{dr.last}</span>
                    <span style={{
                      fontFamily: 'Geist Mono, monospace', fontSize: 9,
                      color: t.hex, letterSpacing: '0.08em',
                    }}>{t.short}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.WorldStandingsScreen = WorldStandingsScreen;
