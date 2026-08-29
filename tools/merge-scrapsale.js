#!/usr/bin/env node
/* ================================================================
   merge-scrapsale.js
   Embeds "ScrapSale Pro version 6 - Copy.html" (workbook data + live
   formula engine + pivot + export/import + undo/redo) into
   "BidAnalyticsPro-2.html" as a new nav tab placed beside Dashboard.

   Why an isolated <iframe srcdoc> instead of a flat HTML/CSS merge:
     * both files declare the same CSS custom properties with
       incompatible values (--bg, --muted, --green, --amber) and the
       same element selectors (body, table, thead th, .btn, .panel,
       nav, main, aside, select, input) — a flat merge restyles both
       apps;
     * ScrapSale Pro resolves 109 document.getElementById() lookups
       and declares its own globals ("use strict" + var), which would
       collide with BidAnalytics Pro's globals (RAW, WORK, fmt, el,
       makeTable, builders...).
   The frame inherits the parent origin, so ScrapSale's autosave
   (localStorage) and invoice cache (IndexedDB) keep working, and the
   whole document still travels inside the single merged HTML file.

   Re-run after editing either source file:
       node tools/merge-scrapsale.js
   Idempotent: generated blocks are replaced in place.
   ================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST = path.join(ROOT, 'BidAnalyticsPro-2.html');
const SRC = path.join(ROOT, 'ScrapSale Pro version 6 - Copy.html');

const host = fs.readFileSync(HOST, 'utf8');
const src = fs.readFileSync(SRC, 'utf8');

/* ---------------- escape the embedded document ----------------
   It lives inside a JS template literal, so escape only what a
   template literal treats specially, plus the "</script" sequence
   that would otherwise close the host <script> element early. In a JS
   string "<\/script>" *is* "</script>", so nothing needs un-escaping
   at runtime. */
