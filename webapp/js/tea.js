/* OpenPyTEA engine port (JavaScript) — scalar path + analyses.
 *
 * Faithful reimplementation of OpenPyTEA v3 Plant/Equipment/analysis math for a
 * single scenario: equipment costing, fixed capital, OPEX, cash flow,
 * depreciation, NPV/LCOP/PBT/ROI/IRR, one-way sensitivity, tornado, Monte Carlo.
 * Validated numerically against the Python engine (see test/parity.mjs).
 *
 * Dependency-graph features (consumption/production/project dependencies) are
 * intentionally not ported; configs using them raise a clear error.
 *
 * No modules (works from file://): attaches to window/globalThis as TEA.
 */
(function (root) {
  'use strict';

  const D = () => root.TEA_DATA;

  function fail(msg) { throw new Error(msg); }
  function isNum(x) { return typeof x === 'number' && Number.isFinite(x); }
  function deepCopy(o) { return o === undefined ? o : JSON.parse(JSON.stringify(o)); }
  // Python int() truncation toward zero (used for float lifetimes).
  function pyInt(x) { return Math.trunc(Number(x)); }

  function assertNoDependencies(cfg, where) {
    const pu = (cfg && cfg.project_uncertainties) || {};
    for (const k of Object.keys(pu)) {
      if (pu[k] && typeof pu[k] === 'object' && pu[k].dependency != null) {
        fail(`${where}: project dependency on '${k}' is not supported in the static app; remove the "dependency" block.`);
      }
    }
    for (const root_key of ['variable_opex_inputs', 'plant_products']) {
      const blk = (cfg && cfg[root_key]) || {};
      for (const name of Object.keys(blk)) {
        const e = blk[name] || {};
        if (e.consumption_dependency != null || e.production_dependency != null) {
          fail(`${where}: quantity dependencies on '${name}' are not supported in the static app.`);
        }
      }
    }
    const op = cfg && cfg.operator_hourly_rate;
    if (op && typeof op === 'object' && op.dependency != null) {
      fail(`${where}: operator-rate dependency is not supported in the static app.`);
    }
  }

  // ---------------------------------------------------------------------------
  // CEPCI + cost correlations
  // ---------------------------------------------------------------------------
  function cepciValue(year) {
    const v = D().cepci[String(pyInt(year))];
    if (v == null) fail(`CEPCI not available for year ${year}`);
    return v;
  }
  function inflationAdjustment(cost, costYear, targetYear) {
    return Number(cost) * (cepciValue(targetYear) / cepciValue(costYear));
  }

  function correlationKeyFor(category, type) {
    const t = String(category).toLowerCase();
    const st = (type == null ? '' : String(type)).toLowerCase();
    const rows = D().correlations;
    for (const r of rows) {
      if (String(r.category).toLowerCase() !== t) continue;
      const rt = (r.type == null ? '' : String(r.type)).toLowerCase();
      if (rt === st) return r.key;
    }
    return null;
  }
  function correlationRow(key) {
    const rows = D().correlations;
    for (const r of rows) if (r.key === key) return r;
    return null;
  }
  function defaultMaterialForKey(key) {
    const r = correlationRow(key);
    return r ? r.default_material || null : null;
  }

  // Returns [purchased, units, costYear]; mirrors CostCorrelationDB.evaluate.
  function evaluateCorrelation(key, s, s2) {
    const r = correlationRow(key);
    if (!r) fail(`Correlation key not found in CSV: ${key}`);
    const sLower = r.s_lower, sUpper = r.s_upper;
    const cap = (r.upper_parallel != null && !Number.isNaN(r.upper_parallel))
      ? r.upper_parallel : sUpper;
    if (sLower != null && !Number.isNaN(sLower) && s < sLower) {
      fail(`s=${s} below lower bound ${sLower} for key '${key}'`);
    }
    if (s2 != null) {
      if (r.s2_lower != null && !Number.isNaN(r.s2_lower) && s2 < r.s2_lower) {
        fail(`s2=${s2} below lower bound ${r.s2_lower} for key '${key}'`);
      }
      if (r.s2_upper != null && !Number.isNaN(r.s2_upper) && s2 > r.s2_upper) {
        fail(`s2=${s2} above upper bound ${r.s2_upper} for key '${key}'`);
      }
    }
    let units = 1, sAdj = s;
    if (cap != null && !Number.isNaN(cap) && s > cap) {
      units = Math.ceil(s / cap);
      sAdj = s / units;
    }
    const form = r.form;
    const year = pyInt(r.cost_year);
    let ce;
    if (form === 'offset power-law') {
      ce = r.a + r.b * Math.pow(sAdj, r.n);
    } else if (form === 'exponential') {
      ce = r.a * Math.exp(r.b * sAdj);
    } else if (form === 'log-log quadratic') {
      const k4 = (r.k4 != null && !Number.isNaN(r.k4)) ? r.k4 : 0.0;
      const k5 = (r.k5 != null && !Number.isNaN(r.k5)) ? r.k5 : 0.0;
      const logS = Math.log10(sAdj);
      const logCe = r.k1 + r.k2 * logS + r.k3 * logS * logS + k4 * Math.pow(logS, 3) + k5 * Math.pow(logS, 4);
      ce = Math.pow(10, logCe);
    } else if (form === 'ln-ln quadratic') {
      const k4 = (r.k4 != null && !Number.isNaN(r.k4)) ? r.k4 : 0.0;
      const k5 = (r.k5 != null && !Number.isNaN(r.k5)) ? r.k5 : 0.0;
      const lnS = Math.log(sAdj);
      const lnCe = r.k1 + r.k2 * lnS + r.k3 * lnS * lnS + k4 * Math.pow(lnS, 3) + k5 * Math.pow(lnS, 4);
      ce = Math.exp(lnCe);
    } else if (form === 'power-sizing') {
      ce = r.c0 * Math.pow(sAdj / r.s0, r.f);
    } else if (form === '2-var power-law') {
      if (s2 == null) {
        fail(`Correlation '${key}' has form '2-var power-law' and requires a second size parameter (s2).`);
      }
      ce = r.a + r.b * Math.pow(sAdj, r.n) * Math.pow(s2, r.n2);
    } else {
      fail(`Unsupported form '${form}' for key '${key}'`);
    }
    return [ce * units, units, year];
  }

  // ---------------------------------------------------------------------------
  // Equipment — mirrors openpytea.equipment.Equipment
  // ---------------------------------------------------------------------------
  function costEquipment(spec) {
    spec = spec || {};
    const name = spec.name != null ? spec.name : 'Equipment';
    const processType = spec.process_type;
    const category = spec.category;
    const type = spec.type != null ? spec.type : null;
    let material = spec.material != null ? spec.material : null;
    let numUnits = spec.num_units != null ? spec.num_units : null;
    const purchasedCost = spec.purchased_cost != null ? spec.purchased_cost : null;
    const costYear = spec.cost_year != null ? spec.cost_year : null;
    const targetYear = spec.target_year != null ? spec.target_year : 2024;

    const PF = D().equip_process_factors;
    const MF = D().material_factors;

    // Default material from the resolved correlation (None if no match).
    let resolvedDefault = null;
    try {
      const dk = spec.cost_func || correlationKeyFor(category, type);
      if (dk) resolvedDefault = defaultMaterialForKey(dk);
    } catch (e) { resolvedDefault = null; }
    if (!resolvedDefault) resolvedDefault = 'Carbon steel';
    const materialWasAuto = (material == null);
    if (materialWasAuto) material = resolvedDefault;
    const usesDefaultMaterial = materialWasAuto || material === resolvedDefault;

    if (!Object.prototype.hasOwnProperty.call(PF, processType)) {
      fail(`Invalid process_type '${processType}'. Valid options are: ${Object.keys(PF).join(', ')}`);
    }
    if (!Object.prototype.hasOwnProperty.call(MF, material) && !usesDefaultMaterial) {
      fail(`Invalid material '${material}'. Valid options are: ${Object.keys(MF).join(', ')}`);
    }
    const pf = PF[processType];
    const pick = (v, d) => (v != null ? v : d);
    const fer = pick(spec.erection_factor, pf.fer);
    const fp = pick(spec.piping_factor, pf.fp);
    const fi = pick(spec.instrumentation_factor, pf.fi);
    const fel = pick(spec.electrical_factor, pf.fel);
    const fc = pick(spec.civil_factor, pf.fc);
    const fs = pick(spec.structural_factor, pf.fs);
    const fl = pick(spec.lagging_factor, pf.fl);

    let materialFactor;
    if (spec.material_factor != null) {
      materialFactor = spec.material_factor;
    } else if (usesDefaultMaterial) {
      materialFactor = 1.0;
    } else {
      const defaultFm = Object.prototype.hasOwnProperty.call(MF, resolvedDefault) ? MF[resolvedDefault] : 1.0;
      materialFactor = MF[material] / defaultFm;
    }

    let purchased, units, cYear;
    let param = (purchasedCost != null) ? null : spec.param;
    if (purchasedCost != null) {
      purchased = Number(purchasedCost);
      if (costYear != null) purchased = inflationAdjustment(purchased, costYear, targetYear);
      units = (numUnits == null) ? 1 : numUnits;
      cYear = costYear;
    } else {
      const key = spec.cost_func || correlationKeyFor(category, type);
      if (!key) {
        fail(`No CSV correlation matches category='${category}', type='${type}'. Add a row to the CSV or specify cost_func manually.`);
      }
      let s = param, s2 = null;
      if (Array.isArray(param)) { s = param[0]; s2 = param.length > 1 ? param[1] : null; }
      const [p, u, y] = evaluateCorrelation(key, Number(s), s2 == null ? null : Number(s2));
      purchased = p;
      if (numUnits == null) { units = u; }
      else { units = numUnits; purchased = purchased * numUnits; }
      cYear = y;
      purchased = inflationAdjustment(purchased, y, targetYear);
    }
    const direct = purchased * ((1 + fp) * materialFactor + (fer + fel + fi + fc + fs + fl));
    return {
      name, category, type, material, process_type: processType,
      param, num_units: units, cost_year: cYear, target_year: targetYear,
      purchased_cost: purchased, direct_cost: direct,
      material_factor: materialFactor,
      factors: { fer, fp, fi, fel, fc, fs, fl },
    };
  }

  // ---------------------------------------------------------------------------
  // Depreciation — mirrors plant._normalize_dep_config / build_depreciation_array
  // ---------------------------------------------------------------------------
  function normalizeDepConfig(projectLife, depCfg) {
    const cfg = {
      method: 'straight_line', life: null, db_factor: 2.0,
      salvage_fraction: 0.0, macrs_class: 7, convention: 'half_year',
      service_start_year: 2,
    };
    if (depCfg) {
      for (const k of Object.keys(depCfg)) {
        if (Object.prototype.hasOwnProperty.call(cfg, k)) cfg[k] = depCfg[k];
      }
    }
    if (cfg.life == null) {
      cfg.life = Math.max(1, Math.min(15, projectLife - cfg.service_start_year));
    }
    if (cfg.method === 'macrs') {
      if (cfg.convention !== 'half_year') fail('Only half_year MACRS convention is supported currently.');
      if (!Object.prototype.hasOwnProperty.call(D().macrs, String(cfg.macrs_class))) {
        fail(`Unsupported MACRS class ${cfg.macrs_class}. Choose one of ${Object.keys(D().macrs).join(', ')}.`);
      }
    }
    return cfg;
  }

  function straightLineSchedule(basis, life, salvageFrac, horizon) {
    const salvage = basis * salvageFrac;
    const depTotal = basis - salvage;
    const annual = depTotal / life;
    const sched = new Array(horizon).fill(0);
    const years = Math.min(life, horizon);
    for (let i = 0; i < years; i++) sched[i] = annual;
    if (horizon >= life && years > 0) {
      const sum = sched.reduce((a, b) => a + b, 0);
      const diff = depTotal - sum;
      if (Math.abs(diff) > 1e-6) sched[years - 1] += diff;
    }
    return sched;
  }

  function decliningBalanceSchedule(basis, life, factor, salvageFrac, horizon) {
    const salvage = basis * salvageFrac;
    let remaining = basis;
    const sched = new Array(horizon).fill(0);
    const n = Math.min(life, horizon);
    for (let y = 0; y < n; y++) {
      const db = remaining * (factor / life);
      const yearsLeft = life - y;
      const slTotalLeft = Math.max(0.0, remaining - salvage);
      const sl = yearsLeft > 0 ? slTotalLeft / yearsLeft : 0.0;
      const dep = Math.max(0.0, Math.min(Math.max(db, sl), remaining - salvage));
      sched[y] = dep;
      remaining -= dep;
    }
    if (horizon >= life) {
      const sum = sched.reduce((a, b) => a + b, 0);
      const diff = (basis - salvage) - sum;
      if (Math.abs(diff) > 1e-6) {
        let last = 0;
        for (let i = 0; i < sched.length; i++) if (sched[i] !== 0) last = i;
        sched[last] += diff;
      }
    }
    return sched;
  }

  function macrsSchedule(basis, macrsClass, horizon) {
    const pct = D().macrs[String(macrsClass)];
    let sched = pct.map(p => p * basis);
    if (sched.length < horizon) {
      sched = sched.concat(new Array(horizon - sched.length).fill(0));
    } else {
      sched = sched.slice(0, horizon);
    }
    const sum = sched.reduce((a, b) => a + b, 0);
    if (sum - basis > 1e-6) sched[sched.length - 1] -= (sum - basis);
    return sched;
  }

  // capexByYear: [[yearIndex, amount], ...]. Returns {sched, stranded}.
  function buildDepreciationArray(projectLife, capexByYear, depCfg) {
    const cfg = normalizeDepConfig(projectLife, depCfg);
    const dep = new Array(projectLife).fill(0);
    let expectedTotal = 0.0, writtenOff = 0.0;
    for (const [capexYear, amount] of capexByYear) {
      const start = Math.max(cfg.service_start_year, capexYear);
      const horizon = Math.max(0, projectLife - start);
      if (horizon <= 0 || amount === 0) continue;
      let sched;
      if (cfg.method === 'straight_line') {
        sched = straightLineSchedule(amount, cfg.life, cfg.salvage_fraction, horizon);
      } else if (cfg.method === 'declining_balance') {
        sched = decliningBalanceSchedule(amount, cfg.life, cfg.db_factor, cfg.salvage_fraction, horizon);
      } else if (cfg.method === 'macrs') {
        sched = macrsSchedule(amount, cfg.macrs_class, horizon);
      } else {
        fail(`Unknown depreciation method: ${cfg.method}`);
      }
      expectedTotal += (cfg.method === 'macrs') ? amount : amount * (1.0 - cfg.salvage_fraction);
      writtenOff += sched.reduce((a, b) => a + b, 0);
      for (let i = 0; i < sched.length; i++) dep[start + i] += sched[i];
    }
    const stranded = expectedTotal - writtenOff;
    return { sched: dep, stranded, expectedTotal };
  }

  // ---------------------------------------------------------------------------
  // Plant — mirrors openpytea.plant.Plant (scalar path)
  // ---------------------------------------------------------------------------
  const PLANT_DEFAULTS = {
    country: 'United States', region: 'Gulf Coast', currency: 'USD',
    exchange_rate: 1.0, working_capital: null,
    interest_rate: 0.09, project_lifetime: 20, plant_utilization: 1,
    tax_rate: 0, depreciation: null,
    operators_per_shift: null, operators_hired: null,
    production_type: 'continuous',
    working_weeks_per_year: 49, working_shifts_per_week: 5,
    operating_shifts_per_day: 3,
    additional_capex_years: null, additional_capex_cost: null,
    operator_hourly_rate: {}, project_uncertainties: {},
    variable_opex_inputs: {}, plant_products: {},
    fc: null, fp: null, capex_ramp: null, production_ramp: null,
    loc_factor: null, fixed_opex_factors: {}, fixed_opex_components: {},
    fixed_capital_factors: {}, fixed_capital_components: {},
  };

  function newPlant(plantCfg, equipmentSpecs) {
    const cfg = Object.assign(deepCopy(PLANT_DEFAULTS), deepCopy(plantCfg || {}));
    assertNoDependencies(cfg, 'Plant config');
    // Normalize None-ish equipment specs; cost each unit now (raises like Python).
    const specs = equipmentSpecs || [];
    const equipment = specs.map((s) => costEquipment(s));
    return { cfg, equipment, warnings: [] };
  }

  function resolveLocFactor(p) {
    const cfg = p.cfg;
    if (cfg.loc_factor != null) return cfg.loc_factor;
    const LF = D().loc_factors;
    if (!Object.prototype.hasOwnProperty.call(LF, cfg.country)) {
      fail(`Country not found: ${cfg.country}. Available countries: ${Object.keys(LF).join(', ')}`);
    }
    const lf = LF[cfg.country];
    if (lf != null && typeof lf === 'object') {
      if (!Object.prototype.hasOwnProperty.call(lf, cfg.region)) {
        fail(`Region not found: ${cfg.region}. Available regions: ${Object.keys(lf).join(', ')}`);
      }
      return lf[cfg.region];
    }
    return lf;
  }

  function calculatePurchasedCost(p) {
    p.purchased_cost = p.equipment.reduce((a, e) => a + e.purchased_cost, 0) * p.cfg.exchange_rate;
    return p.purchased_cost;
  }

  function calculateISBL(p, fc) {
    if (fc === undefined) fc = 1.0;
    p.isbl = p.equipment.reduce((a, e) => a + e.direct_cost, 0)
      * resolveLocFactor(p) * fc * p.cfg.exchange_rate;
    return p.isbl;
  }

  function calculateFixedCapital(p, fc) {
    // None keeps configured factor; bare call must not clobber fc != 1.
    if (fc !== undefined && fc !== null) p.cfg.fc = fc;
    else if (p.cfg.fc == null) p.cfg.fc = 1.0;
    calculateISBL(p, p.cfg.fc);
    const PT = D().process_types;
    if (!Object.prototype.hasOwnProperty.call(PT, p.cfg.process_type)) {
      fail(`Unsupported process_type '${p.cfg.process_type}'. Valid types: ${Object.keys(PT).join(', ')}`);
    }
    const params = PT[p.cfg.process_type];
    const f = { osbl: params.OS, de: params.DE, contingency: params.X };
    const fcf = p.cfg.fixed_capital_factors || {};
    for (const k of Object.keys(fcf)) if (fcf[k] != null) f[k] = fcf[k];
    const c = {};
    const fcc = p.cfg.fixed_capital_components || {};
    for (const k of Object.keys(fcc)) if (fcc[k] != null) c[k] = fcc[k];
    p.osbl = ('osbl' in c) ? c.osbl : f.osbl * p.isbl;
    p.dne = ('dne' in c) ? c.dne : f.de * (p.isbl + p.osbl);
    p.contigency = ('contingency' in c) ? c.contingency : f.contingency * (p.isbl + p.osbl);
    p.fixed_capital = p.isbl + p.osbl + p.dne + p.contigency;
    return p.fixed_capital;
  }

  function calculateVariableOpex(p) {
    p.variable_production_costs = 0;
    p.variable_opex_breakdown = {};
    const inputs = p.cfg.variable_opex_inputs || {};
    for (const item of Object.keys(inputs)) {
      const det = inputs[item] || {};
      const consumption = det.consumption != null ? det.consumption : 0;
      const price = det.price != null ? det.price : 0;
      const cost = consumption * price * 365 * p.cfg.plant_utilization;
      p.variable_opex_breakdown[item] = cost;
      p.variable_production_costs += cost;
    }
    return p.variable_production_costs;
  }

  function calculateRevenue(p) {
    p.revenue = 0;
    p.revenue_breakdown = {};
    const prods = p.cfg.plant_products || {};
    const keys = Object.keys(prods);
    p.main_product = keys.length ? keys[0] : null;
    for (const prod of keys) {
      const det = prods[prod] || {};
      const production = det.production != null ? det.production : 0;
      const price = det.price != null ? det.price : 0;
      const rev = production * price * 365 * p.cfg.plant_utilization;
      p.revenue_breakdown[prod] = rev;
      p.revenue += rev;
    }
    return p.revenue;
  }

  function countProcessSteps(p, targets, excluded) {
    let count = 0;
    for (const e of p.equipment) {
      if (targets.has(e.process_type) && !excluded.has(e.category)) count++;
    }
    return count;
  }

  function calculateOperatorsPerShift(p, noFluid, noSolid) {
    if (p.cfg.operators_per_shift != null) return p.cfg.operators_per_shift;
    if (p.cfg.production_type !== 'continuous' && p.cfg.production_type !== 'batch') {
      fail(`Unsupported production_type '${p.cfg.production_type}'. Expected 'continuous' or 'batch'.`);
    }
    const isBatch = p.cfg.production_type === 'batch';
    if (noFluid == null) {
      noFluid = countProcessSteps(p, new Set(['Fluids', 'Mixed']), new Set(['Pumps', 'Pressure vessels']));
    }
    if (noSolid == null) {
      noSolid = countProcessSteps(p, new Set(['Solids', 'Mixed']), new Set(['Pumps', 'Pressure vessels']));
    }
    p.no_fluid_process = noFluid;
    p.no_solid_process = noSolid;
    let ops;
    if (noSolid > 2) ops = 3.0 + noSolid;
    else ops = Math.pow(6.29 + 31.7 * noSolid * noSolid + 0.23 * noFluid, 0.5);
    if (isBatch) ops = Math.max(3.0, ops);
    return ops;
  }

  function calculateOperatorsHired(p, noFluid, noSolid) {
    if (p.cfg.operators_hired != null) return p.cfg.operators_hired;
    const perShift = calculateOperatorsPerShift(p, noFluid, noSolid);
    const operatingShiftsPerYear = 365 * p.cfg.operating_shifts_per_day;
    const workingShiftsPerYear = p.cfg.working_weeks_per_year * p.cfg.working_shifts_per_week;
    return Math.ceil(perShift * operatingShiftsPerYear / workingShiftsPerYear);
  }

  function operatorRate(p) {
    const rc = p.cfg.operator_hourly_rate;
    if (rc != null && typeof rc === 'object') {
      return rc.rate != null ? rc.rate : 38.11;
    }
    return (rc == null) ? 38.11 : Number(rc);
  }

  function calculateOperatingLabor(p, noFluid, noSolid) {
    const hired = calculateOperatorsHired(p, noFluid, noSolid);
    p.operators_hired_calc = hired;
    const workingShiftsPerYear = p.cfg.working_weeks_per_year * p.cfg.working_shifts_per_week;
    const workingHoursPerYear = workingShiftsPerYear * (24 / p.cfg.operating_shifts_per_day);
    p.working_hours_per_year = workingHoursPerYear;
    p.operating_labor_costs = hired * workingHoursPerYear * operatorRate(p);
    return p.operating_labor_costs;
  }

  const FIXED_OPEX_DEFAULTS = {
    supervision: 0.25, direct_salary_overhead: 0.5, laboratory_charges: 0.10,
    maintenance: 0.05, taxes_insurance: 0.015, rent_of_land: 0.015,
    environmental_charges: 0.01, operating_supplies: 0.009,
    general_plant_overhead: 0.65, working_capital: 0.15,
    patents_royalties: 0.02, distribution_selling: 0.02, rnd: 0.03,
  };

  function calculateFixedOpex(p, fp) {
    if (fp !== undefined && fp !== null) p.cfg.fp = fp;
    else if (p.cfg.fp == null) p.cfg.fp = 1.0;
    calculateFixedCapital(p, p.cfg.fc);
    calculateVariableOpex(p);
    calculateOperatingLabor(p);
    const f = Object.assign({}, FIXED_OPEX_DEFAULTS);
    const fof = p.cfg.fixed_opex_factors || {};
    for (const k of Object.keys(fof)) if (fof[k] != null) f[k] = fof[k];
    const c = {};
    const foc = p.cfg.fixed_opex_components || {};
    for (const k of Object.keys(foc)) if (foc[k] != null) c[k] = foc[k];

    p.supervision_costs = ('supervision_costs' in c) ? c.supervision_costs
      : f.supervision * p.operating_labor_costs;
    p.direct_salary_overhead = ('direct_salary_overhead' in c) ? c.direct_salary_overhead
      : f.direct_salary_overhead * (p.operating_labor_costs + p.supervision_costs);
    p.laboratory_charges = ('laboratory_charges' in c) ? c.laboratory_charges
      : f.laboratory_charges * p.operating_labor_costs;
    p.maintenance_costs = ('maintenance_costs' in c) ? c.maintenance_costs
      : f.maintenance * p.isbl;
    p.taxes_insurance_costs = ('taxes_insurance_costs' in c) ? c.taxes_insurance_costs
      : f.taxes_insurance * p.isbl;
    p.rent_of_land_costs = ('rent_of_land_costs' in c) ? c.rent_of_land_costs
      : f.rent_of_land * (p.isbl + p.osbl);
    p.environmental_charges = ('environmental_charges' in c) ? c.environmental_charges
      : f.environmental_charges * (p.isbl + p.osbl);
    p.operating_supplies = ('operating_supplies' in c) ? c.operating_supplies
      : f.operating_supplies * p.isbl;
    p.general_plant_overhead = ('general_plant_overhead' in c) ? c.general_plant_overhead
      : f.general_plant_overhead * (p.operating_labor_costs + p.supervision_costs + p.direct_salary_overhead);

    // Auto working capital tracks fixed_capital; user value kept as-is.
    if (p.cfg.working_capital == null) {
      p.working_capital = f.working_capital * p.fixed_capital;
    } else {
      p.working_capital = p.cfg.working_capital;
    }
    p.interest_working_capital = p.working_capital * p.cfg.interest_rate;

    p.fixed_production_costs =
      p.operating_labor_costs + p.supervision_costs + p.direct_salary_overhead +
      p.laboratory_charges + p.maintenance_costs + p.taxes_insurance_costs +
      p.rent_of_land_costs + p.environmental_charges + p.operating_supplies +
      p.general_plant_overhead + p.interest_working_capital;

    const markup = f.patents_royalties + f.distribution_selling + f.rnd;
    const ccop = (p.variable_production_costs + p.fixed_production_costs) / (1 - markup);
    p.patents_royalties = ('patents_royalties' in c) ? c.patents_royalties
      : f.patents_royalties * ccop;
    p.distribution_selling_costs = ('distribution_selling_costs' in c) ? c.distribution_selling_costs
      : f.distribution_selling * ccop;
    p.RnD_costs = ('RnD_costs' in c) ? c.RnD_costs : f.rnd * ccop;
    p.fixed_production_costs += p.patents_royalties + p.distribution_selling_costs + p.RnD_costs;
    p.fixed_production_costs *= p.cfg.fp;
    return p.fixed_production_costs;
  }

  function asRampArray(v, name, nYears, kind) {
    let arr;
    if (v == null) {
      arr = (kind === 'capex') ? [0.3, 0.6, 0.1] : [0, 0, 0.4, 0.8];
    } else {
      if (!Array.isArray(v) || v.length === 0) fail(`${name} must be a non-empty 1-D list or array.`);
      arr = v.map(Number);
      if (kind === 'capex') {
        if (arr.some((x) => !(x >= 0))) fail('All values in capex_ramp must be >= 0.');
        const s = arr.reduce((a, b) => a + b, 0);
        if (Math.abs(s - 1.0) > 1e-6) fail(`capex_ramp must sum to 1.0 (got ${s.toFixed(6)}).`);
        if (arr.length >= nYears) {
          fail(`capex_ramp has ${arr.length} entries but project_lifetime is only ${nYears}; at least 1 year must remain for production.`);
        }
      } else {
        if (arr.some((x) => !(x >= 0 && x <= 1))) {
          fail('All values in production_ramp must be between 0 and 1.');
        }
        if (arr.length > nYears) {
          fail(`production_ramp has ${arr.length} entries but project_lifetime is only ${nYears}.`);
        }
      }
    }
    return arr;
  }

  function calculateCashFlow(p) {
    calculateFixedCapital(p, p.cfg.fc);
    calculateVariableOpex(p);
    calculateFixedOpex(p, p.cfg.fp);
    calculateRevenue(p);

    const lifetime = pyInt(p.cfg.project_lifetime);
    if (!(lifetime >= 3)) fail('All project_lifetime values must be ≥3.');
    const nYears = lifetime;
    const FC = p.fixed_capital;
    const fixedOpex = p.fixed_production_costs;
    const varOpex = p.variable_production_costs;

    const capexRamp = asRampArray(p.cfg.capex_ramp, 'capex_ramp', nYears, 'capex');
    const prodRampRaw = asRampArray(p.cfg.production_ramp, 'production_ramp', nYears, 'prod');
    const ramp = prodRampRaw.concat(new Array(Math.max(0, nYears - prodRampRaw.length)).fill(1)).slice(0, nYears);

    const capex = new Array(nYears).fill(0);
    const mainRevenue = new Array(nYears).fill(0);
    const sideRevenue = new Array(nYears).fill(0);
    const revenue = new Array(nYears).fill(0);
    const cashCost = new Array(nYears).fill(0);
    const grossProfit = new Array(nYears).fill(0);
    const depreciation = new Array(nYears).fill(0);
    const taxableIncome = new Array(nYears).fill(0);
    const taxPaid = new Array(nYears).fill(0);
    const cashFlow = new Array(nYears).fill(0);
    const prodArr = new Array(nYears).fill(0);

    // CAPEX profile + WC draw/release.
    capexRamp.forEach((frac, yr) => { if (yr < nYears) capex[yr] += FC * frac; });
    const wcYear = capexRamp.length - 1;
    if (wcYear < nYears) capex[wcYear] += p.working_capital;
    capex[lifetime - 1] -= p.working_capital;

    // Additional CAPEX at specified (1-indexed) years; invalid years ignored.
    if (p.cfg.additional_capex_years != null && p.cfg.additional_capex_cost != null) {
      const yrs = p.cfg.additional_capex_years.map(pyInt);
      const costs = p.cfg.additional_capex_cost.map(Number);
      if (yrs.length !== costs.length) {
        fail('The number of additional_capex_years must match the number of additional_capex_cost entries.');
      }
      yrs.forEach((year, i) => {
        if (year < 1 || year > nYears) return;
        if (lifetime >= year) capex[year - 1] += costs[i];
      });
    }

    // Production ramp.
    const prods = p.cfg.plant_products || {};
    if (!Object.keys(prods).length || p.main_product == null) {
      fail('No plant_products defined; cannot build cash flow / production profile.');
    }
    p.daily_prod = prods[p.main_product].production;
    const nameplate = p.daily_prod * 365.0 * p.cfg.plant_utilization;
    const sideKeys = Object.keys(prods).filter((k) => k !== p.main_product);

    // Depreciation (scalar: single config).
    const capexByYear = capexRamp.map((frac, yr) => [yr, frac * FC]);
    const depRes = buildDepreciationArray(lifetime, capexByYear, p.cfg.depreciation);
    for (let i = 0; i < lifetime; i++) depreciation[i] = depRes.sched[i];
    const stranded = depRes.stranded, expTot = depRes.expectedTotal;
    if (stranded > Math.max(1e-6, 1e-9 * expTot)) {
      p.warnings.push('Depreciation life exceeds the usable horizon (project lifetime minus service start year), so part of the depreciable basis is not written off within the project.');
    }

    for (let yr = 0; yr < nYears; yr++) {
      const prod = nameplate * ramp[yr];
      prodArr[yr] = prod;
      const mainPrice = prods[p.main_product].price;
      mainRevenue[yr] = (mainPrice == null) ? 0 : prod * mainPrice;
      let side = 0;
      for (const k of sideKeys) {
        const e = prods[k];
        side += (e.production || 0) * 365.0 * p.cfg.plant_utilization * ramp[yr] * (e.price != null ? e.price : 0);
      }
      sideRevenue[yr] = side;
      revenue[yr] = mainRevenue[yr] + sideRevenue[yr];
      cashCost[yr] = fixedOpex + varOpex * ramp[yr];
      grossProfit[yr] = revenue[yr] - cashCost[yr];
      taxableIncome[yr] = grossProfit[yr] - depreciation[yr];
      if (yr === 0) taxPaid[yr] = 0;
      else {
        const prev = taxableIncome[yr - 1];
        taxPaid[yr] = prev > 0 ? p.cfg.tax_rate * prev : 0;
      }
      cashFlow[yr] = grossProfit[yr] - taxPaid[yr] - capex[yr];
    }

    p.capital_cost_array = capex;
    p.side_revenue_array = sideRevenue;
    p.main_revenue_array = mainRevenue;
    p.revenue_array = revenue;
    p.cash_cost_array = cashCost;
    p.gross_profit_array = grossProfit;
    p.depreciation_array = depreciation;
    p.taxable_income_array = taxableIncome;
    p.tax_paid_array = taxPaid;
    p.cash_flow = cashFlow;
    p.prod_array = prodArr;
    p.n_years = nYears;
    return cashFlow;
  }

  function calculateNPV(p) {
    calculateFixedCapital(p, p.cfg.fc == null ? 1.0 : p.cfg.fc);
    calculateVariableOpex(p);
    calculateFixedOpex(p, p.cfg.fp == null ? 1.0 : p.cfg.fp);
    calculateRevenue(p);
    calculateCashFlow(p);
    const r = p.cfg.interest_rate;
    let npv = 0;
    p.pv_array = p.cash_flow.map((cf, i) => {
      const pv = cf / Math.pow(1.0 + r, i + 1);
      npv += pv;
      return pv;
    });
    // cumulative npv array (mirrors npv_array)
    let run = 0;
    p.npv_array = p.pv_array.map((pv) => (run += pv));
    p.npv = npv;
    return npv;
  }

  function calculateLevelizedCost(p) {
    calculateFixedCapital(p, p.cfg.fc == null ? 1.0 : p.cfg.fc);
    calculateVariableOpex(p);
    calculateFixedOpex(p, p.cfg.fp == null ? 1.0 : p.cfg.fp);
    calculateRevenue(p);
    calculateCashFlow(p);
    const r = p.cfg.interest_rate;
    let discCapex = 0, discOpex = 0, discProd = 0, discSide = 0;
    for (let yr = 0; yr < p.n_years; yr++) {
      const df = Math.pow(1 + r, yr + 1);
      discCapex += p.capital_cost_array[yr] / df;
      discOpex += p.cash_cost_array[yr] / df;
      discSide += p.side_revenue_array[yr] / df;
      discProd += p.prod_array[yr] / df;
    }
    p.levelized_cost = Math.max((discCapex + discOpex - discSide) / discProd, 0);
    return p.levelized_cost;
  }

  function additionalCapexTotal(p) {
    if (p.cfg.additional_capex_cost == null) return null;
    return p.cfg.additional_capex_cost.reduce((a, b) => a + Number(b), 0);
  }

  function calculatePaybackTime(p, additionalCapex) {
    const rev = p.revenue_array, cf = p.cash_flow;
    const gen = [];
    for (let i = 0; i < cf.length; i++) if (rev[i] > 0) gen.push(cf[i]);
    if (!gen.length) { p.payback_time = NaN; return p.payback_time; }
    let total = p.fixed_capital;
    const add = additionalCapex ? additionalCapexTotal(p) : null;
    if (additionalCapex && add != null) total = p.fixed_capital + add;
    const avg = gen.reduce((a, b) => a + b, 0) / gen.length;
    p.payback_time = avg > 0 ? total / avg : NaN;
    return p.payback_time;
  }

  function calculateROI(p, additionalCapex) {
    let netSum = 0;
    for (let i = 0; i < p.gross_profit_array.length; i++) {
      netSum += p.gross_profit_array[i] - p.tax_paid_array[i];
    }
    let total = p.fixed_capital + p.working_capital;
    const add = additionalCapex ? additionalCapexTotal(p) : null;
    if (additionalCapex && add != null) total = p.fixed_capital + add + p.working_capital;
    p.roi = netSum * 100 / (p.cfg.project_lifetime * total);
    return p.roi;
  }

  // --- IRR: grid + Brent (mirrors scipy brentq use) ---
  function linspace(a, b, n) {
    const out = new Array(n);
    if (n === 1) { out[0] = a; return out; }
    for (let i = 0; i < n; i++) out[i] = a + (b - a) * (i / (n - 1));
    return out;
  }

  function brentq(f, a, b, xtol, rtol, maxiter) {
    let fa = f(a), fb = f(b);
    if (!(fa !== 0 && fb !== 0 && ((fa < 0) !== (fb < 0)))) {
      // scipy raises ValueError here; engine catches -> NaN. Mirror via throw.
      fail('brentq: f(a) and f(b) must have different signs');
    }
    if (Math.abs(fa) < Math.abs(fb)) { const t = a; a = b; b = t; const tf = fa; fa = fb; fb = tf; }
    let c = a, fc = fa;
    let mflag = true, d = 0, s = 0, fs = 0;
    for (let iter = 0; iter < maxiter; iter++) {
      if (Math.abs(fb) < xtol) return { root: b, converged: true };
      if (Math.abs(b - a) < Math.max(xtol, rtol * Math.abs(b))) return { root: b, converged: true };
      if (fa !== fc && fb !== fc) {
        // inverse quadratic interpolation
        s = (a * fb * fc) / ((fa - fb) * (fa - fc))
          + (b * fa * fc) / ((fb - fa) * (fb - fc))
          + (c * fa * fb) / ((fc - fa) * (fc - fb));
      } else {
        s = b - fb * (b - a) / (fb - fa); // secant
      }
      const cond1 = (s < (3 * a + b) / 4) || (s > b);
      const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
      const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
      const cond4 = mflag && Math.abs(b - c) < Math.max(xtol, rtol * Math.abs(b));
      const cond5 = !mflag && Math.abs(c - d) < Math.max(xtol, rtol * Math.abs(b));
      if (cond1 || cond2 || cond3 || cond4 || cond5) {
        s = (a + b) / 2;
        mflag = true;
      } else {
        mflag = false;
      }
      fs = f(s);
      d = c; c = b; fc = fb;
      if ((fa < 0) !== (fs < 0)) { b = s; fb = fs; }
      else { a = s; fa = fs; }
      if (Math.abs(fa) < Math.abs(fb)) {
        const t = a; a = b; b = t; const tf = fa; fa = fb; fb = tf;
      }
    }
    return { root: b, converged: false };
  }

  function irrFromCashFlow(cf1d) {
    const n = cf1d.length;
    if (n === 0) return NaN;
    let hasNeg = false, hasPos = false;
    for (const v of cf1d) { if (v < 0) hasNeg = true; if (v > 0) hasPos = true; }
    if (!(hasNeg && hasPos)) return NaN;
    const npvAt = (r) => {
      if (r <= -1.0) return Infinity;
      let s = 0;
      for (let i = 0; i < n; i++) s += cf1d[i] / Math.pow(1.0 + r, i + 1);
      return s;
    };
    const grid = linspace(-0.95, -0.01, 120).concat([0.0], linspace(0.01, 10.0, 240));
    const npvVals = grid.map(npvAt);
    const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
    let bracket = null;
    for (let i = 0; i < grid.length - 1; i++) {
      const a = grid[i], b = grid[i + 1];
      const fa = npvVals[i], fb = npvVals[i + 1];
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
      if (fa === 0.0) { bracket = [a - 1e-6, a + 1e-6]; break; }
      if (sgn(fa) !== sgn(fb)) { bracket = [a, b]; break; }
    }
    if (bracket === null) {
      let a = 0.01, b = 10.0;
      const fa = npvAt(a);
      let fb = npvAt(b);
      while (Number.isFinite(fb) && sgn(fa) === sgn(fb) && b < 1000.0) {
        b *= 1.5;
        fb = npvAt(b);
      }
      if (Number.isFinite(fb) && sgn(fa) !== sgn(fb)) bracket = [a, b];
    }
    if (bracket === null) return NaN;
    try {
      const sol = brentq(npvAt, bracket[0], bracket[1], 1e-10, 1e-10, 200);
      return (sol.converged && Number.isFinite(sol.root)) ? sol.root : NaN;
    } catch (e) {
      return NaN;
    }
  }

  function calculateIRR(p) {
    p.irr = irrFromCashFlow(p.cash_flow);
    return p.irr;
  }

  function calculateAll(p, additionalCapex) {
    calculateFixedCapital(p, p.cfg.fc);
    calculateVariableOpex(p);
    calculateFixedOpex(p, p.cfg.fp);
    calculateRevenue(p);
    calculateCashFlow(p);
    calculateNPV(p);
    calculateLevelizedCost(p);
    calculatePaybackTime(p, !!additionalCapex);
    calculateROI(p, !!additionalCapex);
    calculateIRR(p);
    return p;
  }

  function clonePlant(p) {
    // Deep copy config + equipment specs; equipment objects are pure data.
    const q = {
      cfg: deepCopy(p.cfg),
      equipment: deepCopy(p.equipment),
      warnings: [],
    };
    return q;
  }

  // ---------------------------------------------------------------------------
  // Sensitivity helpers — mirrors openpytea.helpers (_update_and_evaluate etc.)
  // ---------------------------------------------------------------------------
  const TOP_LEVEL_KEYS_SENS = ['fixed_capital', 'fixed_opex', 'project_lifetime',
    'interest_rate', 'operator_hourly_rate', 'plant_utilization', 'tax_rate'];
  const TOP_LEVEL_KEYS_TORNADO = ['fixed_capital', 'fixed_opex', 'project_lifetime',
    'interest_rate', 'operator_hourly_rate'];

  function getOriginalValue(p, fullKey) {
    if (fullKey.endsWith('.consumption') || fullKey.endsWith('.production')) {
      const parts = fullKey.split('.');
      const root = parts[0], name = parts[1], field = parts[2];
      return p.cfg[root][name][field];
    }
    const keys = fullKey.split('.');
    if (keys.length === 1) {
      // top-level attribute; fixed_capital/fixed_opex handled by callers via fc/fp.
      return p.cfg[fullKey];
    }
    const [root, name] = keys;
    return p.cfg[root][name].price;
  }

  function updateAndEvaluate(p, factor, value, nestedPriceKeys, metric, additionalCapex) {
    const q = clonePlant(p);
    metric = String(metric).toUpperCase();
    const parts = factor.split('.');
    if ((parts.length === 3) && (parts[2] === 'consumption' || parts[2] === 'production')) {
      const root = parts[0], name = parts[1], field = parts[2];
      q.cfg[root][name][field] = value;
    } else if (factor === 'fixed_capital') {
      calculateFixedCapital(q, value);
    } else if (factor === 'fixed_opex') {
      calculateFixedOpex(q, value);
    } else if (nestedPriceKeys.indexOf(factor) !== -1) {
      const root = parts[0], name = parts[1];
      if (root !== 'variable_opex_inputs' && root !== 'plant_products') {
        fail(`Unsupported nested price root '${root}' in factor '${factor}'.`);
      }
      q.cfg[root][name].price = value;
    } else if (factor === 'operator_hourly_rate') {
      const cur = q.cfg.operator_hourly_rate;
      if (cur != null && typeof cur === 'object') q.cfg.operator_hourly_rate = Object.assign({}, cur, { rate: value });
      else q.cfg.operator_hourly_rate = value;
    } else {
      q.cfg[factor] = value;
    }
    calculateLevelizedCost(q);
    if (metric === 'LCOP') return q.levelized_cost;
    if (metric === 'ROI') return calculateROI(q, !!additionalCapex);
    if (metric === 'NPV') return calculateNPV(q);
    if (metric === 'PBT' || metric === 'PAYBACK' || metric === 'PAYBACK_TIME') {
      return calculatePaybackTime(q, !!additionalCapex);
    }
    if (metric === 'IRR') return calculateIRR(q);
    fail(`Unsupported metric '${metric}'. Use 'LCOP', 'ROI', 'NPV', 'PBT', or 'IRR'.`);
  }

  function evaluateMetric(p, metric, additionalCapex) {
    metric = String(metric).toUpperCase();
    if (metric === 'LCOP') { calculateLevelizedCost(p); return p.levelized_cost; }
    if (metric === 'ROI') { calculateLevelizedCost(p); return calculateROI(p, !!additionalCapex); }
    if (metric === 'NPV') return calculateNPV(p);
    if (metric === 'PBT' || metric === 'PAYBACK' || metric === 'PAYBACK_TIME') {
      calculateLevelizedCost(p); return calculatePaybackTime(p, !!additionalCapex);
    }
    if (metric === 'IRR') { calculateLevelizedCost(p); return calculateIRR(p); }
    fail(`Unsupported metric '${metric}'.`);
  }

  // --- One-way sensitivity — mirrors analysis.sensitivity_data (single plant) ---
  function sensitivityData(p, parameter, metric, plusMinusValue, nPoints) {
    metric = String(metric).toUpperCase();
    nPoints = nPoints == null ? 21 : nPoints;
    const varKeys = Object.keys(p.cfg.variable_opex_inputs || {}).map((k) => `variable_opex_inputs.${k}`);
    const prodList = Object.keys(p.cfg.plant_products || {});
    const allProdKeys = prodList.map((k) => `plant_products.${k}`);
    const byprodKeys = prodList.slice(1).map((k) => `plant_products.${k}`);
    const nestedPriceKeys = (metric === 'LCOP') ? varKeys.concat(byprodKeys) : varKeys.concat(allProdKeys);
    const quantityKeys = Object.keys(p.cfg.variable_opex_inputs || {}).map((k) => `variable_opex_inputs.${k}.consumption`)
      .concat(prodList.map((k) => `plant_products.${k}.production`));
    const validParams = new Set(TOP_LEVEL_KEYS_SENS.concat(nestedPriceKeys, quantityKeys));

    // Shorthand resolution with ambiguity check.
    const shortToFull = {};
    const ambiguous = new Set();
    for (const k of Object.keys(p.cfg.variable_opex_inputs || {})) {
      const full = `variable_opex_inputs.${k}`;
      if ((k in shortToFull) && shortToFull[k] !== full) ambiguous.add(k);
      else shortToFull[k] = full;
      shortToFull[`${k}.consumption`] = `${full}.consumption`;
    }
    for (const k of prodList) {
      const full = `plant_products.${k}`;
      if ((k in shortToFull) && shortToFull[k] !== full) ambiguous.add(k);
      else shortToFull[k] = full;
      shortToFull[`${k}.production`] = `${full}.production`;
    }
    if (ambiguous.has(parameter)) {
      const opts = [];
      if ((p.cfg.variable_opex_inputs || {})[parameter] !== undefined) opts.push(`variable_opex_inputs.${parameter}`);
      if ((p.cfg.plant_products || {})[parameter] !== undefined) opts.push(`plant_products.${parameter}`);
      fail(`Ambiguous shorthand '${parameter}'. Seen both ${opts.sort().join(' and ')}. Please use full path.`);
    }
    parameter = (parameter in shortToFull) ? shortToFull[parameter] : parameter;
    if (!validParams.has(parameter)) fail(`Unrecognized parameter: ${parameter}`);

    const pctChanges = linspace(-plusMinusValue, plusMinusValue, nPoints);
    const pctAxis = pctChanges.map((v) => v * 100);
    const baseValue = evaluateMetric(clonePlant(p), metric, false);

    let originalValue;
    if (parameter === 'fixed_capital') originalValue = (p.cfg.fc == null) ? 1.0 : p.cfg.fc;
    else if (parameter === 'fixed_opex') originalValue = (p.cfg.fp == null) ? 1.0 : p.cfg.fp;
    else if (parameter === 'operator_hourly_rate') originalValue = operatorRate(p);
    else originalValue = getOriginalValue(p, parameter);
    const paramValues = pctChanges.map((c) => originalValue * (1 + c));
    const y = paramValues.map((v) => updateAndEvaluate(p, parameter, v, nestedPriceKeys, metric, false));
    return { parameter, metric, x: pctAxis, y, baseline: baseValue };
  }

  // --- Tornado — mirrors analysis.tornado_data ---
  function tornadoData(p, plusMinusValue, metric, additionalCapex) {
    metric = String(metric).toUpperCase();
    const varKeys = Object.keys(p.cfg.variable_opex_inputs || {}).map((k) => `variable_opex_inputs.${k}`);
    const prodKeys = Object.keys(p.cfg.plant_products || {}).map((k) => `plant_products.${k}`);
    const nested = (metric === 'LCOP') ? varKeys : varKeys.concat(prodKeys);
    const keys = TOP_LEVEL_KEYS_TORNADO.concat(nested);
    const baseValue = evaluateMetric(clonePlant(p), metric, !!additionalCapex);
    const lows = [], highs = [];
    for (const key of keys) {
      let original;
      if (key === 'fixed_capital') original = (p.cfg.fc == null) ? 1.0 : p.cfg.fc;
      else if (key === 'fixed_opex') original = (p.cfg.fp == null) ? 1.0 : p.cfg.fp;
      else if (key === 'operator_hourly_rate') {
        const cur = p.cfg.operator_hourly_rate;
        if (cur != null && typeof cur === 'object') original = (cur.rate != null) ? cur.rate : 0.0;
        else original = (cur == null) ? 0.0 : Number(cur);
      }
      else original = getOriginalValue(p, key);
      const low = original * (1 - plusMinusValue);
      const high = original * (1 + plusMinusValue);
      lows.push(updateAndEvaluate(p, key, low, nested, metric, !!additionalCapex));
      highs.push(updateAndEvaluate(p, key, high, nested, metric, !!additionalCapex));
    }
    const order = keys.map((_, i) => i).sort((a, b) =>
      Math.abs(highs[a] - lows[a]) - Math.abs(highs[b] - lows[b]));
    return {
      factors: order.map((i) => keys[i]),
      lows: order.map((i) => lows[i]),
      highs: order.map((i) => highs[i]),
      base_value: baseValue, metric,
      plus_minus_value: plusMinusValue,
    };
  }

  // ---------------------------------------------------------------------------
  // Monte Carlo — mirrors analysis.monte_carlo (independent inputs, no DAG)
  // ---------------------------------------------------------------------------
  // Seeded PRNG (mulberry32) + Box-Muller normal.
  function mulberry32(seed) {
    let a = (seed == null ? (Math.random() * 0x100000000) : seed) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNormalSampler(rand) {
    let spare = null;
    return function (loc, scale) {
      if (spare == null) {
        let u = 0, v = 0;
        while (u === 0) u = rand();
        v = rand();
        const mag = Math.sqrt(-2.0 * Math.log(u));
        spare = mag * Math.sin(2.0 * Math.PI * v);
        return loc + scale * mag * Math.cos(2.0 * Math.PI * v);
      }
      const z = spare; spare = null;
      return loc + scale * z;
    };
  }

  // Truncated-normal sampling with rejection (mirrors sample_distribution for
  // dist_id 3; dist 0/1 constant; uniform min/max for dist 4/5-style cfgs).
  function sampleValues(distId, n, loc, scale, minimum, maximum, rand, randn) {
    if (distId === 0 || distId === 1) {
      const v = (loc == null) ? 0.0 : loc;
      return new Array(n).fill(v);
    }
    if (scale === 0 || scale == null) {
      // scipy norm(loc, 0).rvs -> constant loc (bounds contain it by construction)
      const v = (loc == null) ? 0.0 : loc;
      return new Array(n).fill(v);
    }
    const out = new Array(n);
    let filled = 0, guard = 0;
    // Uniform-style ids (4,5): draw uniform in [minimum, maximum].
    const isUniform = (distId === 4 || distId === 5);
    while (filled < n) {
      if (++guard > 500) {
        fail(`Truncated sampling accepted only ${filled}/${n} draws (dist_id=${distId}, loc=${loc}, scale=${scale}, minimum=${minimum}, maximum=${maximum}).`);
      }
      const batch = (n - filled) * 2;
      for (let i = 0; i < batch && filled < n; i++) {
        let x;
        if (isUniform) {
          x = minimum + rand() * (maximum - minimum);
        } else {
          x = randn(loc, scale);
        }
        if (minimum != null && x < minimum) continue;
        if (maximum != null && x > maximum) continue;
        out[filled++] = x;
      }
    }
    return out;
  }

  function resolveScale(cfg, dflt) {
    if (cfg == null) return dflt;
    if (cfg.scale != null) return cfg.scale;
    if (cfg.std != null) return cfg.std;
    if (cfg.noise != null) return cfg.noise;
    return dflt;
  }
  function hasUncertainty(cfg) {
    if (cfg == null) return false;
    return resolveScale(cfg, 0) > 0 || ('dist_id' in cfg);
  }
  function resolveDistParams(cfg, dflt) {
    cfg = cfg || {};
    const distId = (cfg.dist_id != null) ? cfg.dist_id : (dflt.id != null ? dflt.id : 3);
    let loc = dflt.loc;
    if (cfg.loc != null) loc = cfg.loc;
    else if (cfg.mean != null) loc = cfg.mean;
    else if (cfg.price != null) loc = cfg.price;
    else if (cfg.rate != null) loc = cfg.rate;
    const scale = resolveScale(cfg, dflt.scale != null ? dflt.scale : 0.0);
    const minimum = (cfg.minimum != null) ? cfg.minimum : ((cfg.min != null) ? cfg.min : dflt.min);
    const maximum = (cfg.maximum != null) ? cfg.maximum : ((cfg.max != null) ? cfg.max : dflt.max);
    return { distId, loc, scale, minimum, maximum };
  }
  function resolvePriceDistParams(props) {
    const baseline = (props.price != null) ? props.price : 0.0;
    const cfg = (props.price_uncertainty != null) ? props.price_uncertainty : props;
    const std = resolveScale(cfg, 0);
    let dmin = baseline - 2 * std;
    if (baseline >= 0) dmin = Math.max(0.0, dmin);
    return resolveDistParams(cfg, { loc: baseline, scale: 0, min: dmin, max: baseline + 2 * std });
  }
  function resolveRateDistParams(props) {
    const baseline = (props.rate != null) ? props.rate : 38.11;
    const cfg = (props.rate_uncertainty != null) ? props.rate_uncertainty : props;
    const std = resolveScale(cfg, 10);
    let dmin = baseline - 2 * std;
    if (baseline >= 0) dmin = Math.max(0.0, dmin);
    return resolveDistParams(cfg, { loc: baseline, scale: 10, min: dmin, max: baseline + 2 * std });
  }

  function monteCarlo(p, opts) {
    opts = opts || {};
    const numSamples = opts.num_samples || 20000;
    const additionalCapex = !!opts.additional_capex;
    // Baseline-init (mirrors Python; result unused but validates config).
    const chk = clonePlant(p);
    calculateFixedCapital(chk, chk.cfg.fc == null ? 1.0 : chk.cfg.fc);
    calculateVariableOpex(chk);
    calculateFixedOpex(chk, chk.cfg.fp == null ? 1.0 : chk.cfg.fp);
    calculateCashFlow(chk);
    calculateLevelizedCost(chk);

    const rand = mulberry32(opts.random_seed);
    const randn = makeNormalSampler(rand);
    const pu = p.cfg.project_uncertainties || {};
    const S = (d, n) => sampleValues(d.distId, n, d.loc, d.scale, d.minimum, d.maximum, rand, randn);

    // Draw order mirrors Python (fixed order; rng shared) for structural parity.
    let utilSamples = null, taxSamples = null;
    const utilCfg = pu.plant_utilization || {};
    if (hasUncertainty(utilCfg)) {
      const std = resolveScale(utilCfg, 0);
      const mean = p.cfg.plant_utilization;
      utilSamples = S(resolveDistParams(utilCfg, {
        loc: mean, scale: std,
        min: Math.max(0.0, mean - 2 * std), max: Math.min(1.0, mean + 2 * std),
      }), numSamples);
    }
    const taxCfg = pu.tax_rate || {};
    if (hasUncertainty(taxCfg)) {
      const std = resolveScale(taxCfg, 0);
      const mean = p.cfg.tax_rate;
      taxSamples = S(resolveDistParams(taxCfg, {
        loc: mean, scale: std,
        min: Math.max(0.0, mean - 2 * std), max: Math.min(1.0, mean + 2 * std),
      }), numSamples);
    }
    const fcD = resolveDistParams(pu.fixed_capital_factor || {}, { loc: 1, scale: 0.3, min: 0.25, max: 1.75 });
    const foD = resolveDistParams(pu.fixed_opex_factor || {}, { loc: 1, scale: 0.3, min: 0.25, max: 1.75 });
    const ltStd = resolveScale(pu.project_lifetime || {}, 5);
    const ltD = resolveDistParams(pu.project_lifetime || {}, {
      loc: p.cfg.project_lifetime, scale: ltStd,
      min: Math.max(5, p.cfg.project_lifetime - 2 * ltStd),
      max: p.cfg.project_lifetime + 2 * ltStd,
    });
    const irStd = resolveScale(pu.interest_rate || {}, 0.03);
    const irD = resolveDistParams(pu.interest_rate || {}, {
      loc: p.cfg.interest_rate, scale: irStd,
      min: Math.max(0.02, p.cfg.interest_rate - 2 * irStd),
      max: p.cfg.interest_rate + 2 * irStd,
    });
    const opCfg = (p.cfg.operator_hourly_rate != null && typeof p.cfg.operator_hourly_rate === 'object')
      ? p.cfg.operator_hourly_rate : { rate: operatorRate(p) };
    const opD = resolveRateDistParams(opCfg);

    const fcS = S(fcD, numSamples);
    const foS = S(foD, numSamples);
    const opS = S(opD, numSamples);
    const ltS = S(ltD, numSamples);
    const irS = S(irD, numSamples);

    const varPrice = {}, varCons = {};
    const varInputs = p.cfg.variable_opex_inputs || {};
    for (const item of Object.keys(varInputs)) {
      const props = varInputs[item] || {};
      varPrice[item] = S(resolvePriceDistParams(props), numSamples);
      const consCfg = props.consumption_uncertainty || {};
      const baseline = (props.consumption != null) ? props.consumption : 0;
      if (hasUncertainty(consCfg)) {
        const std = resolveScale(consCfg, 0);
        varCons[item] = S(resolveDistParams(consCfg, {
          loc: baseline, scale: std,
          min: Math.max(0.0, baseline - 2 * std), max: baseline + 2 * std,
        }), numSamples);
      } else {
        varCons[item] = new Array(numSamples).fill(baseline);
      }
    }
    const prods = p.cfg.plant_products || {};
    const prodKeys = Object.keys(prods);
    const havePrices = prodKeys.length > 0 && prodKeys.every((k) => (prods[k] || {}).price != null);
    const prodPrice = {};
    if (havePrices) {
      for (const k of prodKeys) prodPrice[k] = S(resolvePriceDistParams(prods[k] || {}), numSamples);
    }
    const prodProd = {};
    for (const k of prodKeys) {
      const props = prods[k] || {};
      const cfgU = props.production_uncertainty || {};
      const baseline = (props.production != null) ? props.production : 0;
      if (hasUncertainty(cfgU)) {
        const std = resolveScale(cfgU, 0);
        prodProd[k] = S(resolveDistParams(cfgU, {
          loc: baseline, scale: std,
          min: Math.max(0.0, baseline - 2 * std), max: baseline + 2 * std,
        }), numSamples);
      } else {
        prodProd[k] = new Array(numSamples).fill(baseline);
      }
    }

    // Evaluate per sample (scalar engine).
    const mLCOP = new Array(numSamples).fill(0);
    const mROI = new Array(numSamples).fill(0);
    const mNPV = new Array(numSamples).fill(0);
    const mPBT = new Array(numSamples).fill(0);
    const baseCfg = deepCopy(p.cfg);
    const baseEquip = p.equipment; // equipment costs are sample-independent
    for (let i = 0; i < numSamples; i++) {
      const q = { cfg: deepCopy(baseCfg), equipment: baseEquip, warnings: [] };
      q.cfg.operator_hourly_rate = { rate: opS[i] };
      q.cfg.project_lifetime = ltS[i];
      q.cfg.interest_rate = irS[i];
      if (utilSamples) q.cfg.plant_utilization = utilSamples[i];
      if (taxSamples) q.cfg.tax_rate = taxSamples[i];
      for (const item of Object.keys(varInputs)) {
        q.cfg.variable_opex_inputs[item] = Object.assign({}, q.cfg.variable_opex_inputs[item],
          { price: varPrice[item][i], consumption: varCons[item][i] });
      }
      if (havePrices) {
        for (const k of prodKeys) {
          q.cfg.plant_products[k] = Object.assign({}, q.cfg.plant_products[k], { price: prodPrice[k][i] });
        }
      }
      for (const k of prodKeys) {
        q.cfg.plant_products[k] = Object.assign({}, q.cfg.plant_products[k], { production: prodProd[k][i] });
      }
      try {
        calculateFixedCapital(q, fcS[i]);
        calculateVariableOpex(q);
        calculateFixedOpex(q, foS[i]);
        calculateCashFlow(q);
        calculateLevelizedCost(q);
        mLCOP[i] = q.levelized_cost;
        if (havePrices) {
          mNPV[i] = calculateNPV(q);
          mROI[i] = calculateROI(q, additionalCapex);
          mPBT[i] = calculatePaybackTime(q, additionalCapex);
        }
      } catch (e) {
        mLCOP[i] = NaN;
        if (havePrices) { mNPV[i] = NaN; mROI[i] = NaN; mPBT[i] = NaN; }
      }
    }

    const title = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const inputs = {
      'Fixed capital factor': fcS, 'Fixed opex factor': foS,
      'Operator hourly rate': opS, 'Project lifetime': ltS, 'Interest rate': irS,
    };
    if (utilSamples) inputs['Plant utilization'] = utilSamples;
    if (taxSamples) inputs['Tax rate'] = taxSamples;
    for (const k of Object.keys(varPrice)) inputs[`${title(k)} price`] = varPrice[k];
    for (const k of Object.keys(varCons)) inputs[`${title(k)} consumption`] = varCons[k];
    for (const k of Object.keys(prodPrice)) inputs[`${title(k)} product price`] = prodPrice[k];
    for (const k of Object.keys(prodProd)) inputs[`${title(k)} production`] = prodProd[k];

    return {
      name: p.cfg.plant_name || 'Plant',
      metrics: { LCOP: mLCOP, ROI: mROI, NPV: mNPV, PBT: mPBT },
      inputs, num_samples: numSamples,
      additional_capex: additionalCapex,
      currency: p.cfg.currency || 'USD',
    };
  }

  // ---------------------------------------------------------------------------
  // Small public helpers (UI + tests)
  // ---------------------------------------------------------------------------
  function listCategories() {
    const s = new Set(D().correlations.map((r) => r.category));
    return Array.from(s).sort();
  }
  function listTypes(category) {
    const out = [];
    for (const r of D().correlations) {
      if (r.category === category) out.push(r.type == null ? '' : r.type);
    }
    return Array.from(new Set(out)).sort();
  }
  function cepciFactor(costYear, targetYear) {
    return cepciValue(targetYear) / cepciValue(costYear);
  }

  root.TEA = {
    costEquipment, evaluateCorrelation, correlationKeyFor, correlationRow,
    inflationAdjustment, cepciValue, cepciFactor,
    listCategories, listTypes,
    newPlant, clonePlant, operatorRate,
    calculatePurchasedCost, calculateISBL, calculateFixedCapital,
    calculateVariableOpex, calculateRevenue,
    calculateOperatorsPerShift, calculateOperatorsHired, calculateOperatingLabor,
    calculateFixedOpex, calculateCashFlow, calculateNPV, calculateLevelizedCost,
    calculatePaybackTime, calculateROI, calculateIRR, calculateAll,
    sensitivityData, tornadoData, monteCarlo,
    buildDepreciationArray, normalizeDepConfig,
    TOP_LEVEL_KEYS_SENS, TOP_LEVEL_KEYS_TORNADO,
    deepCopy, pyInt,
  };
})(typeof window !== 'undefined' ? window : globalThis);
