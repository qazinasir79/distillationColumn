// Node parity harness: JS engine (tea.js) vs Python engine (expected.json).
// Run: node test/parity.mjs   (from webapp/)
import { readFileSync } from 'fs';
import { runInThisContext } from 'vm';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');

function loadJS(rel) {
  const code = readFileSync(join(ROOT, rel), 'utf8');
  runInThisContext(code, { filename: rel });
}
loadJS('js/data.js');
loadJS('js/tea.js');

const TEA = globalThis.TEA;
const DATA = globalThis.TEA_DATA;
const exp = JSON.parse(readFileSync(join(DIR, 'expected.json'), 'utf8'));

let nPass = 0, nFail = 0;
const failures = [];
function close(a, b, tol, what) {
  if (b === null || b === undefined) {
    if (typeof a === 'number' && !Number.isFinite(a)) { nPass++; return; }
    nFail++; failures.push(`${what}: expected non-finite, got ${a}`);
    return;
  }
  if (typeof b === 'number' && typeof a === 'number') {
    const denom = Math.max(1e-300, Math.abs(b));
    if (Math.abs(a - b) / denom <= tol) { nPass++; return; }
    nFail++; failures.push(`${what}: got ${a}, expected ${b} (reldiff ${Math.abs(a - b) / denom})`);
    return;
  }
  if (a === b) { nPass++; return; }
  nFail++; failures.push(`${what}: got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function closeArr(a, b, tol, what) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    nFail++; failures.push(`${what}: length mismatch (${a && a.length} vs ${b && b.length})`);
    return;
  }
  for (let i = 0; i < b.length; i++) close(a[i], b[i], tol, `${what}[${i}]`);
}
function expectThrow(fn, what) {
  try { fn(); } catch (e) { nPass++; return; }
  nFail++; failures.push(`${what}: expected an error, none thrown`);
}

// --- 1. Equipment ---
for (const presetName of Object.keys(exp.equipment)) {
  const specs = DATA.presets[presetName].equipment;
  const outs = specs.map((s) => TEA.costEquipment(JSON.parse(JSON.stringify(s))));
  const es = exp.equipment[presetName];
  outs.forEach((o, i) => {
    const e = es[i];
    close(o.purchased_cost, e.purchased_cost, 1e-9, `${presetName} eq#${i} purchased`);
    close(o.direct_cost, e.direct_cost, 1e-9, `${presetName} eq#${i} direct`);
    close(o.num_units, e.num_units, 0, `${presetName} eq#${i} units`);
    close(o.cost_year, e.cost_year, 0, `${presetName} eq#${i} cost_year`);
    close(o.material, e.material, 0, `${presetName} eq#${i} material`);
    close(o.material_factor, e.material_factor, 1e-12, `${presetName} eq#${i} matfactor`);
  });
}

// --- 2. Plant KPIs + arrays ---
const SCALARS = ['purchased_cost', 'isbl', 'osbl', 'dne', 'contigency',
  'fixed_capital', 'working_capital', 'variable_opex', 'fixed_opex',
  'operating_labor_costs', 'revenue', 'npv', 'levelized_cost',
  'payback_time', 'roi', 'irr'];
const ARRAYS = ['cash_flow', 'prod_array', 'revenue_array', 'capital_cost_array',
  'cash_cost_array', 'gross_profit_array', 'depreciation_array', 'tax_paid_array'];
for (const presetName of Object.keys(exp.presets)) {
  const pr = DATA.presets[presetName];
  const p = TEA.newPlant(pr.plant, pr.equipment);
  TEA.calculatePurchasedCost(p);
  TEA.calculateAll(p);
  const e = exp.presets[presetName];
  for (const k of SCALARS) {
    const got = (k === 'variable_opex') ? p.variable_production_costs
      : (k === 'fixed_opex') ? p.fixed_production_costs
      : (k === 'levelized_cost') ? p.levelized_cost
      : (k === 'payback_time') ? p.payback_time : p[k];
    close(got, e[k], k === 'irr' ? 1e-6 : 1e-9, `${presetName} ${k}`);
  }
  for (const k of ARRAYS) closeArr(p[k], e[k][0], 1e-9, `${presetName} ${k}`);
  for (const k of Object.keys(e.variable_opex_breakdown)) {
    close(p.variable_opex_breakdown[k], e.variable_opex_breakdown[k], 1e-9, `${presetName} varbd ${k}`);
  }
  for (const k of Object.keys(e.revenue_breakdown)) {
    close(p.revenue_breakdown[k], e.revenue_breakdown[k], 1e-9, `${presetName} revbd ${k}`);
  }
}

// --- 3. Sensitivity ---
{
  const base = Object.keys(DATA.presets)[0];
  const pr = DATA.presets[base];
  for (const key of Object.keys(exp.sensitivity)) {
    const [param, metric] = key.split('|');
    const p = TEA.newPlant(pr.plant, pr.equipment);
    const r = TEA.sensitivityData(p, param, metric, 0.2, 9);
    const e = exp.sensitivity[key];
    close(r.parameter, e.parameter, 0, `sens ${key} param`);
    closeArr(r.x, e.x, 1e-12, `sens ${key} x`);
    closeArr(r.y, e.y, 1e-9, `sens ${key} y`);
    close(r.baseline, e.baseline, 1e-9, `sens ${key} baseline`);
  }
}

