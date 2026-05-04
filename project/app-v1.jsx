const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- helpers ---------- */
const STORAGE_KEY = "opportunity-tracker-v1";
const TICK_KEY = "opportunity-tracker-opened-at-v1";

const fmtMoney = (n, opts = {}) => {
  const { decimals = 0, sign = "$" } = opts;
  if (!isFinite(n)) return sign + "0";
  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + (decPart ? withCommas + "." + decPart : withCommas);
};

const fmtCompact = (n) => {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1000) + "k";
  return "$" + Math.round(n);
};

const parseSalaryInput = (str) => {
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d.kKmM]/g, "");
  let mult = 1;
  let n = cleaned;
  if (/k$/i.test(cleaned)) { mult = 1000; n = cleaned.slice(0, -1); }
  else if (/m$/i.test(cleaned)) { mult = 1_000_000; n = cleaned.slice(0, -1); }
  return (parseFloat(n) || 0) * mult;
};

const loadStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};

const saveStored = (s) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
};

/* ---------- core math ---------- */
function useDerived(state) {
  return useMemo(() => {
    const annual = state.annualSalary || 0;
    const weeklyHours = state.weeklyHours || 40;
    const weeksPerYear = state.weeksPerYear || 50;
    const workdayHours = state.workdayHours || 8;

    const annualWorkingHours = weeklyHours * weeksPerYear;
    const perHour = annualWorkingHours > 0 ? annual / annualWorkingHours : 0;
    const perMinute = perHour / 60;
    const perSecond = perMinute / 60;
    const perDay = perHour * workdayHours;
    const perWeek = perDay * 5;
    const perMonth = annual / 12;

    const low = annual * state.rangeLowPct;
    const high = annual * state.rangeHighPct;
    const lowHourly = annualWorkingHours > 0 ? low / annualWorkingHours : 0;
    const highHourly = annualWorkingHours > 0 ? high / annualWorkingHours : 0;

    return {
      annual, perHour, perMinute, perSecond, perDay, perWeek, perMonth,
      low, high, lowHourly, highHourly, annualWorkingHours,
    };
  }, [state]);
}

/* ---------- live ticker hook ---------- */
function useTickerSince(openedAt, perSecond) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf;
    const loop = () => { setTick(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const elapsedMs = openedAt ? Date.now() - openedAt : 0;
  const lost = (elapsedMs / 1000) * perSecond;
  return { lost, elapsedMs, tick };
}

/* ---------- icons ---------- */
const IconDown = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);
const IconUp = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
const IconPip = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2.5" y="4" width="19" height="16" rx="2"/>
    <rect x="12.5" y="12" width="7" height="6" rx="1" fill="currentColor" stroke="none"/>
  </svg>
);
const IconReset = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);
const IconExpand = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7"/>
  </svg>
);
const IconClose = (p) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

