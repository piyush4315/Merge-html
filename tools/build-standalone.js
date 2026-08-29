#!/usr/bin/env node
/* ================================================================
   build-standalone.js
   Turns the merged BidAnalyticsPro-2.html into ONE file that opens
   from a phone's file manager / browser with no network at all:

     * Chart.js v4.4.1 (the exact version the CDN link pointed at) is
       inlined, so the Dashboard and Charts tabs still draw offline;
     * the Google Fonts stylesheet is replaced by base64 @font-face
       rules for Inter 400/600/700/800 + JetBrains Mono 400/600;
     * touch/small-screen CSS is added for the host page AND injected
       into the embedded ScrapSale Pro frame on load (its modals use
       3- and 4-column grids that do not fit a phone).

   Build inputs (not needed at runtime — the output is self-contained):
       npm install --prefix /tmp chart.js@4.4.1 @fontsource/inter @fontsource/jetbrains-mono
   Usage:
       node tools/build-standalone.js
   ================================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'BidAnalyticsPro-2.html');
const OUT = path.join(ROOT, 'BidAnalyticsPro-Standalone.html');

/* resolve a build dependency from ./node_modules or /tmp/node_modules */
function dep(rel) {
  for (const base of [path.join(ROOT, 'node_modules'), '/tmp/node_modules']) {
    const p = path.join(base, rel);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`build dependency missing: ${rel}\n  npm install --prefix /tmp chart.js@4.4.1 @fontsource/inter @fontsource/jetbrains-mono`);
}

let html = fs.readFileSync(SRC, 'utf8');

