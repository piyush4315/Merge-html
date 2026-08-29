# Merge-html

Single-file MSTC auction analytics.

## Files

| file | what it is |
| --- | --- |
| **`BidAnalyticsPro-Standalone.html`** | **The one to open on a phone.** 722 KB, zero network dependencies — Chart.js v4.4.1 and the fonts are inlined, plus touch/small-screen CSS. Works from a file manager, an email attachment or a USB stick, online or offline. |
| `BidAnalyticsPro-2.html` | Same app, but Chart.js and Google Fonts load from CDNs (needs internet for the charts). |
| `ScrapSale Pro version 6 - Copy.html` | Original ScrapSale Pro source, unchanged. |

Both app files show the same tabs:

```
◈ Dashboard │ ◆ ScrapSale Pro │ ⊞ Raw Data │ ₹ Payments │ ⊛ Pivot Analytics │ ◉ Charts │ ⊕ Variants
```

## The ScrapSale Pro tab

Carries the whole of `ScrapSale Pro version 6 - Copy.html`:

* the 37-lot workbook for auctions 21977–21980;
* the live formula engine — `Total Receivables = Material Value + GST + TCS − Net Service
  Charge − TDS 194O − GST TDS`, `SD Expected = 25% × Material Value`,
  `FP Expected = Total − SD Expected`, `Total Received = SD + FP Received`,
  `Outstanding = Total − Received`, `GST TDS = Material Value × rate%` — recalculating on
  every cell edit, in the grid and in the row editor;
* Pivot Analytics (group by Buyer / Auction / Material / Unit) with drill-down,
  column pickers, freeze panes and Excel-style range copy;
* Excel export with **live formulas**, the `CashReceivables` table, a SUMIF-driven
  *Pivot Analytics* sheet and a *Power BI* sheet, plus PDF / CSV / JSON / HTML export;
* XLSX · CSV · JSON · HTML · TXT import (replace or merge by Lot No), invoice PDF cache,
  undo/redo (Ctrl+Z / Ctrl+Y) and autosave.

The workspace runs in an isolated `<iframe srcdoc>` whose document is embedded in the file,
so the merge stays one self-contained page while both apps keep their own CSS variables
(`--bg`, `--muted`, `--green`, `--amber` are declared by both, with different values) and
their own element ids. The frame inherits the page origin, so ScrapSale's autosave
(localStorage) and invoice cache (IndexedDB) keep working; if storage is blocked (e.g.
`file://` in some mobile browsers) it falls back to in-memory and says so.

## Getting it onto a phone

* **Android** — copy the file to the phone (Drive/USB/email) and open it with Chrome.
* **iPhone/iPad** — save it to Files, then open with a browser-style app (Safari's Files
  preview also renders it). Some browsers block storage on local files; the app then runs
  in-memory and warns you, so export a backup when you are done.
* Optional: add it to the home screen for a full-screen app-like launch.

The only network calls the app can make are the ones you trigger yourself: the optional
Google Drive upload (needs a Client ID) and invoice links you paste in.

## Scripts

| script | purpose |
| --- | --- |
| `node tools/merge-scrapsale.js` | rebuild the ScrapSale tab inside `BidAnalyticsPro-2.html` (idempotent) |
| `node tools/build-standalone.js` | rebuild `BidAnalyticsPro-Standalone.html` from it (inlines Chart.js + fonts, adds mobile CSS) |
| `node tools/verify-merged.js` | 98 checks across both files: original tabs vs. a pristine baseline, embedded-document fidelity, formulas, pivot, undo, `.xlsx` writer, storage fallback, inlined assets, mobile CSS |
| `node tools/preview-server.js` | serve the standalone build on `:8080` |

Build dependencies for `build-standalone.js` (only at build time — the output needs none):

```bash
npm install --prefix /tmp chart.js@4.4.1 @fontsource/inter @fontsource/jetbrains-mono
```

The verifier needs `jsdom` and `css-tree` in `/tmp/node_modules`.
