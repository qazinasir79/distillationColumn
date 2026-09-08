// UI smoke test with a minimal fake DOM: executes every render path to catch
// ReferenceErrors/TypeErrors (logic bugs), without a browser.
// Run: node test/smoke.mjs   (from webapp/)
import { readFileSync } from 'fs';
import { runInThisContext } from 'vm';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');

// ---- minimal fake DOM ----
function fakeEl() {
  return {
    innerHTML: '', value: '', textContent: '', dataset: {},
    style: {}, disabled: false,
    addEventListener() {}, appendChild() {}, click() {}, select() {}, remove() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
  };
}
const els = {};
globalThis.document = {
  getElementById(id) { if (!els[id]) els[id] = fakeEl(); return els[id]; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  createElement() { return fakeEl(); },
  addEventListener() {},
  body: fakeEl(),
};
globalThis.window = globalThis;
globalThis.scrollTo = () => {};

function loadJS(rel) {
  runInThisContext(readFileSync(join(ROOT, rel), 'utf8'), { filename: rel });
}
loadJS('js/data.js');
loadJS('js/tea.js');
loadJS('js/charts.js');
loadJS('js/app.js');
loadJS('js/plant.js');

const { TEA, TEA_DATA, CHARTS, APP, PLANT } = globalThis;
let nPass = 0, nFail = 0;
const failures = [];
function ok(cond, what) {
  if (cond) { nPass++; return; }
  nFail++; failures.push(what);
}
function runs(fn, what) {
  try { fn(); nPass++; }
  catch (e) { nFail++; failures.push(`${what}: ${e.message}\n${(e.stack || '').split('\n').slice(1, 3).join('\n')}`); }
}

// ---- charts ----
for (const [fn, args, tag] of [
  ['barV', [{ labels: ['a', 'b'], values: [1, -2] }], '<svg'],
  ['barV', [{ labels: [], values: [] }], 'chart-empty'],
  ['barH', [{ labels: ['x'], values: [5] }], '<svg'],
  ['line', [{ series: [{ label: 's', x: [1, 2], y: [3, NaN] }] }], '<svg'],
  ['line', [{ series: [] }], 'chart-empty'],
  ['tornado', [{ labels: ['f'], lows: [1], highs: [3], base: 2 }], '<svg'],
  ['hist', [{ values: [1, 2, 2, 3, NaN] }], '<svg'],
  ['hist', [{ values: [NaN] }], 'chart-empty'],
  ['cashflow', [{ years: 3, revenue: [1, 2, 3], cashCost: [1, 1, 1], capex: [5, 0, -1], cashFlow: [-5, 1, 3] }], '<svg'],
  ['donut', [{ labels: ['a', 'b'], values: [3, 1] }], '<svg'],
  ['donut', [{ labels: ['a'], values: [0] }], 'chart-empty'],
]) {
  runs(() => {
    const el = fakeEl();
    CHARTS[fn](el, ...args);
    if (!el.innerHTML.includes(tag)) throw new Error(`missing ${tag}`);
  }, `chart ${fn}`);
}

// ---- shell + learn ----
runs(() => APP.resetToPreset(Object.keys(TEA_DATA.presets)[0]), 'resetToPreset');
for (const tab of ['types', 'compare', 'decide', 'trouble']) {
  runs(() => { APP.state.learnTab = tab; APP.showPage('learn'); }, `learn/${tab}`);
}
ok(els.learnBody.innerHTML.length > 100, 'learn body rendered');

// ---- equipment ----
runs(() => APP.showPage('equip'), 'equip page');
runs(() => {
  APP.state.equip.category = 'NoSuch';
  APP.showPage('equip');
  APP.state.equip.category = 'Towers'; APP.state.equip.type = 'Tray and packed';
}, 'equip bad category recovers');

// ---- builder ----
runs(() => APP.showPage('builder'), 'builder page');
runs(() => {
  APP.runTEA(false);
  PLANT._debug.renderResults();
  PLANT._debug.renderResTab('cost');
  PLANT._debug.renderResTab('cf');
  PLANT._debug.renderResTab('det');
}, 'builder results all tabs');
ok(els.bResults.innerHTML.includes('Results'), 'results header present');
runs(() => {
  APP.state.tea = null; APP.state.teaError = 'boom'; APP.state.teaRan = true;
  PLANT._debug.renderResults();
  APP.state.teaRan = false; APP.state.teaError = null;
}, 'builder error path');

// ---- sensitivity ----
for (const tab of ['oneway', 'tornado', 'mc']) {
  runs(() => { APP.state.sensTab = tab; APP.showPage('sens'); }, `sens/${tab}`);
}
runs(() => {
  const p = APP.buildWorkingPlant();
  const mc = TEA.monteCarlo(p, { num_samples: 300, random_seed: 1 });
  mc.baseline = { LCOP: 1, NPV: 2, ROI: 3, PBT: 4 };
  APP.state.mc = mc;
  PLANT._debug.renderMCResults(document.getElementById('mcOut'));
}, 'mc results render');

// ---- compare ----
runs(() => APP.showPage('compare'), 'compare empty');
runs(() => {
  const p = APP.buildWorkingPlant();
  TEA.calculatePurchasedCost(p);
  TEA.calculateAll(p);
  APP.state.designs.push({
    name: 'd1', cfg: JSON.parse(JSON.stringify(p.cfg)),
    specs: [], kpis: APP.kpisOf(p), cashflow: p.cash_flow.slice(), lifetime: p.n_years,
  });
  APP.state.designs.push(JSON.parse(JSON.stringify(APP.state.designs[0])));
  APP.state.designs[1].name = 'd2';
  PLANT._debug.renderCompareTable();
  APP.state.designs = [];
}, 'compare with designs');

// ---- json/about ----
for (const tab of ['json', 'about']) {
  runs(() => { APP.state.jsonTab = tab; APP.showPage('json'); }, `json/${tab}`);
}
ok(els.jsonBody.innerHTML.includes('Methodology'), 'about rendered');

// ---- decision helper logic ----
{
  const [rec] = APP.recommendDistillation(10, false, false, false, false);
  ok(rec === 'Fractional', 'recommend fractional');
  const [rec2] = APP.recommendDistillation(50, false, false, false, false);
  ok(rec2 === 'Simple', 'recommend simple');
}

console.log(`\nsmoke: ${nPass} passed, ${nFail} failed`);
if (failures.length) {
  console.log('--- failures ---');
  for (const f of failures) console.log('FAIL', f);
  process.exit(1);
}