/* ---------- main app ---------- */
function App() {
  const defaults = JSON.parse(document.getElementById("defaults").textContent);
  const [state, setState] = useState(() => {
    const stored = loadStored();
    return stored ? { ...defaults, ...stored } : defaults;
  });

  // Persist to localStorage
  useEffect(() => { saveStored(state); }, [state]);

  // Opened-at timestamp persists across reloads (per session-ish)
  const [openedAt, setOpenedAt] = useState(() => {
    const existing = sessionStorage.getItem(TICK_KEY);
    if (existing) return parseInt(existing, 10);
    const now = Date.now();
    sessionStorage.setItem(TICK_KEY, String(now));
    return now;
  });

  const resetTicker = () => {
    const now = Date.now();
    sessionStorage.setItem(TICK_KEY, String(now));
    setOpenedAt(now);
  };

  const derived = useDerived(state);
  const { lost } = useTickerSince(openedAt, derived.perSecond);

  // PiP / compact window state
  const [pipOpen, setPipOpen] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);
  const pipWinRef = useRef(null);
  const pipRootRef = useRef(null);

  const supportsDocPiP = typeof window !== "undefined" && "documentPictureInPicture" in window;

  const openCompact = useCallback(async () => {
    if (supportsDocPiP) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({ width: 320, height: 200 });
        // Copy fonts + base styles
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
          pipWin.document.head.appendChild(node.cloneNode(true));
        });
        const baseStyle = pipWin.document.createElement("style");
        baseStyle.textContent = `
          html, body { margin:0; padding:0; background: transparent; font-family: "Inter", system-ui, sans-serif; color: oklch(0.18 0.008 60); }
          body { background: oklch(0.97 0.012 85); }
        `;
        pipWin.document.head.appendChild(baseStyle);
        const mount = pipWin.document.createElement("div");
        mount.id = "pip-root";
        pipWin.document.body.appendChild(mount);
        const root = ReactDOM.createRoot(mount);
        pipRootRef.current = root;
        pipWinRef.current = pipWin;
        setPipOpen(true);
        pipWin.addEventListener("pagehide", () => {
          setPipOpen(false);
          try { root.unmount(); } catch (e) {}
          pipWinRef.current = null;
          pipRootRef.current = null;
        });
      } catch (e) {
        console.warn("PiP failed, falling back to floating window", e);
        setFloatOpen(true);
      }
    } else {
      setFloatOpen(true);
    }
  }, [supportsDocPiP]);

  const closeCompact = useCallback(() => {
    if (pipWinRef.current) { try { pipWinRef.current.close(); } catch(e){} }
    setPipOpen(false);
    setFloatOpen(false);
  }, []);

  // Render the PiP content
  useEffect(() => {
    if (pipOpen && pipRootRef.current) {
      pipRootRef.current.render(
        <CompactView state={state} derived={derived} lost={lost} onClose={closeCompact} setState={setState} />
      );
    }
  }, [pipOpen, state, derived, lost, closeCompact]);

  return (
    <>
      <MainView
        state={state}
        setState={setState}
        derived={derived}
        lost={lost}
        openCompact={openCompact}
        resetTicker={resetTicker}
        compactActive={pipOpen || floatOpen}
        supportsDocPiP={supportsDocPiP}
      />
      {floatOpen && (
        <FloatingWindow onClose={closeCompact}>
          <CompactView state={state} derived={derived} lost={lost} onClose={closeCompact} setState={setState} embedded />
        </FloatingWindow>
      )}
    </>
  );
}

