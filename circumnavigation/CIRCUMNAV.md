# Jorczak.com Circumnavigation sub site — Project Notes for Claude

## Project Overview

Build a polished, interactive **Jeff and Missy 36-month sailing circumnavigation** as a standalone sub web application. This area will contain interactive pages for a 3 year global circumnavigation performed by Jeff (who will be age 65) and Missy (who will be age 56). Target date is 2034. Boat wil be a 40' catamaran aged about 10 years old. We will be travelling with a dog.

The project was prototyped as a single self-contained HTML file in Claude.ai across several iterations. This document captures all design decisions, data structures, features, and UX patterns so Claude Code can build a production-quality version.

## style

This will not match the Jorczak.com root style. It should use colors and styles from a world atlas theme with vibes of adventure, mystery, and discovery.

## audience

This will be to record our journey, but at this stage it's for planning it. Core right now is the itinerary and the budget.

---

## What Has Been Built (Prototype)

A single-file HTML/CSS/JS dashboard (`liveaboard-budget.html`) that renders a full 36-month, month-by-month budget for two liveaboard travelers (ages 65 and 56) plus one dog, sailing a 40' catamaran around the world. The file is large (~6,000+ lines) and was cut off during generation — the final months (M33–M36) are incomplete. Claude Code should complete the missing months and restructure the app properly.

---

## Traveler Profile & Assumptions

| Parameter      | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Vessel         | 40' catamaran, 2015 build                                          |
| Crew           | 2 adults — ages **65** and **56**                                  |
| Pets           | 1 dog                                                              |
| Dining out     | 2× per week                                                        |
| Dockage split  | 30% at anchor · 30% mooring · 30% marina slip · 10% at sea/passage |
| Flights home   | 4× per year (2 adults, ~8 nights each trip)                        |
| Dog boarding   | 8 nights per home trip                                             |
| Haul-outs      | 1 per year (3 total)                                               |
| Route duration | 36 months                                                          |

---

## Route — All 36 Months

### Year 1 — Mediterranean & Atlantic (M01–M12)

| Month            | Location                                 | Flag | Type            | Est. Total    |
| ---------------- | ---------------------------------------- | ---- | --------------- | ------------- |
| M01 Jun          | Western Mediterranean — Spain, Balearics | 🇪🇸   | Home trip       | $12,800       |
| M02 Jul          | Eastern Med — Croatia, Montenegro        | 🇭🇷   | —               | $9,600        |
| M03 Aug          | Greece — Ionian & Aegean                 | 🇬🇷   | —               | $9,800        |
| M04 Sep          | Turkey — Bodrum, Marmaris                | 🇹🇷   | Home trip       | $11,000       |
| M05 Oct          | Gibraltar → Morocco → Canaries           | 🇪🇸   | —               | $9,200        |
| M06 Nov          | South Atlantic Crossing (passage)        | 🌊   | Passage         | $8,000        |
| M07 Dec          | Brazil — NE Coast, Rio                   | 🇧🇷   | Home trip       | $11,200       |
| M08 Jan          | Brazil — South Coast                     | 🇧🇷   | —               | $8,200        |
| M09 Feb          | Uruguay & N. Argentina                   | 🇺🇾   | —               | $8,400        |
| M10 Mar          | Patagonia — Ushuaia                      | 🇦🇷   | **Haul-out #1** | $15,200       |
| M11 Apr          | Cape Horn & Patagonian Channels          | 🌊   | Passage + Home  | $12,800       |
| M12 May          | Chile North — Puerto Montt to Valparaíso | 🇨🇱   | —               | $8,200        |
| **Year 1 Total** |                                          |      |                 | **~$112,600** |

### Year 2 — Pacific & Antipodes (M13–M24)

| Month            | Location                            | Flag | Type                                    | Est. Total    |
| ---------------- | ----------------------------------- | ---- | --------------------------------------- | ------------- |
| M13 Jun          | Easter Island                       | 🗿   | —                                       | $10,000       |
| M14 Jul          | Marquesas — French Polynesia        | 🇵🇫   | Home trip                               | $11,400       |
| M15 Aug          | Society Islands — Bora Bora, Moorea | 🇵🇫   | —                                       | $10,400       |
| M16 Sep          | Cook Islands → Tonga                | 🇨🇰   | —                                       | $9,000        |
| M17 Oct          | Samoa & American Samoa              | 🇼🇸   | Home trip                               | $9,600        |
| M18 Nov          | Fiji — Yasawa & Lau                 | 🇫🇯   | —                                       | $8,800        |
| M19 Dec          | Vanuatu                             | 🇻🇺   | —                                       | $8,400        |
| M20 Jan          | New Zealand — Bay of Islands        | 🇳🇿   | Home trip + **Dog quarantine NZ**       | $14,200       |
| M21 Feb          | Australia — Cairns, Whitsundays     | 🇦🇺   | **Haul-out #2** + **Dog quarantine AU** | $16,200       |
| M22 Mar          | Australia — Darwin & Kimberley      | 🇦🇺   | —                                       | $9,800        |
| M23 Apr          | Indonesia — Komodo & Bali           | 🇮🇩   | —                                       | $8,200        |
| M24 May          | Indonesia — Raja Ampat & North      | 🇮🇩   | Home trip                               | $9,000        |
| **Year 2 Total** |                                     |      |                                         | **~$111,200** |

