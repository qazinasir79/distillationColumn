/* =========================================================
   Distillation Lab — interactive concept widgets
   W.init.<procId>(container) builds + wires one widget.
   ========================================================= */

const W = { init: {} };

const Rg = 8.314;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

function bisect(f, lo, hi, iters = 80) {
  let a = lo, b = hi, fa = f(lo);
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2, fm = f(m);
    if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
  }
  return (a + b) / 2;
}

/* ---------- tiny chart helpers ---------- */
function scales(W, H, pad, xmin, xmax, ymin, ymax, logx = false) {
  const lx = v => Math.log10(v);
  const sx = x => logx ? pad.l + (lx(x) - lx(xmin)) / (lx(xmax) - lx(xmin)) * (W - pad.l - pad.r)
                        : pad.l + (x - xmin) / (xmax - xmin) * (W - pad.l - pad.r);
  const sy = y => H - pad.b - (y - ymin) / (ymax - ymin) * (H - pad.t - pad.b);
  return { sx, sy };
}
function frame(W, H, pad, xmin, xmax, ymin, ymax, o = {}) {
  let s = '';
  const ticks = [];
  for (let i = 0; i <= (o.nx ?? 5); i++) ticks.push(xmin + (xmax - xmin) * i / (o.nx ?? 5));
  if (o.logx) o.xticks = [10, 20, 50, 100, 200, 500, 760];
  (o.xticks || ticks).forEach(t => {
    const x = o.sx ? o.sx(t) : scales(W, H, pad, xmin, xmax, ymin, ymax, !!o.logx).sx(t);
    s += `<line x1="${x}" y1="${pad.t}" x2="${x}" y2="${H - pad.b}" stroke="#eee9dd" stroke-width="1"/>
      <text x="${x}" y="${H - pad.b + 16}" text-anchor="middle" font-size="10.5" fill="#8a94a3">${o.xtickf ? o.xtickf(t) : Math.round(t)}</text>`;
  });
  const yticks = [];
  for (let i = 0; i <= (o.ny ?? 4); i++) yticks.push(ymin + (ymax - ymin) * i / (o.ny ?? 4));
  (o.yticks || yticks).forEach(t => {
    const y = o.sy ? o.sy(t) : scales(W, H, pad, xmin, xmax, ymin, ymax, !!o.logx).sy(t);
    s += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#eee9dd" stroke-width="1"/>
      <text x="${pad.l - 7}" y="${y + 3.5}" text-anchor="end" font-size="10.5" fill="#8a94a3">${o.ytickf ? o.ytickf(t) : Math.round(t)}</text>`;
  });
  s += `<line x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}" stroke="#b8c0cc" stroke-width="1.5"/>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${H - pad.b}" stroke="#b8c0cc" stroke-width="1.5"/>`;
  if (o.xlab) s += `<text x="${(pad.l + W - pad.r) / 2}" y="${H - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#5b6675">${o.xlab}</text>`;
  if (o.ylab) s += `<text x="12" y="${(pad.t + H - pad.b) / 2}" text-anchor="middle" font-size="11" font-weight="700" fill="#5b6675" transform="rotate(-90 12 ${(pad.t + H - pad.b) / 2})">${o.ylab}</text>`;
  return s;
}
const pathFrom = (pts, sx, sy) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');

function widgetShell(id, color, ico, title, headExtra, body) {
  return `<div class="card widget" style="--wc:${color}">
    <div class="widget-head"><h3><span class="ico">${ico}</span>${title}</h3>${headExtra || ''}</div>
    ${body}
  </div>`;
}
function sliderHTML(pid, label, min, max, step, value, unit) {
  return `<div class="ctl-row"><label for="${pid}">${label}<output id="${pid}o">${value}${unit}</output></label>
    <input type="range" id="${pid}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}
function readoutHTML(pid, label) {
  return `<div class="readout"><div class="v" id="${pid}v">—</div><div class="l">${label}</div></div>`;
}
function bindRange(input, fn) {
  input.addEventListener('input', () => fn(parseFloat(input.value)));
}

/* =========================================================
   1. SIMPLE — boiling point gap tester
   ========================================================= */
W.init.simple = el => {
  el.innerHTML = widgetShell('simple', '#2563eb', '🌡️', 'Boiling point gap tester — when is simple distillation enough?',
    '',
    `<div class="ctl-cols">
      <div>${sliderHTML('simT1', 'Boiling point of lighter component', 40, 150, 1, 80, ' °C')}</div>
      <div>${sliderHTML('simT2', 'Boiling point of heavier component', 90, 250, 1, 110, ' °C')}</div>
    </div>
    <div id="simChart"></div>
    <div class="verdict" id="simVerdict"></div>
    <p class="hint">Rule of thumb from the notes: simple distillation works when <b>ΔTb &gt; 25–30 °C</b> (or for removing non-volatile impurities). Below that, use a fractionating column.</p>`);

  const t1 = el.querySelector('#simT1'), t2 = el.querySelector('#simT2');
  const chart = el.querySelector('#simChart'), verdict = el.querySelector('#simVerdict');

  function update() {
    let a = +t1.value, b = +t2.value;
    if (a > b) [a, b] = [b, a];
    t1.value = a; t2.value = b;
    el.querySelector('#simT1o').textContent = a + ' °C';
    el.querySelector('#simT2o').textContent = b + ' °C';
    const dT = b - a;

    // two temperature bars
    const H = 210, Wc = 420, pad = { l: 46, r: 16, t: 14, b: 26 };
    const s = scales(Wc, H, pad, 0, 260, 0, 260);
    let svg = `<svg viewBox="0 0 ${Wc} ${H}" style="width:100%;max-width:${Wc}px">`;
    svg += frame(Wc, H, pad, 0, 260, 0, 260, { sx: s.sx, sy: s.sy, xticks: [], yticks: [0, 50, 100, 150, 200, 250], ylab: 'Tb (°C)' });
    const yA = s.sy(a), yB = s.sy(b);
    svg += `<rect x="${s.sx(70)}" y="${yA}" width="52" height="${s.sy(0) - yA}" rx="6" fill="#cfe3f7" stroke="#2563eb" stroke-width="2"/>
      <rect x="${s.sx(190)}" y="${yB}" width="52" height="${s.sy(0) - yB}" rx="6" fill="#e8e3d5" stroke="#5b6675" stroke-width="2"/>
      <text x="${s.sx(96)}" y="${yA - 8}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#2563eb">Light: ${a} °C</text>
      <text x="${s.sx(216)}" y="${yB - 8}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#5b6675">Heavy: ${b} °C</text>
      <line x1="${s.sx(150)}" y1="${yA}" x2="${s.sx(150)}" y2="${yB}" stroke="#d9480f" stroke-width="2.5" stroke-dasharray="5 4"/>
      <text x="${s.sx(150) + 8}" y="${(yA + yB) / 2 + 4}" font-size="12.5" font-weight="800" fill="#d9480f">ΔTb = ${dT} °C</text>`;
    svg += '</svg>';
    chart.innerHTML = svg;

    if (dT >= 25) { verdict.className = 'verdict ok'; verdict.textContent = `✔ Good gap: ΔTb = ${dT} °C ≥ 25–30 °C → simple distillation can separate these (less volatile stays as residue).`; }
    else if (dT >= 15) { verdict.className = 'verdict warn'; verdict.textContent = `⚠ Borderline: ΔTb = ${dT} °C — simple distillation gives a mixed distillate; a fractionating column is safer.`; }
    else { verdict.className = 'verdict bad'; verdict.textContent = `✖ Too close: ΔTb = ${dT} °C < 25 °C → simple distillation cannot separate these. Use fractional distillation.`; }
  }
  bindRange(t1, update); bindRange(t2, update);
  update();
};

/* =========================================================
   2. FRACTIONAL — trays & reflux lab
   ========================================================= */
W.init.fractional = el => {
  const ALPHA = 1.25, XB = 0.05;
  el.innerHTML = widgetShell('frac', '#7048e8', '🧮', 'Trays & reflux lab — how close-boiling mixtures get separated',
    '',
    `<div class="ctl-cols">
      <div>${sliderHTML('fracN', 'Number of theoretical trays N', 2, 16, 1, 6, '')}</div>
      <div>${sliderHTML('fracR', 'Reflux ratio R (reflux / distillate)', 0.5, 8, 0.1, 2, '')}</div>
    </div>
    <div class="readouts">
      ${readoutHTML('fracPurity', 'Top product purity')}
      ${readoutHTML('fracSep', 'Separation factor αᴺ')}
      ${readoutHTML('fracStages', 'Stages needed for 95% top')}
      ${readoutHTML('fracEnergy', 'Energy index (R+1)')}
    </div>
    <div class="verdict" id="fracVerdict"></div>
    <div id="fracCol" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:8px"></div>
    <p class="hint">Model: a close-boiling pair with α = 1.25, bottoms fixed at 5% light. Each tray is one equilibrium stage (Fenske-type), and a higher reflux ratio activates more of each stage — but burns more reboiler duty. Bottoms (residue) = less volatile product; distillate = more volatile product.</p>`);

  const N = el.querySelector('#fracN'), R = el.querySelector('#fracR');
  const verdict = el.querySelector('#fracVerdict');

  function update() {
    const n = +N.value, r = +R.value;
    el.querySelector('#fracNo').textContent = n;
    el.querySelector('#fracRo').textContent = r.toFixed(1);
    const Ne = n * (r / (r + 1)) * 1.2;
    const S = Math.pow(ALPHA, Ne);
    const ratioB = XB / (1 - XB);
    const ratioT = S * ratioB;
    const xT = ratioT / (1 + ratioT);
    const N95 = Math.ceil(Math.log((0.95 / 0.05) / ratioB) / Math.log(ALPHA) / (1.2 * r / (r + 1)));

    el.querySelector('#fracPurityv').textContent = fmt(xT * 100, 1) + ' %';
    el.querySelector('#fracSepv').textContent = fmt(S, 1) + '×';
    el.querySelector('#fracStagesv').textContent = N95 > 999 ? '∞' : N95;
    el.querySelector('#fracEnergyv').textContent = fmt(r + 1, 1);

    if (xT >= 0.95) { verdict.className = 'verdict ok'; verdict.textContent = `✔ High purity: ${n} trays at R = ${r.toFixed(1)} reach ${fmt(xT * 100, 0)}% in the distillate. More stages + reflux = sharper cut.`; }
    else { verdict.className = 'verdict warn'; verdict.textContent = `⚠ Top is only ${fmt(xT * 100, 0)}% light. With α = 1.25 (close boiling) you need ${N95 > 999 ? 'far more' : '≈ ' + N95} stages — raise trays or reflux.`; }

    // mini column with n trays
    const Hc = 240, Wc = 150;
    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:150px;flex:0 0 150px">
      <rect x="45" y="18" width="60" height="${Hc - 56}" rx="24" fill="#fff" stroke="#4a5568" stroke-width="2.5"/>`;
    const ty = Hc - 40;
    const nTray = Math.min(n, 16);
    for (let i = 0; i < nTray; i++) {
      const y = 34 + i * (ty - 40) / Math.max(nTray - 1, 1);
      svg += `<line x1="52" y1="${y}" x2="98" y2="${y}" stroke="#7048e8" stroke-width="2"/>`;
    }
    svg += `<path d="M62,${ty - 4} L62,36" stroke="#d9480f" stroke-width="2" stroke-dasharray="4 4"/>
      <path d="M82,36 L82,${ty - 4}" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 4"/>
      <path d="M75,${Hc - 38} L75,${Hc - 20} L120,${Hc - 20}" fill="none" stroke="#7d8b99" stroke-width="2.5"/>
      <path d="M75,18 L75,4 L118,4" fill="none" stroke="#7d8b99" stroke-width="2.5"/>
      <text x="75" y="${Hc - 6}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#5b6675">reboiler vapour ↑</text>
      <text x="126" y="16" font-size="9.5" font-weight="700" fill="#1a7f4e">to condenser</text>
      <text x="75" y="${Hc - 46}" text-anchor="middle" font-size="10" font-weight="800" fill="#7048e8">${nTray} trays</text>
      <path d="M62,${ty - 8} L62,${ty - 22} L57,${ty - 16} M62,${ty - 22} L67,${ty - 16}" stroke="#d9480f" stroke-width="2" fill="none"/>
      <path d="M82,${ty - 22} L82,${ty - 8} L77,${ty - 14} M82,${ty - 8} L87,${ty - 14}" stroke="#2563eb" stroke-width="2" fill="none"/>
    </svg>`;
    el.querySelector('#fracCol').innerHTML = svg +
      `<div style="flex:1;min-width:240px">
        <div class="bar-pair"><span>Energy use</span><span class="track"><i style="width:${((r + 1) / 9) * 100}%;background:linear-gradient(90deg,#f08c00,#d9480f)"></i></span></div>
        <div class="bar-pair" style="margin-top:8px"><span>Stages activated (of ${n})</span><span class="track"><i style="width:${(Ne / n) * 100}%;background:#7048e8"></i></span></div>
        <p class="hint" style="margin-top:10px">Reflux returns condensed liquid to the top: it improves separation, but every extra unit of reflux means more vapour to generate and condense — more energy.</p>
      </div>`;
  }
  bindRange(N, update); bindRange(R, update);
  update();
};

