# Google Stitch Design Brief — Aegis Thermal Dashboard

Use this document when you go to [stitch.withgoogle.com](https://stitch.withgoogle.com) to design the investor-grade UI. Paste the **Master Prompt** below as your first message to Stitch. After Stitch generates v1, use the **Refinement prompts** in order to iterate.

---

## How to use Stitch (click-by-click)

1. Go to **https://stitch.withgoogle.com** in Chrome.
2. Sign in with your Google account.
3. Click **New design** (top-right).
4. Paste the **Master Prompt** (below) into the input box.
5. Under the prompt box, choose: **Mode: Standard**, **Device: Desktop (1440×900)**.
6. Click **Generate**.
7. When v1 appears, click **Continue chat** and paste **Refinement prompt 1**, then 2, then 3.
8. When happy: click **Export → PNG** for every screen. Save them in `thermal-dashboard/design/` and share them back to Claude.

---

## Master Prompt — paste this first

```
Design a pitch-ready desktop web dashboard for an AI product called "Aegis
Thermal — AI Data-Center Energy Optimization". The audience is enterprise
investors and CTOs at hyperscalers, banks, and telcos. The dashboard shows
LIVE telemetry from server racks — temperatures, power, CPU — and uses AI
(anomaly detection + forecasting) to cut cooling costs and CO2 emissions.

Tone: premium, calm, ops-center, professional. Think Stripe + Linear + a
dash of Palantir Gotham. Dark theme only. NOT playful, NOT consumer.

COLOR PALETTE (use only these):
- Background base: deep navy #0b0f1a (almost-black with blue tint)
- Surface cards: #111827 with 1px border rgba(255,255,255,0.06)
- Primary accent (data/active): cyan #22d3ee
- Secondary accent (power/energy): amber #f59e0b
- Positive / healthy / savings: emerald #10b981
- Alert / anomaly: red #ef4444
- Info / forecast: purple #8b5cf6
- Muted text: gray #9ca3af
- Primary text: near-white #e5e7eb
Avoid any bright or playful colors. No pastels. No gradients except one subtle
cyan→blue gradient behind KPI numbers.

TYPOGRAPHY:
- Sans: Inter (400/500/600/700)
- Mono: JetBrains Mono (for numbers and timestamps)
- Titles use tight letter-spacing. All numbers are mono.

LAYOUT (single-page desktop dashboard, 1440px width, 24px page padding):

1) TOP BAR (sticky, 64px):
   - Left: logo mark (a minimal CPU/chip icon in a cyan-to-blue gradient square),
     product name "Aegis Thermal" (600 weight), subtitle "AI Data-Center Energy
     Optimization" (12px muted).
   - Right: a small live pulse dot + "LIVE" in mono, and muted text
     "1,234 rows buffered · model ready".

2) KPI ROW (6 cards across, equal width):
   Each KPI card has: a tiny icon + uppercase label, a big mono number, and a
   one-line sub-caption. Use a soft radial gradient behind each card matching
   the KPI's accent color (cyan/amber/purple/green/blue/green).
   - Avg Inlet Temp (°C, cyan)
   - Total Power (kW, amber)
   - Avg CPU Load (%, purple)
   - Avg PUE (unitless, green — label: "target 1.30")
   - Avg Fan Speed (%, blue)
   - Avg Cooling Efficiency (%, green)

3) MAIN CHART SECTION (2 columns, 2/3 + 1/3 split):
   LEFT (2/3): three stacked line charts, each 320px tall:
     a) "Inlet Temperature by Rack (live)" — 4 lines (A1 cyan, A2 blue, B1 purple, B2 green)
     b) "Power Draw by Rack (live)" — same 4 series
     c) "CPU Load by Rack (live)" — same 4 series
     Each chart has a subtle grid (rgba(255,255,255,0.04)), thin 1.8px lines,
     no dots, and RED DIAMOND markers where the AI flagged anomalies.
   RIGHT (1/3): "Live Incident Feed" card, 520px tall, scrollable.
     Each feed row has:
       - A colored pill with the incident type ("Cooling Failure" red,
         "Workload Spike" amber, "AI Detected" blue, etc.)
       - A mono "Rack A1" tag and a mono timestamp (HH:MM:SS)
       - A single line of key telemetry (Inlet · Power · CPU · PUE)
       - A second 11px line: "Dominant signal: inlet_temp_c · score 0.73"

4) FORECAST SECTION header ("AI FORECAST · NEXT 6 HOURS" uppercase, tracked out):
   A 2x2 grid of small forecast cards (260px tall each). Each card shows:
     - Title ("Inlet Temperature — 6h Forecast")
     - A small delta pill in top-right ("+0.8°C" amber if rising, green if falling)
     - "Now 23.4°C → in 6h 24.2°C" muted sub-line
     - A soft-filled area chart with a gradient envelope (high/low band) and a
       solid mean line. 24 hourly points across the x-axis.
   Four cards: Inlet Temp (cyan), Power Draw (amber), CPU (purple), PUE (green).

5) RACK STATUS GRID (4 cards across):
   For each rack zone (A1, A2, B1, B2) a card with:
     - A 4px colored top border (green/amber/red by status)
     - "RACK ZONE" label + big "A1" name
     - A status pill (HEALTHY / WARN / ANOMALY) on the right
     - 3 mini stats in a row: Inlet temp, Power, PUE (big mono numbers)
     - A tiny muted line: "CPU 72% · FAN 65% · COOL 91%"
     - When in ANOMALY state, add a small "⚠ cooling failure" caption in red

6) BUSINESS IMPACT card (full width, 180px tall):
   Title: "Business Impact — Projected at Scale"
   Left third: big emerald number "$1.4M" with "Annual Cost Saved" label,
     sub: "3,200,000 kWh / yr"
   Middle third: white number "$4.6M / yr" with "Current Run Rate" label
   Right third: emerald "1,280 t / yr" with "CO₂ Avoided" label
   Below a divider: a tiny "INVESTOR ASSUMPTIONS" uppercase label, then three
   horizontal slider controls: "Facility scale (racks)", "Electricity ($/kWh)",
   "Target PUE". Each slider shows its current value in mono underneath.

7) FOOTER: small centered mono line:
   "Aegis Thermal · AI-powered data-center energy optimization · demo build"

VISUAL NOTES:
- Overall feel: a faint 40px grid pattern overlay at 3% opacity on the page
  background, a soft cyan radial glow in the top-right corner, a soft
  purple radial glow in the bottom-left. Think mission-control console.
- Cards have 16px rounded corners, 1px hairline borders, and a subtle
  shadow (shadow-2xl, low opacity).
- No skeuomorphism, no emojis in the UI (except the ⚠ warning glyph).
- Density is moderate: enough white space to feel premium, not a trading
  terminal.

DELIVERABLE: one desktop 1440x1800 long-scroll screen with all sections visible.
```

---

## Refinement prompt 1 — nail the KPI row

```
Tighten the KPI row. Each KPI card should be exactly 180px tall. The big
number should be 32-34px Inter 600, mono digits. The background gradient
behind each number should be a very soft radial glow in the KPI's accent
color, positioned top-right of the card. Add a subtle top-to-bottom 1px
hairline separator between the label and the number. The sub-caption under
the number must be muted gray #9ca3af at 11-12px.
```

## Refinement prompt 2 — make the incident feed feel alive

```
The "Live Incident Feed" should have:
- Each new event slide in from the top with a 200ms animation (just show
  the static state — a subtle left-side accent bar in the incident's color).
- The newest event has a thin 1px cyan left border that fades over 3 seconds
  (draw it as a static bar for the mockup).
- Timestamps in JetBrains Mono, right-aligned, 11px muted.
- On hover, the row brightens slightly and the left border brightens.
```

## Refinement prompt 3 — polish the Business Impact card

```
Make the Business Impact card more investor-grade:
- The "$1.4M" savings number should be 44px, emerald, mono.
- Add a small green up-arrow icon before "$1.4M".
- The "CO₂ Avoided" number should have a tiny leaf icon.
- The sliders below should look like macOS-style sliders: thin track, small
  round thumb with the accent color for that metric. Show tick marks at
  min/mid/max.
- Add a very subtle emerald glow in the top-left of the card background.
```

---

## What to share back with Claude

When your designs are ready:

1. Export each section as PNG (full-page also fine).
2. Save them into `thermal-dashboard/design/` — create the folder if it doesn't exist.
3. In a new Claude message, attach the screenshots and say: "Here are my approved Stitch designs — rebuild the React UI to match."

Claude will then update the React components one by one so the running app matches your designs pixel-for-pixel.