### Year 3 — Asia, Indian Ocean & Home (M25–M36)

| Month            | Location                            | Flag | Type                      | Est. Total    |
| ---------------- | ----------------------------------- | ---- | ------------------------- | ------------- |
| M25 Jun          | Philippines — Palawan               | 🇵🇭   | —                         | $8,000        |
| M26 Jul          | Philippines — Manila & Luzon        | 🇵🇭   | Home trip                 | $10,400       |
| M27 Aug          | Japan — Okinawa & Kyushu            | 🇯🇵   | —                         | $10,200       |
| M28 Sep          | Japan — Inland Sea & Tokyo          | 🇯🇵   | Home trip                 | $12,000       |
| M29 Oct          | Sri Lanka                           | 🇱🇰   | —                         | $7,600        |
| M30 Nov          | Maldives                            | 🇲🇻   | —                         | $7,800        |
| M31 Dec          | India — Goa & Kerala                | 🇮🇳   | Home trip                 | $10,600       |
| M32 Jan          | Seychelles                          | 🇸🇨   | —                         | $8,600        |
| M33 Feb          | East Africa — Kenya to South Africa | 🇰🇪   | **Haul-out #3**           | $14,800       |
| M34 Mar          | South Africa — Cape Town            | 🇿🇦   | Home trip                 | $10,200       |
| M35 Apr          | St. Helena → Ascension → Brazil     | 🌊   | Passage                   | $7,800        |
| M36 May          | Caribbean — Barbados → BVI 🎉       | 🇧🇧   | Circumnavigation complete | $13,200       |
| **Year 3 Total** |                                     |      |                           | **~$104,600** |

**3-Year Grand Total: ~$328,400** ($9,122/month average)

---

## Budget Categories (per month, every month)

Each month contains line items organized into these categories. Every category should be expandable/collapsible:

| Category                    | Icon | Color Accent | Notes                                   |
| --------------------------- | ---- | ------------ | --------------------------------------- |
| Marina & Dockage            | ⚓   | Blue         | Varies dramatically by region           |
| Provisioning & Dining       | 🛒   | Green        | Grocery + 2× dining/week                |
| Health Insurance            | 🏥   | Red          | **Age-adjusted — see below**            |
| Vessel Insurance            | 🛡️   | Teal         | Bluewater hull + liability              |
| Maintenance & Repairs       | 🔧   | Orange       | Higher in haul-out months               |
| Fuel & Energy               | ⛽   | Gold         | Diesel + shore power + solar offset     |
| Communications & Navigation | 📡   | Purple       | Starlink + Iridium + local SIMs         |
| Customs & Port Fees         | 🛂   | Sand         | Per-country clearance fees              |
| Dog Expenses                | 🐾   | Pink         | Food, vet, insurance, quarantine months |
| Personal & Lifestyle        | 👤   | Sand         | Laundry, excursions, medical, clothing  |
| Admin & Banking             | 📋   | Sand         | Wire fees, storage, tax accrual         |
| Flights Home + Boat Watch   | ✈️   | Gold         | Only in home-trip months (4×/yr)        |
| Haul-Out                    | 🏗️   | Orange       | Only in haul months (M10, M21, M33)     |
| Cape Horn Emergency Buffer  | ⚠️   | Orange       | M11 only — $2,000                       |

### Health Insurance — Critical Pricing Note

This was the key correction made in the final iteration. Medicare does not cover international travel. Age-based premiums are:

| Person                          | Annual Premium | Monthly    |
| ------------------------------- | -------------- | ---------- |
| Age 65 (Cigna Global / GeoBlue) | $11,000/yr     | $917       |
| Age 56 (international plan)     | $5,800/yr      | $483       |
| MEDEVAC rider                   | $1,800/yr      | $150       |
| **Combined**                    | **$16,800/yr** | **$1,400** |