/* =========================================================
   3. FLASH — flash drum simulator
   ========================================================= */
W.init.flash = el => {
  // binary: light Tb=80°C (ΔHv 42 kJ/mol), heavy Tb=160°C (ΔHv 55 kJ/mol)
  const Tb1 = 353.15, Tb2 = 433.15, DH1 = 42000, DH2 = 55000, z1 = 0.6, z2 = 0.4;
  const cpL = 150, cpV = 110, Tref = 273.15, DHmix = z1 * DH1 + z2 * DH2;
  const Pv = (T, Tb, DH) => 760 * Math.exp(-(DH / Rg) * (1 / T - 1 / Tb));

  el.innerHTML = widgetShell('flash', '#d9480f', '⚡', 'Flash drum simulator — pressure drop does the separating',
    '',
    `<div class="ctl-cols">
      <div>${sliderHTML('flP', 'Drum pressure P', 200, 760, 5, 400, ' mmHg')}</div>
      <div>${sliderHTML('flT', 'Feed temperature T_F (saturated liquid feed)', 40, 140, 1, 95, ' °C')}</div>
    </div>
    <div class="readouts">
      ${readoutHTML('flVF', 'Flash fraction V/F')}
      ${readoutHTML('flTbub', 'Bubble point at P')}
      ${readoutHTML('flTdew', 'Dew point at P')}
      ${readoutHTML('flY', 'Light in vapour (y₁)')}
      ${readoutHTML('flX', 'Light in liquid (x₁)')}
    </div>
    <div class="verdict" id="flVerdict"></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:8px">
      <div id="flDrum" style="flex:0 0 150px"></div>
      <div style="flex:1;min-width:250px">
        <div class="bar-pair"><span>Vapour: light</span><span class="track"><i id="flYbar" style="width:60%;background:#d9480f"></i></span></div>
        <div class="bar-pair" style="margin-top:8px"><span>Liquid: light</span><span class="track"><i id="flXbar" style="width:60%;background:#2563eb"></i></span></div>
        <p class="hint" style="margin-top:10px">Feed: z₁ = 60% light (Tb 80 °C) / 40% heavy (Tb 160 °C). No heat is added — the flash uses the feed's sensible heat, so a hotter feed or a lower drum pressure means more vapour (V/F = (hF − hL)/(hV − hL)).</p>
      </div>
    </div>`);

  const P = el.querySelector('#flP'), T = el.querySelector('#flT');
  const verdict = el.querySelector('#flVerdict');

  function update() {
    const p = +P.value, tf = +T.value;
    el.querySelector('#flPo').textContent = p + ' mmHg';
    el.querySelector('#flTo').textContent = tf + ' °C';

    const fBub = T => z1 * Pv(T, Tb1, DH1) + z2 * Pv(T, Tb2, DH2) - p;
    const fDew = T => z1 * p / Pv(T, Tb1, DH1) + z2 * p / Pv(T, Tb2, DH2) - 1;
    const Tbub = bisect(fBub, 280, 500);
    const Tdew = bisect(fDew, 280, 500);

    const hF = cpL * (tf + Tref - Tref);
    const hL = cpL * (Tbub - Tref);
    const hV = cpV * (Tdew - Tref) + DHmix;
    const VF = clamp((hF - hL) / (hV - hL), 0, 1);

    const K1 = Pv(Tbub, Tb1, DH1) / p, K2 = Pv(Tbub, Tb2, DH2) / p;
    let y1 = z1 * K1, y2 = z2 * K2; const ys = y1 + y2; y1 /= ys;
    let x1 = z1 / K1, x2 = z2 / K2; const xs = x1 + x2; x1 /= xs;

    el.querySelector('#flVFv').textContent = fmt(VF * 100, 1) + ' %';
    el.querySelector('#flTbubv').textContent = fmt(Tbub - 273.15, 1) + ' °C';
    el.querySelector('#flTdewv').textContent = fmt(Tdew - 273.15, 1) + ' °C';
    el.querySelector('#flYv').textContent = fmt(y1 * 100, 0) + ' %';
    el.querySelector('#flXv').textContent = fmt(x1 * 100, 0) + ' %';
    el.querySelector('#flYbar').style.width = (y1 * 100) + '%';
    el.querySelector('#flXbar').style.width = (x1 * 100) + '%';

    // drum visual
    const Hc = 190, Wc = 150;
    const liqH = 14 + (1 - VF) * (Hc - 70);
    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:150px">
      <rect x="35" y="20" width="80" height="${Hc - 50}" rx="26" fill="#fff" stroke="#4a5568" stroke-width="2.5"/>
      <rect x="38" y="${20 + Hc - 50 - liqH}" width="74" height="${liqH}" fill="#cfe3f7" opacity="0.95"/>
      <line x1="40" y1="${20 + Hc - 50 - liqH}" x2="110" y2="${20 + Hc - 50 - liqH}" stroke="#9cc3ea" stroke-width="2"/>`;
    const vapSpace = 20 + Hc - 50 - liqH - 24;
    if (vapSpace > 8) {
      svg += `<path d="M55,${Hc - 70 - liqH + 6} L55,${40} L50,${46} M55,40 L60,46" stroke="#f08c00" stroke-width="2" fill="none"/>
        <path d="M95,${Hc - 70 - liqH + 6} L95,${40} L90,${46} M95,40 L100,46" stroke="#f08c00" stroke-width="2" fill="none"/>
        <text x="75" y="36" text-anchor="middle" font-size="10" font-weight="800" fill="#8a5a17">VAPOUR</text>`;
    }
    svg += `<text x="75" y="${Hc - 66 - liqH / 2}" text-anchor="middle" font-size="10" font-weight="800" fill="#27548a">LIQUID</text>
      <path d="M75,20 L75,6 L126,6" fill="none" stroke="#7d8b99" stroke-width="2.5"/>
      <path d="M75,${Hc - 30} L75,${Hc - 12} L126,${Hc - 12}" fill="none" stroke="#7d8b99" stroke-width="2.5"/>
      <path d="M126,6 L134,6" stroke="#f08c00" stroke-width="3"/>
      <path d="M126,${Hc - 12} L134,${Hc - 12}" stroke="#2563eb" stroke-width="3"/>
      <text x="138" y="10" font-size="9.5" font-weight="700" fill="#f08c00">V</text>
      <text x="138" y="${Hc - 8}" font-size="9.5" font-weight="700" fill="#2563eb">L</text>
      <text x="75" y="${Hc - 2}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#5b6675">drum P = ${p} mmHg</text>
    </svg>`;
    el.querySelector('#flDrum').innerHTML = svg;

    if (VF === 0) { verdict.className = 'verdict bad'; verdict.textContent = '✖ No flash: at this pressure the feed is below its bubble point — lower the drum pressure or raise the feed temperature.'; }
    else if (VF > 0.99) { verdict.className = 'verdict warn'; verdict.textContent = '⚠ Nearly complete vaporization — the drum is acting like a reboiler. For a useful split, aim for 0 < V/F < 1.'; }
    else { verdict.className = 'verdict ok'; verdict.textContent = `✔ ${fmt(VF * 100, 0)}% of the feed flashes to vapour; vapour is enriched to ${fmt(y1 * 100, 0)}% light while the liquid drops to ${fmt(x1 * 100, 0)}%. Lower pressure ⇒ more vapour.`; }
  }
  bindRange(P, update); bindRange(T, update);
  update();
};

/* =========================================================
   4. STEAM — co-distillation temperature
   ========================================================= */
W.init.steam = el => {
  const Bw = 40700, Bo = 52000, M_O = 150, M_W = 18;
  const Pw = T => 760 * Math.exp(-(Bw / Rg) * (1 / T - 1 / 373.15));
  const Po = (T, TbO) => 760 * Math.exp(-(Bo / Rg) * (1 / T - 1 / TbO));

  el.innerHTML = widgetShell('steam', '#0ca678', '♨️', 'Why does the mixture boil earlier? P_total = P_water + P_organic',
    '',
    `<div class="ctl">${sliderHTML('stTb', 'Normal boiling point of the organic compound', 120, 260, 1, 200, ' °C')}</div>
    <div class="readouts">
      ${readoutHTML('stTmix', 'Mixture boils at (T_mix)')}
      ${readoutHTML('stSave', 'Saved vs normal B.P.')}
      ${readoutHTML('stRatio', 'Co-distilled oil : water')}
    </div>
    <div id="stChart"></div>
    <div class="verdict" id="stVerdict"></div>
    <p class="hint">Water and the organic are <b>immiscible</b>, so each contributes its own vapour pressure. The mixture boils as soon as P_water + P_organic = 760 mmHg — always <b>below</b> the organic's own boiling point, which protects heat-sensitive compounds (essential oils, aromatics).</p>`);

  const Tb = el.querySelector('#stTb');
  const chart = el.querySelector('#stChart'), verdict = el.querySelector('#stVerdict');

  function update() {
    const tb = +Tb.value;
    el.querySelector('#stTbo').textContent = tb + ' °C';
    const TbOK = tb + 273.15;
    const Tmix = bisect(T => Pw(T) + Po(T, TbOK) - 760, 290, 480);

    const pw = Pw(Tmix), po = Po(Tmix, TbOK);
    const ratio = (po * M_O) / (pw * M_W);

    el.querySelector('#stTmixv').textContent = fmt(Tmix - 273.15, 1) + ' °C';
    el.querySelector('#stSavev').textContent = '−' + fmt(tb - (Tmix - 273.15), 0) + ' °C';
    el.querySelector('#stRatiov').textContent = ratio.toFixed(2) + ' : 1';

    // chart: P vs T
    const Wc = 560, Hc = 250, pad = { l: 52, r: 16, t: 14, b: 30 };
    const tMax = tb + 15, tMin = 20;
    const sc = scales(Wc, Hc, pad, tMin, tMax, 0, 800);
    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:100%;max-width:${Wc}px">`;
    svg += frame(Wc, Hc, pad, tMin, tMax, 0, 800, { sx: sc.sx, sy: sc.sy, xlab: 'Temperature (°C)', ylab: 'Vapour pressure (mmHg)', nx: 5 });
    const pts = [];
    for (let t = tMin; t <= tMax; t += 1) pts.push([t, Pw(t + 273.15)]);
    const ptsO = [];
    for (let t = tMin; t <= tMax; t += 1) ptsO.push([t, Po(t + 273.15, TbOK)]);
    const ptsT = [];
    for (let t = tMin; t <= tMax; t += 1) ptsT.push([t, Math.min(800, Pw(t + 273.15) + Po(t + 273.15, TbOK))]);
    svg += `<path d="${pathFrom(ptsT, sc.sx, sc.sy)}" fill="none" stroke="#0ca678" stroke-width="3"/>
      <path d="${pathFrom(pts, sc.sx, sc.sy)}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="7 4"/>
      <path d="${pathFrom(ptsO, sc.sx, sc.sy)}" fill="none" stroke="#d9480f" stroke-width="2.5" stroke-dasharray="7 4"/>
      <line x1="${pad.l}" y1="${sc.sy(760)}" x2="${Wc - pad.r}" y2="${sc.sy(760)}" stroke="#5b6675" stroke-width="1.5" stroke-dasharray="4 4"/>
      <text x="${Wc - pad.r - 4}" y="${sc.sy(760) - 6}" text-anchor="end" font-size="10.5" font-weight="700" fill="#5b6675">System pressure = 760 mmHg (1 atm)</text>
      <circle cx="${sc.sx(Tmix - 273.15)}" cy="${sc.sy(760)}" r="6" fill="#0ca678" stroke="#fff" stroke-width="2"/>
      <text x="${sc.sx(Tmix - 273.15)}" y="${sc.sy(760) + 20}" text-anchor="middle" font-size="11" font-weight="800" fill="#0ca678">T_mix = ${fmt(Tmix - 273.15, 0)} °C</text>
      <circle cx="${sc.sx(tb)}" cy="${sc.sy(760)}" r="6" fill="#d9480f" stroke="#fff" stroke-width="2"/>
      <text x="${sc.sx(tb)}" y="${sc.sy(760) + 20}" text-anchor="middle" font-size="11" font-weight="800" fill="#d9480f">T_organic = ${tb} °C</text>
      <text x="${sc.sx(tMin + 8)}" y="${sc.sy(Pw(tMin + 273.15)) - 8}" font-size="11" font-weight="700" fill="#2563eb">Water</text>
      <text x="${sc.sx(tMax - 26)}" y="${Math.max(pad.t + 12, sc.sy(Po(tMax - 26 + 273.15, TbOK)) - 8)}" font-size="11" font-weight="700" fill="#d9480f">Organic</text>
      <line x1="${Wc - pad.r - 165}" y1="${Hc - pad.b - 12}" x2="${Wc - pad.r - 148}" y2="${Hc - pad.b - 12}" stroke="#0ca678" stroke-width="3.5"/>
      <text x="${Wc - pad.r - 142}" y="${Hc - pad.b - 8}" font-size="11" font-weight="800" fill="#0ca678">Total (water + organic)</text>
    </svg>`;
    chart.innerHTML = svg;

    verdict.className = 'verdict ok';
    verdict.textContent = `✔ The mixture boils at ${fmt(Tmix - 273.15, 0)} °C — ${fmt(tb - (Tmix - 273.15), 0)} °C below the organic's normal boiling point (${tb} °C). Roughly ${ratio.toFixed(1)} g of oil co-distils per g of water.`;
  }
  bindRange(Tb, update);
  update();
};

/* =========================================================
   5. VACUUM — pressure vs boiling point
   ========================================================= */
W.init.vacuum = el => {
  const B = 8500;
  // Clausius-Clapeyron: 1/T2 = 1/T1 + (ΔH/R)·ln(P1/P2)  →  lower P ⇒ lower T
  const Tof = (tbK, p) => 1 / (1 / tbK + Math.log(760 / p) / B);

  el.innerHTML = widgetShell('vac', '#4263eb', '🌀', 'Lower the pressure → lower the boiling temperature',
    '',
    `<div class="ctl-cols">
      <div>${sliderHTML('vacTb', 'Liquid normal boiling point (at 760 mmHg)', 100, 300, 1, 200, ' °C')}</div>
      <div>${sliderHTML('vacP', 'Operating pressure P', 10, 760, 5, 100, ' mmHg')}</div>
    </div>
    <div class="readouts">
      ${readoutHTML('vacT', 'Boiling temperature at P')}
      ${readoutHTML('vacSave', 'Saved vs 1 atm')}
      ${readoutHTML('vacVap', 'Vapour volume vs 1 atm')}
    </div>
    <div id="vacChart"></div>
    <div class="verdict" id="vacVerdict"></div>
    <div class="hint" style="margin-top:10px">Vacuum system options from the notes: <span class="chip">Liquid-ring pump</span><span class="chip">Steam ejector</span><span class="chip">Dry vacuum pump</span><span class="chip">Mechanical pump</span> — all equipment must be well sealed; any air leak disturbs the operation.</div>`);

  const Tb = el.querySelector('#vacTb'), P = el.querySelector('#vacP');
  const chart = el.querySelector('#vacChart'), verdict = el.querySelector('#vacVerdict');

  function update() {
    const tb = +Tb.value, p = +P.value;
    el.querySelector('#vacTbo').textContent = tb + ' °C';
    el.querySelector('#vacPo').textContent = p + ' mmHg';
    const tbK = tb + 273.15;
    const T = Tof(tbK, p) - 273.15;
    const Tdecomp = tb + 40;
    const vapVol = 760 / p;

    el.querySelector('#vacTv').textContent = fmt(T, 0) + ' °C';
    el.querySelector('#vacSavev').textContent = '−' + fmt(tb - T, 0) + ' °C';
    el.querySelector('#vacVapv').textContent = fmt(vapVol, 1) + '×';

    // chart: T vs log P  (y-range framed to the curve + decomposition line)
    const Wc = 560, Hc = 250, pad = { l: 52, r: 16, t: 14, b: 30 };
    const tLo = Tof(tbK, 10) - 273.15;
    const tMin = Math.floor((tLo - 12) / 10) * 10;
    const tMax = Math.max(tb + 20, Tdecomp + 12);
    const sc = scales(Wc, Hc, pad, 10, 760, tMin, tMax, true);
    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:100%;max-width:${Wc}px">`;
    svg += frame(Wc, Hc, pad, 10, 760, tMin, tMax, { sx: sc.sx, sy: sc.sy, logx: true, xlab: 'Pressure P (mmHg, log scale)', ylab: 'Boiling temperature (°C)', ny: 5, yticks: null, xticks: [10, 20, 50, 100, 200, 500, 760] });
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const pp = 10 * Math.pow(76, i / 60);
      pts.push([pp, Tof(tbK, pp) - 273.15]);
    }
    svg += `<path d="${pathFrom(pts, sc.sx, sc.sy)}" fill="none" stroke="#4263eb" stroke-width="3"/>`;
    if (Tdecomp < tMax) {
      svg += `<line x1="${pad.l}" y1="${sc.sy(Tdecomp)}" x2="${Wc - pad.r}" y2="${sc.sy(Tdecomp)}" stroke="#b23434" stroke-width="1.8" stroke-dasharray="6 4"/>
        <text x="${Wc - pad.r - 4}" y="${sc.sy(Tdecomp) - 6}" text-anchor="end" font-size="10.5" font-weight="700" fill="#b23434">Thermal decomposition starts ≈ ${Tdecomp} °C (assumed)</text>`;
    }
    svg += `<circle cx="${sc.sx(p)}" cy="${sc.sy(T)}" r="7" fill="#4263eb" stroke="#fff" stroke-width="2.5"/>
      <text x="${clamp(sc.sx(p), pad.l + 30, Wc - pad.r - 30)}" y="${sc.sy(T) - 12}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#4263eb">P = ${p} mmHg → boils at ${fmt(T, 0)} °C</text>`;
    svg += '</svg>';
    chart.innerHTML = svg;

    if (T > Tdecomp) {
      verdict.className = 'verdict bad';
      verdict.textContent = `✖ Risk of thermal decomposition: even at ${p} mmHg the liquid boils at ${fmt(T, 0)} °C, above the decomposition temperature (~${Tdecomp} °C). Go to a lower pressure.`;
    } else {
      verdict.className = 'verdict ok';
      verdict.textContent = `✔ Safe margin: boils at ${fmt(T, 0)} °C, ${fmt(Tdecomp - T, 0)} °C below decomposition. Note the vapour volume is ${fmt(vapVol, 0)}× larger than at 1 atm → the column needs a larger diameter.`;
    }
  }
  bindRange(Tb, update); bindRange(P, update);
  update();
};

