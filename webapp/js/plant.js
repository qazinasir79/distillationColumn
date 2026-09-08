/* Static TEA Studio — Builder / Sensitivity / Compare / JSON pages. */
(function (root) {
  'use strict';
  const TEA = root.TEA, DATA = root.TEA_DATA, C = root.CHARTS;
  const APP = root.APP;
  const esc = C.esc;

  const num = (v, d) => { const f = parseFloat(v); return isFinite(f) ? f : d; };
  const int = (v, d) => { const f = parseInt(v, 10); return isFinite(f) ? f : d; };
  function locFactorFor(country, region) {
    const LF = DATA.loc_factors;
    const lf = LF[country];
    if (lf == null) return NaN;
    if (typeof lf === 'object') return lf[region] != null ? lf[region] : NaN;
    return lf;
  }
  function regionsForCountry(country) {
    const lf = DATA.loc_factors[country];
    if (lf != null && typeof lf === 'object') return Object.keys(lf);
    return ['—'];
  }

  // ================================================================= Builder
  function renderBuilder() {
    const cfg = APP.state.plant_cfg;
    const specs = APP.state.equipment_specs;
    const body = document.getElementById('builderBody');
    const countries = Object.keys(DATA.loc_factors);

    let h = `<details class="expander" open><summary>⚙️ Plant basics &amp; finance</summary><div class="body"><div class="grid c4">`;
    h += `<div>
      <div class="field"><label>Plant name</label><input id="bName" value="${esc(cfg.plant_name || '')}"></div>
      <div class="field"><label>Process type</label><select id="bPT">${['Solids', 'Fluids', 'Mixed'].map((t) => `<option${t === cfg.process_type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Production mode</label><select id="bProd">${['continuous', 'batch'].map((t) => `<option${t === (cfg.production_type || 'continuous') ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    </div><div>
      <div class="field"><label>Country</label><select id="bCountry">${countries.map((c) => `<option${c === cfg.country ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label>Region</label><select id="bRegion"></select></div>
      <div class="small" id="bLocCap"></div>
    </div><div>
      <div class="field"><label>Interest / discount rate</label><input type="number" id="bRate" step="0.005" min="0" max="0.3" value="${esc(String(cfg.interest_rate != null ? cfg.interest_rate : 0.09))}"></div>
      <div class="field"><label>Project lifetime (years)</label><input type="number" id="bLife" step="1" min="5" max="40" value="${esc(String(cfg.project_lifetime != null ? cfg.project_lifetime : 20))}"></div>
      <div class="field"><label>Plant utilisation</label><input type="number" id="bUtil" step="0.01" min="0.1" max="1" value="${esc(String(cfg.plant_utilization != null ? cfg.plant_utilization : 0.95))}"></div>
    </div><div>
      <div class="field"><label>Tax rate</label><input type="number" id="bTax" step="0.01" min="0" max="0.5" value="${esc(String(cfg.tax_rate != null ? cfg.tax_rate : 0))}"></div>
      <div class="field"><label>Operator hourly rate</label><input type="number" id="bOpRate" step="1" min="5" max="150" value="${esc(String(currentOpRate()))}"></div>
      <div class="field"><label><input type="checkbox" id="bAddCap"> Include additional CAPEX in ROI/payback</label></div>
    </div></div></div></details>`;

    h += `<details class="expander" open><summary>🧰 Equipment (<span id="bEqN">${specs.length}</span> items) — sized &amp; costed live</summary><div class="body">
      <p class="small">Edit cells directly (size accepts <span class="mono">s</span> or <span class="mono">s, s2</span> for two-parameter correlations). Category/Type must match the database — see the Equipment page for valid pairs.</p>
      <div style="overflow-x:auto"><table class="data" id="bEqTable"></table></div>
      <div class="btn-row">
        <button class="btn sm" id="bEqAdd">＋ Add row</button>
        <select id="bKit" style="max-width:220px"><option value="">＋ Quick-add…</option></select>
        <button class="btn sm" id="bKitAdd">Add</button>
      </div>
      <p class="small">Tip: costs use the plant's process type for installation factors. Trays: set Units = tray count (size = column diameter).</p>
      <div id="bEqPrev"></div>
    </div></details>`;

    h += `<div class="grid c2">
      <details class="expander" open><summary>📦 Products (production/day · price)</summary><div class="body">
        <div style="overflow-x:auto"><table class="data" id="bProdTable"></table></div>
        <div class="btn-row"><button class="btn sm" id="bProdAdd">＋ Add product</button></div>
        <p class="small">The <b>first</b> product is the main product (LCOP denominator); the rest earn side revenue.</p>
      </div></details>
      <details class="expander" open><summary>🔌 Variable OPEX (consumption/day · price)</summary><div class="body">
        <div style="overflow-x:auto"><table class="data" id="bOpexTable"></table></div>
        <div class="btn-row"><button class="btn sm" id="bOpexAdd">＋ Add input</button></div>
      </div></details>
    </div>`;

    h += `<details class="expander"><summary>🔧 Advanced — depreciation, ramps, capital</summary><div class="body"><div class="grid c3">
      <div>
        <div class="field"><label>Depreciation method</label><select id="bDepM">${['straight_line', 'declining_balance', 'macrs'].map((m) => `<option value="${m}"${m === ((cfg.depreciation || {}).method || 'straight_line') ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Depreciation life (blank = auto: min(15, life−2))</label><input id="bDepL" placeholder="auto" value="${esc((cfg.depreciation || {}).life != null ? String(cfg.depreciation.life) : '')}"></div>
        <div class="field"><label>Service start year index</label><input type="number" id="bDepS" step="1" min="0" value="${esc(String((cfg.depreciation || {}).service_start_year != null ? cfg.depreciation.service_start_year : 2))}"></div>
        <div class="field"><label>MACRS class (macrs only)</label><input type="number" id="bDepC" step="1" min="1" max="20" value="${esc(String((cfg.depreciation || {}).macrs_class != null ? cfg.depreciation.macrs_class : 7))}"></div>
      </div><div>
        <div class="field"><label>CAPEX ramp (fractions, sum = 1; blank = 0.3, 0.6, 0.1)</label><input id="bCapexRamp" class="mono" placeholder="0.3, 0.6, 0.1" value="${esc((cfg.capex_ramp || []).join(', '))}"></div>
        <div class="field"><label>Production ramp (0–1; blank = 0, 0, 0.4, 0.8)</label><input id="bProdRamp" class="mono" placeholder="0, 0, 0.4, 0.8" value="${esc((cfg.production_ramp || []).join(', '))}"></div>
        <div class="field"><label>Working capital override (blank = auto 15% of fixed capital)</label><input id="bWC" placeholder="auto" value="${esc(cfg.working_capital != null ? String(cfg.working_capital) : '')}"></div>
      </div><div>
        <div class="field"><label>Currency</label><input id="bCur" value="${esc(cfg.currency || 'USD')}"></div>
        <div class="field"><label>Exchange rate (× equipment costs)</label><input type="number" id="bXR" step="any" value="${esc(String(cfg.exchange_rate != null ? cfg.exchange_rate : 1))}"></div>
        <div class="field"><label>Additional CAPEX years (1-indexed, comma list)</label><input id="bAddY" class="mono" placeholder="" value="${esc((cfg.additional_capex_years || []).join(', '))}"></div>
        <div class="field"><label>Additional CAPEX costs (comma list)</label><input id="bAddC" class="mono" placeholder="" value="${esc((cfg.additional_capex_cost || []).join(', '))}"></div>
      </div>
    </div></div></details>`;

    h += `<div class="btn-row"><button class="btn primary" id="bRun" style="flex:1">🚀 Run TEA</button>
      <button class="btn" id="bReset">↺ Reset to preset</button></div>
      <div id="staleBanner"></div><div id="bResults"></div>`;
    body.innerHTML = h;

    // ---- wire basics ----
    const changed = () => { APP.markDirty(); showStale(); };
    document.getElementById('bName').addEventListener('input', (e) => { cfg.plant_name = e.target.value; changed(); });
    document.getElementById('bPT').addEventListener('change', (e) => { cfg.process_type = e.target.value; changed(); renderEquipPreview(); });
    document.getElementById('bProd').addEventListener('change', (e) => { cfg.production_type = e.target.value; changed(); });
    const regionSel = document.getElementById('bRegion');
    const fillRegions = () => {
      const rs = regionsForCountry(cfg.country);
      regionSel.innerHTML = rs.map((r) => `<option${r === (cfg.region || rs[0]) ? ' selected' : ''}>${esc(r)}</option>`).join('');
      if (rs[0] === '—') cfg.region = '—';
      else if (!rs.includes(cfg.region)) cfg.region = rs[0];
      document.getElementById('bLocCap').innerHTML =
        `Location factor ≈ <b>${APP.isFin(locFactorFor(cfg.country, cfg.region)) ? locFactorFor(cfg.country, cfg.region).toFixed(2) : 'n/a'}</b>`;
    };
    document.getElementById('bCountry').addEventListener('change', (e) => { cfg.country = e.target.value; fillRegions(); changed(); renderEquipPreview(); });
    regionSel.addEventListener('change', (e) => { if (e.target.value !== '—') cfg.region = e.target.value; fillRegions(); changed(); });
    fillRegions();
    document.getElementById('bRate').addEventListener('input', (e) => { cfg.interest_rate = num(e.target.value, cfg.interest_rate); changed(); });
    document.getElementById('bLife').addEventListener('input', (e) => { cfg.project_lifetime = int(e.target.value, cfg.project_lifetime); changed(); });
    document.getElementById('bUtil').addEventListener('input', (e) => { cfg.plant_utilization = num(e.target.value, cfg.plant_utilization); changed(); });
    document.getElementById('bTax').addEventListener('input', (e) => { cfg.tax_rate = num(e.target.value, cfg.tax_rate); changed(); });
    document.getElementById('bOpRate').addEventListener('input', (e) => {
      const v = num(e.target.value, currentOpRate());
      const cur = cfg.operator_hourly_rate;
      if (cur != null && typeof cur === 'object') cfg.operator_hourly_rate = Object.assign({}, cur, { rate: v });
      else cfg.operator_hourly_rate = v;
      changed();
    });
    // ---- advanced ----
    const depGet = () => { cfg.depreciation = cfg.depreciation || {}; return cfg.depreciation; };
    document.getElementById('bDepM').addEventListener('change', (e) => { depGet().method = e.target.value; changed(); });
    document.getElementById('bDepL').addEventListener('input', (e) => {
      const t = e.target.value.trim();
      if (t === '') { if (cfg.depreciation) delete cfg.depreciation.life; }
      else depGet().life = int(t, 15);
      changed();
    });
    document.getElementById('bDepS').addEventListener('input', (e) => { depGet().service_start_year = int(e.target.value, 2); changed(); });
    document.getElementById('bDepC').addEventListener('input', (e) => { depGet().macrs_class = int(e.target.value, 7); changed(); });
    const parseList = (t) => t.split(',').map((x) => parseFloat(x.trim())).filter((x) => isFinite(x));
    document.getElementById('bCapexRamp').addEventListener('input', (e) => {
      const t = e.target.value.trim(); cfg.capex_ramp = t === '' ? null : parseList(t); changed();
    });
    document.getElementById('bProdRamp').addEventListener('input', (e) => {
      const t = e.target.value.trim(); cfg.production_ramp = t === '' ? null : parseList(t); changed();
    });
    document.getElementById('bWC').addEventListener('input', (e) => {
      const t = e.target.value.trim(); cfg.working_capital = t === '' ? null : num(t, null); changed();
    });
    document.getElementById('bCur').addEventListener('input', (e) => { cfg.currency = e.target.value || 'USD'; changed(); });
    document.getElementById('bXR').addEventListener('input', (e) => { cfg.exchange_rate = num(e.target.value, 1); changed(); });
    document.getElementById('bAddY').addEventListener('input', (e) => {
      const t = e.target.value.trim(); cfg.additional_capex_years = t === '' ? null : parseList(t).map(Math.trunc); changed();
    });
    document.getElementById('bAddC').addEventListener('input', (e) => {
      const t = e.target.value.trim(); cfg.additional_capex_cost = t === '' ? null : parseList(t); changed();
    });

    // ---- equipment table ----
    renderEquipTable();
    const KIT = {
      'Fractionating column': { name: 'T-1 Column', param: 8.0, category: 'Towers', type: 'Tray and packed' },
      'Kettle reboiler': { name: 'E-1 Reboiler', param: 60.0, category: 'Heat exchangers', type: 'Kettle reboiler' },
      'Condenser': { name: 'E-2 Condenser', param: 45.0, category: 'Heat exchangers', type: 'Fixed tube' },
      'Reflux drum': { name: 'V-1 Reflux drum', param: 6.0, category: 'Pressure vessels', type: 'Horizontal' },
      'Reflux pump': { name: 'P-1 Pump', param: 15.0, category: 'Pumps', type: 'Centrifugal' },
      'Sieve trays ×20': { name: 'Trays', param: 1.2, category: 'Trays', type: 'Sieve', num_units: 20 },
      'Vacuum ejector': { name: 'J-1 Ejector', param: 0.02, category: 'Ejectors', type: 'Two-stage, including condenser and piping' },
    };
    document.getElementById('bKit').innerHTML = '<option value="">＋ Quick-add…</option>'
      + Object.keys(KIT).map((k) => `<option>${esc(k)}</option>`).join('');
    document.getElementById('bEqAdd').addEventListener('click', () => {
      specs.push({ name: `EQ-${specs.length + 1}`, param: 1, category: 'Towers', type: 'Tray and packed', material: 'Carbon steel', process_type: cfg.process_type, target_year: 2024 });
      changed(); renderEquipTable(); renderEquipPreview();
    });
    document.getElementById('bKitAdd').addEventListener('click', () => {
      const k = document.getElementById('bKit').value;
      if (!k || !KIT[k]) return;
      const add = Object.assign({ material: 'Carbon steel', process_type: cfg.process_type, target_year: 2024 }, KIT[k]);
      specs.push(add);
      document.getElementById('bKit').value = '';
      changed(); renderEquipTable(); renderEquipPreview();
    });
    renderEquipPreview();
    // ---- products / opex tables ----
    renderProdTable(); renderOpexTable();
    document.getElementById('bProdAdd').addEventListener('click', () => {
      cfg.plant_products = cfg.plant_products || {};
      let n = 'product_' + (Object.keys(cfg.plant_products).length + 1);
      cfg.plant_products[n] = { production: 0, price: 0 };
      changed(); renderProdTable();
    });
    document.getElementById('bOpexAdd').addEventListener('click', () => {
      cfg.variable_opex_inputs = cfg.variable_opex_inputs || {};
      let n = 'input_' + (Object.keys(cfg.variable_opex_inputs).length + 1);
      cfg.variable_opex_inputs[n] = { consumption: 0, price: 0 };
      changed(); renderOpexTable();
    });
    // ---- run / reset ----
    document.getElementById('bRun').addEventListener('click', () => {
      const addCap = document.getElementById('bAddCap').checked;
      try {
        if (!specs.length) throw new Error('No equipment defined — add at least one equipment item (or ↺ reset to the preset).');
        if (!Object.keys(cfg.plant_products || {}).length) throw new Error('No products defined — add at least one product (the engine needs a production profile).');
        APP.runTEA(addCap);
        APP.state.addCap = addCap;
        document.getElementById('staleBanner').innerHTML = '';
        renderResults();
      } catch (e) {
        APP.state.tea = null; APP.state.teaError = e.message; APP.state.teaRan = true;
        document.getElementById('staleBanner').innerHTML = '';
        renderResults();
      }
    });
    document.getElementById('bReset').addEventListener('click', () => {
      APP.resetToPreset(APP.state.preset_name);
      renderBuilder();
    });
    if (APP.state.teaRan) renderResults();
  }
  function currentOpRate() {
    const cur = APP.state.plant_cfg.operator_hourly_rate;
    if (cur != null && typeof cur === 'object') return cur.rate != null ? cur.rate : 38;
    return cur != null ? cur : 38;
  }
  function showStale() {
    const b = document.getElementById('staleBanner');
    if (b && APP.state.teaRan) b.innerHTML = '<div class="warn-callout">⚠️ Inputs changed — press <b>🚀 Run TEA</b> to refresh results.</div>';
  }
  function parseParam(t) {
    if (typeof t === 'number') return t;
    const parts = String(t).split(',').map((x) => parseFloat(x.trim())).filter((x) => isFinite(x));
    if (!parts.length) return 0;
    return parts.length === 1 ? parts[0] : parts;
  }

  function renderEquipTable() {
    const cfg = APP.state.plant_cfg;
    const specs = APP.state.equipment_specs;
    const t = document.getElementById('bEqTable');
    if (!t) return;
    document.getElementById('bEqN').textContent = specs.length;
    const cats = TEA.listCategories();
    const mats = Object.keys(DATA.material_factors);
    const years = Object.keys(DATA.cepci).map(Number).sort((a, b) => a - b);
    let h = '<thead><tr><th>Tag</th><th>Category</th><th>Type</th><th class="num">Size (s)</th>'
      + '<th class="num">Units</th><th>Material</th><th class="num">Target yr</th><th></th></tr></thead><tbody>';
    specs.forEach((s, i) => {
      const types = TEA.listTypes(s.category);
      const pstr = Array.isArray(s.param) ? s.param.join(', ') : String(s.param != null ? s.param : '');
      h += `<tr>
        <td><input data-i="${i}" data-f="name" value="${esc(s.name || '')}"></td>
        <td><select data-i="${i}" data-f="category">${cats.map((c) => `<option${c === s.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></td>
        <td><select data-i="${i}" data-f="type">${types.map((x) => `<option value="${esc(x)}"${x === (s.type || '') ? ' selected' : ''}>${esc(x || '—')}</option>`).join('')}</select></td>
        <td><input data-i="${i}" data-f="param" class="mono" value="${esc(pstr)}" style="text-align:right"></td>
        <td><input data-i="${i}" data-f="num_units" type="number" min="1" step="1" value="${esc(String(s.num_units != null ? s.num_units : 1))}" style="text-align:right"></td>
        <td><select data-i="${i}" data-f="material">${mats.map((m) => `<option${m === (s.material || 'Carbon steel') ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select></td>
        <td><select data-i="${i}" data-f="target_year">${years.map((y) => `<option${y === (s.target_year || 2024) ? ' selected' : ''}>${y}</option>`).join('')}</select></td>
        <td><button class="btn sm danger" data-del="${i}">✕</button></td></tr>`;
    });
    t.innerHTML = h + '</tbody>';
    t.querySelectorAll('input,select').forEach((elx) => {
      elx.addEventListener('input', () => {
        const i = parseInt(elx.dataset.i, 10), f = elx.dataset.f;
        const s = specs[i];
        if (f === 'param') s[f] = parseParam(elx.value);
        else if (f === 'num_units') { const v = int(elx.value, 1); s[f] = v > 1 ? v : null; }
        else if (f === 'target_year') s[f] = int(elx.value, 2024);
        else if (f === 'type') s[f] = elx.value || null;
        else s[f] = elx.value;
        if (f === 'category') {
          const ts = TEA.listTypes(s.category);
          s.type = ts.includes(s.type || '') ? s.type : (ts[0] || null);
          renderEquipTable(); // refresh type options
        }
        s.process_type = cfg.process_type;
        APP.markDirty(); showStale(); renderEquipPreview();
      });
    });
    t.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', () => {
        specs.splice(parseInt(b.dataset.del, 10), 1);
        APP.markDirty(); showStale(); renderEquipTable(); renderEquipPreview();
      });
    });
  }
  function fullSpec(s, cfg) {
    const o = Object.assign({}, s);
    o.process_type = cfg.process_type;
    if (o.target_year == null) o.target_year = 2024;
    return o;
  }
  function renderEquipPreview() {
    const box = document.getElementById('bEqPrev');
    if (!box) return;
    const cfg = APP.state.plant_cfg;
    const specs = APP.state.equipment_specs;
    const rows = [];
    const errs = [];
    specs.forEach((s, i) => {
      try {
        const e = TEA.costEquipment(fullSpec(s, cfg));
        rows.push(e);
      } catch (e) { errs.push(`#${i + 1} ${s.name || ''}: ${e.message}`); }
    });
    if (errs.length) {
      box.innerHTML = errs.map((e) => `<div class="err-callout">Equipment error — ${esc(e)}</div>`).join('');
      return;
    }
    if (!rows.length) { box.innerHTML = '<p class="small">No equipment yet.</p>'; return; }
    const cur = cfg.currency || 'USD';
    let h = '<div class="grid c2"><div style="overflow-x:auto"><table class="data"><thead><tr>'
      + '<th>Tag</th><th class="num">Purchased</th><th class="num">Direct</th><th class="num">Units</th><th>Material</th></tr></thead><tbody>';
    for (const e of rows) {
      h += `<tr><td>${esc(e.name)}</td><td class="num">${esc(APP.fmtMoney(e.purchased_cost, cur))}</td>`
        + `<td class="num">${esc(APP.fmtMoney(e.direct_cost, cur))}</td><td class="num">${e.num_units || 1}</td><td>${esc(e.material)}</td></tr>`;
    }
    h += '</tbody></table></div><div class="grid c2">'
      + APP.kpiCard('Σ Purchased', esc(APP.fmtMoney(rows.reduce((a, e) => a + e.purchased_cost, 0), cur)))
      + APP.kpiCard('Σ Direct', esc(APP.fmtMoney(rows.reduce((a, e) => a + e.direct_cost, 0), cur)))
      + '</div></div>';
    box.innerHTML = h;
  }
  function renderProdTable() {
    const t = document.getElementById('bProdTable');
    if (!t) return;
    const prods = APP.state.plant_cfg.plant_products || {};
    const keys = Object.keys(prods);
    let h = '<thead><tr><th>Product</th><th class="num">Production / day</th><th class="num">Price</th><th></th></tr></thead><tbody>';
    keys.forEach((k) => {
      const v = prods[k] || {};
      h += `<tr><td><input data-k="${esc(k)}" data-f="name" value="${esc(k)}"></td>`
        + `<td><input data-k="${esc(k)}" data-f="production" type="number" step="any" value="${esc(String(v.production != null ? v.production : 0))}" style="text-align:right"></td>`
        + `<td><input data-k="${esc(k)}" data-f="price" type="number" step="any" value="${esc(String(v.price != null ? v.price : 0))}" style="text-align:right"></td>`
        + `<td><button class="btn sm danger" data-del="${esc(k)}">✕</button></td></tr>`;
    });
    t.innerHTML = h + '</tbody>';
    t.querySelectorAll('input').forEach((elx) => {
      elx.addEventListener('input', () => {
        const old = elx.dataset.k, f = elx.dataset.f;
        if (f === 'name') {
          const nk = elx.value.trim();
          if (nk && nk !== old && prods[nk] == null) {
            const order = Object.keys(prods);
            const nv = {};
            for (const kk of order) nv[kk === old ? nk : kk] = prods[kk];
            APP.state.plant_cfg.plant_products = nv;
            elx.dataset.k = nk;
          }
        } else {
          (prods[old] || (prods[old] = {}))[f] = num(elx.value, 0);
        }
        APP.markDirty(); showStale();
      });
    });
    t.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', () => {
        delete APP.state.plant_cfg.plant_products[b.dataset.del];
        APP.markDirty(); showStale(); renderProdTable();
      });
    });
  }
  function renderOpexTable() {
    const t = document.getElementById('bOpexTable');
    if (!t) return;
    const ins = APP.state.plant_cfg.variable_opex_inputs || {};
    const keys = Object.keys(ins);
    let h = '<thead><tr><th>Input</th><th class="num">Consumption / day</th><th class="num">Price</th><th></th></tr></thead><tbody>';
    keys.forEach((k) => {
      const v = ins[k] || {};
      h += `<tr><td><input data-k="${esc(k)}" data-f="name" value="${esc(k)}"></td>`
        + `<td><input data-k="${esc(k)}" data-f="consumption" type="number" step="any" value="${esc(String(v.consumption != null ? v.consumption : 0))}" style="text-align:right"></td>`
        + `<td><input data-k="${esc(k)}" data-f="price" type="number" step="any" value="${esc(String(v.price != null ? v.price : 0))}" style="text-align:right"></td>`
        + `<td><button class="btn sm danger" data-del="${esc(k)}">✕</button></td></tr>`;
    });
    t.innerHTML = h + '</tbody>';
    t.querySelectorAll('input').forEach((elx) => {
      elx.addEventListener('input', () => {
        const old = elx.dataset.k, f = elx.dataset.f;
        if (f === 'name') {
          const nk = elx.value.trim();
          if (nk && nk !== old && ins[nk] == null) {
            const order = Object.keys(ins);
            const nv = {};
            for (const kk of order) nv[kk === old ? nk : kk] = ins[kk];
            APP.state.plant_cfg.variable_opex_inputs = nv;
            elx.dataset.k = nk;
          }
        } else {
          (ins[old] || (ins[old] = {}))[f] = num(elx.value, 0);
        }
        APP.markDirty(); showStale();
      });
    });
    t.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', () => {
        delete APP.state.plant_cfg.variable_opex_inputs[b.dataset.del];
        APP.markDirty(); showStale(); renderOpexTable();
      });
    });
  }

  function renderResults() {
    const box = document.getElementById('bResults');
    if (!box) return;
    if (APP.state.teaError || !APP.state.tea) {
      box.innerHTML = `<div class="err-callout"><b>TEA calculation failed:</b> ${esc(APP.state.teaError || 'unknown error')}</div>`;
      return;
    }
    const p = APP.state.tea;
    const cfg = p.cfg;
    const cur = cfg.currency || 'USD';
    const k = APP.kpisOf(p);
    const good = (v) => (APP.isFin(v) && v > 0 ? 'good' : (APP.isFin(v) && v < 0 ? 'bad' : ''));
    let h = `<hr><h2>Results — ${esc(cfg.plant_name || 'Plant')}</h2>`;
    if (p.warnings.length) h += p.warnings.map((w) => `<div class="warn-callout">⚠️ ${esc(w)}</div>`).join('');
    h += '<div class="grid kpi5">'
      + APP.kpiCard('NPV', esc(APP.fmtMoney(k.npv, cur)), `@ ${(cfg.interest_rate * 100).toFixed(1)}% · ${cfg.project_lifetime} yr`, good(k.npv))
      + APP.kpiCard('IRR', APP.isFin(k.irr) ? esc((k.irr * 100).toFixed(1) + '%') : '—', 'internal rate of return', good(k.irr))
      + APP.kpiCard('ROI', APP.isFin(k.roi) ? esc(k.roi.toFixed(0) + '%') : '—', 'return on investment', good(k.roi))
      + APP.kpiCard('Payback', APP.isFin(k.payback) ? esc(k.payback.toFixed(1) + ' yr') : '—', 'break-even time')
      + APP.kpiCard('LCOP', APP.isFin(k.lcop) ? esc(`${cur === 'USD' ? '$' : cur + ' '}${k.lcop.toFixed(3)}/unit`) : '—', 'levelised cost of product')
      + '</div><div class="grid kpi4" style="margin-top:12px">'
      + APP.kpiCard('Fixed capital', esc(APP.fmtMoney(k.fixed_capital, cur)), `ISBL ${esc(APP.fmtMoney(k.isbl, cur))}`)
      + APP.kpiCard('Working capital', esc(APP.fmtMoney(k.working_capital, cur)))
      + APP.kpiCard('Variable OPEX/yr', esc(APP.fmtMoney(k.variable_opex, cur)))
      + APP.kpiCard('Fixed OPEX/yr', esc(APP.fmtMoney(k.fixed_opex, cur)))
      + '</div>';
    h += `<div class="subtabs" id="resTabs">
        <button data-t="cost" class="active">💵 Cost breakdowns</button>
        <button data-t="cf">📈 Cash flow</button>
        <button data-t="det">🧾 Details &amp; export</button></div><div id="resBody"></div>`;
    box.innerHTML = h;
    box.querySelectorAll('#resTabs button').forEach((b) =>
      b.addEventListener('click', () => {
        box.querySelectorAll('#resTabs button').forEach((x) => x.classList.toggle('active', x === b));
        renderResTab(b.dataset.t);
      }));
    renderResTab('cost');
  }
  function renderResTab(t) {
    const box = document.getElementById('resBody');
    const p = APP.state.tea;
    const cur = p.cfg.currency || 'USD';
    const M = (v) => APP.fmtMoney(v, cur);
    if (t === 'cost') {
      box.innerHTML = `<div class="grid c2">
        <div class="card"><div id="rcDirect"></div></div>
        <div class="card"><div id="rcCap"></div></div>
        <div class="card"><div id="rcVar"></div></div>
        <div class="card"><div id="rcFix"></div></div>
        <div class="card"><div id="rcLcop"></div></div>
        <div class="card"><div id="rcRev"></div></div></div>`;
      C.barH(document.getElementById('rcDirect'), {
        title: 'Direct equipment costs', labels: p.equipment.map((e) => e.name),
        values: p.equipment.map((e) => e.direct_cost), xfmt: M, tipfmt: M,
      });
      C.donut(document.getElementById('rcCap'), {
        title: 'Fixed capital', labels: ['ISBL', 'OSBL', 'Design & engineering', 'Contingency'],
        values: [p.isbl, p.osbl, p.dne, p.contigency], tipfmt: M,
        centerTop: M(p.fixed_capital), centerBottom: 'fixed capital',
      });
      const vk = Object.keys(p.variable_opex_breakdown);
      C.barH(document.getElementById('rcVar'), {
        title: 'Variable OPEX (per year)', labels: vk, values: vk.map((k) => p.variable_opex_breakdown[k]),
        xfmt: M, tipfmt: M, empty: 'No variable inputs',
      });
      const fixRows = [
        ['Operating labour', p.operating_labor_costs], ['Supervision', p.supervision_costs],
        ['Direct salary overhead', p.direct_salary_overhead], ['Laboratory', p.laboratory_charges],
        ['Maintenance', p.maintenance_costs], ['Taxes & insurance', p.taxes_insurance_costs],
        ['Rent of land', p.rent_of_land_costs], ['Environmental', p.environmental_charges],
        ['Operating supplies', p.operating_supplies], ['General plant overhead', p.general_plant_overhead],
        ['Interest on WC', p.interest_working_capital], ['Patents & royalties', p.patents_royalties],
        ['Distribution & selling', p.distribution_selling_costs], ['R&D', p.RnD_costs],
      ];
      C.barH(document.getElementById('rcFix'), {
        title: `Fixed OPEX (per year, × fp=${p.cfg.fp})`, labels: fixRows.map((r) => r[0]),
        values: fixRows.map((r) => r[1]), xfmt: M, tipfmt: M, rowH: 26,
      });
      // LCOP components (discounted, per unit of main product).
      const r = p.cfg.interest_rate;
      let dC = 0, dO = 0, dS = 0, dP = 0;
      for (let i = 0; i < p.n_years; i++) {
        const df = Math.pow(1 + r, i + 1);
        dC += p.capital_cost_array[i] / df; dO += p.cash_cost_array[i] / df;
        dS += p.side_revenue_array[i] / df; dP += p.prod_array[i] / df;
      }
      C.barH(document.getElementById('rcLcop'), {
        title: 'Levelised cost LCOP (per unit)', labels: ['Capital part', 'Operating part', 'Side-revenue credit', 'LCOP'],
        values: [dC / dP, dO / dP, -dS / dP, p.levelized_cost],
        xfmt: (v) => (cur === 'USD' ? '$' : cur + ' ') + v.toFixed(3),
        tipfmt: (v) => (cur === 'USD' ? '$' : cur + ' ') + v.toFixed(4) + '/unit',
      });
      C.barV(document.getElementById('rcRev'), {
        title: 'Revenue vs OPEX (per year)', labels: ['Revenue', 'Variable OPEX', 'Fixed OPEX'],
        values: [p.revenue, p.variable_production_costs, p.fixed_production_costs],
        yfmt: M, tipfmt: M, colors: ['#16a34a', '#dc2626', '#d97706'],
      });
    } else if (t === 'cf') {
      box.innerHTML = `<div class="card"><div id="rcCF"></div></div>
        <div class="card"><div id="rcDep"></div></div>
        <div class="card"><h3>Cash-flow table</h3><div style="overflow-x:auto"><table class="data" id="rcCFTable"></table></div>
        <div class="btn-row"><button class="btn sm" id="rcCsv">⬇️ Download cash_flow.csv</button></div></div>`;
      C.cashflow(document.getElementById('rcCF'), {
        title: 'Annual cash flow', years: p.n_years, revenue: p.revenue_array,
        cashCost: p.cash_cost_array, capex: p.capital_cost_array, cashFlow: p.cash_flow, yfmt: M,
      });
      C.line(document.getElementById('rcDep'), {
        title: 'Depreciation schedule', series: [{ label: 'Depreciation', x: p.depreciation_array.map((_, i) => i + 1), y: p.depreciation_array }],
        xlabel: 'Year', ylabel: cur, xfmt: (v) => String(Math.round(v)), yfmt: M,
      });
      const cols = ['Year', `Capital [${cur}]`, `Revenue [${cur}]`, `Cash cost [${cur}]`, `Gross profit [${cur}]`, `Depreciation [${cur}]`, `Taxable income [${cur}]`, `Tax paid [${cur}]`, `Cash flow [${cur}]`];
      let th = '<thead><tr>' + cols.map((c, i) => `<th${i ? ' class="num"' : ''}>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
      for (let i = 0; i < p.n_years; i++) {
        const vals = [p.capital_cost_array[i], p.revenue_array[i], p.cash_cost_array[i], p.gross_profit_array[i],
          p.depreciation_array[i], p.taxable_income_array[i], p.tax_paid_array[i], p.cash_flow[i]];
        th += `<tr><td>${i + 1}</td>` + vals.map((v) => `<td class="num">${APP.isFin(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</td>`).join('') + '</tr>';
      }
      document.getElementById('rcCFTable').innerHTML = th + '</tbody>';
      document.getElementById('rcCsv').addEventListener('click', () => {
        let csv = cols.join(',') + '\n';
        for (let i = 0; i < p.n_years; i++) {
          csv += [i + 1, p.capital_cost_array[i], p.revenue_array[i], p.cash_cost_array[i], p.gross_profit_array[i],
            p.depreciation_array[i], p.taxable_income_array[i], p.tax_paid_array[i], p.cash_flow[i]].join(',') + '\n';
        }
        APP.download('cash_flow.csv', csv, 'text/csv');
      });
    } else {
      const ops = TEA.calculateOperatorsPerShift(p);
      const fmt = (v) => (APP.isFin(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—');
      box.innerHTML = `<div class="grid c2"><div class="card"><h3>👷 Staffing &amp; labour</h3>
        <table class="data"><tbody>
        <tr><td>Fluid process steps (excl. pumps/vessels)</td><td class="num">${p.no_fluid_process != null ? p.no_fluid_process : '—'}</td></tr>
        <tr><td>Solid process steps</td><td class="num">${p.no_solid_process != null ? p.no_solid_process : '—'}</td></tr>
        <tr><td>Operators / shift (Turton correlation)</td><td class="num">${APP.isFin(ops) ? ops.toFixed(2) : '—'}</td></tr>
        <tr><td>Operators hired</td><td class="num">${p.operators_hired_calc}</td></tr>
        <tr><td>Working hours / operator / year</td><td class="num">${fmt(p.working_hours_per_year)}</td></tr>
        <tr><td>Hourly rate</td><td class="num">${esc(M(TEA.operatorRate(p)))}/h</td></tr>
        <tr><td><b>Annual operating labour</b></td><td class="num"><b>${esc(M(p.operating_labor_costs))}</b></td></tr>
        </tbody></table></div>
        <div class="card"><h3>💰 Capital &amp; finance</h3>
        <table class="data"><tbody>
        <tr><td>Purchased equipment</td><td class="num">${esc(M(p.purchased_cost))}</td></tr>
        <tr><td>ISBL (× loc ${(() => { try { return locFactorFor(p.cfg.country, p.cfg.region).toFixed(2); } catch (e) { return '?'; } })()} · fc ${p.cfg.fc})</td><td class="num">${esc(M(p.isbl))}</td></tr>
        <tr><td>OSBL</td><td class="num">${esc(M(p.osbl))}</td></tr>
        <tr><td>Design &amp; engineering</td><td class="num">${esc(M(p.dne))}</td></tr>
        <tr><td>Contingency</td><td class="num">${esc(M(p.contigency))}</td></tr>
        <tr><td><b>Fixed capital</b></td><td class="num"><b>${esc(M(p.fixed_capital))}</b></td></tr>
        <tr><td>Working capital (${p.cfg.working_capital == null ? 'auto 15%' : 'user'})</td><td class="num">${esc(M(p.working_capital))}</td></tr>
        <tr><td>Main product</td><td class="num">${esc(p.main_product || '—')}</td></tr>
        <tr><td>Annual production (main, nameplate)</td><td class="num">${fmt(p.daily_prod * 365 * p.cfg.plant_utilization)} units</td></tr>
        </tbody></table></div></div>
        <div class="card"><h3>🧾 Equipment</h3>
        <table class="data"><thead><tr><th>Tag</th><th>Category / type</th><th class="num">Size</th><th class="num">Units</th><th class="num">Purchased</th><th class="num">Direct</th></tr></thead><tbody>
        ${p.equipment.map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.category)}${e.type ? ' / ' + esc(e.type) : ''}</td><td class="num">${esc(Array.isArray(e.param) ? e.param.join(', ') : String(e.param != null ? e.param : 'quoted'))}</td><td class="num">${e.num_units || 1}</td><td class="num">${esc(M(e.purchased_cost))}</td><td class="num">${esc(M(e.direct_cost))}</td></tr>`).join('')}
        </tbody></table>
        <div class="btn-row"><button class="btn sm" id="rcJson">⬇️ Download plant JSON</button></div></div>`;
      document.getElementById('rcJson').addEventListener('click', () => {
        APP.download((p.cfg.plant_name || 'plant').replace(/\s+/g, '_') + '.json',
          JSON.stringify({ plant: p.cfg, equipment: APP.state.equipment_specs }, null, 2));
      });
    }
  }

  // ================================================================ Sensitivity
  const SENS_TABS = [['oneway', '📈 One-way'], ['tornado', '🌪️ Tornado'], ['mc', '🎲 Monte Carlo']];
  function sensParams() {
    const cfg = APP.state.plant_cfg;
    const out = [];
    for (const k of TEA.TOP_LEVEL_KEYS_SENS) out.push([k, k]);
    for (const k of Object.keys(cfg.variable_opex_inputs || {})) {
      out.push([`variable_opex_inputs.${k}`, `${k} — price`]);
      out.push([`variable_opex_inputs.${k}.consumption`, `${k} — consumption`]);
    }
    for (const k of Object.keys(cfg.plant_products || {})) {
      out.push([`plant_products.${k}`, `${k} — price`]);
      out.push([`plant_products.${k}.production`, `${k} — production`]);
    }
    return out;
  }
  function renderSens() {
    const tabs = document.getElementById('sensTabs');
    tabs.innerHTML = SENS_TABS.map(([id, label]) =>
      `<button data-t="${id}" class="${APP.state.sensTab === id ? 'active' : ''}">${label}</button>`).join('');
    tabs.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => { APP.state.sensTab = b.dataset.t; renderSens(); }));
    const body = document.getElementById('sensBody');
    if (APP.state.sensTab === 'oneway') renderOneway(body);
    else if (APP.state.sensTab === 'tornado') renderTornado(body);
    else renderMC(body);
  }
  function needPlant(body) {
    try {
      return APP.buildWorkingPlant();
    } catch (e) {
      body.innerHTML = `<div class="err-callout"><b>Cannot build plant:</b> ${esc(e.message)} — fix the configuration in the Plant TEA Builder.</div>`;
      return null;
    }
  }
  function metricFmt(metric, cur) {
    if (metric === 'NPV') return (v) => APP.fmtMoney(v, cur);
    if (metric === 'LCOP') return (v) => (cur === 'USD' ? '$' : cur + ' ') + (APP.isFin(v) ? v.toFixed(3) : '—');
    if (metric === 'ROI') return (v) => (APP.isFin(v) ? v.toFixed(1) + '%' : '—');
    if (metric === 'IRR') return (v) => (APP.isFin(v) ? (v * 100).toFixed(2) + '%' : '—');
    return (v) => (APP.isFin(v) ? v.toFixed(2) + ' yr' : '—');
  }
  function renderOneway(body) {
    const params = sensParams();
    body.innerHTML = `<div class="card"><div class="grid c4">
      <div class="field"><label>Parameter</label><select id="sParam">${params.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>
      <div class="field"><label>Metric</label><select id="sMetric">${['LCOP', 'NPV', 'ROI', 'IRR', 'PBT'].map((m) => `<option>${m}</option>`).join('')}</select></div>
      <div class="field"><label>Range ± (<span id="sPmVal">20</span>%)</label><input type="range" id="sPm" min="5" max="50" value="20" style="width:100%"></div>
      <div class="field"><label>Points</label><input type="number" id="sN" min="5" max="51" step="2" value="21"></div>
    </div><div class="btn-row"><button class="btn primary" id="sRun">Run sensitivity</button></div>
    <p class="small">Fixed capital / fixed OPEX perturb the <span class="mono">fc</span>/<span class="mono">fp</span> multipliers around their configured values. LCOP excludes the main product's price.</p></div>
    <div id="sOut"></div>`;
    document.getElementById('sPm').addEventListener('input', (e) => {
      document.getElementById('sPmVal').textContent = e.target.value;
    });
    document.getElementById('sRun').addEventListener('click', () => {
      const p = needPlant(body); if (!p) return;
      const param = document.getElementById('sParam').value;
      const metric = document.getElementById('sMetric').value;
      const pm = num(document.getElementById('sPm').value, 20) / 100;
      const npt = int(document.getElementById('sN').value, 21);
      const out = document.getElementById('sOut');
      try {
        const r = TEA.sensitivityData(p, param, metric, pm, npt);
        const cur = p.cfg.currency || 'USD';
        const yf = metricFmt(metric, cur);
        out.innerHTML = `<div class="card"><div id="sChart"></div>
          <p class="small">Baseline ${metric}: <b>${esc(yf(r.baseline))}</b> · parameter: <span class="mono">${esc(r.parameter)}</span></p></div>`;
        C.line(document.getElementById('sChart'), {
          title: `${metric} vs ${param} (±${Math.round(pm * 100)}%)`,
          series: [{ label: metric, x: r.x, y: r.y }],
          xlabel: 'Parameter change (%)', ylabel: metric,
          xfmt: (v) => v.toFixed(0) + '%', yfmt: yf, vline: 0, hline: r.baseline,
        });
      } catch (e) {
        out.innerHTML = `<div class="err-callout"><b>Sensitivity failed:</b> ${esc(e.message)}</div>`;
      }
    });
  }
  function prettyFactor(f) {
    const map = { fixed_capital: 'Fixed capital (×fc)', fixed_opex: 'Fixed OPEX (×fp)',
      project_lifetime: 'Project lifetime', interest_rate: 'Interest rate', operator_hourly_rate: 'Operator hourly rate' };
    if (map[f]) return map[f];
    const parts = f.split('.');
    if (parts[0] === 'variable_opex_inputs') return `${parts[1]} — price`;
    if (parts[0] === 'plant_products') return `${parts[1]} — price`;
    return f;
  }
  function renderTornado(body) {
    body.innerHTML = `<div class="card"><div class="grid c3">
      <div class="field"><label>Metric</label><select id="tMetric">${['LCOP', 'NPV', 'ROI', 'IRR', 'PBT'].map((m) => `<option>${m}</option>`).join('')}</select></div>
      <div class="field"><label>Perturbation ± (<span id="tPmVal">10</span>%)</label><input type="range" id="tPm" min="5" max="50" value="10" style="width:100%"></div>
      <div class="field"><label>&nbsp;</label><button class="btn primary" id="tRun">Run tornado</button></div>
    </div><p class="small">Sorted by total effect. LCOP excludes the main product's price from the factors.</p></div>
    <div id="tOut"></div>`;
    document.getElementById('tPm').addEventListener('input', (e) => {
      document.getElementById('tPmVal').textContent = e.target.value;
    });
    document.getElementById('tRun').addEventListener('click', () => {
      const p = needPlant(body); if (!p) return;
      const metric = document.getElementById('tMetric').value;
      const pm = num(document.getElementById('tPm').value, 10) / 100;
      const out = document.getElementById('tOut');
      try {
        const r = TEA.tornadoData(p, pm, metric);
        const cur = p.cfg.currency || 'USD';
        const yf = metricFmt(metric, cur);
        // Largest effect on top (reverse ascending engine order for display).
        const idx = r.factors.map((_, i) => i).reverse();
        out.innerHTML = `<div class="card"><div id="tChart"></div>
          <p class="small">Baseline ${metric}: <b>${esc(yf(r.base_value))}</b> · ±${Math.round(pm * 100)}% · green line = baseline</p></div>`;
        C.tornado(document.getElementById('tChart'), {
          title: `Tornado — ${metric} (±${Math.round(pm * 100)}%)`,
          labels: idx.map((i) => prettyFactor(r.factors[i])),
          lows: idx.map((i) => r.lows[i]), highs: idx.map((i) => r.highs[i]),
          base: r.base_value, xfmt: yf,
        });
      } catch (e) {
        out.innerHTML = `<div class="err-callout"><b>Tornado failed:</b> ${esc(e.message)}</div>`;
      }
    });
  }
  // ------------------------------------------------------------------ MC ----
  function percentile(sorted, q) {
    if (!sorted.length) return NaN;
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  }
  function mcStats(arr) {
    const f = arr.filter(APP.isFin).sort((a, b) => a - b);
    if (!f.length) return { n: 0 };
    const mean = f.reduce((a, b) => a + b, 0) / f.length;
    const sd = Math.sqrt(f.reduce((a, b) => a + (b - mean) * (b - mean), 0) / f.length);
    return { n: f.length, mean, sd, p5: percentile(f, 0.05), p50: percentile(f, 0.5), p95: percentile(f, 0.95) };
  }
  function renderMC(body) {
    body.innerHTML = `<div class="card"><div class="grid c3">
      <div class="field"><label>Samples</label><input type="number" id="mcN" min="200" max="50000" step="100" value="5000"></div>
      <div class="field"><label>Random seed (blank = random)</label><input id="mcSeed" placeholder="e.g. 42" value="42"></div>
      <div class="field"><label>&nbsp;</label><button class="btn primary" id="mcRun">🎲 Run Monte Carlo</button></div>
    </div>
    <div class="field"><label>Uncertainty overrides (JSON, merged into a copy of the plant — same keys as the engine config)</label>
    <textarea id="mcUnc" class="code" rows="6" placeholder='{"project_uncertainties": {"project_lifetime": {"std": 2}}, "variable_opex_inputs": {"steam_LP": {"price_uncertainty": {"std": 0.005}}}}'></textarea></div>
    <p class="small">Defaults: fixed capital/OPEX factors ~ Normal(1, 0.3) truncated to [0.25, 1.75]; lifetime ~ Normal(life, 5); interest ~ Normal(r, 0.03); operator rate ~ Normal(rate, 10); prices constant unless a <span class="mono">std</span> is given. Production/consumption constant unless configured. The static app uses its own seeded PRNG, so samples differ from the Python run but the distributions match.</p></div>
    <div id="mcOut"></div>`;
    if (APP.state.mc) renderMCResults(document.getElementById('mcOut'));
    document.getElementById('mcRun').addEventListener('click', () => {
      const p = needPlant(body); if (!p) return;
      const out = document.getElementById('mcOut');
      let unc = {};
      const t = document.getElementById('mcUnc').value.trim();
      if (t) {
        try { unc = JSON.parse(t); }
        catch (e) { out.innerHTML = `<div class="err-callout"><b>Invalid uncertainty JSON:</b> ${esc(e.message)}</div>`; return; }
      }
      const n = Math.max(200, Math.min(50000, int(document.getElementById('mcN').value, 5000)));
      const seedT = document.getElementById('mcSeed').value.trim();
      const seed = seedT === '' ? null : int(seedT, 42);
      out.innerHTML = '<div class="card"><p>Running Monte Carlo… (this can take a few seconds for large samples)</p></div>';
      setTimeout(() => {
        try {
          const q = TEA.clonePlant(p);
          deepMerge(q.cfg, unc);
          const mc = TEA.monteCarlo(q, { num_samples: n, random_seed: seed });
          // baselines from the unperturbed working plant
          const b = TEA.clonePlant(p);
          TEA.calculateLevelizedCost(b);
          mc.baseline = { LCOP: b.levelized_cost, NPV: TEA.calculateNPV(b), ROI: TEA.calculateROI(b), PBT: TEA.calculatePaybackTime(b) };
          mc.uncText = t;
          APP.state.mc = mc;
          renderMCResults(out);
        } catch (e) {
          out.innerHTML = `<div class="err-callout"><b>Monte Carlo failed:</b> ${esc(e.message)}</div>`;
        }
      }, 30);
    });
  }
  function deepMerge(dst, src) {
    for (const k of Object.keys(src)) {
      if (src[k] != null && typeof src[k] === 'object' && !Array.isArray(src[k]) &&
          dst[k] != null && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
        deepMerge(dst[k], src[k]);
      } else {
        dst[k] = JSON.parse(JSON.stringify(src[k]));
      }
    }
  }
  function renderMCResults(out) {
    const mc = APP.state.mc;
    if (!mc) return;
    const cur = mc.currency || 'USD';
    const mets = ['LCOP', 'NPV', 'ROI', 'PBT'];
    let h = `<div class="card"><h3>Outcome distributions (n = ${mc.num_samples.toLocaleString()})</h3>
      <div class="grid c2">${mets.map((m) => `<div id="mcH_${m}"></div>`).join('')}</div></div>`;
    h += '<div class="card"><h3>Statistics</h3><div style="overflow-x:auto"><table class="data"><thead><tr>'
      + '<th>Metric</th><th class="num">Mean</th><th class="num">Std</th><th class="num">P5</th><th class="num">P50</th><th class="num">P95</th><th class="num">Finite</th></tr></thead><tbody>';
    for (const m of mets) {
      const s = mcStats(mc.metrics[m]);
      const yf = metricFmt(m, cur);
      h += `<tr><td><b>${m}</b></td>`
        + (s.n ? `<td class="num">${esc(yf(s.mean))}</td><td class="num">${esc(yf(s.sd))}</td><td class="num">${esc(yf(s.p5))}</td><td class="num">${esc(yf(s.p50))}</td><td class="num">${esc(yf(s.p95))}</td><td class="num">${s.n.toLocaleString()} / ${mc.num_samples.toLocaleString()}</td>`
          : `<td class="num" colspan="6">no finite values (e.g. payback is undefined when average cash flow ≤ 0)</td>`) + '</tr>';
    }
    h += '</tbody></table></div></div>';
    h += `<div class="card"><h3>Sampled inputs</h3>
      <div class="field" style="max-width:340px"><label>Input distribution</label><select id="mcInSel">${
        Object.keys(mc.inputs).map((k) => `<option>${esc(k)}</option>`).join('')}</select></div>
      <div id="mcInChart"></div></div>`;
    out.innerHTML = h;
    for (const m of mets) {
      const yf = metricFmt(m, cur);
      C.hist(document.getElementById('mcH_' + m), {
        title: m, values: mc.metrics[m], xlabel: m, xfmt: yf,
        vline: mc.baseline ? mc.baseline[m] : null,
        empty: `No finite ${m} values`,
      });
    }
    const updIn = () => {
      const k = document.getElementById('mcInSel').value;
      C.hist(document.getElementById('mcInChart'), {
        title: k, values: mc.inputs[k], xlabel: k, xfmt: (v) => C.fmtShort(v),
      });
    };
    document.getElementById('mcInSel').addEventListener('change', updIn);
    updIn();
  }

  // ================================================================== Compare
  function renderCompare() {
    const body = document.getElementById('compareBody');
    const designs = APP.state.designs;
    let h = `<div class="card"><div class="grid c3">
      <div class="field"><label>Snapshot name</label><input id="cName" placeholder="e.g. Base case" value="Design ${designs.length + 1}"></div>
      <div class="field"><label>&nbsp;</label><button class="btn primary" id="cSnap">📸 Snapshot working plant</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn" id="cPresetAll">＋ Add all 5 presets</button></div>
    </div><p class="small">Snapshots freeze the working plant (config + equipment) with its KPIs. Designs live in this page only — export them below to keep them.</p></div>
    <div id="cOut"></div>`;
    body.innerHTML = h;
    document.getElementById('cSnap').addEventListener('click', () => {
      const name = document.getElementById('cName').value.trim() || `Design ${designs.length + 1}`;
      try {
        const p = APP.buildWorkingPlant();
        TEA.calculatePurchasedCost(p);
        TEA.calculateAll(p);
        designs.push({ name, cfg: JSON.parse(JSON.stringify(p.cfg)),
          specs: JSON.parse(JSON.stringify(APP.state.equipment_specs)),
          kpis: APP.kpisOf(p), cashflow: p.cash_flow.slice(), lifetime: p.n_years });
        renderCompare();
      } catch (e) {
        document.getElementById('cOut').innerHTML = `<div class="err-callout"><b>Snapshot failed:</b> ${esc(e.message)}</div>`;
      }
    });
    document.getElementById('cPresetAll').addEventListener('click', () => {
      for (const pn of Object.keys(DATA.presets)) {
        if (designs.some((d) => d.name === pn)) continue;
        try {
          const pr = DATA.presets[pn];
          const p = TEA.newPlant(pr.plant, pr.equipment);
          TEA.calculatePurchasedCost(p);
          TEA.calculateAll(p);
          designs.push({ name: pn, cfg: JSON.parse(JSON.stringify(p.cfg)),
            specs: JSON.parse(JSON.stringify(pr.equipment)), kpis: APP.kpisOf(p),
            cashflow: p.cash_flow.slice(), lifetime: p.n_years });
        } catch (e) { /* skip failing preset */ }
      }
      renderCompare();
    });
    renderCompareTable();
  }
  function renderCompareTable() {
    const out = document.getElementById('cOut');
    if (!out) return;
    const designs = APP.state.designs;
    if (!designs.length) {
      out.innerHTML = '<div class="card"><p class="small">No designs yet — snapshot the working plant or add all presets.</p></div>';
      return;
    }
    const cur = 'USD';
    const rows = [
      ['NPV', (k) => APP.fmtMoney(k.npv, cur), 'money'],
      ['IRR', (k) => (APP.isFin(k.irr) ? (k.irr * 100).toFixed(1) + '%' : '—'), 'pct'],
      ['ROI', (k) => (APP.isFin(k.roi) ? k.roi.toFixed(0) + '%' : '—'), 'pct'],
      ['Payback (yr)', (k) => (APP.isFin(k.payback) ? k.payback.toFixed(1) : '—'), 'num'],
      ['LCOP', (k) => (APP.isFin(k.lcop) ? '$' + k.lcop.toFixed(3) + '/unit' : '—'), 'num'],
      ['Fixed capital', (k) => APP.fmtMoney(k.fixed_capital, cur), 'money'],
      ['Working capital', (k) => APP.fmtMoney(k.working_capital, cur), 'money'],
      ['Variable OPEX/yr', (k) => APP.fmtMoney(k.variable_opex, cur), 'money'],
      ['Fixed OPEX/yr', (k) => APP.fmtMoney(k.fixed_opex, cur), 'money'],
      ['Revenue/yr', (k) => APP.fmtMoney(k.revenue, cur), 'money'],
    ];
    let h = '<div class="card"><h3>Side-by-side KPIs</h3><div style="overflow-x:auto"><table class="data"><thead><tr><th>Metric</th>'
      + designs.map((d) => `<th class="num">${esc(d.name)}</th>`).join('') + '</tr></thead><tbody>';
    for (const [label, f] of rows) {
      h += `<tr><td><b>${esc(label)}</b></td>` + designs.map((d) => `<td class="num">${esc(f(d.kpis))}</td>`).join('') + '</tr>';
    }
    h += `<tr><td></td>` + designs.map((d, i) => `<td class="num"><button class="btn sm" data-load="${i}">Load</button> <button class="btn sm danger" data-cdel="${i}">✕</button></td>`).join('') + '</tr>';
    h += '</tbody></table></div><div class="btn-row"><button class="btn sm" id="cDl">⬇️ Download designs JSON</button></div></div>';
    h += `<div class="grid c2"><div class="card"><div id="cNPV"></div></div>
      <div class="card"><div id="cLCOP"></div></div></div>
      <div class="card"><div id="cCF"></div></div>`;
    out.innerHTML = h;
    out.querySelectorAll('[data-cdel]').forEach((b) => b.addEventListener('click', () => {
      designs.splice(parseInt(b.dataset.cdel, 10), 1);
      renderCompare();
    }));
    out.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const d = designs[parseInt(b.dataset.load, 10)];
      APP.state.plant_cfg = JSON.parse(JSON.stringify(d.cfg));
      APP.state.equipment_specs = JSON.parse(JSON.stringify(d.specs));
      APP.markDirty();
      APP.showPage('builder');
    }));
    document.getElementById('cDl').addEventListener('click', () => {
      APP.download('designs.json', JSON.stringify(designs.map((d) => ({ name: d.name, plant: d.cfg, equipment: d.specs })), null, 2));
    });
    const M = (v) => APP.fmtMoney(v, cur);
    C.barV(document.getElementById('cNPV'), {
      title: 'NPV by design', labels: designs.map((d) => d.name),
      values: designs.map((d) => d.kpis.npv), yfmt: M, tipfmt: M, tickAngle: designs.length > 3,
    });
    C.barV(document.getElementById('cLCOP'), {
      title: 'LCOP by design', labels: designs.map((d) => d.name),
      values: designs.map((d) => d.kpis.lcop), yfmt: (v) => '$' + v.toFixed(2), tipfmt: (v) => '$' + v.toFixed(3) + '/unit',
      tickAngle: designs.length > 3,
    });
    C.line(document.getElementById('cCF'), {
      title: 'Net cash flow by design', xlabel: 'Year', ylabel: cur,
      series: designs.map((d, i) => ({
        label: d.name, x: d.cashflow.map((_, k) => k + 1), y: d.cashflow,
        color: C.PALETTE[i % C.PALETTE.length],
      })),
      xfmt: (v) => String(Math.round(v)), yfmt: M,
    });
  }

  // ================================================================ JSON/About
  const JSON_TABS = [['json', '💾 Export / Import'], ['about', '📖 About & methods']];
  function renderJSON() {
    const tabs = document.getElementById('jsonTabs');
    tabs.innerHTML = JSON_TABS.map(([id, label]) =>
      `<button data-t="${id}" class="${APP.state.jsonTab === id ? 'active' : ''}">${label}</button>`).join('');
    tabs.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => { APP.state.jsonTab = b.dataset.t; renderJSON(); }));
    const body = document.getElementById('jsonBody');
    if (APP.state.jsonTab === 'json') renderJSONTab(body);
    else renderAboutTab(body);
  }
  function workingJSON() {
    return JSON.stringify({ plant: APP.state.plant_cfg, equipment: APP.state.equipment_specs }, null, 2);
  }
  function renderJSONTab(body) {
    body.innerHTML = `<div class="card"><h3>Export working plant</h3>
      <textarea id="jOut" class="code" rows="14" readonly>${esc(workingJSON())}</textarea>
      <div class="btn-row"><button class="btn sm" id="jDl">⬇️ Download JSON</button>
      <button class="btn sm" id="jCopy">⧉ Copy</button>
      <button class="btn sm" id="jRefresh">↻ Refresh</button></div></div>
      <div class="card"><h3>Import plant JSON</h3>
      <textarea id="jIn" class="code" rows="8" placeholder='{"plant": {...}, "equipment": [...]}'></textarea>
      <div class="btn-row"><button class="btn primary sm" id="jLoad">Load into builder</button>
      <button class="btn sm" id="jReset">↺ Reset to preset “${esc(APP.state.preset_name)}”</button></div>
      <div id="jMsg"></div>
      <p class="small">Shape: <span class="mono">{"plant": {…OpenPyTEA-style config…}, "equipment": [{name, param, category, type, …}]}</span>.
      Two-parameter correlations: <span class="mono">"param": [s, s2]</span>. A quoted unit: <span class="mono">{"purchased_cost": …, "cost_year": …}</span> (param ignored).
      Dependency-graph blocks (<span class="mono">*_dependency</span>) are not supported in the static app.</p></div>`;
    document.getElementById('jDl').addEventListener('click', () => {
      APP.download((APP.state.plant_cfg.plant_name || 'plant').replace(/\s+/g, '_') + '.json', workingJSON());
    });
    document.getElementById('jCopy').addEventListener('click', () => {
      const t = document.getElementById('jOut');
      t.select();
      try { document.execCommand('copy'); } catch (e) { /* clipboard may need permission */ }
      if (navigator.clipboard) navigator.clipboard.writeText(workingJSON());
    });
    document.getElementById('jRefresh').addEventListener('click', () => {
      document.getElementById('jOut').value = workingJSON();
    });
    document.getElementById('jLoad').addEventListener('click', () => {
      const msg = document.getElementById('jMsg');
      try {
        const o = JSON.parse(document.getElementById('jIn').value);
        if (!o || typeof o !== 'object' || !o.plant || typeof o.plant !== 'object') {
          throw new Error('JSON must be an object with a "plant" object and an "equipment" array.');
        }
        if (!Array.isArray(o.equipment)) throw new Error('"equipment" must be an array.');
        // Validate by building (throws with the engine message on bad configs).
        const p = TEA.newPlant(o.plant, o.equipment);
        TEA.calculateFixedCapital(p, p.cfg.fc == null ? 1.0 : p.cfg.fc);
        APP.state.plant_cfg = JSON.parse(JSON.stringify(o.plant));
        APP.state.equipment_specs = JSON.parse(JSON.stringify(o.equipment));
        APP.markDirty();
        msg.innerHTML = '<div class="callout">✅ Loaded — open the <b>Plant TEA Builder</b> and press <b>Run TEA</b>.</div>';
      } catch (e) {
        msg.innerHTML = `<div class="err-callout"><b>Import failed:</b> ${esc(e.message)}</div>`;
      }
    });
    document.getElementById('jReset').addEventListener('click', () => {
      APP.resetToPreset(APP.state.preset_name);
      document.getElementById('jOut').value = workingJSON();
      document.getElementById('jMsg').innerHTML = '<div class="callout">✅ Reset to preset.</div>';
    });
  }
  function renderAboutTab(body) {
    const years = Object.keys(DATA.cepci).map(Number).sort((a, b) => a - b);
    body.innerHTML = `<div class="card"><h3>What this is</h3>
      <p>A fully static port of the Distillation TEA Studio: the OpenPyTEA techno-economic engine
      reimplemented in dependency-free JavaScript, with the cost database, CEPCI table, location factors,
      presets, and study notes embedded in the page. No server, no build step — open <span class="mono">index.html</span>
      directly or serve this folder with any static file server.</p></div>
      <div class="card"><h3>Methodology (mirrors OpenPyTEA v3)</h3>
      <ul class="tight">
      <li><b>Equipment costing</b> — 417 cost correlations (offset power-law, exponential, log-log / ln-ln quadratics, power-sizing, 2-variable power-law) with lower-bound checks and automatic parallelisation above unit capacity; CEPCI inflation adjustment (${years[0]}–${years[years.length - 1]}); material factors rescaled to each correlation's default material; direct (installed) cost = purchased × ((1+fp)·fm + fer+fel+fi+fc+fs+fl).</li>
      <li><b>Fixed capital</b> — ISBL = Σ direct × location factor × fc × exchange rate; OSBL = OS·ISBL; design &amp; engineering = DE·(ISBL+OSBL); contingency = X·(ISBL+OSBL). Defaults: Fluids OS 0.3 / DE 0.3 / X 0.1.</li>
      <li><b>Operating labour</b> — Turton staffing correlation √(6.29 + 31.7·ns² + 0.23·nf) (chart rule 3+ns beyond 2 solids steps; batch floor 3/shift), pumps &amp; pressure vessels excluded from step counts; hired = ceil(per-shift × 365·shifts/day ÷ (weeks·shifts/week)); cost = hired × hours × rate (default $38.11/h).</li>
      <li><b>Fixed OPEX</b> — supervision 25%, salary overhead 50%, lab 10% (of labour); maintenance 5%, tax+insurance 1.5%, supplies 0.9% (of ISBL); rent 1.5%, environmental 1% (of ISBL+OSBL); GPO 65% (of labour block); working-capital interest; patents/distribution/R&amp;D 2/2/3% via cash-cost markup; total × fp.</li>
      <li><b>Cash flow</b> — CAPEX ramp 30/60/10 with working capital drawn in year 3 and released in the final year; production ramp 0/0/40/80 → 100%; depreciation from year index 2 (straight-line default life min(15, life−2)); 1-year tax lag (final year's tax falls outside the horizon by design).</li>
      <li><b>Metrics</b> — NPV = Σ CF/(1+r)^t; LCOP = discounted (capex + cash cost − side revenue) ÷ discounted main-product output (floored at 0); payback = fixed capital ÷ mean cash flow over revenue years; ROI = Σ(gross−tax)·100 ÷ (life·(FC+WC)); IRR by grid search + Brent's method.</li>
      <li><b>Sensitivity / tornado</b> — fixed capital &amp; OPEX perturb the fc/fp multipliers; LCOP runs exclude the main product's price (by-products included).</li>
      </ul></div>
      <div class="card"><h3>Known differences from the Python app</h3>
      <ul class="tight">
      <li>Monte Carlo uses a seeded <b>mulberry32 + Box–Muller</b> PRNG instead of NumPy's generator: same distributions and truncation rules, but individual draws differ — compare distributions/statistics, not sample-by-sample values.</li>
      <li>Parameter <b>dependency graphs</b> (consumption/production/project DAG blocks) are not supported; importing such a config raises a clear error.</li>
      <li>Charts are hand-rolled SVG rather than Matplotlib; percentile and histogram conventions match the Python app's defaults.</li>
      </ul></div>
      <div class="card"><h3>Validation</h3>
      <p>Run <span class="mono">node test/parity.mjs</span> from the <span class="mono">webapp/</span> folder: it replays all 5 presets, 4 sensitivity curves, 2 tornado diagrams, a 4,000-sample Monte Carlo run, and 12 edge cases against Python-computed expectations (<span class="mono">test/expected.json</span>, generated by <span class="mono">tools/export_webapp_data.py</span>) — currently <b>1,164 checks, all passing</b>.</p></div>`;
  }

  root.PLANT = { renderBuilder, renderSens, renderCompare, renderJSON,
    _debug: { renderResults, renderResTab, renderMCResults, renderCompareTable } };
})(typeof window !== 'undefined' ? window : globalThis);