Previous iterations used ~$400–500/month for health insurance. Correct figure is ~$1,400/month (combined). This adds ~$10,000/year vs generic expat pricing.

### Special Events by Month

**Home trip months** (4× per year — add these line items):

- Flight: Age 65 (~$900–1,100 one-way)
- Flight: Age 56 (~$900–1,100 one-way)
- Ground transport both ends
- Dog boarding: 8 nights × ~$70/night = ~$560
- Vet cert for boarding
- Boat watch: ~$250–300
- Travel insurance: ~$100
- Misc home expenses: ~$400

**Haul-out months** (M10, M21, M33 — add these line items):

- Travel lift fee (catamaran wide beam): $1,500–2,500
- Bottom paint (2 hulls, 2 coats): $2,000–3,500
- Zincs, shaft seals, pressure wash: $500–1,000
- Yard blocking / storage: $300–600
- Optional: osmosis check, through-hull inspection

**Dog quarantine months** (M20 NZ, M21 AU — add):

- NZ: Quarantine facility 10 days: $3,200 + permit + transport = ~$4,500 total
- AU: Quarantine facility 10 days: $3,500 + permit + transport = ~$4,600 total
- Note: Titer test blood draw (precursor) is in M16 Tonga, 6+ months before NZ

---

## UI / UX Architecture

### Navigation Structure

```
Header + Summary Tiles
    ↓
Year Tabs: [YEAR 1] [YEAR 2] [YEAR 3] [3-YEAR ROLLUP]
    ↓
Month Subtabs (within each year): [M01 Jun] [M02 Jul] ... [M12 May]
    ↓
Month Detail Panel:
  - Hero section (location, flag, total, badges)
  - Expandable category sections (click to open/close)
    - Line items with: name, note, low estimate, mid estimate, high estimate
  - Footer summary (low/mid/high totals for month)
```

### Month Tab Variants

Tabs should have visual distinction for special months:

- **Standard** — default styling
- **Home trip** — gold border accent
- **Haul-out** — orange border accent
- **Passage** — teal border accent

### Month Hero Card

Each month shows:

- Month number + calendar month (e.g. "M01 · JUNE YR1")
- Location name (large, serif font)
- Region subtitle (smaller, muted)
- Flag emoji
- Total (color coded: teal < $8,500 / gold $8,500–$11K / orange $11K–$13K / red > $13K)
- Low/high range
- Badges: `home` `haul` `passage` `dog quarantine`

### Expandable Category Sections

Each category has:

- Icon (emoji) in colored pill
- Category name
- Subtotal (right-aligned, colored per category)
- Chevron to expand/collapse
- When expanded: table of line items with columns:
  - Line item name
  - Note/explanation (smaller, muted)
  - Low estimate
  - Mid estimate (the "real" number)
  - High estimate

### Month Footer

After all categories, show:

- Monthly total: low / mid / high
- Per-day equivalent
- YTD running total (optional stretch goal)

---

## Visual Design System

### Color Palette (CSS Variables)

```css
--navy: #0d1b2a /* page background */ --deep: #0f1e2e /* card background */
  --card: #132234 /* nested card */ --mid: #1a3a5c /* highlighted card bg */
  --teal: #1b8a7e --teal-light: #22b5a5 /* primary accent */ --gold: #c9a84c
  --gold-light: #e8c97e /* secondary accent */ --sand: #f0e6cc
  /* heading text */ --text: #ddeaf5 /* body text */ --text-dim: #6e9ab5
  /* secondary text */ --text-muted: #3d6480 /* tertiary / labels */
  --warn: #e07b4a /* orange */ --red: #c94444 --green: #2eb87a --purple: #8b6fd4
  --pink: #d46fa0 --blue: #4a9fd4 --border: rgba(255, 255, 255, 0.055);
```

### Typography

- **Display / headings**: Playfair Display (serif, italic for emphasis)
- **Mono / numbers / labels**: DM Mono
- **Body / UI**: DM Sans

All three from Google Fonts.

### Background Texture

Subtle grid pattern on the body using CSS `background-image` with linear-gradient lines:

```css
background-image:
  linear-gradient(rgba(27, 138, 126, 0.035) 1px, transparent 1px),
  linear-gradient(90deg, rgba(27, 138, 126, 0.035) 1px, transparent 1px);
background-size: 48px 48px;
```

### Summary Tiles (top of page)

5-column grid showing:

1. 3-Year Total: $328,400
2. Per Year avg: $109,467
3. Per Month avg: $9,122
4. Health Insurance: $16,800/yr
5. Countries Visited: ~38

