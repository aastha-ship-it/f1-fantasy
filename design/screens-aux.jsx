// Auxiliary screens — /join, /dashboard/predict, /admin, /admin/results/[eventId]

// Reusable broadcast strip — top bar
function TopStrip({ user = "Aastha", current = "" }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: 16, borderBottom: '1px solid var(--border)',
      fontFamily: 'Geist Mono, monospace', fontSize: 11,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--fg-subtle)',
    }}>
      <span>F1 Fantasy · The Group · 2026</span>
      <span style={{ display: 'flex', gap: 24 }}>
        {['Calendar', 'Predict', 'World', 'The Group', 'Profile'].map(n => (
          <span key={n} style={{ color: current === n ? 'var(--fg)' : 'inherit' }}>{n}</span>
        ))}
      </span>
      <span>{user}</span>
    </div>
  );
}

// ============================================================================
// /join — INVITE CODE GATE
// ============================================================================
function JoinScreen() {
  return (
    <div style={{
      minHeight: '100%', background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, sans-serif', display: 'grid',
      gridTemplateColumns: '1fr 1fr', position: 'relative', overflow: 'hidden',
    }}>
      {/* Left — checkered start-line backdrop with pit-lane numerals */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `
          repeating-conic-gradient(#0a0608 0% 25%, #1a0a0d 0% 50%) 50% / 56px 56px,
          radial-gradient(ellipse at 30% 20%, oklch(28% 0.08 27 / 0.4), transparent 60%)
        `,
        padding: '64px 56px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: 'var(--accent)', marginBottom: 16,
          }}>
            ▣ Private League · Invite-only
          </div>
          <h1 style={{
            fontFamily: 'Boldonse, sans-serif',
            fontSize: 96, lineHeight: 0.88, letterSpacing: '-0.02em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Lights<br/>out.
          </h1>
          <div style={{
            marginTop: 32, maxWidth: 360,
            fontSize: 16, lineHeight: 1.6, color: 'var(--fg-muted)',
          }}>
            A predict-the-podium league for the group. 24 races, 8 friends, one season-long argument. Got the code?
          </div>
        </div>
        {/* Race-stripe footer */}
        <div style={{
          fontFamily: 'Geist Mono, monospace', fontSize: 11,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--fg-subtle)',
        }}>
          2026 Season · Round 6 · Miami GP next
        </div>
      </div>

      {/* Right — invite code form */}
      <div style={{
        background: 'var(--bg)', padding: '120px 80px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'Geist Mono, monospace', fontSize: 11,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--fg-subtle)', marginBottom: 12,
        }}>
          Step 1 of 2 · Enter invite
        </div>
        <h2 style={{
          fontFamily: 'Boldonse, sans-serif', fontSize: 48,
          lineHeight: 0.9, letterSpacing: '-0.01em', textTransform: 'uppercase',
          margin: '0 0 32px',
        }}>
          The Code
        </h2>

        {/* Code input — six monospace boxes */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {['B', 'O', 'X', '·', '0', '6'].map((ch, i) => (
            <div key={i} style={{
              width: 56, height: 72, background: 'var(--surface)',
              border: i === 5 ? '1px solid var(--accent)' : '1px solid var(--border)',
              display: 'grid', placeItems: 'center',
              fontFamily: 'Geist Mono, monospace', fontSize: 28, fontWeight: 600,
              color: ch === '·' ? 'var(--fg-subtle)' : 'var(--fg)',
              position: 'relative',
            }}>
              {ch}
              {i === 5 && (
                <span style={{
                  position: 'absolute', bottom: -2, left: 8, right: 8, height: 2,
                  background: 'var(--accent)', animation: 'caretBlink 1s infinite',
                }} />
              )}
            </div>
          ))}
        </div>
        <div style={{
          fontFamily: 'Geist Mono, monospace', fontSize: 11,
          color: 'var(--success)', letterSpacing: '0.06em',
          marginBottom: 40,
        }}>
          ✓ Code accepted · Welcome to The Group
        </div>

        <button style={{
          fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em',
          textTransform: 'uppercase', padding: '20px 32px',
          background: 'var(--accent)', color: 'var(--fg)', border: 'none',
          fontSize: 16, cursor: 'pointer',
          alignSelf: 'flex-start', minWidth: 280,
        }}>
          Continue → Sign in with Google
        </button>

        <div style={{
          marginTop: 32, fontSize: 13, color: 'var(--fg-subtle)',
          fontFamily: 'Geist Mono, monospace', letterSpacing: '0.04em', lineHeight: 1.6,
        }}>
          Wrong code? Ask Aastha for the right one.<br/>
          Codes rotate per season.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// /dashboard/predict — EVENT LIST (pick which event to predict for)
// ============================================================================
function PredictListScreen() {
  // Show all events; mark predicted/locked/upcoming/past
  const eventStates = CALENDAR.map((ev, i) => {
    if (ev.status === 'done') return { ...ev, predState: 'revealed', myPicks: ['PIA','LEC','NOR'], pts: 18 - i*2 };
    if (ev.status === 'next') return { ...ev, predState: 'open', myPicks: ['PIA','LEC',null] };
    return { ...ev, predState: 'upcoming', myPicks: [null,null,null] };
  });

  return (
    <div style={{
      padding: '40px 56px 56px', background: 'var(--bg)', minHeight: '100%',
      color: 'var(--fg)', fontFamily: 'Geist, sans-serif',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <TopStrip current="Predict" />

      {/* Hero */}
      <div style={{
        marginTop: 40, marginBottom: 48,
        paddingBottom: 32, borderBottom: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 48, alignItems: 'end',
      }}>
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 12,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fg-subtle)', marginBottom: 12,
          }}>
            Predictions · 2026 season
          </div>
          <h1 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 88,
            lineHeight: 0.9, letterSpacing: '-0.015em', textTransform: 'uppercase',
            margin: 0,
          }}>
            Lock<br/>your picks
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fg-subtle)',
          }}>
            Your season · 5 of 24 races
          </div>
          <div style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 56, lineHeight: 1,
          }}>47 pts</div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 12,
            color: 'var(--fg-muted)',
          }}>P1 in The Group · 2 perfect podiums</div>
        </div>
      </div>

      {/* NEXT EVENT — hero card */}
      {(() => {
        const next = eventStates.find(e => e.status === 'next');
        return (
          <div style={{
            marginBottom: 48,
            background: 'var(--surface-2)',
            display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr',
            gap: 0, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ padding: 32 }}>
              <div style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 11,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'var(--accent)', marginBottom: 12,
              }}>
                ● Next race · Picks open
              </div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{next.flag}</div>
              <div style={{
                fontFamily: 'Boldonse, sans-serif', fontSize: 36,
                lineHeight: 0.92, letterSpacing: '-0.01em', textTransform: 'uppercase',
              }}>
                {next.name}<br/>Grand Prix
              </div>
              <div style={{
                marginTop: 16, fontFamily: 'Geist Mono, monospace', fontSize: 12,
                color: 'var(--fg-muted)', letterSpacing: '0.04em',
              }}>
                R{String(next.round).padStart(2, '0')} · {next.date} · {next.city}<br/>
                {TRACK_LENGTH[next.track]} · Sprint weekend
              </div>
            </div>

            <div style={{ padding: 32, display: 'grid', placeItems: 'center' }}>
              <TrackDiagram trackId={next.track} color="var(--fg-muted)" width={420} strokeWidth={2.5} />
            </div>

            <div style={{
              padding: 32, background: 'var(--surface)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 11,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--fg-subtle)', marginBottom: 12,
                }}>
                  Picks needed · {next.myPicks.filter(p => p).length} of 3
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {[0,1,2].map(i => {
                    const pick = next.myPicks[i];
                    if (!pick) return (
                      <div key={i} style={{
                        padding: 12, background: 'transparent',
                        border: '1px dashed var(--border)',
                        textAlign: 'center', minHeight: 64,
                        display: 'grid', placeItems: 'center',
                      }}>
                        <span style={{
                          fontFamily: 'Geist Mono, monospace', fontSize: 10,
                          color: 'var(--fg-subtle)', letterSpacing: '0.08em',
                        }}>P{i+1} ?</span>
                      </div>
                    );
                    const dr = driverById[pick];
                    return (
                      <div key={i} style={{
                        padding: 12, background: TEAMS[dr.team].livery[1],
                        textAlign: 'center', position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          fontFamily: 'Geist Mono, monospace', fontSize: 9,
                          letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)',
                        }}>P{i+1}</div>
                        <div style={{
                          fontFamily: 'Boldonse, sans-serif', fontSize: 18,
                          color: '#fff', marginTop: 4,
                        }}>{dr.id}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 12,
                  color: 'var(--warning)', letterSpacing: '0.04em',
                }}>
                  Locks in 2d 14h 23m
                </div>
              </div>

              <button style={{
                fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '16px 24px',
                background: 'var(--accent)', color: 'var(--fg)',
                border: 'none', fontSize: 14, cursor: 'pointer',
                marginTop: 24,
              }}>
                Continue picks →
              </button>
            </div>
          </div>
        );
      })()}

      {/* Past + upcoming list */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48,
      }}>
        {/* Past — revealed */}
        <div>
          <h2 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 24,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            margin: '0 0 20px',
          }}>
            Revealed · 5 races
          </h2>
          {eventStates.filter(e => e.status === 'done').map(ev => (
            <div key={ev.round} style={{
              display: 'grid', gridTemplateColumns: '40px 80px 1fr auto auto',
              gap: 16, alignItems: 'center',
              padding: '16px 12px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 11,
                color: 'var(--fg-subtle)', letterSpacing: '0.1em',
              }}>R{String(ev.round).padStart(2,'0')}</span>
              <TrackDiagram trackId={ev.track} color="var(--fg-subtle)" width={70} strokeWidth={1.5} />
              <div>
                <div style={{
                  fontFamily: 'Boldonse, sans-serif', fontSize: 16,
                  letterSpacing: '0.01em', textTransform: 'uppercase',
                }}>
                  {ev.name}
                </div>
                <div style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 11,
                  color: 'var(--fg-subtle)', letterSpacing: '0.04em',
                }}>{ev.date} · {ev.city}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {ev.myPicks.map((p, i) => (
                  <span key={i} style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 11,
                    padding: '4px 6px', background: 'var(--surface-2)',
                    color: 'var(--fg-muted)', letterSpacing: '0.04em',
                  }}>{p}</span>
                ))}
              </div>
              <span style={{
                fontFamily: 'Boldonse, sans-serif', fontSize: 22,
                color: ev.pts >= 10 ? 'var(--accent)' : 'var(--fg)',
                minWidth: 40, textAlign: 'right',
              }}>+{ev.pts}</span>
            </div>
          ))}
        </div>

        {/* Upcoming — locked */}
        <div>
          <h2 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 24,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            margin: '0 0 20px',
          }}>
            Upcoming · 18 races
          </h2>
          {eventStates.filter(e => e.status === 'upcoming').slice(0, 6).map(ev => (
            <div key={ev.round} style={{
              display: 'grid', gridTemplateColumns: '40px 80px 1fr auto',
              gap: 16, alignItems: 'center',
              padding: '16px 12px',
              borderBottom: '1px solid var(--border)',
              opacity: 0.85,
            }}>
              <span style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 11,
                color: 'var(--fg-subtle)', letterSpacing: '0.1em',
              }}>R{String(ev.round).padStart(2,'0')}</span>
              <TrackDiagram trackId={ev.track} color="var(--fg-subtle)" width={70} strokeWidth={1.5} />
              <div>
                <div style={{
                  fontFamily: 'Boldonse, sans-serif', fontSize: 16,
                  letterSpacing: '0.01em', textTransform: 'uppercase',
                }}>
                  {ev.name}
                </div>
                <div style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 11,
                  color: 'var(--fg-subtle)', letterSpacing: '0.04em',
                }}>{ev.date} · {ev.city}</div>
              </div>
              <span style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 11,
                color: 'var(--fg-subtle)', letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>Picks open T-7d</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// /admin — EVENT LIST (admin sees all events with state: results pending / entered / revealed)