/* =========================================================
   6. AZEOTROPIC — break the azeotrope
   ========================================================= */
W.init.azeotropic = el => {
  let mode = 'min';      // min | max
  let entrainer = false;
  let stages = [];       // array of x compositions reached

  const curve = {
    min: { xaz: 0.8, Taz: 64, T1: 70, T2: 100 },
    max: { xaz: 0.5, Taz: 110, T1: 100, T2: 70 },
  };

  el.innerHTML = widgetShell('az', '#2f9e44', '🧬', 'Break the azeotrope — step-by-step stages',
    `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <div class="toggle" id="azType"><button data-v="min" class="on">Min-boiling azeotrope</button><button data-v="max">Max-boiling azeotrope</button></div>
      <div class="toggle" id="azEnt"><button data-v="0" class="on">Ordinary distillation</button><button data-v="1">With entrainer</button></div>
    </div>`,
    `<div style="display:flex;gap:8px;margin:6px 0 10px">
      <button class="stepbtn primary" id="azStep">＋ Add one stage</button>
      <button class="stepbtn" id="azAuto">▶ Auto-run</button>
      <button class="stepbtn" id="azReset">↺ Reset</button>
      <span class="stepcount" id="azCount">0 stages</span>
    </div>
    <div id="azChart"></div>
    <div class="verdict" id="azVerdict"></div>
    <p class="hint">Each stage is one vapour–liquid equilibrium. Without an entrainer the compositions <b>pile up at the azeotrope</b> (x = x<sub>az</sub>, where vapour and liquid have the same composition) — no number of stages crosses it. The entrainer shifts/destroys the azeotropic point, so stages can finally march to high purity.</p>`);

  const chart = el.querySelector('#azChart'), verdict = el.querySelector('#azVerdict');

  // bezier helper
  const bez = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };

  function draw() {
    const c = curve[mode];
    const Wc = 560, Hc = 300, pad = { l: 52, r: 16, t: 16, b: 32 };
    const tMin = mode === 'min' ? 58 : 60, tMax = 118;
    const sc = scales(Wc, Hc, pad, 0, 1, tMin, tMax);

    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:100%;max-width:${Wc}px">`;
    svg += frame(Wc, Hc, pad, 0, 1, tMin, tMax, { sx: sc.sx, sy: sc.sy, xlab: 'Mole fraction of more volatile component (x, y)', ylab: 'T (°C)', nx: 5, xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], xtickf: v => v.toFixed(1) });

    // bubble / dew curves
    const bpts = [], dpts = [];
    for (let i = 0; i <= 40; i++) {
      const x = i / 40;
      if (mode === 'min') {
        const b = bez(100, 52, 60, 70, x);
        const d = bez(104, 56, 64, 74, x);
        bpts.push([x, b]); dpts.push([x, d]);
      } else {
        const b = bez(100, 118, 118, 70, x);
        const d = bez(104, 122, 122, 74, x);
        bpts.push([x, b]); dpts.push([x, d]);
      }
    }
    svg += `<path d="${pathFrom(bpts, sc.sx, sc.sy)}" fill="none" stroke="#d9480f" stroke-width="3"/>
      <path d="${pathFrom(dpts, sc.sx, sc.sy)}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="7 4"/>
      <text x="${sc.sx(mode === 'min' ? 0.14 : 0.04)}" y="${sc.sy(mode === 'min' ? 92 : 99)}" font-size="11" font-weight="700" fill="#d9480f">Bubble point curve</text>
      <text x="${sc.sx(0.62)}" y="${sc.sy(mode === 'min' ? 80 : 84)}" font-size="11" font-weight="700" fill="#2563eb">Dew point curve</text>`;

    // azeotrope marker
    const ax = c.xaz, ay = c.Taz;
    svg += `<line x1="${sc.sx(ax)}" y1="${pad.t}" x2="${sc.sx(ax)}" y2="${Hc - pad.b}" stroke="#888" stroke-width="1.2" stroke-dasharray="4 4"/>
      <circle cx="${sc.sx(ax)}" cy="${sc.sy(ay)}" r="7" fill="none" stroke="#b23434" stroke-width="3"/>
      <text x="${sc.sx(ax) - 8}" y="${sc.sy(ay) + (mode === 'min' ? 22 : -14)}" text-anchor="end" font-size="11.5" font-weight="800" fill="#b23434">x_az (azeotrope, ${ay} °C)</text>`;

    // entrainer: dashed "new VLE" hint
    if (entrainer && mode === 'min') {
      const npts = [];
      for (let i = 0; i <= 40; i++) {
        const x = i / 40;
        const b = bez(100, 60, 58, 70, x);
        npts.push([x, b]);
      }
      svg += `<path d="${pathFrom(npts, sc.sx, sc.sy)}" fill="none" stroke="#2f9e44" stroke-width="2.5" stroke-dasharray="3 5"/>
        <text x="${sc.sx(0.02)}" y="${sc.sy(64)}" font-size="11" font-weight="700" fill="#2f9e44">VLE with entrainer — azeotrope shifted/destroyed</text>`;
    }

    // staircase on T-x-y: (x_i, T_bub(x_i)) → (x_{i+1}, T_bub(x_i)) → (x_{i+1}, T_bub(x_{i+1}))
    const Tbub = x => mode === 'min' ? bez(100, 52, 60, 70, x) : bez(100, 118, 118, 70, x);
    if (stages.length) {
      let cur = 0.2;
      let path = `M${sc.sx(cur)},${sc.sy(Tbub(cur))}`;
      stages.forEach(nx => {
        const T = Tbub(cur);
        path += ` L${sc.sx(nx)},${sc.sy(T)} L${sc.sx(nx)},${sc.sy(Tbub(nx))}`;
        cur = nx;
      });
      svg += `<path d="${path}" fill="none" stroke="#26303b" stroke-width="2"/>
        <circle cx="${sc.sx(cur)}" cy="${sc.sy(Tbub(cur))}" r="5" fill="#26303b"/>`;
    }
    // feed marker
    svg += `<circle cx="${sc.sx(0.2)}" cy="${sc.sy(Tbub(0.2))}" r="4.5" fill="#2563eb"/>
      <text x="${sc.sx(0.2) - 8}" y="${sc.sy(Tbub(0.2)) + 18}" text-anchor="end" font-size="10.5" font-weight="700" fill="#2563eb">feed x=0.2</text>`;
    svg += '</svg>';
    chart.innerHTML = svg;
  }

  function nextStage() {
    if (stages.length >= 30) return;
    const c = curve[mode];
    const last = stages.length ? stages[stages.length - 1] : 0.2;
    let nx;
    if (entrainer) nx = 0.995 - (0.995 - last) * 0.55;
    else if (mode === 'min') nx = c.xaz - (c.xaz - last) * 0.55;   // piles up AT the azeotrope
    else nx = c.xaz + (last - c.xaz) * 0.55;                       // max-boiling: pulled toward x_az
    stages.push(nx);
    afterChange();
  }

  function afterChange() {
    el.querySelector('#azCount').textContent = stages.length + ' stages' + (stages.length >= 30 ? ' (max shown)' : '');
    draw();
    const c = curve[mode];
    const top = stages.length ? stages[stages.length - 1] : 0.2;
    if (!entrainer) {
      if (stages.length >= 8 && Math.abs(top - c.xaz) < 0.02) {
        verdict.className = 'verdict bad';
        const where = mode === 'min' ? 'the top product piles up at the azeotrope' : 'the composition piles up at the azeotrope (it leaves with the bottoms)';
        verdict.textContent = `✖ Stuck: ${where} (x_az = ${c.xaz}, ${c.Taz} °C). At the azeotrope vapour and liquid have the SAME composition — no number of stages crosses it.`;
      } else {
        verdict.className = 'verdict warn';
        verdict.textContent = `Approaching the azeotrope… composition = ${fmt(top * 100, 1)}%. Keep adding stages — watch where they stop.`;
      }
    } else {
      if (top >= 0.985) { verdict.className = 'verdict ok'; verdict.textContent = `✔ Azeotrope broken: with the entrainer, ${stages.length} stages reach ${fmt(top * 100, 1)}% in the overhead product.`; }
      else { verdict.className = 'verdict ok'; verdict.textContent = `With the entrainer the stages are no longer blocked — top = ${fmt(top * 100, 1)}%. Keep stepping to high purity.`; }
    }
  }

  let auto = null;
  el.querySelector('#azStep').onclick = () => { clearInterval(auto); nextStage(); };
  el.querySelector('#azAuto').onclick = () => { clearInterval(auto); auto = setInterval(() => { if (stages.length >= 30) clearInterval(auto); else nextStage(); }, 420); };
  el.querySelector('#azReset').onclick = () => { clearInterval(auto); stages = []; afterChange(); };
  el.querySelectorAll('#azType button').forEach(b => b.onclick = () => {
    mode = b.dataset.v; stages = [];
    el.querySelectorAll('#azType button').forEach(x => x.classList.toggle('on', x === b));
    afterChange();
  });
  el.querySelectorAll('#azEnt button').forEach(b => b.onclick = () => {
    entrainer = b.dataset.v === '1'; stages = [];
    el.querySelectorAll('#azEnt button').forEach(x => x.classList.toggle('on', x === b));
    afterChange();
  });

  afterChange();
};

