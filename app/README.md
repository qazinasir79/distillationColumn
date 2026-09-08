# ⚗️ Distillation Lab — Interactive Study Guide

An interactive web application that clarifies the core concepts from the
handwritten distillation notes (`1788342025167.pdf`, 8 pages) kept in the
repository root.

## What's inside

| Section | What it does |
|---|---|
| **Overview** | The 7 processes at a glance + the one core idea they all share |
| **Simple / Fractional / Flash / Steam / Vacuum / Azeotropic / Extractive** | One page per process: definition & principle, an **animated labelled flow diagram** with a step-through player (each step lights up its part of the diagram), an **interactive simulation**, key formulas, how-it-works steps, applications, advantages/limitations, and the process-specific troubleshooting table |
| **Compare all 7** | Side-by-side comparison + quick decision guide |
| **Troubleshooter** | The full "Problem → Root cause → Corrective action" reference for all 7 processes, with search |
| **Quiz** | 16 questions with instant explanations and a score review |
| **Glossary** | Every term and abbreviation from the notes, searchable |

### Interactive simulations

- **Simple** — boiling-point-gap tester (the ΔTb > 25–30 °C rule)
- **Fractional** — trays & reflux lab (Fenske-type model: purity vs. trays, reflux ratio, energy)
- **Flash** — flash-drum simulator (V/F = (hF − hL)/(hV − hL), bubble/dew points, pressure drop)
- **Steam** — why the immiscible mixture boils below the organic's normal boiling point (P_total = P_water + P_organic)
- **Vacuum** — pressure vs. boiling temperature (Clausius–Clapeyron) with thermal-decomposition safety margin
- **Azeotropic** — step-by-stage T-x-y staircase: watch compositions pile up at the azeotrope, then break through with an entrainer
- **Extractive** — entrainer/feed ratio → relative volatility α → Fenske stages (McCabe y-x diagram)

## Run it

No build step, no dependencies — static HTML/CSS/JS.

```bash
cd app
python3 -m http.server 8000 --bind 0.0.0.0
# open http://localhost:8000
```

(Any static file server works: `npx serve app`, VS Code Live Server, …)

## Structure

```
app/
├── index.html        # shell
├── css/styles.css    # styling
└── js/
    ├── data.js       # all content transcribed from the PDF notes
    ├── diagrams.js   # animated SVG process-flow diagrams
    ├── widgets.js    # interactive concept simulations
    └── app.js        # routing, pages, step player, quiz, troubleshooter
```

> Content (definitions, principles, steps, formulas, applications,
> advantages/limitations, troubleshooting tables, abbreviations) is
> transcribed faithfully from the source PDF. Simulations use simplified
> teaching models (documented in each widget) to make the core ideas
> tangible, not process-design tools.
