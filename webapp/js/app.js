/* Static TEA Studio — shell, state, Learn + Equipment pages.
 * plant.js adds Builder / Sensitivity / Compare / JSON pages. Plain script.
 */
(function (root) {
  'use strict';
  const TEA = root.TEA, DATA = root.TEA_DATA, C = root.CHARTS;
  const esc = C.esc;

  // ------------------------------------------------------------------ state
  const state = {
    page: 'learn',
    preset_name: null,
    plant_cfg: null,
    equipment_specs: null,
    dirty: false,
    tea: null, teaError: null, teaRan: false,
    mc: null, mcKey: '',
    designs: [],
    learnTab: 'types', learnType: 'Fractional', troubleType: 'Fractional',
    sensTab: 'oneway', jsonTab: 'json',
    equip: { category: 'Towers', type: 'Tray and packed', param: 8, s2: null,
             material: 'Carbon steel', process_type: 'Fluids', target_year: 2024, num_units: 1 },
  };

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function presetNames() { return Object.keys(DATA.presets); }
  function resetToPreset(name) {
    const p = DATA.presets[name];
    if (!p) return;
    state.preset_name = name;
    state.plant_cfg = deepCopy(p.plant);
    state.equipment_specs = deepCopy(p.equipment);
    state.dirty = false;
    state.tea = null; state.teaError = null; state.teaRan = false;
    state.mc = null; state.mcKey = '';
    syncPresetBar();
  }
  function markDirty() {
    state.dirty = true;
    state.tea = null; state.teaError = null; state.teaRan = false;
    state.mc = null; state.mcKey = '';
    syncPresetBar();
  }

  // -------------------------------------------------------------- formatting
  function isFin(x) { return typeof x === 'number' && isFinite(x); }
  function fmtMoney(v, cur) {
    if (!isFin(v)) return '—';
    const sym = (!cur || cur === 'USD') ? '$' : cur + ' ';
    const neg = v < 0 ? '−' : '';
    const a = Math.abs(v);
    if (a >= 1e9) return `${neg}${sym}${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${neg}${sym}${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e4) return `${neg}${sym}${(a / 1e3).toFixed(1)}k`;
    return `${neg}${sym}${a.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  function fmtNum(v, d) {
    if (!isFin(v)) return '—';
    return v.toLocaleString('en-US', { maximumFractionDigits: d != null ? d : 2 });
  }
  function fmtPct(v, d) {
    if (!isFin(v)) return '—';
    return (v * 100).toFixed(d != null ? d : 1) + '%';
  }
  function kpiCard(label, value, sub, cls) {
    return `<div class="kpi${cls ? ' ' + cls : ''}"><div class="kpi-label">${esc(label)}</div>`
      + `<div class="kpi-value">${value}</div>`
      + (sub ? `<div class="kpi-sub">${sub}</div>` : '') + '</div>';
  }

  // ------------------------------------------------------------------ engine
  function buildWorkingPlant() {
    const cfg = deepCopy(state.plant_cfg);
    const specs = deepCopy(state.equipment_specs);
    return TEA.newPlant(cfg, specs);
  }
  function runTEA(additionalCapex) {
    const p = buildWorkingPlant();
    TEA.calculatePurchasedCost(p);
    TEA.calculateAll(p, !!additionalCapex);
    state.tea = p; state.teaError = null; state.teaRan = true;
    return p;
  }
  function kpisOf(p) {
    return {
      name: p.cfg.plant_name || 'Plant',
      npv: p.npv, irr: p.irr, roi: p.roi, payback: p.payback_time, lcop: p.levelized_cost,
      fixed_capital: p.fixed_capital, isbl: p.isbl, working_capital: p.working_capital,
      variable_opex: p.variable_production_costs, fixed_opex: p.fixed_production_costs,
      revenue: p.revenue, purchased: p.purchased_cost,
      lifetime: p.cfg.project_lifetime, rate: p.cfg.interest_rate,
    };
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ------------------------------------------------------------ shell / nav
  const PAGES = [
    ['learn', '📚 Learn'],
    ['equip', '💰 Equipment'],
    ['builder', '🏭 Plant TEA'],
    ['sens', '📊 Sensitivity'],
    ['compare', '⚖️ Compare'],
    ['json', '💾 JSON & About'],
  ];
  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = PAGES.map(([id, label]) =>
      `<button data-page="${id}" class="${state.page === id ? 'active' : ''}">${label}</button>`).join('');
    nav.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => showPage(b.dataset.page)));
  }
  function showPage(id) {
    state.page = id;
    document.querySelectorAll('nav.tabs button').forEach((b) =>
      b.classList.toggle('active', b.dataset.page === id));
    document.querySelectorAll('.page').forEach((s) =>
      s.classList.toggle('active', s.id === 'page-' + id));
    if (id === 'learn') renderLearn();
    else if (id === 'equip') renderEquip();
    else if (id === 'builder') root.PLANT.renderBuilder();
    else if (id === 'sens') root.PLANT.renderSens();
    else if (id === 'compare') root.PLANT.renderCompare();
    else if (id === 'json') root.PLANT.renderJSON();
    window.scrollTo(0, 0);
  }
  function syncPresetBar() {
    const sel = document.getElementById('presetSel');
    sel.innerHTML = presetNames().map((n) =>
      `<option value="${esc(n)}"${n === state.preset_name ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const badge = document.getElementById('dirtyBadge');
    badge.innerHTML = state.dirty
      ? '<span class="badge dirty">● modified</span>'
      : '<span class="badge clean">✓ preset</span>';
    const eq = (state.equipment_specs || []).length;
    const prods = Object.keys((state.plant_cfg || {}).plant_products || {}).length;
    document.getElementById('plantSummary').textContent =
      `${(state.plant_cfg || {}).plant_name || ''} · ${eq} item(s) · ${prods} product(s)`;
  }

  // ------------------------------------------------------------------- Learn
  function recommendDistillation(deltaTb, heat, azeo, wimm, highb) {
    const reasons = [];
    let rec;
    if (azeo) {
      if (wimm) {
        rec = 'Azeotropic';
        reasons.push('Azeotrope present → ordinary distillation cannot cross the azeotropic composition; an entrainer is needed.');
      } else {
        rec = 'Extractive';
        reasons.push('Azeotrope / very low relative volatility → a high-boiling solvent (extractive) is usually the most robust choice.');
      }
    } else if (heat && highb) {
      rec = 'Vacuum';
      reasons.push('Heat-sensitive + high boiler → lower the pressure to lower the boiling point.');
    } else if (heat && wimm) {
      rec = 'Steam';
      reasons.push('Heat-sensitive + water-immiscible volatile → steam co-distillation below the normal boiling point.');
    } else if (deltaTb != null && deltaTb < 25) {
      rec = 'Fractional';
      reasons.push(`ΔTb ≈ ${deltaTb} °C (< 25 °C) → multi-stage fractionation with reflux is required.`);
    } else if (deltaTb != null && deltaTb >= 25) {
      rec = 'Simple';
      reasons.push(`ΔTb ≈ ${deltaTb} °C (≥ 25 °C) → a single-stage still is sufficient and cheapest.`);
    } else {
      rec = 'Fractional';
      reasons.push('Default for continuous, reasonably difficult separations.');
    }
    if ((rec === 'Simple' || rec === 'Fractional') && heat) {
      reasons.push('Note: if thermal decomposition is observed, consider Vacuum or Steam instead.');
    }
    return [rec, reasons];
  }

  const LEARN_TABS = [['types', '🎓 Types & Theory'], ['compare', '🔀 Compare'],
    ['decide', '🧭 Decision Helper'], ['trouble', '🛠️ Troubleshooting']];
  function renderLearn() {
    const tabs = document.getElementById('learnTabs');
    tabs.innerHTML = LEARN_TABS.map(([id, label]) =>
      `<button data-t="${id}" class="${state.learnTab === id ? 'active' : ''}">${label}</button>`).join('');
    tabs.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => { state.learnTab = b.dataset.t; renderLearn(); }));
    const body = document.getElementById('learnBody');
    if (state.learnTab === 'types') renderLearnTypes(body);
    else if (state.learnTab === 'compare') renderLearnCompare(body);
    else if (state.learnTab === 'decide') renderLearnDecide(body);
    else renderLearnTrouble(body);
  }
  function flowStrip(nodes) {
    let h = '<div class="flow-strip">';
    nodes.forEach((n, i) => {
      h += `<div class="flow-node">${esc(n)}</div>`;
      if (i < nodes.length - 1) h += '<div class="flow-arrow">→</div>';
    });
    return h + '</div>';
  }
  function renderLearnTypes(body) {
    const TYPES = DATA.learn.types;
    const names = Object.keys(TYPES);
    if (!TYPES[state.learnType]) state.learnType = names[0];
    let h = '<div class="typebtns">';
    for (const n of names) {
      h += `<button data-t="${esc(n)}" class="${state.learnType === n ? 'active' : ''}"><span class="ic">${esc(TYPES[n].icon)}</span>${esc(n)}</button>`;
    }
    h += '</div>';
    const d = TYPES[state.learnType];
    h += `<h2>${esc(d.icon)} ${esc(state.learnType)} Distillation</h2><p class="lede">${esc(d.tagline)}</p>`;
    h += flowStrip(DATA.learn.flow_strips[state.learnType] || []);
    h += `<p><b>Definition.</b> ${esc(d.definition)}</p><div class="grid c2"><div class="card">`;
    h += '<h3>⚙️ Principle</h3><ul class="tight">' + d.principle.map((p) => `<li>${esc(p)}</li>`).join('') + '</ul>';
    h += '<h3>🧰 Main equipment</h3>' + d.equipment.map((e) => `<span class="pill">${esc(e)}</span>`).join(' ');
    h += '<h3>📋 Working</h3><ol class="tight">' + d.working.map((w) => `<li>${esc(w)}</li>`).join('') + '</ol>';
    h += '</div><div class="card">';
    h += '<h3>🎯 Applications</h3><ul class="tight">' + d.applications.map((a) => `<li>${esc(a)}</li>`).join('') + '</ul>';
    h += '<h3>✅ Advantages</h3><ul class="tight">' + d.advantages.map((a) => `<li>${esc(a)}</li>`).join('') + '</ul>';
    h += '<h3>⚠️ Limitations</h3><ul class="tight">' + d.limitations.map((l) => `<li>${esc(l)}</li>`).join('') + '</ul>';
    h += '</div></div>';
    h += `<div class="callout"><b>🔑 Key point.</b> ${esc(d.key_point)}</div>`;
    body.innerHTML = h;
    body.querySelectorAll('.typebtns button').forEach((b) =>
      b.addEventListener('click', () => { state.learnType = b.dataset.t; renderLearn(); }));
  }
  function renderLearnCompare(body) {
    const rows = DATA.learn.comparison;
    const cols = Object.keys(rows[0]);
    let h = '<h2>Side-by-side comparison</h2><div class="card"><div style="overflow-x:auto"><table class="data"><thead><tr>';
    for (const c of cols) h += `<th>${esc(c)}</th>`;
    h += '</tr></thead><tbody>';
    for (const r of rows) {
      h += '<tr>';
      for (const c of cols) h += `<td>${esc(r[c])}</td>`;
      h += '</tr>';
    }
    h += '</tbody></table></div></div>';
    h += '<h3>Abbreviations</h3><p>' + Object.entries(DATA.learn.abbreviations)
      .map(([k, v]) => `<span class="pill"><b>${esc(k)}</b> — ${esc(v)}</span>`).join(' ') + '</p>';
    h += '<h3>General tips for all distillation systems</h3><ul class="tight">'
      + DATA.learn.tips.map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>';
    body.innerHTML = h;
  }
  function renderLearnDecide(body) {
    body.innerHTML = `
      <h2>Which distillation should I use?</h2>
      <p class="lede">Rule-based helper (boiling gap, heat sensitivity, azeotropes).</p>
      <div class="grid c2"><div class="card">
        <div class="field"><label>Boiling-point gap ΔTb (°C) — <span id="decDeltaVal">15</span></label>
          <input type="range" id="decDelta" min="0" max="120" value="15" style="width:100%"></div>
        <div class="field"><label><input type="checkbox" id="decHeat"> Heat-sensitive / thermally unstable</label></div>
        <div class="field"><label><input type="checkbox" id="decHighb"> High boiler (hard to vaporise at 1 atm)</label></div>
      </div><div class="card">
        <div class="field"><label><input type="checkbox" id="decAzeo"> Forms an azeotrope</label></div>
        <div class="field"><label><input type="checkbox" id="decWimm"> Volatile is water-immiscible</label></div>
      </div></div>
      <div id="decOut"></div>`;
    const upd = () => {
      const delta = parseInt(document.getElementById('decDelta').value, 10);
      document.getElementById('decDeltaVal').textContent = delta;
      const [rec, reasons] = recommendDistillation(delta,
        document.getElementById('decHeat').checked,
        document.getElementById('decAzeo').checked,
        document.getElementById('decWimm').checked,
        document.getElementById('decHighb').checked);
      const d = DATA.learn.types[rec];
      document.getElementById('decOut').innerHTML =
        `<div class="callout"><b>${esc(d.icon)} Recommended: ${esc(rec)} Distillation.</b><br>`
        + reasons.map((r) => `• ${esc(r)}`).join('<br>') + '</div>'
        + flowStrip(DATA.learn.flow_strips[rec] || [])
        + `<div class="btn-row"><button class="btn" id="decOpen">Open ${esc(rec)} theory →</button></div>`;
      document.getElementById('decOpen').addEventListener('click', () => {
        state.learnTab = 'types'; state.learnType = rec; renderLearn();
      });
    };
    ['decDelta', 'decHeat', 'decHighb', 'decAzeo', 'decWimm'].forEach((id) =>
      document.getElementById(id).addEventListener('input', upd));
    upd();
  }
  function renderLearnTrouble(body) {
    const TYPES = DATA.learn.types;
    const names = Object.keys(TYPES);
    let h = `<h2>Troubleshooting &amp; root cause</h2>
      <div class="field" style="max-width:320px"><label>Distillation type</label><select id="trType">`
      + names.map((n) => `<option${n === state.troubleType ? ' selected' : ''}>${esc(n)}</option>`).join('')
      + '</select></div><div id="trOut"></div>';
    h += '<h3>General tips</h3><ul class="tight">' + DATA.learn.tips.map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>';
    body.innerHTML = h;
    const upd = () => {
      const sel = document.getElementById('trType').value;
      const t = TYPES[sel] ? sel : state.troubleType;
      state.troubleType = t;
      const rows = TYPES[t].troubleshooting || [];
      document.getElementById('trOut').innerHTML = '<div class="card"><div style="overflow-x:auto"><table class="data">'
        + '<thead><tr><th>Problem / symptom</th><th>Root cause</th><th>Corrective action</th></tr></thead><tbody>'
        + rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
        + '</tbody></table></div></div>';
    };
    document.getElementById('trType').addEventListener('change', upd);
    upd();
  }

  // --------------------------------------------------------------- Equipment
  function currentCorrelationRow() {
    const key = TEA.correlationKeyFor(state.equip.category, state.equip.type || null);
    return key ? TEA.correlationRow(key) : null;
  }
  function renderEquip() {
    const body = document.getElementById('equipBody');
    const cats = TEA.listCategories();
    const E = state.equip;
    if (!cats.includes(E.category)) E.category = cats.includes('Towers') ? 'Towers' : cats[0];
    const types = TEA.listTypes(E.category);
    if (!types.includes(E.type || '')) E.type = types[0] || '';
    const row = currentCorrelationRow();
    const mats = Object.keys(DATA.material_factors);
    const years = Object.keys(DATA.cepci).map(Number).sort((a, b) => a - b);
    const is2var = row && row.form === '2-var power-law';

    let h = '<div class="grid c2"><div class="card"><h3>Correlation</h3>';
    h += `<div class="field"><label>Equipment category</label><select id="eqCat">`
      + cats.map((c) => `<option${c === E.category ? ' selected' : ''}>${esc(c)}</option>`).join('') + '</select></div>';
    h += `<div class="field"><label>Type</label><select id="eqType">`
      + types.map((t) => `<option value="${esc(t)}"${t === (E.type || '') ? ' selected' : ''}>${esc(t || '—')}</option>`).join('') + '</select></div>';
    if (row) {
      h += `<p><span class="pill">correlation: <b>${esc(row.key)}</b></span> `
        + `<span class="pill">form: ${esc(row.form)}</span> `
        + `<span class="pill">cost year: ${row.cost_year != null ? row.cost_year : '—'}</span></p>`;
      h += `<p class="small">Valid size range: s ∈ [${row.s_lower != null ? row.s_lower : '−∞'}, `
        + `${row.s_upper != null ? row.s_upper : (row.upper_parallel != null ? '∞ (parallelises above ' + row.upper_parallel + ')' : '∞]')}`
        + `${is2var ? ` · s2 ∈ [${row.s2_lower}, ${row.s2_upper}]` : ''}`
        + `${row.unit ? ` · unit: ${esc(row.unit)}` : ''}</p>`;
    } else {
      h += '<div class="warn-callout">No correlation matches this category/type pair. Costs below need a quoted <b>purchased cost</b> instead.</div>';
    }
    h += `<div class="grid c2">
      <div class="field"><label>Size parameter s</label><input type="number" id="eqParam" step="any" value="${esc(String(E.param))}"></div>
      ${is2var ? `<div class="field"><label>Second size s2</label><input type="number" id="eqS2" step="any" value="${esc(String(E.s2 != null ? E.s2 : (row.s2_lower != null ? row.s2_lower : 1)))}"></div>` : ''}
    </div><div class="grid c2">
      <div class="field"><label>Material</label><select id="eqMat">`
      + mats.map((m) => `<option${m === E.material ? ' selected' : ''}>${esc(m)}</option>`).join('') + '</select></div>'
      + `<div class="field"><label>Process type (install factors)</label><select id="eqPT">`
      + ['Solids', 'Fluids', 'Mixed', 'Electrical'].map((t) => `<option${t === E.process_type ? ' selected' : ''}>${t}</option>`).join('') + '</select></div>'
      + '</div><div class="grid c2">'
      + `<div class="field"><label>Target year (CEPCI)</label><select id="eqTY">`
      + years.map((y) => `<option${y === E.target_year ? ' selected' : ''}>${y}</option>`).join('') + '</select></div>'
      + `<div class="field"><label>Identical units</label><input type="number" id="eqNU" min="1" step="1" value="${esc(String(E.num_units))}"></div>`
      + '</div>';
    h += '</div><div><div id="eqKpis"></div><div class="card"><div id="eqCurve"></div></div></div></div>';
    h += `<details class="expander"><summary>📖 Correlation database (${DATA.correlations.length} rows)</summary><div class="body">
      <div class="field" style="max-width:420px"><label>Filter (category / type / key)</label><input id="eqFilter" placeholder="e.g. tower"></div>
      <div style="overflow-x:auto;max-height:420px;overflow-y:auto"><table class="data" id="eqDbTable"></table></div>
      <div class="btn-row"><button class="btn sm" id="eqCsv">⬇️ Download cost_correlations.csv</button></div>
    </div></details>`;
    body.innerHTML = h;

    const refresh = () => {
      E.category = document.getElementById('eqCat').value;
      E.type = document.getElementById('eqType').value || '';
      E.param = parseFloat(document.getElementById('eqParam').value);
      const s2el = document.getElementById('eqS2');
      E.s2 = s2el ? parseFloat(s2el.value) : null;
      E.material = document.getElementById('eqMat').value;
      E.process_type = document.getElementById('eqPT').value;
      E.target_year = parseInt(document.getElementById('eqTY').value, 10);
      E.num_units = parseInt(document.getElementById('eqNU').value, 10) || 1;
      renderEquipResults();
    };
    document.getElementById('eqCat').addEventListener('change', () => {
      E.category = document.getElementById('eqCat').value;
      E.type = (TEA.listTypes(E.category)[0]) || '';
      renderEquip();
    });
    document.getElementById('eqType').addEventListener('change', renderEquip);
    ['eqParam', 'eqS2', 'eqMat', 'eqPT', 'eqTY', 'eqNU'].forEach((id) => {
      const elx = document.getElementById(id);
      if (elx) elx.addEventListener('input', refresh);
    });
    const renderDbTable = () => {
      const q = (document.getElementById('eqFilter').value || '').toLowerCase();
      const cols = ['key', 'category', 'type', 's_lower', 's_upper', 'form', 'cost_year', 'default_material'];
      let rows = DATA.correlations;
      if (q) rows = rows.filter((r) => cols.some((c) => String(r[c] != null ? r[c] : '').toLowerCase().includes(q)));
      let t = '<thead><tr>' + cols.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
      for (const r of rows.slice(0, 400)) {
        t += '<tr>' + cols.map((c) => `<td>${esc(r[c] != null ? r[c] : '')}</td>`).join('') + '</tr>';
      }
      t += '</tbody>';
      document.getElementById('eqDbTable').innerHTML = t
        + (rows.length > 400 ? `<caption class="small">showing 400 of ${rows.length} matches</caption>` : '');
    };
    document.getElementById('eqFilter').addEventListener('input', renderDbTable);
    renderDbTable();
    document.getElementById('eqCsv').addEventListener('click', () => {
      const cols = Object.keys(DATA.correlations[0]);
      const q2 = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      const csv = cols.join(',') + '\n' + DATA.correlations.map((r) => cols.map((c) => q2(r[c])).join(',')).join('\n');
      download('cost_correlations.csv', csv, 'text/csv');
    });
    renderEquipResults();
  }
  function renderEquipResults() {
    const E = state.equip;
    const box = document.getElementById('eqKpis');
    const curveBox = document.getElementById('eqCurve');
    if (!box) return;
    const row = currentCorrelationRow();
    let eq = null, err = null;
    try {
      eq = TEA.costEquipment({
        name: 'Unit', param: (row && row.form === '2-var power-law') ? [E.param, E.s2] : E.param,
        process_type: E.process_type, category: E.category, type: E.type || null,
        material: E.material, target_year: E.target_year,
        num_units: E.num_units > 1 ? E.num_units : null,
      });
    } catch (e) { err = e.message; }
    if (err) {
      box.innerHTML = `<div class="err-callout"><b>Cannot cost:</b> ${esc(err)}</div>`;
    } else {
      const inst = eq.purchased_cost ? eq.direct_cost / eq.purchased_cost : 0;
      box.innerHTML = '<div class="grid c2">'
        + kpiCard('Purchased cost', esc(fmtMoney(eq.purchased_cost)), `${E.target_year} basis · ${eq.num_units || 1} unit(s)`)
        + kpiCard('Direct (installed) cost', esc(fmtMoney(eq.direct_cost)), `×${inst.toFixed(2)} install factor`)
        + '</div>';
    }
    // Cost curve across the valid range.
    if (!row || row.s_lower == null || row.s_upper == null || !(row.s_lower > 0) || !(row.s_upper > row.s_lower)) {
      curveBox.innerHTML = '';
      return;
    }
    const n = 60, lo = row.s_lower, hi = row.s_upper;
    const ss = [];
    for (let i = 0; i < n; i++) ss.push(lo * Math.pow(hi / lo, i / (n - 1)));
    let f;
    try { f = TEA.cepciFactor(row.cost_year, E.target_year); }
    catch (e) { curveBox.innerHTML = `<div class="warn-callout">No CEPCI coverage for cost year ${row.cost_year} → ${E.target_year}; curve hidden.</div>`; return; }
    const is2 = row.form === '2-var power-law';
    const s2fix = is2 ? (isFin(E.s2) ? E.s2 : (row.s2_lower != null ? row.s2_lower : 1)) : null;
    const costs = ss.map((s) => {
      try {
        const [p] = TEA.evaluateCorrelation(row.key, s, s2fix);
        return p * f;
      } catch (e) { return NaN; }
    });
    C.line(curveBox, {
      title: `Purchased cost vs size (${E.target_year} $)${is2 ? ` — s2 fixed at ${s2fix}` : ''}`,
      series: [{ label: 'Purchased cost', x: ss, y: costs }],
      xlabel: 'Size s (log scale approx)', ylabel: 'USD',
      xfmt: (v) => C.fmtShort(v), yfmt: (v) => fmtMoney(v),
    });
  }

  // ------------------------------------------------------------------ export
  root.APP = {
    state, presetNames, resetToPreset, markDirty, syncPresetBar, showPage,
    buildWorkingPlant, runTEA, kpisOf, download,
    fmtMoney, fmtNum, fmtPct, isFin, kpiCard, recommendDistillation,
  };

  // --------------------------------------------------------------------- boot
  document.addEventListener('DOMContentLoaded', () => {
    resetToPreset(presetNames()[0]);
    renderNav();
    document.getElementById('presetSel').addEventListener('change', (e) => {
      resetToPreset(e.target.value);
      showPage(state.page);
    });
    showPage('learn');
  });
})(typeof window !== 'undefined' ? window : globalThis);
