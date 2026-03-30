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
| `john-father` | John Jorczak | Chicopee MA patriarch — unresolved child: Edward J |
| `joseph-f-palmer` | Joseph F Jorczak | Bondsville / Palmer MA branch — Joseph F & Madeline; descendants include John Joseph (1915) and Sophie |
| `francis-1840` | Francis Jorczak | FamilySearch-backed ancestor of Symon, Joseph (1881), and Anthony (1885) |
| `stanley-a-jorczak` | Stanley A Jorczak | Connecticut record-backed parent branch — father of Stanley J & Vivienne line |
| `john-jurczak-parent` | John Jurczak | Chicago / Indiana cluster placeholder ancestor — parent of Jon Jorczak |
| `casimer-1874` | Casimer Jorczak | Chicago branch ancestor — parent of Walter Anthony Jorczak |

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
 - The `joseph-1911` branch now has FamilySearch record support for children beyond `nancy-1948`: the 1940 and 1950 U.S. censuses show Donald, Alan, Paul, and Nancy as children of Joseph S Jorczak and Phyllis, with the 1950 household in Hamilton, Mercer County, New Jersey showing Donald as Massachusetts-born and Paul as New Jersey-born; Alan David Jorczak's 1963 Virginia marriage certificate gives his full name, supports an estimated 1941 birth year, identifies spouse Cecelia Mathilda Lang, and names parents Joseph Stanley Jorczak and Phyllis Grotkowski; and a U.S. Public Records entry (`KG8Q-4DP`) supports Alan D. Jorczak's exact birth date of 22 Mar 1941. Family Tree profile `GL42-YL6` still does not currently list those children.
