/* Minimal dependency-free SVG chart library for the TEA static app.
 * Each function renders into a container element. Plain script -> window.CHARTS.
 */
(function (root) {
  'use strict';

  const PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#4f46e5', '#0d9488', '#b45309', '#be123c'];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtShort(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    if (a === 0) return '0';
    return v.toPrecision(2);
  }
  function fmtMoney(v, cur) {
    if (v == null || !isFinite(v)) return '—';
    const sym = cur === 'USD' ? '$' : (cur ? cur + ' ' : '$');
    const a = Math.abs(v);
    if (a >= 1e6) return sym + (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return sym + (v / 1e3).toFixed(1) + 'k';
    return sym + v.toFixed(0);
  }
  function niceTicks(vmin, vmax, n) {
    n = n || 5;
    if (!(vmax > vmin)) { vmax = vmin + 1; }
    const span = vmax - vmin;
    const step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    let step;
    if (norm >= 5) step = 10 * mag; else if (norm >= 2) step = 5 * mag;
    else if (norm >= 1) step = 2 * mag; else step = mag;
    const ticks = [];
    for (let v = Math.ceil(vmin / step) * step; v <= vmax + 1e-12; v += step) {
      ticks.push(Math.abs(v) < 1e-12 ? 0 : v);
    }
    return ticks;
  }
  function svgOpen(w, h) {
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg" role="img">`;
  }
  function emptyChart(msg) {
    return `<div class="chart-empty">${esc(msg || 'No data')}</div>`;
  }

  function legend(items) {
    // items: [{label, color}]
    let s = '<div class="chart-legend">';
    for (const it of items) {
      s += `<span class="lg"><span class="sw" style="background:${it.color}"></span>${esc(it.label)}</span>`;
    }
    return s + '</div>';
  }

  // ---- Vertical bar chart ----
  function barV(el, o) {
    o = o || {};
    const labels = o.labels || [], values = o.values || [];
    if (!labels.length) { el.innerHTML = emptyChart(o.empty); return; }
    const W = 640, H = o.height || 340, L = 64, R = 12, T = 14, B = o.tickAngle ? 64 : 34;
    const w = W - L - R, h = H - T - B;
    const vmax = Math.max(0, ...values.filter(isFinite));
    const vmin = Math.min(0, ...values.filter(isFinite));
    const ticks = niceTicks(vmin, vmax, 5);
    const lo = Math.min(vmin, ticks[0] != null ? ticks[0] : vmin);
    const hi = Math.max(vmax, ticks.length ? ticks[ticks.length - 1] : vmax);
    const X = (i) => L + (i + 0.5) * (w / values.length);
    const Y = (v) => T + h - ((v - lo) / (hi - lo || 1)) * h;
    let s = svgOpen(W, H);
    for (const t of ticks) {
      const y = Y(t);
      s += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#e2e8f0"/>`
        + `<text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${esc(o.yfmt ? o.yfmt(t) : fmtShort(t))}</text>`;
    }
    const y0 = Y(0);
    if (0 >= lo && 0 <= hi) s += `<line x1="${L}" y1="${y0}" x2="${W - R}" y2="${y0}" stroke="#94a3b8"/>`;
    const bw = Math.min(64, (w / values.length) * 0.62);
    values.forEach((v, i) => {
      if (!isFinite(v)) return;
      const x = X(i) - bw / 2, y = v >= 0 ? Y(v) : y0, hh = Math.abs(Y(v) - y0);
      const c = (o.colors && o.colors[i]) || PALETTE[i % PALETTE.length];
      const tip = `${labels[i]}: ${o.tipfmt ? o.tipfmt(v) : fmtShort(v)}`;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(hh, 1.5).toFixed(1)}" rx="3" fill="${c}" opacity="0.88"><title>${esc(tip)}</title></rect>`;
      if (o.showValues && hh > 14) {
        s += `<text x="${X(i)}" y="${(v >= 0 ? y + 13 : y + hh - 4)}" text-anchor="middle" font-size="10" fill="#fff">${esc(o.yfmt ? o.yfmt(v) : fmtShort(v))}</text>`;
      }
      const ang = o.tickAngle ? ` transform="rotate(-38 ${X(i)} ${H - B + 14})" text-anchor="end"` : ' text-anchor="middle"';
      s += `<text x="${X(i)}" y="${H - B + 14}" font-size="11" fill="#334155"${ang}>${esc(String(labels[i]).length > 22 ? String(labels[i]).slice(0, 21) + '…' : labels[i])}<title>${esc(labels[i])}</title></text>`;
    });
    s += `<line x1="${L}" y1="${T}" x2="${L}" y2="${T + h}" stroke="#94a3b8"/>`;
    s += '</svg>';
    el.innerHTML = (o.title ? `<div class="chart-title">${esc(o.title)}</div>` : '') + s;
  }

  // ---- Horizontal bar chart ----
  function barH(el, o) {
    o = o || {};
    const labels = o.labels || [], values = o.values || [];
    if (!labels.length) { el.innerHTML = emptyChart(o.empty); return; }
    const rowH = o.rowH || 30, L = o.labelWidth || 190, R = 70, T = 10;
    const H = T + rowH * labels.length + 10, W = 640;
    const w = W - L - R;
    const vmax = Math.max(0, ...values.filter(isFinite));
    const vmin = Math.min(0, ...values.filter(isFinite));
    const X = (v) => L + ((v - vmin) / ((vmax - vmin) || 1)) * w;
    let s = svgOpen(W, H);
    const ticks = niceTicks(vmin, vmax, 5);
    for (const t of ticks) {
      const x = X(t);
      s += `<line x1="${x}" y1="${T}" x2="${x}" y2="${H - 8}" stroke="#eef2f7"/>`;
      s += `<text x="${x}" y="${H - 1}" text-anchor="middle" font-size="10" fill="#94a3b8">${esc(o.xfmt ? o.xfmt(t) : fmtShort(t))}</text>`;
    }
    values.forEach((v, i) => {
      const y = T + i * rowH + 5, hh = rowH - 12;
      const c = (o.colors && o.colors[i]) || PALETTE[i % PALETTE.length];
      if (isFinite(v)) {
        const x0 = X(Math.min(0, v)), x1 = X(Math.max(0, v));
        s += `<rect x="${x0.toFixed(1)}" y="${y}" width="${Math.max(x1 - x0, 1.5).toFixed(1)}" height="${hh}" rx="3" fill="${c}" opacity="0.88"><title>${esc(labels[i])}: ${esc(o.tipfmt ? o.tipfmt(v) : fmtShort(v))}</title></rect>`;
        s += `<text x="${(x1 + 5).toFixed(1)}" y="${y + hh - 4}" font-size="11" fill="#334155">${esc(o.xfmt ? o.xfmt(v) : fmtShort(v))}</text>`;
      }
      const lab = String(labels[i]);
      s += `<text x="${L - 8}" y="${y + hh - 4}" text-anchor="end" font-size="12" fill="#334155">${esc(lab.length > 30 ? lab.slice(0, 29) + '…' : lab)}<title>${esc(lab)}</title></text>`;
    });
    s += '</svg>';
    el.innerHTML = (o.title ? `<div class="chart-title">${esc(o.title)}</div>` : '') + s;
  }

  // ---- Multi-series line chart ----
  function line(el, o) {
    o = o || {};
    const series = (o.series || []).filter((s) => s.y && s.y.length);
    if (!series.length) { el.innerHTML = emptyChart(o.empty); return; }
    const W = 640, H = o.height || 340, L = 70, R = 14, T = 14, B = 40;
    const w = W - L - R, h = H - T - B;
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const s of series) {
      const xs = s.x || s.y.map((_, i) => i);
      for (const v of xs) { if (isFinite(v)) { xmin = Math.min(xmin, v); xmax = Math.max(xmax, v); } }
      for (const v of s.y) { if (isFinite(v)) { ymin = Math.min(ymin, v); ymax = Math.max(ymax, v); } }
    }
    if (!(xmax > xmin)) { xmax = xmin + 1; }
    if (!(ymax > ymin)) { const m = Math.abs(ymax) || 1; ymin -= m * 0.05; ymax += m * 0.05; }
    const pad = (ymax - ymin) * 0.08; ymin -= pad; ymax += pad;
    const X = (v) => L + ((v - xmin) / (xmax - xmin)) * w;
    const Y = (v) => T + h - ((v - ymin) / (ymax - ymin)) * h;
    let s = svgOpen(W, H);
    for (const t of niceTicks(xmin, xmax, 6)) {
      const x = X(t);
      s += `<line x1="${x}" y1="${T}" x2="${x}" y2="${T + h}" stroke="#eef2f7"/>`;
      s += `<text x="${x}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="#64748b">${esc(o.xfmt ? o.xfmt(t) : fmtShort(t))}</text>`;
    }
    for (const t of niceTicks(ymin, ymax, 5)) {
      const y = Y(t);
      s += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#e2e8f0"/>`;
      s += `<text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${esc(o.yfmt ? o.yfmt(t) : fmtShort(t))}</text>`;
    }
    if (o.vline != null && o.vline >= xmin && o.vline <= xmax) {
      s += `<line x1="${X(o.vline)}" y1="${T}" x2="${X(o.vline)}" y2="${T + h}" stroke="#94a3b8" stroke-dasharray="4 3"/>`;
    }
    if (o.hline != null && isFinite(o.hline) && o.hline >= ymin && o.hline <= ymax) {
      s += `<line x1="${L}" y1="${Y(o.hline)}" x2="${W - R}" y2="${Y(o.hline)}" stroke="#16a34a" stroke-dasharray="4 3"/>`;
    }
    series.forEach((sr, i) => {
      const c = sr.color || PALETTE[i % PALETTE.length];
      const xs = sr.x || sr.y.map((_, k) => k);
      let d = '';
      let started = false;
      const pts = [];
      for (let k = 0; k < xs.length; k++) {
        const xv = xs[k], yv = sr.y[k];
        if (!isFinite(xv) || !isFinite(yv)) { started = false; continue; }
        d += (started ? 'L' : 'M') + X(xv).toFixed(1) + ' ' + Y(yv).toFixed(1);
        started = true;
        pts.push([X(xv), Y(yv), xv, yv]);
      }
      s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.2"><title>${esc(sr.label || ('series ' + (i + 1)))}</title></path>`;
      if (o.markers !== false) {
        for (const [px, py, xv, yv] of pts) {
          s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${c}"><title>${esc(sr.label || '')} (${esc(o.xfmt ? o.xfmt(xv) : fmtShort(xv))}, ${esc(o.yfmt ? o.yfmt(yv) : fmtShort(yv))})</title></circle>`;
        }
      }
    });
    s += `<text x="${L + w / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="#475569">${esc(o.xlabel || '')}</text>`;
    s += '</svg>';
    let lg = '';
    if (series.length > 1 || (series[0] && series[0].label)) {
      lg = legend(series.map((sr, i) => ({ label: sr.label || ('series ' + (i + 1)), color: sr.color || PALETTE[i % PALETTE.length] })));
    }
    el.innerHTML = (o.title ? `<div class="chart-title">${esc(o.title)}</div>` : '') + s + lg
      + (o.ylabel ? `<div class="chart-sub">${esc(o.ylabel)}</div>` : '');
  }

  // ---- Tornado chart ----
  function tornado(el, o) {
    o = o || {};
    const labels = o.labels || [], lows = o.lows || [], highs = o.highs || [];
    const base = o.base;
    if (!labels.length) { el.innerHTML = emptyChart(o.empty); return; }
    const rowH = 34, L = 210, R = 90, T = 10;
    const n = labels.length;
    const H = T + rowH * n + 26, W = 680;
    const w = W - L - R;
    const all = lows.concat(highs).concat(isFinite(base) ? [base] : []).filter(isFinite);
    let vmin = Math.min(...all), vmax = Math.max(...all);
    if (!(vmax > vmin)) { vmax = vmin + 1; }
    const pad = (vmax - vmin) * 0.06; vmin -= pad; vmax += pad;
    const X = (v) => L + ((v - vmin) / (vmax - vmin)) * w;
    let s = svgOpen(W, H);
    for (const t of niceTicks(vmin, vmax, 6)) {
      const x = X(t);
      s += `<line x1="${x}" y1="${T}" x2="${x}" y2="${H - 22}" stroke="#eef2f7"/>`;
      s += `<text x="${x}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${esc(o.xfmt ? o.xfmt(t) : fmtShort(t))}</text>`;
    }
    labels.forEach((lab, i) => {
      const y = T + i * rowH + 5, hh = rowH - 12;
      const lo = lows[i], hi = highs[i];
      if (isFinite(lo) && isFinite(hi)) {
        const xa = X(Math.min(lo, hi)), xb = X(Math.max(lo, hi));
        s += `<rect x="${xa.toFixed(1)}" y="${y}" width="${Math.max(xb - xa, 2).toFixed(1)}" height="${hh}" rx="3" fill="#2563eb" opacity="0.75">`
          + `<title>${esc(lab)}: low ${esc(o.xfmt ? o.xfmt(lo) : fmtShort(lo))}, high ${esc(o.xfmt ? o.xfmt(hi) : fmtShort(hi))}</title></rect>`;
      } else {
        s += `<text x="${L + 4}" y="${y + hh - 5}" font-size="11" fill="#b91c1c">n/a</text>`;
      }
      s += `<text x="${L - 8}" y="${y + hh - 5}" text-anchor="end" font-size="12" fill="#334155">${esc(lab.length > 34 ? lab.slice(0, 33) + '…' : lab)}<title>${esc(lab)}</title></text>`;
    });
    if (isFinite(base)) {
      const bx = X(base);
      s += `<line x1="${bx}" y1="${T}" x2="${bx}" y2="${H - 22}" stroke="#16a34a" stroke-width="2" stroke-dasharray="5 3"><title>Baseline: ${esc(o.xfmt ? o.xfmt(base) : fmtShort(base))}</title></line>`;
    }
    s += '</svg>';
    el.innerHTML = (o.title ? `<div class="chart-title">${esc(o.title)}</div>` : '') + s;
  }

  // ---- Histogram ----
  function hist(el, o) {
    o = o || {};
    const vals = (o.values || []).filter(isFinite);
    if (!vals.length) { el.innerHTML = emptyChart(o.empty || 'No finite values'); return; }
    const W = 640, H = o.height || 300, L = 60, R = 12, T = 14, B = 40;
    const w = W - L - R, h = H - T - B;
    let vmin = Math.min(...vals), vmax = Math.max(...vals);
    if (!(vmax > vmin)) { vmax = vmin + 1; }
    const nb = o.bins || 40;
    const bw = (vmax - vmin) / nb;
    const counts = new Array(nb).fill(0);
    for (const v of vals) {
      let i = Math.floor((v - vmin) / bw);
      if (i >= nb) i = nb - 1;
      if (i < 0) i = 0;
      counts[i]++;
    }
    const cmax = Math.max(...counts);
    const X = (i) => L + (i / nb) * w;
    const Y = (c) => T + h - (c / cmax) * h;
    let s = svgOpen(W, H);
    for (const t of niceTicks(0, cmax, 4)) {
      const y = Y(t);
      s += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#e2e8f0"/>`;
      s += `<text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${t}</text>`;
    }
    for (let i = 0; i < nb; i++) {
      const x = X(i), y = Y(counts[i]);
      const range = `${o.xfmt ? o.xfmt(vmin + i * bw) : fmtShort(vmin + i * bw)} – ${o.xfmt ? o.xfmt(vmin + (i + 1) * bw) : fmtShort(vmin + (i + 1) * bw)}`;
      s += `<rect x="${(x + 0.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(w / nb - 1).toFixed(1)}" height="${Math.max(T + h - y, 1).toFixed(1)}" fill="${o.color || '#2563eb'}" opacity="0.8"><title>${esc(range)}: ${counts[i]}</title></rect>`;
    }
    for (const t of niceTicks(vmin, vmax, 6)) {
      const x = L + ((t - vmin) / (vmax - vmin)) * w;
      s += `<text x="${x.toFixed(1)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="#64748b">${esc(o.xfmt ? o.xfmt(t) : fmtShort(t))}</text>`;
    }
    if (o.vline != null && isFinite(o.vline)) {
      const x = L + ((o.vline - vmin) / (vmax - vmin)) * w;
      if (x >= L && x <= L + w) {
        s += `<line x1="${x}" y1="${T}" x2="${x}" y2="${T + h}" stroke="#16a34a" stroke-width="2" stroke-dasharray="5 3"><title>Baseline: ${esc(o.xfmt ? o.xfmt(o.vline) : fmtShort(o.vline))}</title></line>`;
      }
    }
    s += `<text x="${L + w / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="#475569">${esc(o.xlabel || '')}</text>`;
    s += '</svg>';
    el.innerHTML = (o.title ? `<div class="chart-title">${esc(o.title)}</div>` : '') + s;
  }

  // ---- Cash-flow chart: grouped bars (revenue, cash cost, capex) + cash-flow line ----
  function cashflow(el, o) {
    o = o || {};
    const n = o.years || 0;
    if (!n) { el.innerHTML = emptyChart(o.empty); return; }
    const W = 680, H = o.height || 360, L = 70, R = 14, T = 14, B = 40;
    const w = W - L - R, h = H - T - B;
    const rev = o.revenue, cost = o.cashCost, cap = o.capex, cf = o.cashFlow;
    const all = rev.concat(cost, cap, cf).filter(isFinite);
    let vmin = Math.min(0, ...all), vmax = Math.max(0, ...all);
    if (!(vmax > vmin)) vmax = vmin + 1;
    const pad = (vmax - vmin) * 0.05; vmin -= pad; vmax += pad;
    const X = (i) => L + (i + 0.5) * (w / n);
    const Y = (v) => T + h - ((v - vmin) / (vmax - vmin)) * h;
    let s = svgOpen(W, H);
    for (const t of niceTicks(vmin, vmax, 6)) {
      const y = Y(t);
      s += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#e2e8f0"/>`;
      s += `<text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#64748b">${esc(o.yfmt ? o.yfmt(t) : fmtShort(t))}</text>`;
    }
    const y0 = Y(0);
    s += `<line x1="${L}" y1="${y0}" x2="${W - R}" y2="${y0}" stroke="#94a3b8"/>`;
    const slot = w / n, bw = Math.min(16, slot / 4.2);
    for (let i = 0; i < n; i++) {
      const cx = X(i);
      const bars = [
        [rev[i], '#16a34a', 'Revenue'],
        [cost[i], '#dc2626', 'Cash cost'],
        [cap[i], '#d97706', 'Capital'],
      ];
      bars.forEach(([v, c, lab], j) => {
        if (!isFinite(v)) return;
        const x = cx + (j - 1) * (bw + 1.5) - bw / 2;
        const y = v >= 0 ? Y(v) : y0;
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(Math.abs(Y(v) - y0), 1).toFixed(1)}" fill="${c}" opacity="0.85">`
          + `<title>Year ${i + 1} ${lab}: ${esc(o.yfmt ? o.yfmt(v) : fmtShort(v))}</title></rect>`;
      });
      if (n <= 40 && (n <= 22 || i % 2 === 0)) {
        s += `<text x="${cx}" y="${H - B + 16}" text-anchor="middle" font-size="10" fill="#64748b">${i + 1}</text>`;
      }
    }
    // net cash flow line
    let d = '', started = false;
    for (let i = 0; i < n; i++) {
      if (!isFinite(cf[i])) { started = false; continue; }
      d += (started ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(cf[i]).toFixed(1);
      started = true;
    }
    s += `<path d="${d}" fill="none" stroke="#2563eb" stroke-width="2.4"><title>Net cash flow</title></path>`;
    s += `<text x="${L + w / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="#475569">Year</text>`;
    s += '</svg>';
    el.innerHTML = (o.title ? `<div class="chart-title">${esc(o.title)}</div>` : '') + s
      + legend([
        { label: 'Revenue', color: '#16a34a' }, { label: 'Cash cost', color: '#dc2626' },
        { label: 'Capital cost', color: '#d97706' }, { label: 'Net cash flow', color: '#2563eb' },
      ]);
  }

  // ---- Donut ----
  function donut(el, o) {
    o = o || {};
    const labels = o.labels || [], values = o.values || [];
    const total = values.filter((v) => isFinite(v) && v > 0).reduce((a, b) => a + b, 0);
    if (!(total > 0)) { el.innerHTML = emptyChart(o.empty); return; }
    const W = 300, H = 220, cx = 110, cy = 110, Rr = 84, r = 52;
    let s = svgOpen(W, H);
    let a0 = -Math.PI / 2;
    let k = 0;
    values.forEach((v, i) => {
      if (!(isFinite(v) && v > 0)) return;
      const frac = v / total;
      const a1 = a0 + frac * 2 * Math.PI;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const x0 = cx + Rr * Math.cos(a0), y0 = cy + Rr * Math.sin(a0);
      const x1 = cx + Rr * Math.cos(a1), y1 = cy + Rr * Math.sin(a1);
      const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1);
      const x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0);
      const c = (o.colors && o.colors[k]) || PALETTE[k % PALETTE.length];
      const tip = `${labels[i]}: ${o.tipfmt ? o.tipfmt(v) : fmtShort(v)} (${(frac * 100).toFixed(1)}%)`;
      s += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${Rr} ${Rr} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r} ${r} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z" fill="${c}" opacity="0.88"><title>${esc(tip)}</title></path>`;
      // label for large slices
      if (frac > 0.07) {
        const am = (a0 + a1) / 2;
        const lx = cx + ((Rr + r) / 2) * Math.cos(am), ly = cy + ((Rr + r) / 2) * Math.sin(am);
        s += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="10" fill="#fff">${(frac * 100).toFixed(0)}%</text>`;
      }
      k++;
    });
    s += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b">${esc(o.centerTop || '')}</text>`;
    s += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="11" fill="#64748b">${esc(o.centerBottom || '')}</text>`;
    s += '</svg>';
    const items = [];
    let j = 0;
    values.forEach((v, i) => {
      if (!(isFinite(v) && v > 0)) return;
      items.push({ label: `${labels[i]} (${(v / total * 100).toFixed(1)}%)`, color: (o.colors && o.colors[j]) || PALETTE[j % PALETTE.length] });
      j++;
    });
    el.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div style="flex:0 0 300px;min-width:260px">${s}</div><div style="flex:1;min-width:180px">${legend(items)}</div></div>`;
    if (o.title) el.innerHTML = `<div class="chart-title">${esc(o.title)}</div>` + el.innerHTML;
  }

  root.CHARTS = {
    barV, barH, line, tornado, hist, cashflow, donut,
    fmtShort, fmtMoney, esc, PALETTE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
