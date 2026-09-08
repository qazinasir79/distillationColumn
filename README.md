# 🗼 Distillation TEA Studio

An **interactive web app** built on [**OpenPyTEA**](https://github.com/pbtamarona/OpenPyTEA)
(open-source Python toolkit for techno-economic assessment of chemical & energy systems, TU Delft, MIT licence),
paired with the distillation study notes shipped in this repository (`1788342025167.pdf`).

It lets you **learn** distillation theory, **cost** equipment, **build** full plant TEAs
(CAPEX · OPEX · cash flow · NPV · IRR · ROI · payback · LCOP), and run
**sensitivity, tornado and Monte Carlo** uncertainty analysis — all in the browser, no code required.

## ✨ Features

| Section | What you get |
|---|---|
| 📚 **Learn Distillation** | 7 types (Simple, Fractional, Flash, Steam, Vacuum, Azeotropic, Extractive): theory, equipment, working, applications, pros/cons, comparison table, **decision helper**, troubleshooting matrices |
| 💰 **Equipment Costing** | Live OpenPyTEA cost explorer: category → type → size → purchased vs installed cost, CEPCI inflation, cost-vs-size curves, full correlation database browser |
| 🏭 **Plant TEA Builder** | 5 distillation presets + fully editable equipment/products/OPEX/finance → KPIs, cost breakdowns, cash-flow diagram, JSON/CSV export |
| 📊 **Sensitivity & Uncertainty** | One-way sweeps, tornado rankings, Monte Carlo with editable uncertainty JSON + input-distribution plots |
| ⚖️ **Compare Designs** | Side-by-side KPIs, cash-flow overlay, LCOP/direct-cost/capital comparisons |
| 📁 **JSON & About** | Import/export OpenPyTEA-style configs, methods, caveats, citation |

## 🚀 Quick start

```bash
pip install -r requirements.txt
streamlit run app.py
```

Then open http://localhost:8501 in your browser.

> Requires Python ≥ 3.10. All economics come from the `openpytea` package
> (`pip install openpytea`), no proprietary tools needed.

## ✅ Tests

```bash
pip install -r requirements-dev.txt
pytest tests/ -q
```

28 tests cover: all presets + KPIs, a 384-entry cost-database sweep, CEPCI-gap
handling, breakdown/cash-flow/sensitivity/tornado/Monte-Carlo smoke tests,
input sanitizers, malformed-input handling, and the distillation content base.

## 📁 Repository layout

```
├── app.py                 # Streamlit web app (all six sections)
├── tea_core.py            # OpenPyTEA wrappers: costing, presets, KPIs, plots, JSON
├── content.py             # Distillation knowledge base (transcribed from the PDF notes)
├── presets/               # Importable {plant, equipment} JSON configs (5 designs)
├── 1788342025167.pdf      # Original 8-page handwritten distillation reference
├── requirements.txt
└── .streamlit/config.toml # Server config (0.0.0.0:8501, headless)
```

## 🧪 Distillation presets

- **Fractional — Ethanol/Water**: continuous sieve-tray column + kettle reboiler + condenser + reflux system
- **Vacuum — High-boiler specialty**: vacuum column + steam ejector + oversized condenser
- **Simple — Batch still**: jacketed kettle + condenser + receivers for solvent recovery
- **Steam — Essential oils**: steam vessel + condenser + separator + boiler
- **Flash — Pre-fractionator**: flash drum + preheater + pumps for bulk light/heavy split

All presets are screening-level (Class 4/5, ±30–50%) teaching cases — tune sizes, prices and
uncertainties to your own process.

## 🔬 Methods (in brief)

Equipment correlations (Turton/Seider/Perry/Towler) → CEPCI inflation → installation &
material factors → ISBL/OSBL/engineering/contingency/location → fixed capital; variable +
fixed OPEX; construction/production ramps + discounting → NPV, IRR, ROI, payback, LCOP;
sensitivity/tornado/Monte Carlo honour a shared parameter-dependency graph.
See the in-app **JSON & About** page for details, caveats and citation.

## 🙏 Credits

- Economics engine: [OpenPyTEA](https://github.com/pbtamarona/OpenPyTEA) by P. B. Tamarona et al., TU Delft
- Distillation notes: handwritten reference PDF in this repo
- App: Streamlit + Matplotlib interface in this repository
