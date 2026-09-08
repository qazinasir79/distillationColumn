/* =========================================================
   Distillation Lab — app shell: routing, pages, step player
   ========================================================= */

const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const tooltip = document.getElementById('tooltip');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PROC_IDS = PROCESSES.map(p => p.id);
const procById = id => PROCESSES.find(p => p.id === id);

/* ---------------- sidebar ---------------- */
function buildSidebar(active) {
  const link = (href, ico, label, color, on) =>
    `<a class="navlink${on ? ' active' : ''}" href="${href}" style="--navc:${color || '#5aa2ff'}"><span class="ico">${ico}</span>${label}</a>`;
  sidebar.innerHTML = `
    <div class="brand"><span class="flask">⚗️</span><div><h1>Distillation Lab</h1><small>7 processes · interactive study guide</small></div></div>
    <div class="navgroup">Start</div>
    ${link('#/', '🏠', 'Overview', null, active === 'home')}
    <div class="navgroup">Distillation processes</div>
    ${PROCESSES.map(p => link(`#/process/${p.id}`, p.ico, p.name, p.color, active === p.id)).join('')}
    <div class="navgroup">Study tools</div>
    ${link('#/compare', '📊', 'Compare all 7', '#5aa2ff', active === 'compare')}
    ${link('#/troubleshoot', '🔧', 'Troubleshooter', '#d9480f', active === 'troubleshoot')}
    ${link('#/quiz', '✅', 'Quiz yourself', '#1a7f4e', active === 'quiz')}
    ${link('#/glossary', '📖', 'Glossary', '#7048e8', active === 'glossary')}
    <div style="margin-top:22px;padding:0 8px;font-size:11px;color:#8fa1b8;line-height:1.5">
      Built from your handwritten distillation notes (8-page PDF).
    </div>`;
}

/* ---------------- tooltip ---------------- */
main.addEventListener('mouseover', e => {
  const p = e.target.closest ? e.target.closest('[data-tip]') : null;
  if (p) { tooltip.textContent = p.dataset.tip; tooltip.style.display = 'block'; }
  else tooltip.style.display = 'none';
});
main.addEventListener('mousemove', e => {
  if (tooltip.style.display === 'block') {
    let x = e.clientX + 14, y = e.clientY - 38;
    if (x + tooltip.offsetWidth > innerWidth - 8) x = e.clientX - tooltip.offsetWidth - 14;
    if (y < 6) y = e.clientY + 18;
    tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
  }
});
document.getElementById('navToggle').addEventListener('click', () => sidebar.classList.toggle('open'));
sidebar.addEventListener('click', e => { if (e.target.closest('a')) sidebar.classList.remove('open'); });

/* ---------------- step player ---------------- */
function initStepPlayer(card, proc) {
  const svg = card.querySelector('svg');
  if (!svg) return;
  const groups = [...svg.querySelectorAll('g[data-step]')];
  const text = card.querySelector('.step-text');
  const countEl = card.querySelector('.stepcount');
  const btnPrev = card.querySelector('#spPrev'), btnPlay = card.querySelector('#spPlay'), btnNext = card.querySelector('#spNext');
  let idx = 0, timer = null;
  const total = proc.steps.length;

  function apply() {
    const active = idx >= 1 && idx <= total;
    groups.forEach(g => {
      g.classList.toggle('step-dim', active && g.dataset.step != String(idx));
      g.classList.toggle('step-on', active && g.dataset.step == String(idx));
    });
    countEl.textContent = `${idx} / ${total}`;
    if (!active) text.innerHTML = 'Press <b>▶ Play</b> — or step through — and each part of the diagram lights up as the notes describe it.';
    else text.innerHTML = `<b>Step ${idx}:</b> ${esc(proc.steps[idx - 1])}`;
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; btnPlay.textContent = '▶ Play'; } }
  btnPrev.onclick = () => { stop(); idx = Math.max(0, idx - 1); apply(); };
  btnNext.onclick = () => { stop(); idx = Math.min(total, idx + 1); apply(); };
  btnPlay.onclick = () => {
    if (timer) { stop(); apply(); return; }
    if (idx >= total) idx = 0;
    btnPlay.textContent = '⏸ Pause';
    const tick = () => { idx++; apply(); if (idx >= total) { stop(); } };
    tick();
    timer = setInterval(tick, 2600);
  };
  apply();
}

/* ---------------- shared bits ---------------- */
function legendHTML(proc) {
  return `<div class="legend">${proc.legend.map(l => `<span><i style="--lc:${l.c}"></i>${esc(l.t)}</span>`).join('')}</div>`;
}
function proconHTML(proc) {
  return `<div class="procon">
    <div class="pro"><h4>✔ Advantages</h4><ul class="clean">${proc.advantages.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>
    <div class="con"><h4>✖ Limitations</h4><ul class="clean">${proc.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>
  </div>`;
}
function troubleAccordionsHTML(proc, base) {
  return proc.trouble.map((t, i) => `
    <div class="acc-item" id="${base}${i}">
      <button class="acc-head" type="button"><span>① ${esc(t.s)}</span><span class="arr">▶</span></button>
      <div class="acc-body">
        <div class="colhead">Root cause</div><ul>${t.c.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <div class="colhead fix">Corrective action</div><ul class="fix">${t.a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
    </div>`).join('');
}
function wireAccordions(root) {
  root.querySelectorAll('.acc-head').forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
}
function formulasHTML(proc) {
  if (!proc.formulas) return '';
  return `<div class="section-title">Key formulas</div>
    <div class="grid2">${proc.formulas.map(f => `<div class="card" style="margin:0"><h3>${esc(f.name)}</h3><div class="formula">${esc(f.f)}</div></div>`).join('')}</div>
    ${proc.extraNote ? `<p class="hint" style="margin-top:10px">${esc(proc.extraNote)}</p>` : ''}`;
}
function extrasHTML(proc) {
  let s = '';
  const e = proc.extras || {};
  const list = (title, items) => `<div class="card" style="margin:14px 0 0"><h3>${title}</h3><ul class="clean">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
  const cards = (title, items) => `<div class="card" style="margin:14px 0 0"><h3>${title}</h3>${items.map(i => i.t ? `<p><b>${esc(i.t)}:</b> ${esc(i.d)}</p>` : `<p>${esc(i)}</p>`).join('')}</div>`;
  if (e.equipment) s += list('Main equipment', e.equipment);
  if (e.trays) s += list('Tray types', e.trays);
  if (e.packing) s += list('Packing types', e.packing);
  if (e.types) s += cards('Types', e.types);
  if (e.entrainer) s += list('What makes a good entrainer', e.entrainer);
  if (e.good) s += list('Properties of a good entrainer', e.good);
  if (e.common) s += list('Common entrainers / solvents', e.common);
  if (e.examples) s += list('Classic examples', e.examples);
  if (e.components) s += list('Main components (all must be properly sealed to hold the vacuum)', e.components);
  if (e.pumps) s += list('Vacuum system — pump / ejector types', e.pumps);
  if (e.column) s += list('Column considerations under vacuum', e.column);
  if (proc.keyNotes) s += list('Key notes', proc.keyNotes);
  if (proc.keyRelation) s += `<div class="card" style="margin:14px 0 0"><h3>Important relationship</h3><div class="formula">${esc(proc.keyRelation)}</div><p style="margin-top:8px">Lower the pressure → lower the boiling temperature of the liquid.</p></div>`;
  if (proc.keyPoint) s += `<div class="note-bubble" style="margin:14px 0 0"><b>Key point:</b> ${esc(proc.keyPoint)}</div>`;
  if (proc.keyPoints) s += list('Important points (exam favourites)', proc.keyPoints);
  if (proc.comparison) {
    const cols = proc.comparison[0];
    s += `<div class="section-title">Comparison table</div>
      <div class="tablewrap"><table class="tbl"><tr><th>Parameter</th><th>${esc(Object.keys(cols)[1])}</th><th>${esc(Object.keys(cols)[2])}</th></tr>
      ${proc.comparison.map(r => `<tr><td>${esc(r.p)}</td><td>${esc(r[Object.keys(r)[1]])}</td><td>${esc(r[Object.keys(r)[2]])}</td></tr>`).join('')}</table></div>`;
  }
  return s;
}
function prevnextHTML(id) {
  const i = PROC_IDS.indexOf(id);
  const prev = i > 0 ? PROCESSES[i - 1] : null;
  const next = i < PROC_IDS.length - 1 ? PROCESSES[i + 1] : null;
  return `<div class="prevnext">
    ${prev ? `<a href="#/process/${prev.id}"><span>← Previous</span>${esc(prev.name)}</a>` : '<span></span>'}
    ${next ? `<a class="next" href="#/process/${next.id}"><span>Next →</span>${esc(next.name)}</a>` : '<span></span>'}
  </div>`;
}

/* ---------------- home ---------------- */
function renderHome() {
  const html = `
  <div class="hero">
    <span class="kicker" style="color:rgba(255,255,255,.85)">Distillation Lab</span>
    <h1>Master the 7 Distillation Processes — interactively</h1>
    <p>Every process from your notes, brought to life: animated flow diagrams you can step through, live simulations of the core physics (flash fraction, pressure–boiling-point, breaking azeotropes, relative volatility), a full troubleshooter, and a quiz to lock it in.</p>
    <div class="chips">
      <span class="chip">⚗️ 7 processes</span><span class="chip">🎬 animated diagrams</span>
      <span class="chip">🧮 live simulations</span><span class="chip">🔧 troubleshooter</span><span class="chip">✅ quiz</span>
    </div>
  </div>

  <div class="section-title">The seven processes</div>
  <div class="grid3">
    ${PROCESSES.map(p => `
      <a class="pcard" style="--pc:${p.color}" href="#/process/${p.id}">
        <div class="top"><span class="ico">${p.ico}</span><h3>${esc(p.name)}</h3></div>
        <p>${esc(p.tagline)}</p>
        <span class="go">Explore →</span>
      </a>`).join('')}
  </div>

  <div class="section-title">One core idea, seven flavours</div>
  <div class="card">
    <p>Every distillation is the same basic loop: <b>heat the feed → vapourise the light component → let vapour and liquid contact each other → condense the vapour → collect two products</b> (distillate = more volatile, bottoms/residue = less volatile). The seven processes differ in <b>how</b> they make that separation possible:</p>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin:14px 0">
      ${['Feed', '🔥 Heat', '💨 Vapourise', '🔁 Contact (stages)', '❄️ Condense', '⚗️ Products'].map((s, i) =>
        `<span class="chip" style="font-size:13.5px;padding:8px 14px">${s}</span>${i < 5 ? '<span style="align-self:center;color:#9aa7b5">→</span>' : ''}`).join('')}
    </div>
    <table class="tbl" style="box-shadow:none;border:none">
      <tr><th>Process</th><th>The trick it adds</th></tr>
      ${PROCESSES.map(p => `<tr><td>${p.ico} ${esc(p.short)}</td><td>${esc(p.tagline)}</td></tr>`).join('')}
    </table>
  </div>

  <div class="section-title">Study tools</div>
  <div class="grid3">
    <a class="pcard" style="--pc:#d9480f" href="#/troubleshoot"><div class="top"><span class="ico">🔧</span><h3>Troubleshooter</h3></div><p>“Symptom → root cause → corrective action” for all seven processes, with search.</p><span class="go">Open →</span></a>
    <a class="pcard" style="--pc:#1a7f4e" href="#/quiz"><div class="top"><span class="ico">✅</span><h3>Quiz yourself</h3></div><p>16 questions with instant explanations — everything you need to know for the exam.</p><span class="go">Start →</span></a>
    <a class="pcard" style="--pc:#7048e8" href="#/glossary"><div class="top"><span class="ico">📖</span><h3>Glossary</h3></div><p>Every term and abbreviation from the notes, in plain language.</p><span class="go">Browse →</span></a>
  </div>

  <footer class="foot">© 2026 Qazi Nasir · <a href="https://qazinasir.com" target="_blank" rel="noopener">qazinasir.com</a></footer>`;
  return { html, init: () => { buildSidebar('home'); } };
}

/* ---------------- process page ---------------- */
function renderProcess(id) {
  const proc = procById(id);
  if (!proc) return renderHome();
  const i = PROC_IDS.indexOf(id);
  const html = `
  <div class="page" style="--accent:${proc.color}">
    <div class="proc-head">
      <span class="kicker">Process ${i + 1} of 7</span>
      <h1>${proc.ico} ${esc(proc.name)}</h1>
      <p>${esc(proc.tagline)}</p>
      <span class="usewhen">🎯 <span><b>Use when:</b> ${esc(proc.useWhen)}</span></span>
    </div>

    <div class="section-title">Core idea &amp; principle</div>
    <div class="card">
      <p>${esc(proc.definition)}</p>
      <ul class="clean" style="margin-top:10px">${proc.principle.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    </div>

    <div class="section-title">Process diagram — step through it</div>
    <div class="card diagram-card" id="diagramCard">
      <div class="diagram-scroll" id="diagramSvg"></div>
      ${legendHTML(proc)}
      <div class="stepbar">
        <button class="stepbtn" id="spPrev" type="button">← Prev</button>
        <button class="stepbtn primary" id="spPlay" type="button">▶ Play</button>
        <button class="stepbtn" id="spNext" type="button">Next →</button>
        <span class="step-text" id="spText"></span>
        <span class="stepcount" id="spCount"></span>
      </div>
    </div>

    <div class="section-title">Interactive lab</div>
    <div id="widgetMount"></div>

    ${formulasHTML(proc)}

    <div class="section-title">Details from the notes</div>
    <div class="card" style="margin-top:14px"><h3>How it works — step by step</h3>
      <ol style="padding-left:20px">${proc.steps.map(s => `<li style="margin:5px 0">${esc(s)}</li>`).join('')}</ol>
    </div>
    ${extrasHTML(proc)}
    <div class="card" style="margin:14px 0 0"><h3>Applications</h3>
      <div>${proc.applications.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
    </div>

    <div class="section-title">Advantages &amp; limitations</div>
    ${proconHTML(proc)}

    <div class="section-title">Troubleshooting (from your notes)</div>
    <div id="troubleMount">${troubleAccordionsHTML(proc, 'trb')}</div>

    ${prevnextHTML(id)}
  </div>`;
  return {
    html,
    init: () => {
      document.getElementById('diagramSvg').innerHTML = D.draw[id]();
      W.init[id](document.getElementById('widgetMount'));
      initStepPlayer(document.getElementById('diagramCard'), proc);
      wireAccordions(document.getElementById('troubleMount'));
      buildSidebar(id);
    }
  };
}

/* ---------------- troubleshooter ---------------- */
function renderTroubleshoot() {
  let sel = 'simple', q = '';
  const html = `
  <div class="page" style="--accent:#d9480f;--tc:#d9480f">
    <span class="kicker" style="color:#d9480f">Study tool</span>
    <h1 class="page-title">🔧 Troubleshooting &amp; Root Cause</h1>
    <p class="lede">The full “Problem → Root cause → Corrective action” reference from your notes. Pick a process, tap a symptom — or just search.</p>
    <div class="card">
      <input class="searchbox" id="tSearch" placeholder="🔍 Search any symptom, root cause or corrective action… (e.g. 'flooding', 'leak', 'foaming')">
      <div class="tchiprow" id="tChips" style="margin-top:14px"></div>
      <div id="tBody"></div>
    </div>
    <div class="section-title">General tips for all distillation systems</div>
    <div class="card"><ul class="clean" style="--accent:#1a7f4e">${GENERAL_TIPS.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
  </div>`;
  return {
    html,
    init: () => {
      const chips = document.getElementById('tChips'), body = document.getElementById('tBody'), search = document.getElementById('tSearch');
      function renderChips() {
        chips.innerHTML = PROCESSES.map(p =>
          `<button class="tchip${p.id === sel ? ' on' : ''}" style="--tc:${p.color}" data-id="${p.id}">${p.ico} ${esc(p.short)}</button>`).join('');
        chips.querySelectorAll('.tchip').forEach(b => b.onclick = () => { sel = b.dataset.id; q = ''; search.value = ''; render(); });
      }
      function row(t, p) {
        return `<button class="symptom" type="button"><span>${esc(t.s)}</span><span class="arr">▶</span></button>
        <div class="sym-body">
          <div class="colhead">Root cause</div><ul class="clean">${t.c.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          <div class="colhead fix">Corrective action</div><ul class="clean fix">${t.a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>`;
      }
      function render() {
        const proc = procById(sel);
        document.documentElement.style.setProperty('--tc', proc.color);
        body.parentElement.style.setProperty('--tc', proc.color);
        const ql = q.trim().toLowerCase();
        let items;
        if (ql) {
          items = [];
          PROCESSES.forEach(p => p.trouble.forEach(t => {
            if ((t.s + ' ' + t.c.join(' ') + ' ' + t.a.join(' ')).toLowerCase().includes(ql)) items.push({ p, t });
          }));
        } else {
          items = proc.trouble.map(t => ({ p: proc, t }));
        }
        if (!items.length) {
          body.innerHTML = `<p style="padding:14px 4px;color:var(--ink-soft)">No match for “${esc(q)}” — try “flooding”, “leak”, “foam”, “energy”…</p>`;
          return;
        }
        if (ql) {
          // search across all processes: group by process with a heading
          body.innerHTML = items.map(({ p, t }) =>
            `<div style="color:${p.color};font-weight:800;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:14px 0 2px">${p.ico} ${esc(p.name)}</div>${row(t, p)}`).join('');
        } else {
          body.innerHTML = items.map(({ t }) => row(t, proc)).join('');
        }
        body.querySelectorAll('.symptom').forEach(b => b.onclick = () => {
          b.classList.toggle('open');
          b.nextElementSibling.classList.toggle('open');
        });
      }
      search.addEventListener('input', () => { q = search.value; render(); });
      renderChips(); render();
      buildSidebar('troubleshoot');
    }
  };
}

/* ---------------- quiz ---------------- */
function renderQuiz() {
  let i = 0, score = 0, locked = false;
  const answers = [];
  const html = `<div class="page" style="--accent:#1a7f4e"><div id="quizMount"></div></div>`;
  return {
    html,
    init: () => {
      const m = document.getElementById('quizMount');
      function draw() {
        if (i >= QUIZ.length) {
          const pct = Math.round((score / QUIZ.length) * 100);
          const grade = pct >= 80 ? ' Excellent — exam ready!' : pct >= 50 ? '👍 Good — review the misses below.' : '📚 Keep going — re-read the process pages.';
          m.innerHTML = `
            <span class="kicker" style="color:#1a7f4e">Quiz complete</span>
            <h1 class="page-title">Your score</h1>
            <div class="card" style="text-align:center;padding:34px">
              <div class="score-big" style="color:${pct >= 80 ? '#1a7f4e' : pct >= 50 ? '#a4650e' : '#b23434'}">${score} / ${QUIZ.length}</div>
              <p style="font-size:16px;font-weight:700;margin-top:6px">${grade}</p>
              <button class="stepbtn primary" id="qRestart" type="button" style="margin-top:18px;padding:11px 22px">↺ Try again</button>
            </div>
            <div class="section-title">Review</div>
            ${QUIZ.map((qq, k) => `<div class="card" style="margin:10px 0;padding:14px 18px">
              <b>${k + 1}. ${esc(qq.q)}</b>
              <p style="margin-top:6px;color:${answers[k] === qq.a ? 'var(--good)' : 'var(--bad)'};font-weight:600">
                ${answers[k] === qq.a ? '✔ Correct' : `✖ You picked “${esc(qq.o[answers[k]] ?? '—')}” — correct: “${esc(qq.o[qq.a])}”`}
              </p>
              <p style="font-size:13px;color:var(--ink-soft)">${esc(qq.w)}</p>
            </div>`).join('')}`;
          m.querySelector('#qRestart').onclick = () => { i = 0; score = 0; locked = false; answers.length = 0; draw(); };
          return;
        }
        const q = QUIZ[i];
        m.innerHTML = `
          <span class="kicker" style="color:#1a7f4e">Question ${i + 1} of ${QUIZ.length}</span>
          <h1 class="page-title" style="font-size:clamp(20px,2.6vw,28px)">${esc(q.q)}</h1>
          <div class="qprog"><i style="width:${(i / QUIZ.length) * 100}%"></i></div>
          <div id="qOpts">
            ${q.o.map((o, k) => `<button class="opt" type="button" data-k="${k}"><span class="key">${'ABCD'[k]}</span><span>${esc(o)}</span></button>`).join('')}
          </div>
          <div id="qFoot" style="margin-top:16px"></div>`;
        locked = false;
        m.querySelectorAll('.opt').forEach(b => b.onclick = () => {
          if (locked) return;
          locked = true;
          const k = +b.dataset.k;
          answers[i] = k;
          if (k === q.a) score++;
          m.querySelectorAll('.opt').forEach((o2, k2) => {
            o2.disabled = true;
            if (k2 === q.a) o2.classList.add('correct');
            else if (k2 === k) o2.classList.add('wrong');
          });
          m.querySelector('#qFoot').innerHTML = `
            <div class="explain"><b>${k === q.a ? '✔ Correct. ' : '✖ Not quite. '}</b>${esc(q.w)}</div>
            <button class="stepbtn primary" id="qNext" type="button" style="margin-top:14px;padding:10px 20px">${i === QUIZ.length - 1 ? 'See results →' : 'Next question →'}</button>`;
          m.querySelector('#qNext').onclick = () => { i++; draw(); };
        });
      }
      draw();
      buildSidebar('quiz');
    }
  };
}

/* ---------------- glossary ---------------- */
function renderGlossary() {
  const all = [
    ...GLOSSARY.map(g => ({ t: g.t, d: g.d, tag: 'Term' })),
    ...ABBREVIATIONS.map(g => ({ t: g.t, d: g.d, tag: 'Abbreviation' })),
  ].sort((a, b) => a.t.localeCompare(b.t));
  let q = '';
  const html = `
  <div class="page" style="--accent:#7048e8">
    <span class="kicker" style="color:#7048e8">Study tool</span>
    <h1 class="page-title">📖 Glossary &amp; Abbreviations</h1>
    <p class="lede">${all.length} terms from your notes — hover a process page for the same words, or search here.</p>
    <div class="card" style="margin-bottom:14px">
      <input class="searchbox" id="gSearch" placeholder="🔍 Search terms… (e.g. 'reflux', 'azeotrope', 'weeping')">
    </div>
    <div class="gloss" id="gGrid"></div>
  </div>`;
  return {
    html,
    init: () => {
      const grid = document.getElementById('gGrid'), search = document.getElementById('gSearch');
      const render = () => {
        const ql = q.toLowerCase();
        const items = all.filter(g => !ql || (g.t + ' ' + g.d).toLowerCase().includes(ql));
        grid.innerHTML = items.length ? items.map(g =>
          `<div class="gterm" style="border-left-color:#7048e8"><h4>${esc(g.t)} <span class="badge soft" style="--accent:#7048e8;margin-left:6px">${g.tag}</span></h4><p>${esc(g.d)}</p></div>`).join('')
          : `<p style="color:var(--ink-soft)">No term matches “${esc(q)}”.</p>`;
      };
      search.addEventListener('input', () => { q = search.value; render(); });
      render();
      buildSidebar('glossary');
    }
  };
}

/* ---------------- compare ---------------- */
function renderCompare() {
  const html = `
  <div class="page">
    <span class="kicker">At a glance</span>
    <h1 class="page-title">📊 Compare all seven processes</h1>
    <p class="lede">The same seven rows from your notes, side by side — the fastest way to choose the right process (or answer a “why X instead of Y?” question).</p>
    <div class="tablewrap" style="margin-top:18px">
      <table class="tbl">
        <tr>
          <th>Criterion</th>
          ${PROCESSES.map(p => `<th style="color:${p.color}">${p.ico} ${esc(p.short)}</th>`).join('')}
        </tr>
        ${COMPARE_ROWS.map(r => `<tr><td>${esc(r.p)}</td>${PROCESSES.map(p => `<td>${esc(r[p.id])}</td>`).join('')}</tr>`).join('')}
      </table>
    </div>
    <div class="card" style="margin-top:18px">
      <h3>Quick decision guide</h3>
      <ul class="clean" style="--accent:#2563eb">
        <li><b>Big boiling point gap (ΔTb &gt; 25–30 °C) or non-volatile impurities?</b> → Simple distillation.</li>
        <li><b>Close boiling points?</b> → Fractional (trays + reflux). If they form an <b>azeotrope</b> → azeotropic (entrainer + decanter) or extractive (solvent + recovery column).</li>
        <li><b>Heat-sensitive / high-boiling liquid that would decompose?</b> → Vacuum distillation. If it's <b>water-immiscible</b> (essential oils) → steam distillation.</li>
        <li><b>One quick equilibrium split (light ends, degassing)?</b> → Flash distillation.</li>
      </ul>
    </div>
  </div>`;
  return { html, init: () => buildSidebar('compare') };
}

/* ---------------- router ---------------- */
const ROUTES = {
  troubleshoot: renderTroubleshoot,
  quiz: renderQuiz,
  glossary: renderGlossary,
  compare: renderCompare,
};
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [seg, id] = h.split('/');
  let view;
  if (!seg) view = renderHome();
  else if (seg === 'process') view = renderProcess(id);
  else if (ROUTES[seg]) view = ROUTES[seg]();
  else view = renderHome();
  main.innerHTML = view.html;
  if (view.init) view.init();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