// ============================================================================
function AdminScreen() {
  const adminEvents = CALENDAR.map(ev => {
    if (ev.round === 5) return { ...ev, adminState: 'pending', resultsAge: '6h ago' };  // Saudi just done, results not entered
    if (ev.round === 4) return { ...ev, adminState: 'entered', resultsAge: '1d ago' };  // Bahrain entered, not revealed
    if (ev.status === 'done') return { ...ev, adminState: 'revealed', resultsAge: ev.date };
    if (ev.status === 'next') return { ...ev, adminState: 'future', resultsAge: 'in 3d' };
    return { ...ev, adminState: 'future', resultsAge: ev.date };
  });

  return (
    <div style={{
      padding: '40px 56px 56px', background: 'var(--bg)', minHeight: '100%',
      color: 'var(--fg)', fontFamily: 'Geist, sans-serif',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {/* Top admin strip — distinct color */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 16, borderBottom: '1px solid var(--accent)',
        fontFamily: 'Geist Mono, monospace', fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <span style={{ color: 'var(--accent)' }}>▣ Admin · The Group · 2026</span>
        <span style={{ display: 'flex', gap: 24, color: 'var(--fg-subtle)' }}>
          <span style={{ color: 'var(--fg)' }}>Events</span>
          <span>Cron status</span>
          <span>Friends</span>
          <span>Logs</span>
        </span>
        <span style={{ color: 'var(--fg-subtle)' }}>Aastha · admin</span>
      </div>

      <div style={{ marginTop: 40, marginBottom: 40 }}>
        <div style={{
          fontFamily: 'Geist Mono, monospace', fontSize: 12,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--accent)', marginBottom: 12,
        }}>
          Admin · 1 attention needed
        </div>
        <h1 style={{
          fontFamily: 'Boldonse, sans-serif', fontSize: 72,
          lineHeight: 0.9, letterSpacing: '-0.015em', textTransform: 'uppercase',
          margin: 0,
        }}>
          Event Control
        </h1>
      </div>

      {/* System status strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        background: 'var(--border)', border: '1px solid var(--border)',
        marginBottom: 48,
      }}>
        {[
          { label: 'Last sync · OpenF1', value: '04:30 UTC', status: 'success', sub: 'Calendar + sessions' },
          { label: 'Last results fetch', value: '04:50 UTC', status: 'success', sub: 'Saudi Arabia · success' },
          { label: 'Nudges refreshed', value: '04:35 UTC', status: 'success', sub: '20 drivers · Miami' },
          { label: 'Reveal queue', value: '1 pending', status: 'warning', sub: 'Bahrain · awaiting reveal' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', padding: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'Geist Mono, monospace', fontSize: 10,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--fg-subtle)',
            }}>
              <span style={{
                width: 6, height: 6,
                background: s.status === 'success' ? 'var(--success)' : 'var(--warning)',
                borderRadius: '50%',
              }} />
              {s.label}
            </div>
            <div style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 28, lineHeight: 1,
              marginTop: 8, color: s.status === 'success' ? 'var(--fg)' : 'var(--warning)',
            }}>{s.value}</div>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-muted)', marginTop: 4,
            }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Event table */}
      <h2 style={{
        fontFamily: 'Boldonse, sans-serif', fontSize: 28,
        letterSpacing: '-0.01em', textTransform: 'uppercase',
        margin: '0 0 20px',
      }}>
        Events · 24
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 80px 60px 1fr 100px 120px 140px 1fr 200px',
        gap: 12, padding: '8px 12px',
        fontFamily: 'Geist Mono, monospace', fontSize: 10,
        color: 'var(--fg-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase',
        borderBottom: '1px solid var(--border)',
      }}>
        <span>R</span>
        <span></span>
        <span></span>
        <span>Event</span>
        <span>Date</span>
        <span>Sessions</span>
        <span>State</span>
        <span>Picks</span>
        <span style={{ textAlign: 'right' }}>Action</span>
      </div>

      {adminEvents.map(ev => {
        const stateMap = {
          pending:  { label: 'Results pending', color: 'var(--accent)', bg: 'oklch(28% 0.08 27 / 0.4)' },
          entered:  { label: 'Entered · Not revealed', color: 'var(--warning)', bg: 'oklch(28% 0.06 70 / 0.3)' },
          revealed: { label: 'Revealed', color: 'var(--success)', bg: 'transparent' },
          future:   { label: 'Future', color: 'var(--fg-subtle)', bg: 'transparent' },
        };
        const s = stateMap[ev.adminState];
        const action = {
          pending:  'Enter results →',
          entered:  'Reveal to group →',
          revealed: 'View reveal',
          future:   'View picks',
        }[ev.adminState];
        return (
          <div key={ev.round} style={{
            display: 'grid',
            gridTemplateColumns: '40px 80px 60px 1fr 100px 120px 140px 1fr 200px',
            gap: 12, padding: '14px 12px', alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            background: s.bg,
          }}>
            <span style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 16,
              color: 'var(--fg)',
            }}>{ev.round}</span>
            <TrackDiagram trackId={ev.track} color="var(--fg-subtle)" width={70} strokeWidth={1.5} />
            <span style={{ fontSize: 24 }}>{ev.flag}</span>
            <div>
              <div style={{
                fontFamily: 'Boldonse, sans-serif', fontSize: 14,
                letterSpacing: '0.01em', textTransform: 'uppercase',
              }}>{ev.name}</div>
              <div style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 10,
                color: 'var(--fg-subtle)', letterSpacing: '0.04em',
              }}>{ev.city}</div>
            </div>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 12,
              color: 'var(--fg-muted)',
            }}>{ev.date}</span>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-subtle)',
            }}>
              {ev.sprint ? 'Q · SQ · S · R' : 'Q · R'}
            </span>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 10,
              color: s.color, letterSpacing: '0.06em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>● {s.label}</span>
            <span style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-muted)',
            }}>
              {ev.adminState === 'future' ? '— picks open T-7d' : '8 of 8 friends · 0 missed'}
            </span>
            <button style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              padding: '8px 14px', textAlign: 'center',
              background: ev.adminState === 'pending' || ev.adminState === 'entered' ? 'var(--accent)' : 'transparent',
              color: 'var(--fg)',
              border: ev.adminState === 'pending' || ev.adminState === 'entered' ? 'none' : '1px solid var(--border)',
              cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              {action}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// /admin/results/[eventId] — MANUAL RESULTS ENTRY
