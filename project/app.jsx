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
    const weeklyHours = 40;
    const weeksPerYear = 50;
    const workdayHours = 8;

    const annualWorkingHours = weeklyHours * weeksPerYear;
    const perHour = annualWorkingHours > 0 ? annual / annualWorkingHours : 0;
    const perMinute = perHour / 60;
    const perSecond = perMinute / 60;
    const perDay = perHour * workdayHours;
    const perWeek = perDay * 5;
    const perMonth = annual / 12;

    return {
      annual, perHour, perMinute, perSecond, perDay, perWeek, perMonth,
      workdayHours, weeklyHours,
    };
  }, [state]);
}

/* ---------- live ticker hook ---------- */
function useTickerSince(openedAt) {
  const [, setTick] = useState(0);
  useEffect(() => {
    let raf;
    const loop = () => { setTick(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return openedAt ? Date.now() - openedAt : 0;
}

/* ---------- icons ---------- */
const IconPip = (p) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2.5" y="4" width="19" height="16" rx="2"/>
    <rect x="12.5" y="12" width="7" height="6" rx="1" fill="currentColor" stroke="none"/>
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

  useEffect(() => { saveStored(state); }, [state]);

  const [openedAt] = useState(() => {
    const existing = sessionStorage.getItem(TICK_KEY);
    if (existing) return parseInt(existing, 10);
    const now = Date.now();
    sessionStorage.setItem(TICK_KEY, String(now));
    return now;
  });

  const derived = useDerived(state);
  const elapsedMs = useTickerSince(openedAt);
  const lost = (elapsedMs / 1000) * derived.perSecond;

  // PiP / compact window state
  const [pipOpen, setPipOpen] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);
  const pipWinRef = useRef(null);
  const pipRootRef = useRef(null);

  const supportsDocPiP = typeof window !== "undefined" && "documentPictureInPicture" in window;

  const openCompact = useCallback(async () => {
    if (supportsDocPiP) {
      try {
        const pipWin = await window.documentPictureInPicture.requestWindow({ width: 280, height: 140 });
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
          pipWin.document.head.appendChild(node.cloneNode(true));
        });
        const baseStyle = pipWin.document.createElement("style");
        baseStyle.textContent = `
          html, body { margin:0; padding:0; font-family: "Inter", system-ui, sans-serif; color: oklch(0.18 0.008 60); }
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

  useEffect(() => {
    if (pipOpen && pipRootRef.current) {
      pipRootRef.current.render(
        <CompactView derived={derived} lost={lost} />
      );
    }
  }, [pipOpen, derived, lost]);

  const compactActive = pipOpen || floatOpen;

  return (
    <>
      <MainView
        state={state}
        setState={setState}
        derived={derived}
        lost={lost}
        openCompact={openCompact}
        closeCompact={closeCompact}
        compactActive={compactActive}
      />
      {floatOpen && (
        <FloatingWindow onClose={closeCompact}>
          <CompactView derived={derived} lost={lost} />
        </FloatingWindow>
      )}
    </>
  );
}

/* ---------- main view ---------- */
function MainView({ state, setState, derived, lost, openCompact, closeCompact, compactActive }) {
  const [salaryInput, setSalaryInput] = useState(String(state.annualSalary));

  useEffect(() => { setSalaryInput(String(state.annualSalary)); }, [state.annualSalary]);

  const commitSalary = (raw) => {
    const n = parseSalaryInput(raw);
    setState(s => ({ ...s, annualSalary: Math.max(0, n) }));
  };

  return (
    <div style={mainStyles.page}>
      <div style={mainStyles.shell}>
        {/* Tiny pin button, top-right */}
        <button
          style={{
            ...mainStyles.pinBtn,
            ...(compactActive ? mainStyles.pinBtnActive : {}),
          }}
          onClick={compactActive ? closeCompact : openCompact}
          title={compactActive ? "Close pinned window" : "Pin to desktop"}
          aria-label={compactActive ? "Close pinned window" : "Pin to desktop"}
        >
          <IconPip />
        </button>

        {/* Salary input */}
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
        </section>

        {/* Cost breakdown */}
        <section style={mainStyles.section}>
          <div style={mainStyles.sectionHead}>Your cost of not working</div>
          <div style={mainStyles.grid}>
            <CostCard label="Per year" value={fmtMoney(derived.annual)} />
            <CostCard label="Per month" value={fmtMoney(derived.perMonth)} />
            <CostCard label="Per week" value={fmtMoney(derived.perWeek)} />
            <CostCard label="Per day" value={fmtMoney(derived.perDay)} />
            <CostCard label="Per hour" value={fmtMoney(derived.perHour)} />
            <CostCard label="Per minute" value={fmtMoney(derived.perMinute, { decimals: 2 })} />
          </div>
        </section>

        {/* Live ticker — below the breakdown */}
        <section style={mainStyles.section}>
          <div style={mainStyles.sectionHead}>Real-time cost ticker</div>
          <div style={mainStyles.ticker}>
            <div style={mainStyles.tickerLabel}>Lost since you opened this</div>
            <div style={mainStyles.tickerNum} className="num">
              {fmtMoney(lost, { decimals: 2 })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function CostCard({ label, value }) {
  return (
    <div style={mainStyles.card}>
      <div style={mainStyles.cardLabel}>{label}</div>
      <div style={mainStyles.cardVal} className="num">{value}</div>
    </div>
  );
}

/* ---------- floating fallback window ---------- */
function FloatingWindow({ children, onClose }) {
  const [pos, setPos] = useState({ x: 24, y: 24 });
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
    <div style={{
      position: "fixed",
      left: pos.x,
      top: pos.y,
      width: 280,
      zIndex: 9999,
      background: "var(--bg)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      boxShadow: "0 20px 50px -10px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
      overflow: "hidden",
    }}>
      <div onMouseDown={startDrag} style={{
        height: 22,
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
          Drag
        </span>
        <button onClick={onClose} style={{
          width: 16, height: 16, borderRadius: 8, background: "var(--surface-2)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", border: "none",
        }}><IconClose /></button>
      </div>
      {children}
    </div>
  );
}

/* ---------- compact view (renders in PiP or float) ---------- */
function CompactView({ derived, lost }) {
  return (
    <div style={compactStyles.root}>
      <div style={compactStyles.label}>Lost since opened</div>
      <div style={compactStyles.bigNum} className="num">{fmtMoney(lost, { decimals: 2 })}</div>
      <div style={compactStyles.footer}>
        @ {fmtCompact(derived.annual)}/yr · {fmtMoney(derived.perHour)}/hr
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const mainStyles = {
  page: {
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: "var(--bg)",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
  },
  shell: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    flexDirection: "column",
    gap: 24,
    position: "relative",
  },

  pinBtn: {
    position: "fixed",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    zIndex: 50,
    borderRadius: 999,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    color: "var(--ink-2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  pinBtnActive: {
    background: "var(--ink)",
    color: "var(--bg)",
    border: "1px solid var(--ink)",
  },

  inputCard: {
    background: "var(--surface)",
    borderRadius: 16,
    padding: "18px 24px",
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
  },
  inputDollar: {
    fontFamily: "var(--serif)",
    fontSize: 44,
    fontWeight: 600,
    color: "var(--ink-2)",
    lineHeight: 1,
  },
  input: {
    fontFamily: "var(--serif)",
    fontSize: 44,
    fontWeight: 600,
    background: "transparent",
    border: "none",
    outline: "none",
    width: "100%",
    color: "var(--ink)",
    padding: 0,
    letterSpacing: -1,
    lineHeight: 1,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  card: {
    background: "var(--surface)",
    borderRadius: 14,
    padding: "14px 18px",
    border: "1px solid transparent",
  },
  cardLabel: {
    fontSize: 12,
    color: "var(--muted)",
    marginBottom: 6,
  },
  cardVal: {
    fontSize: 26,
    fontWeight: 600,
    color: "var(--ink)",
    letterSpacing: -0.5,
    lineHeight: 1.05,
  },

  ticker: {
    background: "var(--accent-soft)",
    border: "1px solid oklch(0.85 0.06 25)",
    borderRadius: 16,
    padding: "18px 24px",
  },
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
};

const compactStyles = {
  root: {
    padding: "14px 18px",
    background: "oklch(0.97 0.012 85)",
    color: "oklch(0.18 0.008 60)",
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
    fontSize: 40,
    fontWeight: 600,
    color: "oklch(0.40 0.13 25)",
    letterSpacing: -0.5,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    marginBottom: 10,
  },
  footer: {
    fontSize: 11,
    color: "oklch(0.55 0.012 60)",
    paddingTop: 10,
    borderTop: "1px solid oklch(0.86 0.02 85)",
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