/* =========================================================
   7. EXTRACTIVE — entrainer effect on relative volatility
   ========================================================= */
W.init.extractive = el => {
  const XD = 0.99, XB = 0.01;
  el.innerHTML = widgetShell('ex', '#e8590c', '', 'How much entrainer do you need? Watch α move from ≈1 to ≫1',
    '',
    `<div class="ctl">${sliderHTML('exS', 'Entrainer / feed ratio S', 0, 100, 1, 20, ' %')}</div>
    <div class="readouts">
      ${readoutHTML('exA', 'Relative volatility α')}
      ${readoutHTML('exN', 'Min. stages (Fenske, 99/1)')}
      ${readoutHTML('exSol', 'Solvent recovery duty')}
    </div>
    <div id="exChart"></div>
    <div class="verdict" id="exVerdict"></div>
    <p class="hint">α<sub>AB</sub> = (y<sub>A</sub>/x<sub>A</sub>)/(y<sub>B</sub>/x<sub>B</sub>). Without entrainer, close-boiling pairs sit at α ≈ 1 and the equilibrium curve hugs the y = x diagonal — hundreds of stages. The high-boiling solvent interacts preferentially with one component, pushes α well above 1, and the same column becomes easy. The trade: you must recover and recycle the solvent (extra column + energy).</p>`);

  const S = el.querySelector('#exS');
  const chart = el.querySelector('#exChart'), verdict = el.querySelector('#exVerdict');

  function update() {
    const s = +S.value;
    el.querySelector('#exSo').textContent = s + ' %';
    const alpha = 1.03 + (3.5 - 1.03) * (s / 100);
    // Fenske: Nmin = ln[(xD/(1-xD)) · ((1-xB)/xB)] / ln(α)
    const Nmin = Math.log(((XD / (1 - XD)) * ((1 - XB) / XB))) / Math.log(alpha);
    const N = Math.ceil(Nmin);

    el.querySelector('#exAv').textContent = fmt(alpha, 2);
    el.querySelector('#exNv').textContent = N > 200 ? '> 200' : N;
    el.querySelector('#exSolv').textContent = s === 0 ? 'none' : fmt(0.4 + s / 50, 1) + '× feed';

    // McCabe y-x style chart
    const Wc = 560, Hc = 300, pad = { l: 52, r: 16, t: 16, b: 32 };
    const sc = scales(Wc, Hc, pad, 0, 1, 0, 1);
    let svg = `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:100%;max-width:${Wc}px">`;
    svg += frame(Wc, Hc, pad, 0, 1, 0, 1, { sx: sc.sx, sy: sc.sy, xlab: 'x (liquid mole fraction of A)', ylab: 'y (vapour mole fraction of A)', nx: 5, xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], xtickf: v => v.toFixed(1), yticks: [0, 0.2, 0.4, 0.6, 0.8, 1], ytickf: v => v.toFixed(1) });
    // y=x
    svg += `<line x1="${sc.sx(0)}" y1="${sc.sy(0)}" x2="${sc.sx(1)}" y2="${sc.sy(1)}" stroke="#888" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="${sc.sx(0.78)}" y="${sc.sy(0.72)}" font-size="10.5" font-weight="700" fill="#888">y = x</text>`;
    // equilibrium curve
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const x = i / 40;
      pts.push([x, (alpha * x) / (1 + (alpha - 1) * x)]);
    }
    svg += `<path d="${pathFrom(pts, sc.sx, sc.sy)}" fill="none" stroke="#e8590c" stroke-width="3.5"/>
      <text x="${sc.sx(0.35)}" y="${sc.sy(alpha * 0.35 / (1 + (alpha - 1) * 0.35) + 0.05)}" font-size="11.5" font-weight="800" fill="#e8590c">Equilibrium: y = αx / (1 + (α−1)x),  α = ${fmt(alpha, 2)}</text>`;
    // staircase (capped)
    if (N <= 30) {
      let path = `M${sc.sx(XB)},${sc.sy(XB)}`;
      let cur = XB;
      for (let i = 0; i < N && cur < XD; i++) {
        const y = (alpha * cur) / (1 + (alpha - 1) * cur);
        path += ` L${sc.sx(cur)},${sc.sy(y)} L${sc.sx(y)},${sc.sy(y)}`;
        cur = y;
      }
      svg += `<path d="${path}" fill="none" stroke="#26303b" stroke-width="2"/>
        <circle cx="${sc.sx(cur)}" cy="${sc.sy(cur)}" r="5" fill="#26303b"/>`;
    }
    svg += `<circle cx="${sc.sx(XB)}" cy="${sc.sy(XB)}" r="4.5" fill="#2563eb"/>
      <text x="${sc.sx(0.16)}" y="${sc.sy(0.06)}" font-size="10.5" font-weight="700" fill="#2563eb">bottoms x=${XB}</text>
      <circle cx="${sc.sx(XD)}" cy="${sc.sy(XD)}" r="4.5" fill="#1a7f4e"/>
      <text x="${sc.sx(0.84)}" y="${sc.sy(0.94)}" font-size="10.5" font-weight="700" fill="#1a7f4e">distillate x=${XD}</text>`;
    svg += '</svg>';
    chart.innerHTML = svg;

    if (N > 200) { verdict.className = 'verdict bad'; verdict.textContent = `✖ α = ${fmt(alpha, 2)} ≈ 1 — the equilibrium curve hugs the diagonal: ~${Math.round(N)}+ theoretical stages. This is the "difficult separation" regime. Add entrainer!`; }
    else if (N > 20) { verdict.className = 'verdict warn'; verdict.textContent = `⚠ α = ${fmt(alpha, 2)}: feasible but costly — ≈ ${N} stages, higher reflux, more energy.`; }
    else { verdict.className = 'verdict ok'; verdict.textContent = `✔ α = ${fmt(alpha, 2)} ≫ 1: easy separation — only ≈ ${N} stages for 99/1. The solvent is recovered in a second column and recycled.`; }
  }
  bindRange(S, update);
  update();
};
