"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// --- Helpers ---
const STORAGE_KEY = "opportunity-tracker-v3"

function fmt(n: number, dec = 0): string {
  if (!isFinite(n)) return "$0"
  const s = n.toFixed(dec)
  const [i, d] = s.split(".")
  const c = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return "$" + (d ? c + "." + d : c)
}

function fmtCompact(n: number): string {
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k"
  return "$" + Math.round(n)
}

function compute(annual: number) {
  const totalHrs = 40 * 50
  const perHour = totalHrs ? annual / totalHrs : 0
  const perMin = perHour / 60
  const perSec = perMin / 60
  return {
    annual,
    perHour,
    perMin,
    perSec,
    perDay: perHour * 8,
    perWeek: perHour * 8 * 5,
    perMonth: annual / 12,
  }
}

// --- Icons ---
function IconPin() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <rect x="12.5" y="12" width="7" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 0.2s",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

// --- Main Component ---
export default function OpportunityTracker() {
  const [salary, setSalary] = useState(0)
  const [inputValue, setInputValue] = useState("")
  const [started, setStarted] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [accordionOpen, setAccordionOpen] = useState(false)
  const [showEditBtn, setShowEditBtn] = useState(false)
  const [showStartRow, setShowStartRow] = useState(true)
  const [floatOpen, setFloatOpen] = useState(false)
  const [floatPos, setFloatPos] = useState({ x: 24, y: 24 })
  const [tick, setTick] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  // Load saved salary
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
      if (s.salary && isFinite(s.salary)) {
        setSalary(s.salary)
        setInputValue(s.salary.toLocaleString("en-US"))
      }
    } catch (_) {}
  }, [])

  // Save salary
  useEffect(() => {
    if (salary > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ salary }))
      } catch (_) {}
    }
  }, [salary])

  // Ticker animation
  useEffect(() => {
    let raf: number
    const loop = () => {
      setTick(Date.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const derived = compute(salary)
  const lost = started && startedAt ? ((Date.now() - startedAt) / 1000) * derived.perSec : 0
  const footer = `@ ${fmtCompact(derived.annual)}/yr · ${fmt(derived.perHour)}/hr`

  const getInputVal = useCallback(() => {
    return parseFloat(inputValue.replace(/[^\d.]/g, "")) || 0
  }, [inputValue])

  const isButtonActive = getInputVal() > 0

  const doStart = useCallback(() => {
    const val = getInputVal()
    if (val <= 0) {
      inputRef.current?.focus()
      return
    }
    setSalary(val)
    setStarted(true)
    setStartedAt(Date.now())
    setShowStartRow(false)
    setShowEditBtn(true)
  }, [getInputVal])

  const handleInputFocus = () => {
    if (salary > 0) setInputValue(String(salary))
  }

  const handleInputBlur = () => {
    const val = getInputVal()
    if (val > 0) {
      setSalary(val)
      setInputValue(val.toLocaleString("en-US"))
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") doStart()
  }

  const handleEditClick = () => {
    setShowStartRow(true)
    setShowEditBtn(false)
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  // Floating window drag
  const handleDragStart = (e: React.MouseEvent) => {
    const sx = e.clientX
    const sy = e.clientY
    const ox = floatPos.x
    const oy = floatPos.y

    const onMove = (ev: MouseEvent) => {
      setFloatPos({
        x: Math.max(8, Math.min(window.innerWidth - 280, ox + (ev.clientX - sx))),
        y: Math.max(8, Math.min(window.innerHeight - 100, oy + (ev.clientY - sy))),
      })
    }

    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return (
    <>
      <div className="page">
        <div className="shell">
          {/* Pin button */}
          <button
            className={`pin-btn ${started ? "visible" : ""} ${floatOpen ? "active" : ""}`}
            title={floatOpen ? "Close pinned window" : "Pin to desktop"}
            aria-label={floatOpen ? "Close pinned window" : "Pin to desktop"}
            onClick={() => setFloatOpen(!floatOpen)}
          >
            <IconPin />
          </button>

          {/* Hero */}
          <div className="hero">
            <h1 className="hero-hed">
              Every minute you wait
              <br />
              <em>costs money.</em>
            </h1>
            <p className="hero-blurb">
              {started
                ? "An unfinished startup is the most expensive kind. You gave up a salary to build something. Every day you don't ship, you're paying for both: the income gone and the time burned."
                : "Time isn't free. See how much procrastination costs by adding your income below."}
            </p>
          </div>

          {/* Input card */}
          <section className="input-card">
            <label className="field-label" htmlFor="salaryInput">
              Foregone annual salary
            </label>

            <button
              className={`edit-btn ${showEditBtn ? "visible" : ""}`}
              title="Edit salary"
              aria-label="Edit salary"
              onClick={handleEditClick}
            >
              <IconEdit />
            </button>

            <div className="input-row">
              <span className="input-symbol">$</span>
              <input
                ref={inputRef}
                id="salaryInput"
                className="salary-input"
                type="text"
                inputMode="numeric"
                placeholder="100,000"
                autoComplete="off"
                spellCheck={false}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
              />
            </div>

            <div className={`start-row ${!showStartRow ? "hidden" : ""}`}>
              <button
                className="start-btn"
                style={{
                  opacity: isButtonActive ? 1 : 0.28,
                  pointerEvents: isButtonActive ? "auto" : "none",
                  cursor: isButtonActive ? "pointer" : "default",
                }}
                onClick={doStart}
              >
                Start calculating
                <IconArrow />
              </button>
            </div>
          </section>

          {/* Results */}
          <div className={`results ${!started ? "hidden" : ""}`}>
            {/* Ticker */}
            <div className="ticker-card">
              <div className="ticker-eyebrow">Lost since you started</div>
              <div className="ticker-num">{started ? fmt(lost, 2) : "—"}</div>
            </div>

            {/* Accordion breakdown */}
            <div className="accordion-section">
              <button
                className={`accordion-toggle ${accordionOpen ? "open" : ""}`}
                aria-expanded={accordionOpen}
                onClick={() => setAccordionOpen(!accordionOpen)}
              >
                <span>Breakdown</span>
                <IconChevron open={accordionOpen} />
              </button>
              <div className={`grid ${accordionOpen ? "open" : ""}`}>
                <div className="card">
                  <div className="card-label">Per year</div>
                  <div className="card-val">{fmt(derived.annual)}</div>
                </div>
                <div className="card">
                  <div className="card-label">Per month</div>
                  <div className="card-val">{fmt(derived.perMonth)}</div>
                </div>
                <div className="card">
                  <div className="card-label">Per week</div>
                  <div className="card-val">{fmt(derived.perWeek)}</div>
                </div>
                <div className="card">
                  <div className="card-label">Per day</div>
                  <div className="card-val">{fmt(derived.perDay)}</div>
                </div>
                <div className="card">
                  <div className="card-label">Per hour</div>
                  <div className="card-val">{fmt(derived.perHour)}</div>
                </div>
                <div className="card">
                  <div className="card-label">Per minute</div>
                  <div className="card-val">{fmt(derived.perMin, 2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating window */}
      {floatOpen && (
        <div
          className="float-win open"
          style={{ left: floatPos.x, top: floatPos.y }}
        >
          <div className="float-bar" onMouseDown={handleDragStart}>
            <span className="float-drag-hint">Drag</span>
            <button
              className="float-close-btn"
              aria-label="Close"
              onClick={() => setFloatOpen(false)}
            >
              <IconClose />
            </button>
          </div>
          <div className="compact-body">
            <div className="compact-label">Lost since started</div>
            <div className="compact-num">{started ? fmt(lost, 2) : "—"}</div>
            <div className="compact-footer">{footer}</div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px 48px;
        }

        .shell {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hero {
          text-align: center;
          padding: 0 8px 4px;
          margin-bottom: 8px;
        }

        .hero-hed {
          font-family: var(--serif);
          font-size: 38px;
          font-weight: 300;
          line-height: 1.18;
          letter-spacing: -0.5px;
          color: var(--ink);
          margin-bottom: 14px;
        }

        .hero-hed em {
          font-style: italic;
          font-weight: 400;
        }

        .hero-blurb {
          font-size: 14px;
          line-height: 1.65;
          color: var(--muted);
          max-width: 420px;
          margin: 0 auto;
          font-weight: 400;
        }

        .input-card {
          background: var(--surface);
          border-radius: var(--radius-card);
          padding: 22px 26px 20px;
          box-shadow: var(--shadow-card);
          position: relative;
        }

        .field-label {
          font-size: 11px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 10px;
          display: block;
        }

        .input-row {
          display: flex;
          align-items: center;
        }

        .input-symbol {
          font-family: var(--serif);
          font-size: 46px;
          font-weight: 400;
          color: var(--ink-2);
          line-height: 1;
          user-select: none;
          flex-shrink: 0;
          margin-right: 3px;
        }

        .salary-input {
          font-family: var(--serif);
          font-size: 46px;
          font-weight: 400;
          background: transparent;
          border: none;
          outline: none;
          flex: 1;
          min-width: 0;
          color: var(--ink);
          padding: 0;
          letter-spacing: -1.5px;
          line-height: 1;
          font-feature-settings: "tnum" 1, "lnum" 1;
        }

        .edit-btn {
          position: absolute;
          top: 14px;
          right: 16px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: transparent;
          color: var(--muted);
          display: none;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .edit-btn.visible {
          display: flex;
        }
        .edit-btn:hover {
          background: var(--surface-2);
          color: var(--ink-2);
        }

        .start-row {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
        }
        .start-row.hidden {
          display: none;
        }

        .start-btn {
          background: var(--ink);
          color: var(--background);
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          letter-spacing: 0.1px;
          transition: opacity 0.15s;
        }
        .start-btn:hover {
          opacity: 0.82;
        }

        .results {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .results.hidden {
          display: none;
        }

        .ticker-card {
          background: var(--accent-soft);
          border: 1px solid var(--accent-line);
          border-radius: var(--radius-card);
          padding: 24px 28px;
          box-shadow: var(--shadow-card);
        }

        .ticker-eyebrow {
          font-size: 11px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: var(--accent);
          font-weight: 500;
          opacity: 0.7;
          margin-bottom: 8px;
        }

        .ticker-num {
          font-family: var(--serif);
          font-size: 52px;
          font-weight: 400;
          color: var(--accent);
          letter-spacing: -2px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "lnum" 1;
        }

        .accordion-section {
          background: var(--surface);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }

        .accordion-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--muted);
          cursor: pointer;
          transition: color 0.15s;
          background: none;
          border: none;
        }
        .accordion-toggle:hover {
          color: var(--ink-2);
        }

        .grid {
          display: none;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--line);
          border-top: 1px solid var(--line);
        }
        .grid.open {
          display: grid;
        }

        .card {
          background: var(--surface);
          padding: 14px 18px;
        }

        .card-label {
          font-size: 11px;
          letter-spacing: 0.3px;
          color: var(--muted);
          margin-bottom: 6px;
          font-weight: 500;
        }

        .card-val {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 400;
          color: var(--ink);
          letter-spacing: -0.3px;
          line-height: 1.05;
          font-feature-settings: "tnum" 1, "lnum" 1;
        }

        .pin-btn {
          position: fixed;
          top: 16px;
          right: 16px;
          width: 34px;
          height: 34px;
          z-index: 50;
          border-radius: 50%;
          background: var(--surface);
          box-shadow: var(--shadow-card);
          color: var(--ink-2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s, opacity 0.2s;
          opacity: 0;
          pointer-events: none;
        }
        .pin-btn.visible {
          opacity: 1;
          pointer-events: auto;
        }
        .pin-btn.active {
          background: var(--ink);
          color: var(--background);
        }

        .float-win {
          position: fixed;
          width: 270px;
          z-index: 9999;
          background: var(--background);
          border-radius: 18px;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }

        .float-bar {
          height: 22px;
          background: var(--surface);
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          cursor: grab;
          user-select: none;
        }
        .float-bar:active {
          cursor: grabbing;
        }
        .float-drag-hint {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--muted);
        }
        .float-close-btn {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--surface-2);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          cursor: pointer;
          padding: 0;
        }
        .compact-body {
          padding: 14px 16px;
        }
        .compact-label {
          font-size: 10px;
          letter-spacing: 1.3px;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 500;
          margin-bottom: 4px;
        }
        .compact-num {
          font-family: var(--serif);
          font-size: 38px;
          font-weight: 400;
          color: var(--accent);
          letter-spacing: -1px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          margin-bottom: 10px;
        }
        .compact-footer {
          font-size: 11px;
          color: var(--muted);
          padding-top: 9px;
          border-top: 1px solid var(--line);
        }

        @media (max-width: 640px) {
          .page {
            align-items: flex-start;
            padding-top: 36px;
          }
          .hero-hed {
            font-size: 28px;
          }
          .hero-blurb {
            font-size: 13px;
          }
          .ticker-num {
            font-size: 40px;
          }
          .salary-input,
          .input-symbol {
            font-size: 36px;
          }
        }
      `}</style>
    </>
  )
}