/* ---------------- 1. Chart.js ---------------- */
const CHART_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>';
const chartPath = dep('chart.js/dist/chart.umd.js');
let chart = fs.readFileSync(chartPath, 'utf8');
chart = chart.replace(/\/\/# sourceMappingURL=.*\n?/, ''); /* avoid a dead .map request */
if (!/Chart\.js v4\.4\.1/.test(chart)) throw new Error('unexpected Chart.js build: ' + chartPath);
if (/<\/script/i.test(chart)) throw new Error('Chart.js bundle contains </script — cannot inline safely');

/* ---------------- 2. fonts ---------------- */
const FONT_TAG = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"/>';
const FAMILIES = [
  ['Inter', '@fontsource/inter/files/inter-latin-%WEIGHT%-normal.woff2', [400, 600, 700, 800]],
  ['JetBrains Mono', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-%WEIGHT%-normal.woff2', [400, 600]],
];
let fontCss = '<style id="inline-fonts">\n/* Inlined so the file works with no network. */\n';
let fontBytes = 0;
for (const [family, pattern, weights] of FAMILIES) {
  for (const w of weights) {
    const file = dep(pattern.replace('%WEIGHT%', w));
    const b64 = fs.readFileSync(file).toString('base64');
    fontBytes += fs.statSync(file).size;
    fontCss += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;` +
      `src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
  }
}
fontCss += '</style>';

/* ---------------- 3. host touch / small-screen CSS ---------------- */
const HOST_CSS = `
/* ── MOBILE / TOUCH (standalone build) ── */
html{-webkit-text-size-adjust:100%}
@media(max-width:820px){
  .hero{padding:30px 16px 16px}
  .hero-sub{font-size:12.5px;margin-bottom:16px}
  .badges{gap:6px}
  .kpi-grid{padding:14px;gap:10px}
  .kpi{padding:15px 13px}
  .section{padding:14px}
  /* one swipeable tab strip instead of a 4-row block of tabs */
  .nav{padding:0 8px;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;
    -webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none}
  .nav::-webkit-scrollbar{display:none}
  .nav-tab{flex:0 0 auto;padding:11px 13px;font-size:11.5px}
  .tbl-wrap{-webkit-overflow-scrolling:touch;max-height:none}
  .chart-grid,.dash-grid,.pivot-layout,.var-layout{gap:12px}
  .ccell{padding:14px}
  .pivot-layout{gap:10px}
  .pzone{padding:11px;min-height:62px}
  .toolbar{gap:8px}
  .search-box{min-width:0;width:100%}
  .btn{padding:9px 13px;font-size:11.5px}
  .filter-row{gap:8px}
  select{padding:8px 11px}
  /* 16px stops iOS Safari from auto-zooming the page on focus */
  input[type=text],input[type=number],.search-box input{font-size:16px;padding:9px 11px}
  input.cedit{font-size:13px;padding:5px 6px}
  .col-tog{padding:6px 11px}
  .ss-bar{padding:9px 11px;gap:8px}
  .ss-title{font-size:11.5px}
  .ss-title small{display:block;margin-top:2px;font-size:9.5px}
  .ss-actions{width:100%;margin-left:0}
  .ss-actions .btn{flex:1;justify-content:center}
  /* let the embedded workspace own nearly the whole screen */
  #ssFrame{height:calc(100vh - 132px);height:calc(100svh - 132px);min-height:520px}
  .ss-frame-wrap{border-radius:11px}
}
@media(max-width:820px) and (orientation:landscape){
  #ssFrame{height:calc(100vh - 132px);min-height:340px}
}
`;

/* ---------------- 4. small-screen CSS for the embedded frame ----------------
   Appended to the ScrapSale Pro document when the tab mounts, so its source
   stays untouched. Its row editor uses 3- and 4-column grids that overflow a
   phone; `td.edit input{font:inherit}` (0,1,2) outranks the input rules below
   (0,1,1), so the dense grid keeps its compact 12px cells. */
const FRAME_CSS = `
@media (max-width: 820px) {
  main { padding: 14px 12px 40px; }
  #topbar { padding: 9px 12px; flex-wrap: wrap; }
  #topbar h1 { font-size: 14px; }
  .top-actions { width: 100%; margin-left: 0; gap: 6px; }
  .top-actions .btn { flex: 1; justify-content: center; }
  .panel { padding: 12px; border-radius: 12px; }
  .panel h2 { font-size: 13px; }
  .btn { padding: 9px 12px; }
  .nav-btn { padding: 11px 12px; }
  .controls { gap: 8px; }
  .controls > div { flex: 1 1 45%; min-width: 0; }
  .controls label { display: block; margin: 0 0 3px; }
  .controls select, .controls input[type=text] { width: 100%; min-width: 0; }
  .table-wrap { -webkit-overflow-scrolling: touch; }
  /* row editor: 3 columns -> 1fr 1fr, amount grid: 4 columns -> 3 */
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .span2 { grid-column: 1 / -1; }
  .form-grid input, .form-grid select { font-size: 16px; padding: 9px 10px; }
  .amt-grid { grid-template-columns: minmax(0, 1.5fr) 72px minmax(0, 1fr); }
  .amt-grid > *:nth-child(4n) { display: none; }   /* drop the "Calculated on" column */
  .amt-grid input { font-size: 16px; padding: 9px 8px; }
  .amt-grid input[type=date] { width: 100%; }
  .modal { max-width: 100%; border-radius: 14px; }
  .modal.wide { max-width: 100%; }
  .modal-body { padding: 14px; }
  .col-picker-panel { width: min(320px, calc(100vw - 24px)); }
  .col-menu { min-width: min(260px, calc(100vw - 24px)); }
  .col-toggle { padding: 7px 12px; }
  #dropzone { padding: 22px 14px; }
  .workspace-row { padding: 12px 0; }
  input[type=text], input[type=search], input[type=date], select { font-size: 16px; }
  input[type=text], input[type=search] { min-width: 0; }
}
`;

const FRAME_SCRIPT = `
<!-- MOBILE-FRAME-CSS-START (standalone build) -->
<script id="ss-mobile">
/* Adds small-screen CSS to the embedded ScrapSale Pro document when its tab
   mounts. The frame is same-origin, so its head is reachable; the embedded
   file itself stays byte-identical to the original. */
(function(){
  var CSS = ${JSON.stringify(FRAME_CSS)};
  function dress(frame){
    try{
      var d = frame.contentDocument;
      if(!d || !d.head || d.getElementById('ssMobileCss')) return;
      var s = d.createElement('style');
      s.id = 'ssMobileCss';
      s.textContent = CSS;
      d.head.appendChild(s);
    }catch(e){ /* opaque origin — nothing to do */ }
  }
  var mount = builders.scrapsale;
  builders.scrapsale = function(){
    mount();
    var frame = document.getElementById('ssFrame');
    if(!frame) return;
    frame.addEventListener('load', function(){ dress(frame); });
    if(frame.contentDocument && frame.contentDocument.readyState === 'complete') dress(frame);
  };
})();
</script>
<!-- MOBILE-FRAME-CSS-END -->
`;

/* ---------------- apply ---------------- */
function must(target, needle, label) {
  const i = target.indexOf(needle);
  if (i === -1) throw new Error('not found: ' + label);
  return i;
}

/* external refs must be present exactly once, or the source changed */
must(html, CHART_TAG, 'Chart.js CDN tag');
must(html, FONT_TAG, 'Google Fonts link');
if (html.split(CHART_TAG).length !== 2) throw new Error('Chart.js tag not unique');
if (html.split(FONT_TAG).length !== 2) throw new Error('Google Fonts link not unique');

html = html.replace(FONT_TAG, fontCss);
html = html.replace(CHART_TAG, '<script id="chartjs">/*! Chart.js v4.4.1 | MIT | chartjs.org */\n' + chart + '</script>');

/* host CSS goes before the FIRST </style> (the embedded app has its own later) */
const styleClose = html.indexOf('</style>');
html = html.slice(0, styleClose) + '/* MOBILE-CSS-START */' + HOST_CSS + '/* MOBILE-CSS-END */\n' + html.slice(styleClose);

/* theme colour for the mobile browser chrome */
html = html.replace('<meta name="viewport" content="width=device-width,initial-scale=1.0"/>',
  '<meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"/>\n' +
  '<meta name="theme-color" content="#070711"/>\n' +
  '<meta name="mobile-web-app-capable" content="yes"/>\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes"/>\n' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>');

/* the frame enhancer runs after the app script -> before the LAST </body> */
const bodyClose = html.lastIndexOf('</body>');
html = html.slice(0, bodyClose) + FRAME_SCRIPT + '\n' + html.slice(bodyClose);

/* ---------------- checks ---------------- */
const leftover = html.match(/<(script|link|img)[^>]*(src|href)="https?:[^"]*"/g) || [];
const checks = [
  ['no external <script>/<link>/<img> left', leftover.length === 0, leftover.join(' | ')],
  ['Chart.js inlined', html.includes('Chart.js v4.4.1') && html.includes('window.Chart=')],
  ['Inter inlined (4 weights)', (html.match(/font-family:'Inter';font-style:normal;font-weight:\d+/g) || []).length === 4],
  ['JetBrains Mono inlined (2 weights)', (html.match(/font-family:'JetBrains Mono';font-style:normal;font-weight:\d+/g) || []).length === 2],
  ['mobile CSS added', html.includes('/* MOBILE-CSS-START */') && html.includes('#ssFrame{height:calc(100vh - 132px)')],
  ['frame enhancer added', html.includes("id=\"ss-mobile\"") && html.includes('builders.scrapsale = function(){')],
  ['embedded app still present', html.includes('const SCRAPSALE_DOC = `') && html.includes('function recalcRow(r, changed)')],
  ['host app still present', html.includes('builders.variants=function(){') && html.includes('const RAW = [')],
  ['viewport + theme meta', html.includes('name="theme-color"') && html.includes('viewport-fit=cover')],
];
const failed = checks.filter(c => !c[1]);
checks.forEach(([n, ok, extra]) => console.log(`${ok ? 'ok  ' : 'FAIL'}  ${n}${ok || !extra ? '' : '   [' + extra + ']'}`));
if (failed.length) throw new Error(failed.length + ' check(s) failed — nothing written');

fs.writeFileSync(OUT, html, 'utf8');
const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log('\nfonts     :', kb(fontBytes), 'raw ->', kb(fontBytes * 4 / 3), 'base64');
console.log('chart.js  :', kb(chart.length));
console.log('written   :', kb(html.length), '->', path.basename(OUT));
