# Pesach 2026 Price Comparison — ChatGPT Briefing

## Project Overview
A self-contained HTML page that compares Pesach 2026 specials across 5 kosher grocery stores: Bingo Wholesale, Gourmet Glatt, NPGS, Evergreen, and Aisle 9 Market. Data is scraped from store websites via browser console scripts, converted to JSON databases, then a Node.js build script generates a single index.html with all data embedded.

## Architecture
- **Browser scripts** (`browser-script.js`, `browser-script-aisle9.js`) scrape store websites
- **Convert scripts** (`convert-npgs.js`, `convert-evergreen.js`, `convert-aisle9.js`) turn CSVs into JSON
- **Store JSONs**: `gg-specials.json` (382), `npgs-specials.json` (310), `evergreen-specials.json` (789), `bingo-specials.json` (86), `aisle9-specials.json` (216)
- **`build-page.js`** reads all JSONs, normalizes, fuzzy-matches across stores, generates `index.html`
- **`index.html`** — self-contained 1.8MB page with all data embedded in JS

## Key Features
- Item consolidation: fuzzy-matches similar items across stores into comparison cards
- Per-unit pricing (cents/oz, $/each) auto-calculated from title size extraction
- Winner highlighting (cheapest per-unit in green)
- Size alerts when products differ >50% in size
- Search, store filters, category filters, collapsible sections
- Shopping cart with localStorage, quantities, gotten checkboxes, copy/print
- Mobile responsive, KYT banner, disclaimer

## Run Log

### Run: /build — 2026-03-22
**Task:** Rewrite build-page.js to add item consolidation across 5 stores with per-unit pricing and comparison view
**Outcome:** APPROVED WITH RECOMMENDATIONS
**Iterations:** 3 (Coder, Tester, Reviewer)
**Files created/modified:** build-page.js (rewritten), index.html (regenerated), chatgpt-briefing.md (created)
**Key decisions:** Fuzzy matching via normalized keys (strip brands/sizes/filler, sort words alphabetically) + substring merge for single-entry groups. Sort by normalized key so similar non-grouped items still appear adjacent.
**Issues encountered:** Initial sort used displayTitle instead of normalized key for ordering; fixed to use normalized key so similar products cluster together.
**Open items:** Reviewer noted saleEnd-as-min-date logic is slightly off (cosmetic). Substring merge could use minimum key length threshold to avoid over-merging short names.