---

## Data Model

### Month Object Structure

```javascript
{
  id: 'm01',
  year: 1,
  num: 'M01',
  label: 'Jun',          // short month name for tab
  flag: '🇪🇸',
  location: 'Western Mediterranean',
  region: 'Spain · Balearics · Málaga',
  type: 'home',          // '' | 'home' | 'haul' | 'pass'
  total: 12800,          // mid estimate
  lo: 10400,             // low estimate
  hi: 16400,             // high estimate
  cats: [
    {
      name: 'Marina & Dockage',
      icon: '⚓',
      iconClass: 'ic-blue',      // CSS class for icon pill background
      colorClass: 'ct-blue',     // CSS class for subtotal text color
      subtotal: 2900,
      items: [
        {
          name: 'Marina berth — peak season Med',
          note: 'Costa Brava / Balearics, avg 28 nights',
          lo: 2400,
          mid: 2900,
          hi: 4200
        },
        // ...more items
      ]
    },
    // ...more categories
  ]
}
```

### Rollup Tab Data

The 4th tab shows:

1. Cash flow bar chart (all 36 months, color coded by spend level)
2. Category breakdown table (all categories × Year 1, 2, 3, Total)
3. Year-by-year summary stats table
4. Insurance carrier recommendations table
5. Planning notes grid (8 notes covering key warnings)

---

## Key Planning Notes to Include

These appear in the rollup tab as colored note cards:

1. **🏥 Age-65 Insurance Cliff** (red) — GeoBlue Xplorer for Medicare beneficiaries abroad; shop 6 months before departure
2. **🐕 NZ + AU Dog Quarantine** (orange) — $6,700 combined; start titer testing in Tonga M16
3. **💡 Year 3 Cheapest** (gold) — Sri Lanka, Philippines, India pull average down
4. **🏗️ Three Haul-Outs** — Ushuaia (best value), Cairns (pricey), Richards Bay (best)
5. **⚠️ Cape Horn Buffer** (orange) — $2,000 in M11, non-negotiable
6. **🔴 East Africa Routing** (red) — Never Gulf of Aden; hug East Africa south
7. **🐾 Dog Boarding Abroad** (pink) — Find via cruiser Facebook groups 2+ weeks ahead
8. **📋 $30K Emergency Reserve** — Keep entirely outside monthly budget

---

## Incomplete Work / What Needs to Be Built

The prototype HTML file was cut off. The following months need their full category/line-item data written:

- **M33** (East Africa / Haul-out #3) — partially written, cut off mid-haul-out section
- **M34** (Cape Town) — not written
- **M35** (St. Helena → Caribbean passage) — not written
- **M36** (Caribbean arrival / celebration) — not written

All other months (M01–M32) have full line-item data in the prototype file.

---

## Tech Stack Recommendation

The prototype is vanilla HTML/CSS/JS in a single file. For Claude Code, recommend:

- **Framework**: React (Vite scaffold)
- **Styling**: Tailwind CSS + custom CSS variables for the design system
- **State**: React useState for year/month tab selections, category open/close state
- **Data**: Separate `data/months.js` file containing the full month array
- **Components**:
  - `<SummaryTiles />`
  - `<InsuranceCallout />`
  - `<YearTabs />`
  - `<MonthSubtabs year={n} />`
  - `<MonthPanel month={data} />`
  - `<CategorySection cat={data} />`
  - `<LineItemsTable items={data} />`
  - `<MonthFooter lo hi mid />`
  - `<RollupTab />`
  - `<CashFlowChart months={allMonths} />`
- **Build**: Single-page app, deployable to Vercel/Netlify as static site

---

## Files in This Handoff

| File                                 | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| `circumnavigation-budget-handoff.md` | This document                                              |
| `liveaboard-budget.html`             | Prototype HTML file (M01–M32 complete, M33–M36 incomplete) |

---

## Priority Order for Claude Code

1. Scaffold the React/Vite project with the design system (CSS variables, fonts)
2. Extract the month data from the prototype HTML into `data/months.js`
3. Complete the missing months (M33–M36) using the established data structure
4. Build the component tree
5. Wire up year tabs → month subtabs → month panel navigation
6. Implement expandable category sections
7. Build the rollup tab with cash flow chart
8. Add the insurance callout banner
9. Polish: animations, responsive layout, print/export option

---

_Generated from a Claude.ai conversation. All budget figures are estimates based on 2024–2025 global cruising data. Individual results vary significantly by itinerary, pace, season, and lifestyle._
