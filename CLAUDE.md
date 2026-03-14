# Jorczak.com — Project Notes for Claude

## Project Overview
Single-file static site (`index.html`) for Jorczak.com — a heritage/surname placeholder covering the
Polish-Rusyn surname's origin, meaning, geographic distribution, family crest, and an interactive
family tree navigator. Everything is inline (HTML + `<style>` + `<script>`). No build tools.
External dependency: Google Fonts CDN only.

---

## Family Tree Data — `family-tree.json`

### Structure
Three top-level arrays:

```json
{
  "people":   [ /* Person objects */ ],
  "marriages": [ /* Marriage objects */ ],
  "parentage": [ /* Parentage objects */ ]
}
```

### Person object
```json
{
  "id":         "name-YYYY",           // required — see ID convention below
  "name":       "Full Name",           // required
  "nickname":   "Nick",                // optional — displayed left of name in italics
  "maidenName": "PriorSurname",        // optional — displayed as "née PriorSurname"
  "birth":      "Jan 1, 1920",         // optional — month/day/year preferred; year-only OK
  "death":      "Dec 31, 2001",        // optional — omit if still living
  "birthplace": "City, Country",       // optional — birthplace (separate from current location)
  "location":   "City, State",         // optional — last known / burial location
  "bio":        "Short description",   // optional — shown truncated to 2 lines; use &amp; for &
  "link":       "https://...",         // optional — opens as "↗ biography" link on the card
  "gender":     "m",                   // required — "m" or "f"
  "root":       true                   // optional — mark explicit root of a family branch (see below)
}
```

### Marriage object
```json
{
  "id":      "m-descriptive-slug",
  "spouseA": "person-id",
  "spouseB": "person-id",
  "status":  "married"                 // "married" or "divorced"
}
```

### Parentage object
```json
{ "child": "person-id", "parents": ["parent-id-1", "parent-id-2"] }
```
A child with only one known parent lists just one ID. Parentage is directional child→parents.

---

## ID Naming Convention

**Preferred format: `name-YYYY`** where YYYY is the person's birth year.

- `stanley-1930`, `francis-1904`, `jean-1939`
- If birth year is unknown, use a descriptive slug: `john-father`, `karl-j`, `betty-r`
- Spouses who are not Jorczak blood still get their own ID (they appear as in-law cards)
- Unknown/placeholder ancestors: `unknown-father-adam`, `unknown-father-don`

When renaming IDs, use `replace_all: true` in Edit — IDs appear in `people[].id`,
`marriages[].spouseA/B`, and `parentage[].child/parents[]`.

---

## Family Branch Roots & the `root` Flag

The tree renderer (`findRoots()`) uses a **two-pass algorithm**:

1. **First pass** — any person with `"root": true` becomes the representative of their entire
   connected component (all people reachable by following spouse/child/parent links).
2. **Second pass** — for any remaining unassigned components, an auto-heuristic picks the
   representative: most direct children first; birth year (ascending) as tiebreaker.

**Always add `"root": true` to every branch root.** All roots are explicit — there is no auto-detection fallback relied upon.

### All branch roots (`"root": true`)

| ID | Name | Branch |
|----|------|--------|
| `john-father` | John Jorczak | Chicopee MA patriarch — six children: Edward J, John (1915), Edwin (1922), Stanley (1930), Sophie Kusek, Eugene |
| `francis-1904` | Francis Joseph Jorczak | Chicopee MA — Francis & Casimiera → Raymond, Robert |
| `joseph-1911` | Joseph Stanley Jorczak | Trenton NJ — Joseph & Phyllis → Nancy |
| `karl-j` | Karl Jorczak | Springfield MA — Karl & Sophie → Paul (1945), John LV |
| `edward-1919` | Edward Joseph Jorczak | West Palm Beach FL — Edward & Marie → Edward Jr, Michael |
| `louis-1916` | Louis J Jorczak | Holyoke MA — Louis & Mary Laptas → Eloise, Linda |
| `stanley-j-2000` | Stanley J Jorczak | Connecticut — Stanley J & Vivienne → Glen, Jodi, Keith |
| `unknown-father-don` | Donald's Unknown Father | Indiana cluster — Donald (1939, TX), Alan, Paul, Nancy; donald-1939 → Bruce, Ann, Jay |
| `unknown-father-adam` | Unknown Father | Illinois/Indiana cluster — Adam (San Pierre IN), Harry, Rudy (both Chicago IL) |
| `phyllis-1913` | Phyllis G Jorczak | Isolated individual — no known connections in the data |

---

## Tree Rendering Notes

- Cards show: nickname (italic, left of name), birth–death, *née* maiden name,
  birthplace (primary card only), location (primary card only), bio (truncated 2 lines),
  biography link.
- Spouse cards are muted (dashed border, italic name), show only birth–death and née.
- Deceased people get class `is-deceased` (slight dimming).
- `unknown-*` IDs get `is-unknown` styling (italic, low opacity name).
- The toolbar has search (highlights + expands path to match) and Expand/Collapse All.

---

## Aesthetic

- Deep forest green `#1a3a2a`, aged parchment `#f4ede0`, crimson `#8b1a1a`, antique gold `#c9a84c`, dark ink `#1c1409`
- Fonts: Playfair Display (headings/names), EB Garamond (body/details)
- All JS/CSS inline in `index.html`; tree data in `family-tree.json` loaded via `fetch()`