/* ---------- main view ---------- */
function MainView({ state, setState, derived, lost, openCompact, resetTicker, compactActive, supportsDocPiP }) {
  const [salaryInput, setSalaryInput] = useState(String(state.annualSalary));

  useEffect(() => { setSalaryInput(String(state.annualSalary)); }, [state.annualSalary]);

  const commitSalary = (raw) => {
    const n = parseSalaryInput(raw);
    setState(s => ({ ...s, annualSalary: Math.max(0, n) }));
  };

  const presetClick = (v) => {
    setSalaryInput(String(v));
    setState(s => ({ ...s, annualSalary: v }));
  };

  return (
    <div style={mainStyles.page}>
      <div style={mainStyles.shell}>
        {/* Header */}
        <header style={mainStyles.header}>
          <div>
            <div style={mainStyles.eyebrow}>Opportunity Tracker</div>
            <h1 style={mainStyles.h1}>What is unemployment costing you?</h1>
            <p style={mainStyles.lede}>Enter the annual salary of the offer you turned down, or could be earning. We'll show you what each minute of building your own thing actually costs.</p>
          </div>
        </header>

        {/* Input card */}
        <section style={mainStyles.inputCard}>
          <label style={mainStyles.label}>Foregone annual salary</label>
          <div style={mainStyles.inputRow}>
            <span style={mainStyles.inputDollar}>$</span>
            <input
              style={mainStyles.input}
              className="num"
              type="text"
              inputMode="numeric"
              value={salaryInput.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "");
                if (/^[\d.kKmM]*$/.test(raw)) {
                  setSalaryInput(raw);
                  commitSalary(raw);
                }
              }}
              placeholder="287,500"
            />
          </div>
          <div style={mainStyles.presets}>
            {[120000, 180000, 250000, 350000, 500000].map(v => (
              <button key={v}
                onClick={() => presetClick(v)}
                style={{
                  ...mainStyles.preset,
                  ...(state.annualSalary === v ? mainStyles.presetActive : {}),
                }}>
                {fmtCompact(v)}
              </button>
            ))}
          </div>

          {/* Range sliders */}
          <div style={mainStyles.rangeWrap}>
            <div style={mainStyles.rangeRow}>
              <span style={mainStyles.rangeLabel}>Range</span>
              <span style={mainStyles.rangeVal}>
                <span className="num">{fmtCompact(derived.low)}</span>
                <span style={{ opacity: 0.4, margin: "0 6px" }}>–</span>
                <span className="num">{fmtCompact(derived.high)}</span>
              </span>
            </div>
            <DualRange
              min={0.7} max={1.3} step={0.005}
              low={state.rangeLowPct} high={state.rangeHighPct}
              onChange={(low, high) => setState(s => ({ ...s, rangeLowPct: low, rangeHighPct: high }))}
            />
          </div>
        </section>

        {/* Cost breakdown */}
        <section style={mainStyles.section}>
          <div style={mainStyles.sectionHead}>Your cost of not working</div>
          <div style={mainStyles.grid}>
            <CostCard label="Per year" value={fmtMoney(derived.annual)} />
            <CostCard label="Per month" value={fmtMoney(derived.perMonth)} />
            <CostCard label="Per week" value={fmtMoney(derived.perWeek)} />
            <CostCard label="Per day" value={fmtMoney(derived.perDay)} sub={`${state.workdayHours}-hr workday`} />
            <CostCard label="Per hour" value={fmtMoney(derived.perHour)} sub={`${state.weeklyHours} hrs / week`} />
            <CostCard label="Per minute" value={fmtMoney(derived.perMinute, { decimals: 2 })} />
          </div>
        </section>

        {/* Range breakdown */}
        <section style={mainStyles.section}>
          <div style={mainStyles.sectionHead}>Range breakdown</div>
          <div style={mainStyles.rangeBreak}>
            <RangeRow label={`Low end (${fmtCompact(derived.low)}) / hour`} value={fmtMoney(derived.lowHourly)} />
            <RangeRow label={`Midpoint (${fmtCompact(derived.annual)}) / hour`} value={fmtMoney(derived.perHour)} emphasized />
            <RangeRow label={`High end (${fmtCompact(derived.high)}) / hour`} value={fmtMoney(derived.highHourly)} />
          </div>
        </section>

        {/* Live ticker */}
        <section style={mainStyles.section}>
          <div style={mainStyles.sectionHead}>Real-time cost ticker</div>
          <div style={mainStyles.ticker}>
            <div style={mainStyles.tickerLeft}>
              <div style={mainStyles.tickerLabel}>Lost since you opened this</div>
              <div style={mainStyles.tickerNum} className="num">
                {fmtMoney(lost, { decimals: 2 })}
              </div>
              <button style={mainStyles.resetBtn} onClick={resetTicker}>
                <IconReset /> Reset timer
              </button>
            </div>

            <div style={mainStyles.tickerRight}>
              <div style={mainStyles.daysLabel}>Days unemployed</div>
              <div style={mainStyles.daysControl}>
                <button style={mainStyles.daysBtn}
                  onClick={() => setState(s => ({ ...s, daysUnemployed: Math.max(0, s.daysUnemployed - 1) }))}>−</button>
                <div style={mainStyles.daysVal} className="num">{state.daysUnemployed}</div>
                <button style={mainStyles.daysBtn}
                  onClick={() => setState(s => ({ ...s, daysUnemployed: s.daysUnemployed + 1 }))}>+</button>
              </div>
              <div style={mainStyles.daysAccrued}>
                Total foregone: <span className="num" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  {fmtMoney(state.daysUnemployed * derived.perDay)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Settings strip */}
        <section style={mainStyles.section}>
          <div style={mainStyles.sectionHead}>Assumptions</div>
          <div style={mainStyles.settings}>
            <SettingNumber label="Hours / week" value={state.weeklyHours}
              onChange={v => setState(s => ({ ...s, weeklyHours: v }))} min={1} max={168} />
            <SettingNumber label="Working weeks / year" value={state.weeksPerYear}
              onChange={v => setState(s => ({ ...s, weeksPerYear: v }))} min={1} max={52} />
            <SettingNumber label="Workday hours" value={state.workdayHours}
              onChange={v => setState(s => ({ ...s, workdayHours: v }))} min={1} max={24} />
          </div>
        </section>

        {/* Compact mode CTA */}
        <section style={mainStyles.pipBar}>
          <div>
            <div style={mainStyles.pipTitle}>Pin to your desktop</div>
            <div style={mainStyles.pipDesc}>
              {supportsDocPiP
                ? "Pop the live ticker out into a tiny floating window that stays on top while you work."
                : "Open a draggable mini-window that sits on top of this page (your browser doesn't support full picture-in-picture, but the floating mode still works)."}
            </div>
          </div>
          <button style={mainStyles.pipBtn} onClick={openCompact} disabled={compactActive}>
            <IconPip />
            {compactActive ? "Window is open" : "Open compact window"}
          </button>
        </section>

        <footer style={mainStyles.footer}>
          Every second you scroll: <span className="num" style={{ color: "var(--accent)" }}>{fmtMoney(derived.perSecond, { decimals: 4 })}</span>
        </footer>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function CostCard({ label, value, sub }) {
  return (
    <div style={mainStyles.card}>
      <div style={mainStyles.cardLabel}>{label}</div>
      <div style={mainStyles.cardVal} className="num">{value}</div>
      {sub && <div style={mainStyles.cardSub}>{sub}</div>}
    </div>
  );
}