// ============================================================================
function AdminResultsScreen() {
  // Mock: admin entering Saudi Arabia results
  const ev = CALENDAR.find(e => e.round === 5);
  const t = TEAMS[driverById['PIA'].team];

  // P1/P2/P3 already filled in this mock
  const entered = ['PIA', 'NOR', 'LEC'];

  return (
    <div style={{
      padding: '40px 56px 56px', background: 'var(--bg)', minHeight: '100%',
      color: 'var(--fg)', fontFamily: 'Geist, sans-serif',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {/* Admin nav */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 16, borderBottom: '1px solid var(--accent)',
        fontFamily: 'Geist Mono, monospace', fontSize: 11,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <span style={{ color: 'var(--accent)' }}>▣ Admin · The Group</span>
        <span style={{ color: 'var(--fg-muted)' }}>
          ← <span style={{ color: 'var(--fg)' }}>/admin</span> · /results/{ev.round}
        </span>
        <span style={{ color: 'var(--fg-subtle)' }}>Aastha · admin</span>
      </div>

      {/* Hero — event banner */}
      <div style={{
        marginTop: 40, marginBottom: 48,
        display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 48, alignItems: 'end',
        paddingBottom: 32, borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 12,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--accent)', marginBottom: 12,
          }}>
            ● Enter results · R0{ev.round} · {ev.flag} {ev.name}
          </div>
          <h1 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 72,
            lineHeight: 0.9, letterSpacing: '-0.015em', textTransform: 'uppercase',
            margin: 0,
          }}>
            {ev.name}<br/>Race
          </h1>
          <div style={{
            marginTop: 16, fontFamily: 'Geist Mono, monospace', fontSize: 13,
            color: 'var(--fg-muted)', letterSpacing: '0.04em',
          }}>
            Session ended 6h ago · OpenF1 not yet returned · Manual entry
          </div>
        </div>
        <TrackDiagram trackId={ev.track} color="var(--fg-muted)" width={300} strokeWidth={2} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 48 }}>

        {/* LEFT — Podium entry */}
        <div>
          <h2 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 28,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            margin: '0 0 20px',
          }}>
            Classified Podium
          </h2>

          {[1, 2, 3].map((pos, idx) => {
            const drId = entered[idx];
            const dr = driverById[drId];
            const team = TEAMS[dr.team];
            return (
              <div key={pos} style={{
                marginBottom: 12, padding: 20,
                background: 'var(--surface)',
                display: 'grid', gridTemplateColumns: '60px 64px 1fr auto', gap: 16,
                alignItems: 'center', position: 'relative', overflow: 'hidden',
                boxShadow: `inset 0 -3px 0 ${team.hex}`,
              }}>
                <div style={{
                  fontFamily: 'Boldonse, sans-serif', fontSize: 48,
                  color: idx === 0 ? 'var(--accent)' : 'var(--fg)',
                  lineHeight: 0.85,
                }}>P{pos}</div>
                <DriverPhoto driverId={drId} size={56} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontFamily: 'Boldonse, sans-serif', fontSize: 18,
                  }}>{dr.first} {dr.last}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TeamLogo team={dr.team} size={14} />
                    <span style={{
                      fontFamily: 'Geist Mono, monospace', fontSize: 11,
                      color: team.hex, letterSpacing: '0.06em',
                    }}>#{dr.num} · {team.short}</span>
                  </div>
                </div>
                <button style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 11,
                  padding: '8px 12px', background: 'transparent',
                  color: 'var(--fg-muted)', border: '1px solid var(--border)',
                  cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  Change
                </button>
              </div>
            );
          })}

          {/* Fastest lap */}
          <div style={{ marginTop: 32, marginBottom: 20 }}>
            <h3 style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 18,
              letterSpacing: '-0.005em', textTransform: 'uppercase',
              margin: '0 0 12px', color: 'var(--fg-muted)',
            }}>
              Fastest Lap (optional)
            </h3>
            <div style={{
              padding: 16, background: 'var(--surface)',
              display: 'grid', gridTemplateColumns: '40px 1fr 140px', gap: 16,
              alignItems: 'center',
            }}>
              <DriverPhoto driverId="VER" size={36} />
              <div>
                <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 14 }}>Max Verstappen</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--fg-subtle)' }}>
                  RBR · Lap 47
                </div>
              </div>
              <input type="text" defaultValue="1:29.284" style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 14,
                padding: '8px 12px', background: 'var(--bg)',
                color: 'var(--fg)', border: '1px solid var(--border)',
                textAlign: 'right',
              }} />
            </div>
          </div>

          {/* DNFs */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 18,
              letterSpacing: '-0.005em', textTransform: 'uppercase',
              margin: '0 0 12px', color: 'var(--fg-muted)',
            }}>
              DNFs · 2 marked
            </h3>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
            }}>
              {['SAI', 'STR'].map(id => {
                const dr = driverById[id];
                return (
                  <span key={id} style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 11,
                    padding: '6px 10px', background: 'var(--surface)',
                    color: 'var(--fg-muted)', letterSpacing: '0.06em',
                    border: '1px solid var(--border)',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 6, height: 6, background: 'var(--error)',
                      borderRadius: '50%',
                    }} />
                    {id} · {dr.first} {dr.last} ×
                  </span>
                );
              })}
              <button style={{
                fontFamily: 'Geist Mono, monospace', fontSize: 11,
                padding: '6px 10px', background: 'transparent',
                color: 'var(--fg-subtle)', border: '1px dashed var(--border)',
                cursor: 'pointer', letterSpacing: '0.06em',
              }}>
                + Add DNF
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Live impact preview */}
        <div>
          <h2 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 28,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            margin: '0 0 20px',
          }}>
            Score Preview
          </h2>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11,
            color: 'var(--fg-subtle)', letterSpacing: '0.04em', marginBottom: 16,
          }}>
            Computed from current entry · 8 friends · live update
          </div>

          {[
            { name: 'Aastha',  pts: 18, picks: ['PIA','NOR','LEC'], note: 'Perfect podium · +3 bonus' },
            { name: 'Vineet',  pts: 7,  picks: ['PIA','LEC','VER'], note: '1 exact · 1 slot' },
            { name: 'Priya',   pts: 5,  picks: ['PIA','RUS','SAI'], note: '1 exact' },
            { name: 'Rohan',   pts: 7,  picks: ['NOR','PIA','LEC'], note: '1 exact · 2 slot' },
            { name: 'Nikhil',  pts: 0,  picks: ['VER','HAM','RUS'], note: '0 hits' },
            { name: 'Tara',    pts: 0,  picks: ['VER','RUS','ALO'], note: '0 hits · rough week' },
            { name: 'Kunal',   pts: 9,  picks: ['LEC','PIA','NOR'], note: '1 exact · 2 slot · +0' },
            { name: 'Dev',     pts: 5,  picks: ['PIA','VER','SAI'], note: '1 exact' },
          ].map(f => (
            <div key={f.name} style={{
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 12,
              alignItems: 'center', padding: '12px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontFamily: 'Boldonse, sans-serif', fontSize: 14,
                  }}>{f.name}</span>
                  <span style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 11,
                    color: 'var(--fg-subtle)', letterSpacing: '0.04em',
                  }}>{f.picks.join(' · ')}</span>
                </div>
                <div style={{
                  fontFamily: 'Geist Mono, monospace', fontSize: 10,
                  color: f.pts >= 10 ? 'var(--accent)' : 'var(--fg-muted)',
                  letterSpacing: '0.04em', marginTop: 2,
                }}>{f.note}</div>
              </div>
              <span style={{
                fontFamily: 'Boldonse, sans-serif', fontSize: 24,
                color: f.pts >= 10 ? 'var(--accent)' : f.pts === 0 ? 'var(--fg-subtle)' : 'var(--fg)',
              }}>+{f.pts}</span>
            </div>
          ))}

          {/* Action bar */}
          <div style={{
            marginTop: 32, padding: 20, background: 'var(--surface-2)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11,
              color: 'var(--fg-muted)', letterSpacing: '0.04em', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--fg)' }}>Save</strong> writes results + computes scores. <strong style={{ color: 'var(--fg)' }}>Reveal</strong> flips picks visible to all friends and triggers the cinematic.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{
                flex: 1, fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '14px 20px',
                background: 'transparent', color: 'var(--fg)',
                border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer',
              }}>
                Save draft
              </button>
              <button style={{
                flex: 2, fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em',
                textTransform: 'uppercase', padding: '14px 20px',
                background: 'var(--accent)', color: 'var(--fg)',
                border: 'none', fontSize: 13, cursor: 'pointer',
              }}>
                Save + Reveal to group →
              </button>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes caretBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

window.JoinScreen = JoinScreen;
window.PredictListScreen = PredictListScreen;
window.AdminScreen = AdminScreen;
window.AdminResultsScreen = AdminResultsScreen;
