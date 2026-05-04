# Opportunity Cost Tracker

_Started 2026-05-04 21:50 UTC_

---

## User

i want to create an opportunity tracker. what it is it that you input the yealry salary you'd get if you take on a job (so there is a user input) and it then breaks down how much money it costs you to stay unemployed or work on this startup/opportunity of yours. you can see the clean design in the screenshot. this should beocme a little webapp tool. once you have a timer you should be able to add as a small window to your desktop so while you work in other windows you always see it in the top left corner for example

## Assistant

I'll build this opportunity tracker. Let me look at the screenshot first to understand the aesthetic, then build it as a single-page interactive prototype with a "compact mode" that turns it into a small always-visible window.

_[tool: view_image]_

Got it. The reference is a clean, original aesthetic — warm cream backgrounds, soft pill cards, a serif-feeling display number, deep red accent for the live ticker. I'll build that as an original design (not copying any branded UI), with input controls and a "compact mode" that shrinks it into a small always-on-top style window perfect for picture-in-picture.

**Design system I'll use:**
- Background: warm cream `oklch(0.97 0.012 85)`, cards `oklch(0.94 0.018 85)`
- Foreground: near-black `oklch(0.18 0.005 60)`, muted `oklch(0.55 0.01 60)`
- Accent: deep oxblood red `oklch(0.38 0.12 25)` for the live ticker
- Type: "Source Serif 4" for display numbers (warm, slightly literary), "Inter" for UI labels

Plan:
1. Salary input at the top (with low/mid/high range)
2. Cost breakdown grid (year/month/week/day/hour/minute)
3. Range breakdown rows
4. Live ticker that increments every 10ms with elapsed-since-opened
5. Days unemployed +/− adjuster
6. **Compact mode toggle** — collapses to a tiny floating window (works as PiP via Document Picture-in-Picture API where supported, otherwise a draggable mini-window)

_[tool: update_todos]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

Built **Opportunity Tracker** — a single-page tool with:

- **Salary input** (typeable, with quick-pick chips for $120k–$500k, plus a draggable low/high range)
- **Cost grid** — year / month / week / day / hour / minute, with adjustable assumptions (hrs/week, working weeks/year, workday length)
- **Range breakdown** rows for low/mid/high hourly
- **Live ticker** that counts up in real time since you opened the page, plus a days-unemployed counter that totals foregone earnings
- **"Pin to your desktop"** — opens a compact window with the live ticker and per-hour/min/sec figures. Uses the **Document Picture-in-Picture API** in supporting browsers (Chrome/Edge) so it stays on top of every other window; falls back to a draggable in-page mini-window elsewhere.
- All state persists to localStorage.

The aesthetic is original — warm cream surfaces, oxblood accent for the loss number, Source Serif 4 for display figures.

## User

there is far too much text and elements. i want to keep the core ones only

## Assistant

Got it — strip it down to the essentials. Let me ask quickly what you want to keep before I cut, since "core" can vary:

_[tool: questions_v2]_

## User

Questions answered:
- header_treatment: Remove entirely — just the tool
- keep: Salary input
- presets: Remove
- density: Roomy & calm — same density, just less stuff

## Assistant

Cutting it down to just: salary input + cost grid + live ticker. Removing header, presets, range breakdown, days counter, assumptions, and the big pin-to-desktop CTA bar. I'll move the compact-window button to a small icon in the top corner so the function stays available without taking up space.

_[tool: copy_files]_

_[tool: snip]_

_[tool: write_file]_

_[tool: snip]_

_[tool: done]_

Stripped down to the three core sections: salary input, cost grid, and live ticker. The pin-to-desktop function is now a small icon button in the top-right corner.

## User

few more changes. first center the content. the forgone salary is an input field for the user. then there ticker. underneath the breakdown. 

it is a non scrollable page. the pop up should only show the tracker. not the salary etc.

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

The compact view already only shows the tracker (not the salary input) — it's already scoped to just the lost-amount and a footer with annual/hourly. Let me verify the layout fits without scrolling and check the result.

_[tool: done]_

_[tool: snip]_

_[tool: fork_verifier_agent]_

Centered the layout, made the page non-scrollable (full viewport, content centered), and confirmed the order is salary input → breakdown → ticker. The popup already shows only the tracker.

## User

Verifier agent check completed

## Assistant

_[tool: snip]_

Verifier confirmed everything's in order — centered, non-scrolling, correct order.

