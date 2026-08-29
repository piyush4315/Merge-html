/* ==================================================================
   verify-merged.js — checks the merged BidAnalyticsPro-2.html.

   Phase 0  runs the PRISTINE host file (git show HEAD:...) and records
            how each original tab behaves, so phase 1 can be compared
            against it instead of against a guess.
   Phase 1  runs the merged file: host nav, the six original tabs, and
            builders.scrapsale (which creates the iframe and assigns
            the embedded document to srcdoc).
   Phase 2  takes the EXACT srcdoc string a browser will load and runs
            it as a real document, then exercises ScrapSale Pro:
            workbook, live formulas, pivot/detail tables, drill-down,
            views, undo, and the .xlsx writer.

   Sandbox limitation: no browser binary is reachable, so jsdom is used
   instead of headless Chrome. jsdom 30 does not implement iframe
   srcdoc navigation, hence phase 2 loads the captured srcdoc string
   directly. Chart.js cannot be fetched either (CDN blocked), so
   window.Chart is stubbed to exercise the chart-building code path.
   ================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const MERGED = path.join(ROOT, 'BidAnalyticsPro-2.html');
const SOURCE = path.join(ROOT, 'ScrapSale Pro version 6 - Copy.html');
const BASELINE = '/tmp/BidAnalyticsPro-orig.html';

const results = [];
let errors = [];
function check(name, value, expected) {
  const ok = expected === undefined ? !!value : JSON.stringify(value) === JSON.stringify(expected);
  results.push([ok, name, expected === undefined ? '' : `expected ${JSON.stringify(expected)} got ${JSON.stringify(value)}`]);
  return value;
}
function makeConsole(tag) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(`[${tag}] jsdomError: ${(e.detail && e.detail.stack) || e.message || e}`));
  vc.on('error', (...a) => errors.push(`[${tag}] console.error: ${a.join(' ')}`));
  return vc;
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

/* Walk every host tab and record what it produced. */
function walkHost(file, label) {
  const charts = [];
  class FakeChart {
    constructor(canvas, cfg) { charts.push({ id: canvas && canvas.id, type: cfg && cfg.type }); }
  }
  /* Trap window.Chart: the real (inlined) bundle installs itself through the
     setter, every read gets the fake so charts can build without a canvas. */
  const installed = { value: null };
  errors = [];
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://bidanalytics.test/',
    virtualConsole: makeConsole(label),
    beforeParse(w) {
      Object.defineProperty(w, 'Chart', {
        configurable: true,
        get() { return FakeChart; },
        set(v) { installed.value = v; },
      });
    },
  });
  const w = dom.window;
  const d = w.document;
  const out = { tabs: [...d.querySelectorAll('.nav-tab')].map(b => b.dataset.tab), charts, nodes: {}, kpis: [], boot: errors.length, chartLib: installed.value };
  out.kpis = [...d.querySelectorAll('#kpiGrid .kpi')].map(k => k.querySelector('.kpi-label').textContent + '=' + k.querySelector('.kpi-val').textContent);

  const visit = t => {
    click(w, d.querySelector(`.nav-tab[data-tab="${t}"]`));
    out.nodes[t] = d.getElementById(t).children.length;
  };
  out.tabs.filter(t => t !== 'scrapsale').forEach(visit);
  return new Promise(res => setTimeout(() => {
    out.charts = charts.slice();
    out.kpiAfter = out.kpis.slice();
    out.errors = errors.slice();
    res(out);
  }, 150)); /* charts build inside setTimeout(...,50) */
}

