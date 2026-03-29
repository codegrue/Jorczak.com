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
  "familySearchUrl": "https://...",    // optional — source metadata only; not rendered on the card
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
| `francis-1840` | Francis Jorczak | FamilySearch-backed ancestor of Symon, Joseph (1881), and Anthony (1885) |
| `edward-1919` | Edward Joseph Jorczak | West Palm Beach FL — Edward & Marie → Edward Jr, Michael |
| `stanley-j-2000` | Stanley J Jorczak | Connecticut — Stanley J & Vivienne → Glen, Jodi, Keith |
| `john-j-chicago` | John Jorczak | Chicago / Indiana cluster — father of Adam (San Pierre IN), Harry (Chicago IL), and Rudy/Rudolph (Chicago IL) |

---

## Tree Rendering Notes

- Cards show: nickname (italic, left of name), birth–death, *née* maiden name,
  birthplace (primary card only), location (primary card only), bio (truncated 2 lines),
  biography link.
- Spouse cards are muted (dashed border, italic name), show only birth–death and née.
- Deceased people get class `is-deceased` (slight dimming).
- `unknown-*` IDs get `is-unknown` styling (italic, low opacity name).
- The toolbar has search (highlights + expands path to match) and Expand/Collapse All.

## Provenance Notes

- `karl-j` matches the FamilySearch record for Karl Alfred Jorczak (`L1BQ-NQ9`) as a son of Jan Szymon Jorczak and Genoefa Baranowska.
- `symon-1866` is now traced one generation higher in FamilySearch: Symon, Joseph (`GLHM-C5D`), and Anthony (`L1BQ-JR6`) appear as children of Francis / Frank Jorczak (`L1BQ-75X`) and Mary Kutron (`L1BQ-9N2`).
- The `karl-j` descendant line through `sophie-sokol`, `paul-1945`, and `john-j-lv` is retained as locally curated data and is not currently confirmed by that FamilySearch record.
- The `francis-1904` local branch is retained as curated data: FamilySearch record `GLHD-F3S` currently shows only one child (`Robert F Jorczak`, 1942–2006), while the local tree has `raymond-1944` and `robert-1950` with further descendants.
- The `joseph-1911` branch now has FamilySearch record support for children beyond `nancy-1948`: the 1940 and 1950 U.S. censuses show Donald, Alan, Paul, and Nancy as children of Joseph S Jorczak and Phyllis, and Alan David Jorczak's 1963 Virginia marriage certificate names parents Joseph Stanley Jorczak and Phyllis Grotkowski. Family Tree profile `GL42-YL6` still does not currently list those children.
- The `louis-1916` Holyoke branch can now be attached to Symon's parents through Symon's brother Anthony: Family Tree profile `L1BQ-JR6` lists Louis Joseph Jorczak (`GJFM-XC5`) as a son of Anthony Jorczak and Kartarzyna / Kate Wadas (`GJFM-NNC`), matching the local Louis branch by name, year, spouse surname, and Holyoke death record.
- The `adam-j` / `harry-j` / `rudy-j` cluster is now linked by both FamilySearch records and Family Tree profiles to parents Jon Jorczak (`GHC2-9WB`) and Veronica Karmilowicz (`GHCK-CB9`). Adam's 1954 Indiana marriage record names parents John Jorczak and Voronica Karmilovitz, Harry's NUMIDENT record names John Jorczak and Veronica Karmolovich, and Rudolph's 1930 census entry places him in the same Chicago household with parents John and Veronica plus siblings Adam and Harry; the Family Tree couple currently carries children Adam (`GHC2-6Y8`), Harry (`GHC2-914`), and Rudolph (`GHC2-33G`) under the same parent pair.
- The remaining disconnected roots do not yet have enough evidence to tie them to Francis / Mary Kutron. In particular, the Chicopee `john-father` branch still overlaps geographically with the Symon family but does not yet have a verified FamilySearch profile or record set strong enough to attach it above or beside Symon.
- The `stanley-j-2000` / `vivienne-1934` Connecticut branch now has FamilySearch record support but not a matching Family Tree profile. Stanley is supported by Connecticut death index record `VZPG-G8Y`, which links a spouse stub `V647-ZVP` (`VIVIA`). Vivienne is directly supported by obituary record `61XK-KKDZ`, which names Stanley and children Glen, Keith, and Jodi Gromek; that record appears to misindex her birthplace as `Norwich, Hampden, Massachusetts, United States` even though the local data and earlier census records point to Norwich, Connecticut.

---

## Aesthetic

- Deep forest green `#1a3a2a`, aged parchment `#f4ede0`, crimson `#8b1a1a`, antique gold `#c9a84c`, dark ink `#1c1409`
- Fonts: Playfair Display (headings/names), EB Garamond (body/details)
- All JS/CSS inline in `index.html`; tree data in `family-tree.json` loaded via `fetch()`