function escapeForTemplateLiteral(s) {
  return s
    .replace(/\\/g, () => '\\\\')      /* backslashes first */
    .replace(/`/g, () => '\\`')        /* template delimiter */
    .replace(/\$\{/g, () => '\\${')    /* interpolation */
    .replace(/<\/script/gi, () => '<\\/script');
}
const embedded = escapeForTemplateLiteral(src);

/* every backtick in the escaped blob must be escaped */
const badTick = /(^|[^\\])`/.exec(embedded);
if (badTick) throw new Error('unescaped backtick in embedded document');
if (/<\/script/i.test(embedded)) throw new Error('unescaped </script in embedded document');

/* ---------------- generated fragments ---------------- */
const M = {
  css: ['/* SCRAPSALE-CSS-START */', '/* SCRAPSALE-CSS-END */'],
  doc: ['<!-- SCRAPSALE-DOC-BLOCK-START', '<!-- SCRAPSALE-DOC-BLOCK-END -->\n'],
  builder: ['// SCRAPSALE-BUILDER-START', '// SCRAPSALE-BUILDER-END\n'],
};

const CSS = `
/* ── SCRAPSALE PRO TAB (embedded workspace) ── */
.ss-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;
  background:rgba(124,58,237,.07);border:1px solid rgba(124,58,237,.2);border-radius:11px}
.ss-title{font-size:12px;font-weight:700;color:#c4b5fd;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ss-title small{font-weight:500;color:var(--dim);font-size:10px;letter-spacing:.2px}
.ss-actions{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
.ss-frame-wrap{position:relative;border-radius:14px;overflow:hidden;background:#f4f6fb;
  border:1px solid rgba(255,255,255,.09);box-shadow:0 18px 50px rgba(0,0,0,.45)}
.ss-frame-wrap:fullscreen{border:0;border-radius:0}
#ssFrame{display:block;width:100%;border:0;background:#f4f6fb;height:calc(100vh - 250px);min-height:640px}
.ss-frame-wrap:fullscreen #ssFrame{height:100vh;min-height:0}
.ss-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:9px;
  background:#f4f6fb;color:#475569;font-size:12px;font-weight:600}
.ss-spin{width:15px;height:15px;border-radius:50%;border:2px solid #c7d2fe;border-top-color:#2563eb;
  animation:ssspin .8s linear infinite}
@keyframes ssspin{to{transform:rotate(360deg)}}
@media(max-width:900px){#ssFrame{height:calc(100vh - 180px);min-height:560px}}
`;

const NAV_BTN = '  <button class="nav-tab" data-tab="scrapsale">◆ ScrapSale Pro</button>';
const SECTION = '<div id="scrapsale" class="section"></div>';

const DOC_BLOCK = `<!-- SCRAPSALE-DOC-BLOCK-START
     EMBEDDED APP — ScrapSale Pro (Cash Receivables Suite)
     Complete document of "ScrapSale Pro version 6 - Copy.html":
     workbook (37 lots, auctions 21977-21980), live formula engine,
     Pivot Analytics, Excel/PDF/CSV/JSON export, import, undo/redo.
     Mounted into the "ScrapSale Pro" tab by builders.scrapsale.
     Regenerate with: node tools/merge-scrapsale.js
     SCRAPSALE-DOC-BLOCK-START -->
<script id="scrapsale-doc">
/* SCRAPSALE-DOC-START (generated — do not hand edit) */
const SCRAPSALE_DOC = \`__EMBEDDED__\`;
/* SCRAPSALE-DOC-END */
</script>
<!-- SCRAPSALE-DOC-BLOCK-END -->
`;

const BUILDER = `
// ═══════════════════════════════════════════════════════
// SCRAPSALE PRO — embedded Cash Receivables workspace
// The complete ScrapSale Pro app (data, live formulas, pivot,
// export/import, undo/redo) runs inside an isolated frame so its CSS
// variables and 100+ element ids never collide with this page.
// ═══════════════════════════════════════════════════════
builders.scrapsale=function(){
  const sec=document.getElementById('scrapsale');
  sec.innerHTML='';

  const bar=el('div','ss-bar');
  bar.innerHTML=\`<div class="ss-title">◆ ScrapSale Pro — Cash Receivables
      <small>Live formula engine · Pivot Analytics · Excel / PDF / CSV / JSON export · import · undo–redo</small></div>
    <div class="ss-actions">
      <button class="btn btn-ghost btn-sm" id="ss-full" title="Toggle fullscreen">⛶ Fullscreen</button>
      <button class="btn btn-ghost btn-sm" id="ss-pop" title="Open in its own browser tab">↗ New tab</button>
      <button class="btn btn-ghost btn-sm" id="ss-reload" title="Reload the workspace">⟳ Reload</button>
    </div>\`;
  sec.appendChild(bar);

  const wrap=el('div','ss-frame-wrap');
  const frame=document.createElement('iframe');
  frame.id='ssFrame';
  frame.title='ScrapSale Pro';
  frame.srcdoc=SCRAPSALE_DOC;
  const load=el('div','ss-loading','<span class="ss-spin"></span><span>Starting ScrapSale Pro…</span>');
  wrap.appendChild(frame);
  wrap.appendChild(load);
  sec.appendChild(wrap);

  frame.addEventListener('load',()=>{load.style.display='none';});
  bar.querySelector('#ss-full').addEventListener('click',()=>{
    if(document.fullscreenElement)document.exitFullscreen();
    else if(wrap.requestFullscreen)wrap.requestFullscreen();
  });
  bar.querySelector('#ss-pop').addEventListener('click',()=>{
    const w=window.open('','_blank');
    if(!w){showToast('Allow pop-ups to open ScrapSale Pro in its own tab');return;}
    w.document.open();w.document.write(SCRAPSALE_DOC);w.document.close();
  });
  bar.querySelector('#ss-reload').addEventListener('click',()=>{
    load.style.display='flex';
    frame.srcdoc=SCRAPSALE_DOC;
  });
};
`;

/* ---------------- insertion helpers ---------------- */
function replaceOnce(text, anchor, inject, label) {
  const first = text.indexOf(anchor);
  if (first === -1) throw new Error(`anchor not found (${label}): ${JSON.stringify(anchor.slice(0, 70))}`);
  if (text.indexOf(anchor, first + 1) !== -1) throw new Error(`anchor not unique (${label})`);
  return text.slice(0, first) + inject + text.slice(first + anchor.length);
}
function stripBlock(text, [startMark, endMark], label) {
  const a = text.indexOf(startMark);
  if (a === -1) return text;
  const b = text.indexOf(endMark, a);
  if (b === -1) throw new Error(`unterminated generated block (${label})`);
  return text.slice(0, a) + text.slice(b + endMark.length);
}
function stripLine(text, needle) {
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.includes(needle));
  if (i === -1) return text;
  if (lines.findIndex((l, j) => j !== i && l.includes(needle)) !== -1) throw new Error('not unique: ' + needle);
  lines.splice(i, 1);
  return lines.join('\n');
}

let out = host;

/* 1. drop any previous generation so re-runs stay idempotent */
out = stripBlock(out, M.css, 'css');
out = stripBlock(out, M.doc, 'doc');
out = stripBlock(out, M.builder, 'builder');
out = stripLine(out, 'data-tab="scrapsale"');
out = out.replace(SECTION + '\n', '');

/* 2. CSS just before the closing </style> */
out = replaceOnce(out, '</style>', M.css[0] + CSS + M.css[1] + '</style>', 'style close');

/* 3. nav button immediately after the Dashboard tab */
const DASH_BTN = '  <button class="nav-tab active" data-tab="dashboard">◈ Dashboard</button>\n';
out = replaceOnce(out, DASH_BTN, DASH_BTN + NAV_BTN + '\n', 'nav');

/* 4. section container immediately after the dashboard section */
const DASH_SEC = '<div id="dashboard" class="section active"></div>\n';
out = replaceOnce(out, DASH_SEC, DASH_SEC + SECTION + '\n', 'section');

/* 5. embedded document before the app script, builder before INIT */
out = replaceOnce(
  out,
  '<div id="toast"></div>\n\n<script>\n',
  '<div id="toast"></div>\n\n' + DOC_BLOCK.replace('__EMBEDDED__', () => embedded) + '<script>\n',
  'doc script'
);
const INIT_MARK = '// ═══════════════════════════════════════════════════════\n// INIT\n';
out = replaceOnce(out, INIT_MARK, M.builder[0] + '\n' + BUILDER + '\n' + M.builder[1] + INIT_MARK, 'builder');

/* ---------------- sanity checks ---------------- */
const blob = (out.split('const SCRAPSALE_DOC = `')[1] || '').split('`;\n/* SCRAPSALE-DOC-END */')[0];
const checks = [
  ['nav tab added', out.includes('data-tab="scrapsale"')],
  ['section container added', out.includes(SECTION)],
  ['document constant added', out.includes('const SCRAPSALE_DOC = `')],
  ['builder added', out.includes('builders.scrapsale=function(){')],
  ['blob has no raw </script', !/<\/script/i.test(blob)],
  ['blob carries workbook data', blob.includes('"lot_no":1763') && blob.includes('"lot_no":2091')],
  ['blob carries formula engine', blob.includes('function recalcRow(r, changed)')],
  ['blob carries xlsx writer', blob.includes('function zipStore(files)')],
  ['blob carries pivot grouping', blob.includes("value=\"lot_name\"")],
  ['blob byte-faithful after unescape', unescapeTemplateLiteral(blob) === src],
  ['host app untouched', out.includes('builders.variants=function(){') && out.includes('const RAW = [')],
];
function unescapeTemplateLiteral(s) {
  return s
    .replace(/<\\\/script/gi, () => '</script')
    .replace(/\\\$/g, () => '$')
    .replace(/\\`/g, () => '`')
    .replace(/\\\\/g, () => '\\');
}
checks.forEach(([name, ok]) => { if (!ok) throw new Error('check failed: ' + name); });

fs.writeFileSync(HOST, out, 'utf8');

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log('host in   :', kb(host.length));
console.log('embedded  :', kb(src.length), '->', kb(embedded.length), 'escaped');
console.log('written   :', kb(out.length), '->', path.basename(HOST));
console.log('checks    :', checks.map(c => c[0]).length, 'passed');