(async () => {
  /* ---------------- PHASE 0: pristine baseline ---------------- */
  console.log('── phase 0: pristine host file (baseline) ──');
  const base = await walkHost(BASELINE, 'baseline');
  console.log(`   baseline: ${base.tabs.length} tabs, ${base.charts.length} charts, ${base.kpis.length} KPIs, ${base.errors.length} errors`);

  /* ---------------- PHASE 1: the merged host page ---------------- */
  console.log('── phase 1: merged host page ──');
  const mergedHtml = fs.readFileSync(MERGED, 'utf8');
  const sourceHtml = fs.readFileSync(SOURCE, 'utf8');
  const merged = await walkHost(MERGED, 'host');

  check('host: boots with no script errors', merged.boot, 0);
  check('host: no errors after visiting every tab', merged.errors.length, 0);
  check('host: new tab inserted beside Dashboard', merged.tabs,
    ['dashboard', 'scrapsale', ...base.tabs.slice(1)]);
  check('host: KPI strip unchanged from baseline', merged.kpiAfter, base.kpiAfter);
  base.tabs.forEach(t => check(`host: tab "${t}" renders as in baseline (${merged.nodes[t]} nodes)`, merged.nodes[t], base.nodes[t]));
  check('host: charts built as in baseline', merged.charts.map(c => c.id + ':' + c.type), base.charts.map(c => c.id + ':' + c.type));
  check('host: dashboard charts dc1+dc2 (rebuilt on re-entry, pre-existing)',
    merged.charts.filter(c => /^dc/.test(c.id)).length, 4);
  check('host: charts-tab canvases ch1..ch5',
    merged.charts.filter(c => /^ch/.test(c.id)).map(c => c.id), ['ch1', 'ch2', 'ch3', 'ch4', 'ch5']);

  /* the new tab, driven through the real nav handler */
  errors = merged.errors;
  const hwin2 = new JSDOM(mergedHtml, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://bidanalytics.test/',
    virtualConsole: makeConsole('host2'),
    beforeParse(w) { w.Chart = class { constructor() {} }; },
  }).window;
  const hdom = hwin2.document;
  check('host: frame not built until the tab is opened', hdom.getElementById('ssFrame') === null, true);
  click(hwin2, hdom.querySelector('.nav-tab[data-tab="scrapsale"]'));
  check('host: section becomes active on click', hdom.getElementById('scrapsale').classList.contains('active'), true);
  check('host: toolbar rendered with 3 controls', hdom.querySelectorAll('#scrapsale .ss-bar .btn').length, 3);
  const frame = hdom.getElementById('ssFrame');
  /* the three toolbar controls */
  let fsCalls = 0;
  hwin2.Element.prototype.requestFullscreen = function () { fsCalls++; return Promise.resolve(); };
  const reloadBtn = hdom.getElementById('ss-reload');
  frame.removeAttribute('srcdoc');
  click(hwin2, reloadBtn);
  check('host: Reload re-attaches the embedded document',
    (hdom.getElementById('ssFrame').getAttribute('srcdoc') || '').length, sourceHtml.length);
  click(hwin2, hdom.getElementById('ss-full'));
  check('host: Fullscreen requests fullscreen on the frame wrapper', fsCalls, 1);
  /* jsdom has no window.open, so this exercises the popup-blocked fallback */
  click(hwin2, hdom.getElementById('ss-pop'));
  check('host: New tab falls back to a toast when pop-ups are blocked',
    hdom.getElementById('toast').textContent.trim(), '\u2713 Allow pop-ups to open ScrapSale Pro in its own tab');
  const srcdoc = frame && frame.getAttribute('srcdoc');
  check('host: builders.scrapsale created the iframe', !!frame, true);
  /* The escaping proof: what the browser hands to the frame must be
     byte-identical to the original ScrapSale Pro file. */
  check('host: embedded document is byte-identical to the source file', srcdoc === sourceHtml, true);
  check('host: embedded doc keeps <script id="core">', srcdoc.indexOf('<script id="core">') > -1, true);
  check('host: embedded doc keeps <script id="app">', srcdoc.indexOf('<script id="app">') > -1, true);
  check('host: embedded doc keeps </body></html>', srcdoc.indexOf('</body>\n</html>') > -1, true);
  check('host: source-file tail reproduced verbatim (incl. its stray ">")', srcdoc.slice(-12), sourceHtml.slice(-12));
  check('host: merged file carries the embedded app', Math.round(mergedHtml.length / 1024) > 300, true);

  /* ---------------- PHASE 2: the embedded ScrapSale Pro app ---------------- */
  console.log('── phase 2: embedded ScrapSale Pro (from the iframe srcdoc) ──');
  errors = [];
  let scrollCalls = 0;
  const app = new JSDOM(srcdoc, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://scrapsale.test/',
    virtualConsole: makeConsole('app'),
    beforeParse(w) {
      /* jsdom does not implement scrollIntoView; browsers do. */
      w.Element.prototype.scrollIntoView = () => { scrollCalls++; };
    },
  });
  const awin = app.window;
  const adoc = awin.document;

  check('app: boots without errors', errors.length, 0);
  check('app: workbook loaded', awin.lots.length, 37);
  check('app: title', adoc.getElementById('viewTitle').textContent);
  check('app: KPI cards rendered', adoc.querySelectorAll('#cards .card').length > 5, true);
  check('app: pivot rows rendered', adoc.querySelectorAll('#pivotTable tbody tr').length > 0, true);
  check('app: lot detail rows rendered', adoc.querySelectorAll('#detailTableDash tbody tr').length, 37);
  check('app: autosave available (localStorage)', awin.storage.ok, true);
  check('app: save indicator', adoc.getElementById('saveState').textContent.trim());
  check('app: auctions in filter (All + 4)', adoc.querySelectorAll('#auctionFilter option').length, 5);

  /* --- live formula engine --- */
  const f = awin.eval(`(function(){
    var r = normalizeLot({lot_no:9999, buyer:'FORMULA TEST', auction:21980, unit:'NO', qty:100, rate:1000,
      gst:18000, tcs:1000, tds194o:100, service_charge_mstc:2000, tds194h:20, gst_tds:0});
    var base = {mat:r.mat_value, net:r.net_service_charge, total:r.total_receivables, sd:r.sd_expected, fp:r.fp_expected};
    r.sd_received = 25000; recalcRow(r, ['sd_received']);
    var paid = {received:r.total_received, outstanding:r.outstanding};
    r.gst_tds_rate = 2; recalcRow(r, ['gst_tds_rate']);
    var tds = {gst_tds:r.gst_tds, total:r.total_receivables, fp:r.fp_expected};
    r.fp_received = r.total_receivables - r.sd_received; recalcRow(r, ['fp_received']);
    return {base:base, paid:paid, tds:tds, settled:r.outstanding};
  })()`);
  check('formula: mat_value = qty x rate', f.base.mat, 100000);
  check('formula: net service charge = MSTC SC - TDS 194H', f.base.net, 1980);
  check('formula: total = mat+gst+tcs-tds194o-netSC-gstTDS', f.base.total, 116920);
  check('formula: SD expected = 25% of mat value', f.base.sd, 25000);
  check('formula: FP expected = total - SD expected', f.base.fp, f.base.total - 25000);
  check('formula: total received = SD + FP received', f.paid.received, 25000);
  check('formula: outstanding = total - received', f.paid.outstanding, f.base.total - 25000);
  check('formula: GST TDS = mat value x rate%', f.tds.gst_tds, 2000);
  check('formula: total receivables drops by GST TDS', f.tds.total, f.base.total - 2000);
  check('formula: fully paid lot settles to zero', f.settled, 0);

  /* --- same recalculation driven through the real table UI --- */
  const uiEdit = awin.eval(`(function(){
    var input = document.querySelector('#detailTable tbody tr td.edit[data-field="sd_received"] input[data-lot]');
    if (!input) return {error:'no editable sd_received cell found'};
    var idx = Number(input.getAttribute('data-lot'));
    var before = lots[idx].total_received;
    var totalBefore = document.querySelector('#detailTable tfoot td[data-field="total_received"]').textContent;
    input.dispatchEvent(new FocusEvent('focusin', {bubbles:true}));
    input.value = '123456';
    input.dispatchEvent(new Event('input', {bubbles:true}));
    input.dispatchEvent(new FocusEvent('focusout', {bubbles:true}));
    var r = lots[idx];
    return {idx:idx, before:before, after:r.total_received, expected:r.sd_received + r.fp_received,
            outstanding:r.outstanding, want:r.total_receivables - r.total_received, totalBefore:totalBefore,
            totalAfter:document.querySelector('#detailTable tfoot td[data-field="total_received"]').textContent,
            undoDepth:hist.undo.length};
  })()`);
  check('UI edit: editable SD-received cell found', !uiEdit.error, true);
  check('UI edit: receipt posted and total received recomputed', uiEdit.after, uiEdit.expected);
  check('UI edit: value actually changed', uiEdit.after !== uiEdit.before, true);
  check('UI edit: outstanding recomputed', uiEdit.outstanding, uiEdit.want);
  check('UI edit: footer total re-rendered', uiEdit.totalAfter !== uiEdit.totalBefore, true);
  check('UI edit: pushed an undo step', uiEdit.undoDepth > 0, true);

  const undone = awin.eval(`(function(){ undo(); var r = lots[${uiEdit.idx}]; return {received:r.total_received, redo:hist.redo.length}; })()`);
  check('undo: reverts the edit', undone.received, uiEdit.before);
  check('undo: fills the redo stack', undone.redo > 0, true);

  /* --- grouping, drill-down, views, export surface --- */
  const views = awin.eval(`(function(){
    var buyers = document.querySelectorAll('#pivotTable tbody tr').length;
    document.querySelector('#pivotTable tbody tr').dispatchEvent(new MouseEvent('click', {bubbles:true}));
    var drill = document.querySelectorAll('#detailTableDash tbody tr').length;
    document.querySelector('.nav-btn[data-view="lots"]').click();
    document.getElementById('clearDetail').click();
    var lotsView = document.querySelectorAll('#detailTable tbody tr').length;
    var groupSel = document.getElementById('groupBy');
    groupSel.value = 'auction'; groupSel.dispatchEvent(new Event('change', {bubbles:true}));
    var auctionRows = document.querySelectorAll('#pivotTable tbody tr').length;
    document.querySelector('.nav-btn[data-view="data"]').click();
    return {buyers:buyers, drill:drill, lotsView:lotsView, auctionRows:auctionRows,
            dataView:!document.getElementById('view-data').hidden,
            exports:document.querySelectorAll('#exportGrid .export-card').length};
  })()`);
  check('pivot: grouped by buyer', views.buyers > 5, true);
  check('pivot drill-down: selects that buyer\\u2019s lots', views.drill > 0, true);
  check('view: Lot Details renders all 37 rows', views.lotsView, 37);
  check('pivot: regroup by auction', views.auctionRows, 4);
  check('view: Data & Backup renders', views.dataView, true);
  check('export: formats offered', views.exports > 4, true);

  /* --- the .xlsx writer with live formulas --- */
  const xlsx = awin.eval(`(function(){
    var bytes = buildXlsx(lots, customCols);
    var files = readZip(bytes);
    var dec = new TextDecoder();
    var all = files.map(function(f){return dec.decode(f.data);}).join('\\n');
    var wb = dec.decode(files.find(function(f){return f.name === 'xl/workbook.xml';}).data);
    var sheetNames = (wb.match(/<sheet [^>]*name="[^"]*"/g) || []).map(function(m){ return m.replace(/.*name="([^"]*)".*/, '$1'); });
    return {size:bytes.length, head:[bytes[0],bytes[1],bytes[2],bytes[3]], count:files.length,
            names:files.map(function(f){return f.name;}), sheetNames:sheetNames,
            sheets:files.filter(function(f){return /worksheets\\/sheet\\d+\\.xml$/.test(f.name);}).length,
            tables:files.filter(function(f){return /^xl\\/tables\\//.test(f.name);}).length,
            formulas:(all.match(/<f>/g)||[]).length, sumif:(all.match(/SUMIF\\(/g)||[]).length,
            table:all.indexOf('CashReceivables') > -1, json:jsonExport(lots, customCols).length};
  })()`);
  check('xlsx: ZIP signature', xlsx.head, [0x50, 0x4b, 0x03, 0x04]);
  check('xlsx: parts written', xlsx.count > 5, true);
  check('xlsx: worksheets written', xlsx.sheets, 3);
  check('xlsx: sheet names', xlsx.sheetNames, ['Cash Receivables', 'Pivot Analytics', 'Power BI']);
  check('xlsx: Excel tables defined', xlsx.tables, 3);
  check('xlsx: live formulas embedded', xlsx.formulas > 50, true);
  check('xlsx: SUMIF pivot formulas embedded', xlsx.sumif > 10, true);
  check('xlsx: Excel table CashReceivables defined', xlsx.table, true);
  check('xlsx: workbook size sane', xlsx.size > 40000, true);
  check('json: export payload', xlsx.json > 20000, true);

  check('app: no errors after full exercise', errors.length, 0);
  console.log(`   note: scrollIntoView stubbed ${scrollCalls}x (jsdom does not implement it)`);

  /* ---------------- PHASE 3: no-localStorage fallback (file:// in strict browsers) ---------- */
  console.log('\u2500\u2500 phase 3: embedded app with localStorage unavailable \u2500\u2500');
  errors = [];
  const strict = new JSDOM(srcdoc, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://scrapsale.test/',
    virtualConsole: makeConsole('strict'),
    beforeParse(w) {
      w.Element.prototype.scrollIntoView = () => {};
      /* Safari / locked-down file:// throws on localStorage access. */
      Object.defineProperty(w, 'localStorage', { get() { throw new Error('SecurityError: storage denied'); } });
    },
  });
  check('fallback: app still boots without localStorage', errors.length, 0);
  check('fallback: workbook still loads from SAMPLE_DATA', strict.window.lots.length, 37);
  check('fallback: storage.ok is false', strict.window.storage.ok, false);
  check('fallback: tables still render',
    strict.window.document.querySelectorAll('#detailTableDash tbody tr').length, 37);
  check('fallback: warns the user', /Autosave is disabled/.test(
    strict.window.document.getElementById('toasts').textContent), true);
  const fb = strict.window.eval(`(function(){
    var r = lots[0], before = r.total_received;
    r.sd_received = r.sd_received + 1000; recalcRow(r, ['sd_received']);
    return {changed: r.total_received !== before, outstanding: r.outstanding === r.total_receivables - r.total_received};
  })()`);
  check('fallback: formulas still recalculate in memory', fb.changed && fb.outstanding, true);

  /* ---------------- PHASE 4: the standalone (offline / mobile) build ---------------- */
  console.log('\u2500\u2500 phase 4: BidAnalyticsPro-Standalone.html \u2500\u2500');
  const STANDALONE = path.join(ROOT, 'BidAnalyticsPro-Standalone.html');
  const standaloneHtml = fs.readFileSync(STANDALONE, 'utf8');
  const ext = standaloneHtml.match(/<(script|link|img)[^>]*(src|href)="https?:[^"]*"/g) || [];
  check('standalone: no external <script>/<link>/<img>', ext.length, 0);
  check('standalone: no @import / url(http) in CSS',
    /@import|url\(\s*['"]?https?:/.test(standaloneHtml.replace(/https:\/\/www\.chartjs\.org|https:\/\/drive\.google\.com[^'"]*|https:\/\/fonts[^'"]*/g, '')), false);

  const sa = await walkHost(STANDALONE, 'standalone');
  check('standalone: boots with no script errors', sa.boot, 0);
  check('standalone: no errors after visiting every tab', sa.errors.length, 0);
  check('standalone: inlined Chart.js executed and installed itself', !!sa.chartLib, true);
  check('standalone: Chart.js version matches the old CDN link', sa.chartLib && sa.chartLib.version, '4.4.1');
  check('standalone: tabs match the merged file', sa.tabs, merged.tabs);
  check('standalone: KPI strip matches the merged file', sa.kpiAfter, merged.kpiAfter);
  check('standalone: charts built as in the merged file',
    sa.charts.map(c => c.id + ':' + c.type), merged.charts.map(c => c.id + ':' + c.type));

  /* fonts really are embedded, not referenced */
  const faces = standaloneHtml.match(/@font-face\{[^}]*\}/g) || [];
  check('standalone: @font-face rules inlined', faces.length, 6);
  check('standalone: every face is a data: URL', faces.every(f => /src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{1000,}\)/.test(f)), true);
  check('standalone: woff2 payloads decode', faces.every(f => {
    const b64 = f.match(/base64,([A-Za-z0-9+/=]+)/)[1];
    const buf = Buffer.from(b64, 'base64');
    return buf.slice(0, 4).toString('latin1') === 'wOF2';   /* woff2 magic number */
  }), true);

  /* the mobile CSS must at least parse */
  const csstree = require('/tmp/node_modules/css-tree');
  for (const [name, css] of [['host', standaloneHtml.split('/* MOBILE-CSS-START */')[1].split('/* MOBILE-CSS-END */')[0]],
                             ['frame', JSON.parse(standaloneHtml.match(/var CSS = ("(?:[^"\\]|\\.)*");/)[1])]]) {
    const problems = [];
    csstree.parse(css, { positions: true, onParseError: e => problems.push(e.message) });
    check(`standalone: ${name} mobile CSS parses cleanly`, problems.length, 0);
    check(`standalone: ${name} mobile CSS is scoped to small screens`, /@media\s*\(max-width:\s*820px\)/.test(css), true);
  }

  /* the frame enhancer must actually inject the stylesheet */
  const swin = new JSDOM(standaloneHtml, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://bidanalytics.test/',
    virtualConsole: makeConsole('standalone2'),
    beforeParse(w) { w.Chart = class { constructor() {} }; },
  }).window;
  const sdoc = swin.document;
  check('standalone: builders.scrapsale is wrapped', /dress\(frame\)/.test(swin.builders.scrapsale.toString()), true);
  click(swin, sdoc.querySelector('.nav-tab[data-tab="scrapsale"]'));
  const injected = sdoc.getElementById('ssFrame').contentDocument.getElementById('ssMobileCss');
  check('standalone: mobile stylesheet injected into the frame document', !!injected, true);
  check('standalone: injected CSS carries the phone rules',
    injected && injected.textContent.includes('.amt-grid > *:nth-child(4n)') &&
    injected.textContent.includes('.form-grid { grid-template-columns: 1fr 1fr; }'), true);
  check('standalone: embedded document still byte-identical to the source',
    sdoc.getElementById('ssFrame').getAttribute('srcdoc') === sourceHtml, true);

  /* the embedded app behaves the same when loaded from the standalone build */
  const sa2 = new JSDOM(sdoc.getElementById('ssFrame').getAttribute('srcdoc'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://scrapsale.test/',
    virtualConsole: makeConsole('standalone-app'),
    beforeParse(w) { w.Element.prototype.scrollIntoView = () => {}; },
  });
  check('standalone: embedded workbook loads', sa2.window.lots.length, 37);
  check('standalone: embedded formulas recalculate', sa2.window.eval(`(function(){
    var r = lots[0], t = r.total_receivables;
    r.fp_received = t - r.sd_received; recalcRow(r, ['fp_received']);
    return r.outstanding;
  })()`), 0);

  /* ---------------- report ---------------- */
  const failed = results.filter(r => !r[0]);
  console.log(`\n===== ${results.length - failed.length}/${results.length} checks passed =====`);
  results.forEach(([ok, name, detail]) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '   [' + detail + ']'}`));
  if (errors.length) { console.log(`\n===== ${errors.length} runtime errors =====`); errors.forEach(e => console.log('  ' + e)); }
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
