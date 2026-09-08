# Distillation TEA Studio — static edition

A fully static (no-backend) port of the Distillation TEA Studio. Open `index.html`
directly in a browser, or serve this folder with any static file server:

```bash
cd webapp
python -m http.server 8123
# → http://localhost:8123
```

## What's inside

| Path | Contents |
|---|---|
| `index.html` | App shell (nav, pages, styling) |
| `js/data.js` | **Generated.** Cost correlations (417), CEPCI table, location factors, process-type factors, MACRS table, material/install factors, 5 presets, study notes |
| `js/tea.js` | **The engine.** Dependency-free JavaScript port of the OpenPyTEA v3 math: equipment costing, fixed capital, labour, fixed/variable OPEX, cash flow, depreciation, NPV/LCOP/PBT/ROI/IRR, one-way sensitivity, tornado, Monte Carlo |
| `js/charts.js` | Dependency-free SVG charts (bars, lines, tornado, histograms, cash-flow, donuts) |
| `js/app.js` | Shell + Learn + Equipment pages |
| `js/plant.js` | Builder + Sensitivity + Compare + JSON/About pages |
| `test/expected.json` | **Generated.** Python-computed expectations for parity testing |
| `test/parity.mjs` | Node harness: JS engine vs Python engine (1,164 checks) |
| `test/smoke.mjs` | Node harness: executes every UI render path against a fake DOM (34 checks) |

## Tests

```bash
cd webapp
node test/parity.mjs   # engine parity vs expected.json
node test/smoke.mjs    # UI render smoke test
node --check js/tea.js # syntax, etc.
```

## Regenerating data

`js/data.js` and `test/expected.json` are generated from the installed OpenPyTEA
package plus `tea_core.py` / `content.py`:

```bash
python tools/export_webapp_data.py
```

## Known differences from the Python app

- Monte Carlo uses a seeded mulberry32 + Box–Muller PRNG (NumPy's is not
  available in the browser): identical distributions and truncation rules, but
  individual draws differ — compare statistics, not samples.
- Parameter dependency-graph blocks (`*_dependency` / `dependency`) are not
  supported; importing such a config raises a clear error.
- Charts are hand-rolled SVG, not Matplotlib.