// --- 4. Tornado ---
{
  const base = Object.keys(DATA.presets)[0];
  const pr = DATA.presets[base];
  for (const metric of Object.keys(exp.tornado)) {
    const p = TEA.newPlant(pr.plant, pr.equipment);
    const r = TEA.tornadoData(p, 0.1, metric);
    const e = exp.tornado[metric];
    close(JSON.stringify(r.factors), JSON.stringify(e.factors), 0, `tornado ${metric} order`);
    closeArr(r.lows, e.lows, 1e-9, `tornado ${metric} lows`);
    closeArr(r.highs, e.highs, 1e-9, `tornado ${metric} highs`);
    close(r.base_value, e.baseline, 1e-9, `tornado ${metric} base`);
  }
}

// --- 5. Monte Carlo (statistical parity) ---
{
  const base = Object.keys(DATA.presets)[0];
  const pr = DATA.presets[base];
  const p = TEA.newPlant(pr.plant, pr.equipment);
  const mc = TEA.monteCarlo(p, { num_samples: 4000, random_seed: 7 });
  const q = (arr, prob) => {
    const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(prob * s.length))];
  };
  const mean = (arr) => { const f = arr.filter(Number.isFinite); return f.reduce((a, b) => a + b, 0) / f.length; };
  const std = (arr) => { const f = arr.filter(Number.isFinite); const m = mean(f); return Math.sqrt(f.reduce((a, b) => a + (b - m) ** 2, 0) / f.length); };
  for (const m of ['LCOP', 'NPV', 'ROI']) {
    const e = exp.monte_carlo.metrics[m];
    const got = mc.metrics[m];
    close(mean(got), e.mean, 0.10, `mc ${m} mean`);
    close(std(got), e.std, 0.15, `mc ${m} std`);
    close(q(got, 0.5), e.p50, 0.10, `mc ${m} p50`);
    close(got.filter(Number.isFinite).length, e.n_finite, 0, `mc ${m} n_finite`);
  }
  // PBT: heavy-tailed (FC/avg_cf) so only robust stats are comparable
  // across PRNGs: finite-count within 5 %, median within 25 %.
  {
    const e = exp.monte_carlo.metrics.PBT;
    const got = mc.metrics.PBT.filter(Number.isFinite).length;
    close(got, e.n_finite, 0.05, 'mc PBT n_finite');
    if (e.n_finite > 0) close(q(mc.metrics.PBT, 0.5), e.p50, 0.25, 'mc PBT median');
  }
  // Input sampling sanity: factor means ~1, lifetime mean ~20.
  close(mean(mc.inputs['Fixed capital factor']), 1.0, 0.05, 'mc input fc mean');
  close(mean(mc.inputs['Project lifetime']), 20.0, 0.05, 'mc input lt mean');
  close(mc.num_samples, 4000, 0, 'mc n');
}

// --- 6. Edge cases: errors must be raised like Python ---
expectThrow(() => TEA.costEquipment({ name: 'x', param: 1, process_type: 'Fluids', category: 'Nope', type: 'Nope' }), 'edge unknown correlation');
expectThrow(() => TEA.costEquipment({ name: 'x', param: 1e-9, process_type: 'Fluids', category: 'Towers', type: 'Tray and packed' }), 'edge param below s_lower');
expectThrow(() => TEA.costEquipment({ name: 'x', param: 5, process_type: 'Fluids', category: 'Towers', type: 'Tray and packed', target_year: 1900 }), 'edge bad target year');
expectThrow(() => TEA.costEquipment({ name: 'x', param: 5, process_type: 'Fluids', category: 'Towers', type: 'Tray and packed', material: 'Unobtainium' }), 'edge bad material');
expectThrow(() => TEA.costEquipment({ name: 'x', param: 5, process_type: 'Plasma', category: 'Towers', type: 'Tray and packed' }), 'edge bad process type');
{
  const p = TEA.newPlant({ process_type: 'Fluids', country: 'Netherlands', project_lifetime: 2,
    plant_products: { a: { production: 1, price: 1 } } }, []);
  expectThrow(() => TEA.calculateCashFlow(p), 'edge lifetime<3');
}
{
  const p = TEA.newPlant({ process_type: 'Fluids', country: 'Netherlands' }, []);
  expectThrow(() => TEA.calculateCashFlow(p), 'edge no products');
}
{
  const p = TEA.newPlant({ process_type: 'Fluids', country: 'Atlantis' }, []);
  expectThrow(() => TEA.calculateFixedCapital(p), 'edge bad country');
}
{
  const p = TEA.newPlant({ process_type: 'Fluids', country: 'United States', region: 'Nowhere' }, []);
  expectThrow(() => TEA.calculateFixedCapital(p), 'edge bad region');
}
{
  const p = TEA.newPlant({ process_type: 'Vapor', country: 'Netherlands' }, []);
  expectThrow(() => TEA.calculateFixedCapital(p), 'edge bad plant process type');
}
{
  // 2-var correlation without s2 must raise (find one in DB).
  const row = DATA.correlations.find((r) => r.form === '2-var power-law');
  if (row) {
    expectThrow(() => TEA.costEquipment({ name: 'x', param: 20, process_type: 'Fluids', category: row.category, type: row.type, cost_func: row.key }),
      'edge 2-var missing s2');
    // And with s2 supplied it must price fine.
    const ok = TEA.costEquipment({ name: 'x', param: [20, row.s2_lower != null ? row.s2_lower : 1], process_type: 'Fluids', category: row.category, type: row.type, cost_func: row.key });
    close(Number.isFinite(ok.purchased_cost), true, 0, 'edge 2-var with s2 prices');
  } else { nPass++; }
}

console.log(`\nparity: ${nPass} passed, ${nFail} failed`);
if (failures.length) {
  console.log('--- failures (first 40) ---');
  for (const f of failures.slice(0, 40)) console.log('FAIL', f);
  process.exit(1);
}