function RangeRow({ label, value, emphasized }) {
  return (
    <div style={{
      ...mainStyles.rangeBreakRow,
      ...(emphasized ? { background: "var(--surface)" } : {}),
    }}>
      <span style={{ color: emphasized ? "var(--ink)" : "var(--ink-2)", fontWeight: emphasized ? 500 : 400 }}>{label}</span>
      <span className="num" style={{ fontWeight: 600, fontSize: 18 }}>{value}</span>
    </div>
  );
}

function SettingNumber({ label, value, onChange, min, max }) {
  return (
    <label style={mainStyles.settingLabel}>
      <span style={mainStyles.settingLabelText}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={mainStyles.settingInput}
        className="num"
      />
    </label>
  );
}

function DualRange({ min, max, step, low, high, onChange }) {
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const pct = (v) => ((v - min) / (max - min)) * 100;

  const handlePointer = (which) => (e) => {
    e.preventDefault();
    setDrag(which);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const v = Math.round((min + ratio * (max - min)) / step) * step;
      if (drag === "low") {
        onChange(Math.min(v, high - step), high);
      } else {
        onChange(low, Math.max(v, low + step));
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [drag, low, high, min, max, step, onChange]);

  return (
    <div ref={trackRef} style={mainStyles.dualTrack}>
      <div style={{
        ...mainStyles.dualFill,
        left: `${pct(low)}%`,
        right: `${100 - pct(high)}%`,
      }} />
      <button
        style={{ ...mainStyles.dualHandle, left: `${pct(low)}%` }}
        onMouseDown={handlePointer("low")}
        onTouchStart={handlePointer("low")}
        aria-label="Low end" />
      <button
        style={{ ...mainStyles.dualHandle, left: `${pct(high)}%` }}
        onMouseDown={handlePointer("high")}
        onTouchStart={handlePointer("high")}
        aria-label="High end" />
    </div>
  );
}

/* ---------- floating fallback window ---------- */
function FloatingWindow({ children, onClose }) {
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragRef = useRef(null);
  const startDrag = (e) => {
    const sx = e.clientX, sy = e.clientY;
    const ox = pos.x, oy = pos.y;
    const onMove = (ev) => {
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 280, ox + (ev.clientX - sx))),
        y: Math.max(8, Math.min(window.innerHeight - 100, oy + (ev.clientY - sy))),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div ref={dragRef} style={{
      position: "fixed",
      left: pos.x,
      top: pos.y,
      width: 320,
      zIndex: 9999,
      background: "var(--bg)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      boxShadow: "0 20px 50px -10px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
      overflow: "hidden",
    }}>
      <div onMouseDown={startDrag} style={{
        height: 24,
        background: "var(--surface)",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px",
        cursor: "grab",
        userSelect: "none",
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--muted)" }}>
          Drag to move
        </span>
        <button onClick={onClose} style={{
          width: 16, height: 16, borderRadius: 8, background: "var(--surface-2)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)",
        }}><IconClose /></button>
      </div>
      {children}
    </div>
  );
}

/* ---------- compact view (renders in PiP or float) ---------- */
function CompactView({ state, derived, lost, onClose, setState, embedded }) {
  return (
    <div style={compactStyles.root}>
      <div style={compactStyles.label}>Lost since opened</div>
      <div style={compactStyles.bigNum} className="num">{fmtMoney(lost, { decimals: 2 })}</div>

      <div style={compactStyles.row}>
        <div style={compactStyles.miniCol}>
          <div style={compactStyles.miniLabel}>per hour</div>
          <div style={compactStyles.miniVal} className="num">{fmtMoney(derived.perHour)}</div>
        </div>
        <div style={compactStyles.miniCol}>
          <div style={compactStyles.miniLabel}>per minute</div>
          <div style={compactStyles.miniVal} className="num">{fmtMoney(derived.perMinute, { decimals: 2 })}</div>
        </div>
        <div style={compactStyles.miniCol}>
          <div style={compactStyles.miniLabel}>per second</div>
          <div style={compactStyles.miniVal} className="num">{fmtMoney(derived.perSecond, { decimals: 4 })}</div>
        </div>
      </div>

      <div style={compactStyles.footer}>
        <span>@ {fmtCompact(derived.annual)}/yr</span>
        {!embedded && (
          <button onClick={onClose} style={compactStyles.closeBtn}>
            <IconClose /> close
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const mainStyles = {
  page: {
    minHeight: "100vh",
    padding: "48px 24px 80px",
    background: "var(--bg)",
  },
  shell: {
    maxWidth: 760,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 32,
  },
  header: { paddingBottom: 8 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "var(--accent)",
    fontWeight: 600,
    marginBottom: 12,
  },
  h1: {
    fontFamily: "var(--serif)",
    fontSize: 40,
    lineHeight: 1.1,
    fontWeight: 600,
    letterSpacing: -0.5,
    color: "var(--ink)",
    marginBottom: 12,
    textWrap: "pretty",
  },
  lede: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "var(--muted)",
    maxWidth: 560,
    textWrap: "pretty",
  },

  inputCard: {
    background: "var(--surface)",
    borderRadius: 16,
    padding: 24,
    border: "1px solid var(--line)",
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "var(--muted)",
    fontWeight: 600,
    marginBottom: 12,
    display: "block",
  },
  inputRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 16,
  },
  inputDollar: {
    fontFamily: "var(--serif)",
    fontSize: 48,
    fontWeight: 600,
    color: "var(--ink-2)",
  },
  input: {
    fontFamily: "var(--serif)",
    fontSize: 48,
    fontWeight: 600,
    background: "transparent",
    border: "none",
    outline: "none",
    width: "100%",
    color: "var(--ink)",
    padding: 0,
    letterSpacing: -1,
  },
  presets: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  preset: {
    padding: "6px 12px",
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    color: "var(--ink-2)",
    transition: "all 0.15s",
  },
  presetActive: {
    background: "var(--ink)",
    color: "var(--bg)",
    border: "1px solid var(--ink)",
  },

  rangeWrap: {
    paddingTop: 16,
    borderTop: "1px solid var(--line)",
  },
  rangeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14,
  },
  rangeLabel: {
    fontSize: 13,
    color: "var(--muted)",
  },
  rangeVal: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--ink)",
  },

  dualTrack: {
    position: "relative",
    height: 6,
    background: "var(--bg)",
    borderRadius: 6,
    margin: "12px 12px",
  },
  dualFill: {
    position: "absolute",
    top: 0, bottom: 0,
    background: "var(--accent)",
    borderRadius: 6,
    opacity: 0.85,
  },
  dualHandle: {
    position: "absolute",
    top: "50%",
    width: 18, height: 18,
    background: "var(--bg)",
    border: "2px solid var(--accent)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    cursor: "grab",
    padding: 0,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },

  section: { display: "flex", flexDirection: "column", gap: 16 },
  sectionHead: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "var(--ink-2)",
    fontWeight: 600,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  card: {
    background: "var(--surface)",
    borderRadius: 14,
    padding: "16px 18px",
    border: "1px solid transparent",
    transition: "border-color 0.15s",
  },
  cardLabel: {
    fontSize: 13,
    color: "var(--muted)",
    marginBottom: 6,
  },
  cardVal: {
    fontSize: 28,
    fontWeight: 600,
    color: "var(--ink)",
    letterSpacing: -0.5,
    lineHeight: 1.1,
  },
  cardSub: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 6,
  },

  rangeBreak: {
    display: "flex",
    flexDirection: "column",
  },
  rangeBreakRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    fontSize: 15,
    borderBottom: "1px solid var(--line)",
    borderRadius: 8,
  },

  ticker: {
    background: "var(--accent-soft)",
    border: "1px solid oklch(0.85 0.06 25)",
    borderRadius: 16,
    padding: 24,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 24,
    alignItems: "center",
  },
  tickerLeft: {},
  tickerLabel: {
    fontSize: 13,
    color: "var(--accent)",
    opacity: 0.8,
    marginBottom: 6,
  },
  tickerNum: {
    fontSize: 44,
    fontWeight: 600,
    color: "var(--accent)",
    letterSpacing: -1,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  resetBtn: {
    marginTop: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--accent)",
    padding: "4px 10px",
    border: "1px solid oklch(0.78 0.08 25)",
    borderRadius: 999,
    background: "transparent",
    fontWeight: 500,
  },

  tickerRight: {
    textAlign: "right",
    minWidth: 140,
  },
  daysLabel: {
    fontSize: 13,
    color: "var(--accent)",
    opacity: 0.8,
    marginBottom: 8,
  },
  daysControl: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  daysBtn: {
    width: 32, height: 32,
    borderRadius: "50%",
    background: "var(--bg)",
    border: "1px solid var(--line)",
    fontSize: 18,
    color: "var(--ink-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
  },
  daysVal: {
    fontSize: 22,
    fontWeight: 600,
    minWidth: 32,
    textAlign: "center",
  },
  daysAccrued: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 8,
  },

  settings: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  settingLabel: {
    background: "var(--surface)",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  settingLabelText: {
    fontSize: 12,
    color: "var(--muted)",
  },
  settingInput: {
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: 22,
    fontWeight: 600,
    width: "100%",
    color: "var(--ink)",
    padding: 0,
  },

  pipBar: {
    background: "var(--ink)",
    color: "var(--bg)",
    borderRadius: 16,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
    flexWrap: "wrap",
  },
  pipTitle: {
    fontFamily: "var(--serif)",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 6,
  },
  pipDesc: {
    fontSize: 13,
    color: "oklch(0.75 0.01 60)",
    maxWidth: 420,
    lineHeight: 1.5,
  },
  pipBtn: {
    background: "var(--bg)",
    color: "var(--ink)",
    padding: "12px 18px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  },

  footer: {
    fontSize: 12,
    color: "var(--muted)",
    textAlign: "center",
    paddingTop: 16,
  },
};

const compactStyles = {
  root: {
    padding: "16px 18px",
    background: "var(--bg, oklch(0.97 0.012 85))",
    color: "var(--ink, oklch(0.18 0.008 60))",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "oklch(0.55 0.012 60)",
    fontWeight: 600,
    marginBottom: 4,
  },
  bigNum: {
    fontFamily: "'Source Serif 4', Georgia, serif",
    fontSize: 36,
    fontWeight: 600,
    color: "oklch(0.40 0.13 25)",
    letterSpacing: -0.5,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    marginBottom: 14,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginBottom: 12,
  },
  miniCol: {
    background: "oklch(0.94 0.018 85)",
    borderRadius: 8,
    padding: "8px 10px",
  },
  miniLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "oklch(0.55 0.012 60)",
    fontWeight: 600,
    marginBottom: 2,
  },
  miniVal: {
    fontFamily: "'Source Serif 4', Georgia, serif",
    fontSize: 14,
    fontWeight: 600,
    color: "oklch(0.18 0.008 60)",
    fontVariantNumeric: "tabular-nums",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    color: "oklch(0.55 0.012 60)",
    paddingTop: 10,
    borderTop: "1px solid oklch(0.86 0.02 85)",
  },
  closeBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "oklch(0.55 0.012 60)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