- The `louis-1916` Holyoke branch can now be attached to Symon's parents through Symon's brother Anthony: Family Tree profile `L1BQ-JR6` lists Louis Joseph Jorczak (`GJFM-XC5`) as a son of Anthony Jorczak and Kartarzyna / Kate Wadas (`GJFM-NNC`), matching the local Louis branch by name, year, spouse surname, and Holyoke death record.
- The `adam-j` / `harry-j` / `rudy-j` cluster is now linked by both FamilySearch records and Family Tree profiles to parents Jon Jorczak (`GHC2-9WB`) and Veronica Karmilowicz (`GHCK-CB9`). Adam's 1954 Indiana marriage record names parents John Jorczak and Voronica Karmilovitz, Harry's NUMIDENT record names John Jorczak and Veronica Karmolovich, and Rudolph's 1930 census entry places him in the same Chicago household with parents John and Veronica plus siblings Adam and Harry; the Family Tree couple currently carries children Adam (`GHC2-6Y8`), Harry (`GHC2-914`), and Rudolph (`GHC2-33G`) under the same parent pair.
- The `edwin-1922` branch is now split away from the unresolved Chicopee `john-father` line and attached under the same Chicago / Indiana couple as Adam, Harry, and Rudy: Jon Jorczak (`GHC2-9WB`) and Veronica Karmilowicz (`GHCK-CB9`). Edwin's Family Tree profile (`GHC2-WZ4`) gives birth 9 Sep 1922, spouse Eleanore Josephine Muldoon (`GDYP-C1S`), and parents Jon + Veronica. The local branch retains additional children beyond Catherine Anne Jorczak because that broader descendant set is still locally curated even though the current FamilySearch profile shows only Catherine.
- Direct Family Tree vitals pages now also support the core Chicago branch dates: Jon Jorczak (`GHC2-9WB`) shows birth 24 Jun 1877 in Poland and death 16 Jun 1950 in Chicago; Veronica Karmilowicz (`GHCK-CB9`) shows birth 1885 in Warsaw and death 1967; Adam (`GHC2-6Y8`) shows birth 24 May 1910 in Chicago and death 28 Oct 1989 in Proviso Township; Harry (`GHC2-914`) shows birth 24 Feb 1913 in Illinois and death 4 Dec 1990 in Cook County; Rudolph (`GHC2-33G`) shows birth 20 Sep 1919 in Illinois and death 12 Mar 1978; and Eleanore Josephine Muldoon (`GDYP-C1S`) shows birth 31 May 1920 in Ireland and death 16 Apr 1984.
- Jon and Veronica's Family Tree family page (`GHC2-9WB`) also supplies their marriage on 15 Feb 1904 in Chicago and expands the sibling set beyond the Chicago line previously carried locally: Johanna "Jean" Jorczak (`GSQQ-M3V`), Steven Jorczak (`GHC2-MPR`), Mildred Jorczak (`GHC2-CS3`), and Evelyn Jorczak (`GHC2-DYQ`) appear alongside Adam, Harry, Rudolph, and Edwin. Rudolph's own family page (`GHC2-33G`) shows spouse Gene Didzerakis (`GH2F-YM9`), marriage 9 Aug 1941 in Cook County, and son Edwin Robert Jorczak (`PCGN-1GQ`).
- `stanley-1930` is now attached under `stanislaw-1895` + `stella-1907` instead of the unresolved Chicopee `john-father` branch. The support is indirect but convergent: Stanley Francis Jorczak Jr.'s 2024 obituary names a brother David and David's wife Betty of Florence, Massachusetts; Google-result snippets and directory-style listings place that same Florence David / Elizabeth "Betty" Jorczak household at 67 Hillcrest and connect them to son Kevin; separate Chicopee newspaper snippets place a David Jorczak family at `107 Northwood`; and Stella E. (Pacosa) Jorczak's obituary snippet also identifies her as living at `107 Northwood` with spouse Stanley Francis Jorczak Sr. That address chain makes Stanley Jr. fit the Stanley / Stella household better than the still-unresolved `john-father` + `mary-mroz` branch.
- The `david-florence` / `elizabeth-florence` / `kevin-david-j` line is retained as locally curated data inferred from the same Stanley Jr. evidence chain. Stanley Jr.'s obituary explicitly gives brother David and wife Betty in Florence, Massachusetts; the Florence directory-style snippets place David and Elizabeth Jorczak together at 67 Hillcrest; and the Kevin engagement snippet identifies Kevin Jorczak as the son of David and Elizabeth Jorczak of Florence. A matching FamilySearch tree profile for that Florence household has not yet been identified.
- The `eugene-j` branch is now split away from the unresolved Chicopee `john-father` line and attached under Walter Anthony Jorczak (`GLN3-6NC`) and Eleanor Cross (`GLN3-98D`). FamilySearch tree search for Rick Eugene Jorczak (`GB3M-YBK`) names parents Eugene Edward Jorczak (`GLN3-XS6`) and Imagene L. Gillette (`GB39-7VC`), matching the local spouse and children cluster; the Eugene tree profile gives birth 29 May 1930 in Chicago and parents Walter Anthony Jorczak and Eleanor Cross. Imagene's Family Tree profile uses `Gillette` as the primary surname and includes `Imagene L Peterson` as an alternate married name, which is why the local record now uses Gillette as the maiden name.
- The `walter-anthony-1909` branch now extends one generation higher in Family Tree: Walter Anthony Jorczak (`GLN3-6NC`) appears on the family page as a child of Casimer Jorczak (`GVT9-Q4S`) and Caroline Zielinski (`GVT9-ZTH`). Casimer's profile has strong vitals support, including exact birth and death dates, while Caroline currently has lighter but still usable vitals support.
- The `edward-1919` West Palm Beach branch is no longer treated as a disconnected root. A 1930 Chicago census record (`XSLW-NBZ`) places Edward Jorczak, age 11 and Illinois-born, in the household of Kazimir / Casimer Jorczak and Caroline Jorczak with siblings Joseph, Irene, and Genevieve. That sibling set matches the existing Casimer + Caroline branch closely enough to attach Edward Joseph Jorczak locally under that couple, even though the current Family Tree family page for `GVT9-Q4S` does not yet list Edward as a child.
- The Bondsville / Palmer branch remains rooted at Joseph F Jorczak (`KLZD-Q7M`). Family Tree currently attaches him to John Jorczak (`KLZD-Q7S`) and Julia (`KLZD-Q7Q`), but both parent profiles are empty stubs with zero sources, no vitals, and no marriage data. That attachment is too weak to treat as a supported local root, so John + Julia are not carried as established ancestors in the local tree.
- `john-1915` is now split away from the unresolved Chicopee `john-father` line and attached under a new Bondsville / Palmer branch headed by Joseph F Jorczak (`KLZD-Q7M`) and Madeline Tarnowiecka (`GTZQ-85P`). Family Tree profile `GYWP-Z22` identifies him as John Joseph Jorczak, born 1 Jan 1915 in Bondsville, with parents Joseph F and Madeline, and his 1976 GenealogyBank obituary names residence Bondsville.
- `sophie-kusek` is provisionally moved with `john-1915` under Joseph F Jorczak (`KLZD-Q7M`) and Madeline Tarnowiecka (`GTZQ-85P`). The current support is sibling-based rather than a direct spouse/obituary proof: Family Tree profile `GYWP-MBV` shows a Sophie Jorczak, born 1917, in the same Bondsville / Palmer sibling set as John Joseph, and Chicopee Sophie Kusek records also point to a 1917 Massachusetts-born woman. Her later Kusek identity remains plausible but not fully closed, so this attachment should be treated as provisional.
- The `john-j-chicago` branch can now be extended one generation higher in Family Tree, but only provisionally: Jon Jorczak (`GHC2-9WB`) appears on the family page as a child of John Jurczak (`GHXW-47V`) and Rose Wengrerski (`GHXW-47J`). Those parent profiles are still sparse one-source stubs with no vitals, so the local tree carries them as placeholder parents rather than as well-supported ancestors.
- The remaining disconnected roots do not yet have enough evidence to tie them to Francis / Mary Kutron. In particular, the Chicopee `john-father` branch still overlaps geographically with the Symon family but does not yet have a verified FamilySearch profile or record set strong enough to attach it above or beside Symon.
- The `stanley-j-2000` / `vivienne-1934` Connecticut branch now has FamilySearch record support but not a matching Family Tree profile. Stanley is supported by Connecticut death index record `VZPG-G8Y`, which links a spouse stub `V647-ZVP` (`VIVIA`). Vivienne is directly supported by obituary record `61XK-KKDZ`, which names Stanley and children Glen, Keith, and Jodi Gromek; that record appears to misindex her birthplace as `Norwich, Hampden, Massachusetts, United States` even though the local data and earlier census records point to Norwich, Connecticut.
- The `stanley-j-2000` Connecticut branch also now has record-backed parents from Stanley's NUMIDENT entry (`6KML-W5PQ`), which gives exact birth date 28 Mar 1928 in Versailles, Connecticut and names parents Stanley A. Jorczak and Stella Tetreault. Because that evidence comes from the record set rather than a matching Family Tree parent couple, the local tree uses record-backed parent stubs for this branch.

---

## Aesthetic

- Deep forest green `#1a3a2a`, aged parchment `#f4ede0`, crimson `#8b1a1a`, antique gold `#c9a84c`, dark ink `#1c1409`
- Fonts: Playfair Display (headings/names), EB Garamond (body/details)
- All JS/CSS inline in `index.html`; tree data in `family-tree.json` loaded via `fetch()`
