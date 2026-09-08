"""Distillation TEA Studio — interactive web app built on OpenPyTEA.

Run locally:
    pip install -r requirements.txt
    streamlit run app.py

Sections:
  1. Learn Distillation — interactive study notes (from the repo PDF)
  2. Equipment Costing — OpenPyTEA equipment cost explorer
  3. Plant TEA — full plant builder + CAPEX/OPEX/cash-flow/LCOP
  4. Sensitivity & Uncertainty — one-way, tornado, Monte Carlo
  5. Compare Designs — multi-plant side-by-side
  6. JSON & About — import/export + methodology
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

import tea_core as T
from tea_core import fmt_money
from content import (
    DISTILLATION_TYPES, COMPARISON_TABLE, GENERAL_TIPS,
    ABBREVIATIONS, recommend_distillation,
)
from openpytea import analysis as OA
from openpytea import plotting as OP

# ----------------------------------------------------------------------------
# Page setup + styling
# ----------------------------------------------------------------------------
st.set_page_config(
    page_title="Distillation TEA Studio · OpenPyTEA",
    page_icon="🗼",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
  .main > div { padding-top: 1.2rem; }
  h1 { letter-spacing: -0.02em; }
  .kpi-card {
    background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    border: 1px solid #e2e8f0; border-radius: 14px;
    padding: 12px 14px; margin-bottom: 4px;
  }
  .kpi-card .kpi-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .kpi-card .kpi-value { font-size: 1.35rem; font-weight: 750; color: #0f172a; }
  .kpi-card .kpi-sub { font-size: 0.78rem; color: #64748b; }
  .flow-strip { display: flex; align-items: stretch; gap: 0; margin: 10px 0 4px 0; flex-wrap: wrap; }
  .flow-node {
    background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a;
    padding: 8px 12px; border-radius: 10px; font-size: 0.82rem; font-weight: 600;
  }
  .flow-arrow { align-self: center; padding: 0 6px; color: #64748b; font-weight: 700; }
  .pill { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0;
          border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; color: #475569; margin: 2px 4px 2px 0; }
  .callout { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 14px; }
  .warn-callout { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 14px; }
  .stTabs [data-baseweb="tab-list"] { gap: 4px; }
  .small { font-size: 0.82rem; color: #64748b; }
  div[data-testid="stMetric"] { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 12px; }
</style>
""", unsafe_allow_html=True)


FLOW_STRIPS = {
    "Simple": ["Feed", "Jacketed still (steam)", "Vapour", "Condenser", "Distillate receivers", "Residue (bottoms)"],
    "Fractional": ["Feed", "Fractionating column", "Overhead vapour", "Condenser", "Reflux drum", "Reflux ⇄ Distillate", "Reboiler ↺ Bottoms"],
    "Flash": ["Feed (P₁,T₁)", "Throttling valve", "Flash drum", "Vapour outlet", "Liquid outlet"],
    "Steam": ["Steam + feed", "Distillation vessel", "Steam + organic vapour", "Condenser", "Separator", "Oil layer / water layer"],
    "Vacuum": ["Feed tank", "Preheater", "Vacuum column", "Condenser", "Distillate receiver", "Vacuum pump", "Bottom product"],
    "Azeotropic": ["Feed + entrainer", "Azeotropic column", "Overhead vapour", "Condenser", "Decanter", "Reflux / product", "Reboiler ↺ Bottoms"],
    "Extractive": ["Feed + solvent", "Extractive column", "Distillate (A)", "Bottoms (B + solvent)", "Solvent recovery", "Solvent recycle / product B"],
}


def flow_strip(nodes):
    html = '<div class="flow-strip">'
    for i, n in enumerate(nodes):
        html += f'<div class="flow-node">{n}</div>'
        if i < len(nodes) - 1:
            html += '<div class="flow-arrow">→</div>'
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)


def kpi_card(label, value, sub=""):
    st.markdown(
        f'<div class="kpi-card"><div class="kpi-label">{label}</div>'
        f'<div class="kpi-value">{value}</div>'
        + (f'<div class="kpi-sub">{sub}</div>' if sub else "") + "</div>",
        unsafe_allow_html=True,
    )


def show_fig(fig, width_note=None):
    st.pyplot(fig, use_container_width=True)
    plt.close(fig)
    if width_note:
        st.caption(width_note)


# Robustness helpers live in tea_core (unit-testable); thin aliases here.
_finite = T.is_finite_number
safe_float = T.safe_float
safe_int = T.safe_int
sanitize_tornado = T.sanitize_tornado


# ----------------------------------------------------------------------------
# Session state — the working plant
# ----------------------------------------------------------------------------
def init_state():
    if "preset_name" not in st.session_state:
        st.session_state.preset_name = "Fractional — Ethanol/Water (continuous)"
    st.session_state.setdefault("editor_ver", 0)
    st.session_state.setdefault("dirty", False)
    if "plant_cfg" not in st.session_state or "equipment_specs" not in st.session_state:
        reset_to_preset(st.session_state.preset_name)
    st.session_state.setdefault("mc_data", None)
    st.session_state.setdefault("mc_n", 20000)


def reset_to_preset(name: str):
    p = deepcopy(T.PRESETS[name])
    st.session_state.preset_name = name
    st.session_state.plant_cfg = deepcopy(p["plant"])
    st.session_state.equipment_specs = deepcopy(p["equipment"])
    st.session_state.mc_data = None
    st.session_state.dirty = False
    # bump editor keys so data_editors drop stale widget state
    st.session_state.editor_ver = st.session_state.get("editor_ver", 0) + 1


def mark_dirty():
    """Flag the working plant as edited and drop cached MC results."""
    st.session_state.dirty = True
    st.session_state.mc_data = None


_MISSING = object()


def set_cfg(key, value, rerun=True):
    """Write a plant-config value, tracking genuine user edits.

    Backfilling a missing default is *not* an edit; changing an existing
    value marks the plant dirty, invalidates Monte Carlo results, and
    reruns so the sidebar badge updates in the same interaction.
    Pass rerun=False for keystroke widgets (e.g. plant name) to avoid
    double runs while typing.
    """
    cfg = st.session_state.plant_cfg
    old = cfg.get(key, _MISSING)
    if old is _MISSING:
        cfg[key] = value
        return
    try:
        changed = bool(old != value)
    except Exception:
        changed = True
    if changed:
        cfg[key] = value
        mark_dirty()
        if rerun:
            st.rerun()


init_state()

# ----------------------------------------------------------------------------
# Sidebar
# ----------------------------------------------------------------------------
with st.sidebar:
    st.markdown("## 🗼 Distillation TEA Studio")
    st.caption("Interactive techno-economic assessment · powered by **OpenPyTEA**")
    page = st.radio(
        "Navigate",
        ["📚 Learn Distillation", "💰 Equipment Costing", "🏭 Plant TEA Builder",
         "📊 Sensitivity & Uncertainty", "⚖️ Compare Designs", "📁 JSON & About"],
        label_visibility="collapsed",
    )
    st.divider()
    st.markdown("**Working plant**")
    preset_choice = st.selectbox("Preset", list(T.PRESETS.keys()),
                                 index=list(T.PRESETS.keys()).index(st.session_state.preset_name))
    if preset_choice != st.session_state.preset_name:
        reset_to_preset(preset_choice)
        st.rerun()
    _base = T.PRESETS[st.session_state.preset_name]
    st.caption(_base["blurb"] + ("  \n✏️ **Edited** — differs from the preset."
                                 if st.session_state.get("dirty", False) else ""))
    if st.button("↺ Reset to preset", use_container_width=True):
        reset_to_preset(st.session_state.preset_name)
        st.rerun()
    st.divider()
    st.caption("OpenPyTEA · open-source TEA for chemical & energy systems  \nDocs: openpytea.readthedocs.io · GitHub: pbtamarona/OpenPyTEA")


def current_plant():
    """Build the OpenPyTEA Plant from session state. Returns (plant, errors)."""
    eq_objs, errors = T.build_equipment_list(st.session_state.equipment_specs)
    if errors:
        return None, errors
    try:
        plant = T.build_plant(st.session_state.plant_cfg, eq_objs)
        return plant, []
    except Exception as e:
        return None, [str(e)]


def import_plant_dict(obj: dict):
    """Load a {plant, equipment} dict into the working plant. Raises on error."""
    pcfg, peq = T.parse_uploaded_json(obj)
    if pcfg:
        st.session_state.plant_cfg.update(pcfg)
    if peq:
        st.session_state.equipment_specs = T.normalize_equipment_specs(
            peq, st.session_state.plant_cfg.get("process_type", "Fluids"))
    # keep the selected preset as the reset baseline; the
    # sidebar "✏️ Edited" badge will flag the difference
    mark_dirty()
    st.session_state.editor_ver = st.session_state.get("editor_ver", 0) + 1
    st.session_state.tea_ran = False


# ============================================================================
# PAGE 1 — LEARN
# ============================================================================
if page == "📚 Learn Distillation":
    st.title("📚 Distillation Learning Lab")
    st.markdown(
        "Interactive study notes distilled from the handwritten reference in this repository "
        "(`1788342025167.pdf`) — seven distillation types, an equipment map, a decision helper, "
        "and troubleshooting tables. When you're ready, cost a real design in the **Plant TEA Builder**."
    )

    tab_learn, tab_compare, tab_decide, tab_trouble = st.tabs(
        ["🎓 Types & Theory", "🔀 Compare", "🧭 Decision Helper", "🛠️ Troubleshooting"]
    )

    with tab_learn:
        cols = st.columns(7)
        type_names = list(DISTILLATION_TYPES.keys())
        if "learn_type" not in st.session_state:
            st.session_state.learn_type = "Fractional"
        for i, name in enumerate(type_names):
            d = DISTILLATION_TYPES[name]
            with cols[i]:
                if st.button(f"{d['icon']}\n{name}", key=f"ltype_{name}", use_container_width=True):
                    st.session_state.learn_type = name
                    st.rerun()
        sel = st.session_state.learn_type
        d = DISTILLATION_TYPES[sel]
        st.markdown(f"### {d['icon']} {sel} Distillation")
        st.caption(d["tagline"])
        flow_strip(FLOW_STRIPS[sel])
        st.markdown(f"**Definition.** {d['definition']}")
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**⚙️ Principle**")
            for p in d["principle"]:
                st.markdown(f"- {p}")
            st.markdown("**🧰 Main equipment**")
            st.markdown(" ".join(f'<span class="pill">{e}</span>' for e in d["equipment"]), unsafe_allow_html=True)
            st.markdown("**📋 Working**")
            for j, w in enumerate(d["working"], 1):
                st.markdown(f"{j}. {w}")
        with c2:
            st.markdown("**🎯 Applications**")
            for a in d["applications"]:
                st.markdown(f"- {a}")
            st.markdown("**✅ Advantages**")
            for a in d["advantages"]:
                st.markdown(f"- {a}")
            st.markdown("**⚠️ Limitations**")
            for lim in d["limitations"]:
                st.markdown(f"- {lim}")
        st.markdown(f'<div class="callout"><b>🔑 Key point.</b> {d["key_point"]}</div>', unsafe_allow_html=True)

    with tab_compare:
        st.markdown("### Side-by-side comparison")
        df = pd.DataFrame(COMPARISON_TABLE).set_index("Aspect")
        st.dataframe(df, use_container_width=True)
        st.markdown("**Abbreviations**")
        st.markdown(" ".join(f'<span class="pill"><b>{k}</b> — {v}</span>' for k, v in ABBREVIATIONS.items()), unsafe_allow_html=True)
        st.markdown("**General tips for all distillation systems**")
        for t in GENERAL_TIPS:
            st.markdown(f"- {t}")

    with tab_decide:
        st.markdown("### Which distillation should I use?")
        st.caption("Rule-based helper mirroring the notes (boiling gap, heat sensitivity, azeotropes).")
        c1, c2 = st.columns(2)
        with c1:
            delta = st.slider("Boiling-point gap ΔTb (°C)", 0, 120, 15,
                              help="Simple distillation needs ΔTb > 25–30 °C; below that, fractionate.")
            heat = st.toggle("Heat-sensitive / thermally unstable", value=False)
            highb = st.toggle("High boiler (hard to vaporise at 1 atm)", value=False)
        with c2:
            azeo = st.toggle("Forms an azeotrope", value=False)
            wimm = st.toggle("Volatile is water-immiscible", value=False)
        rec, reasons = recommend_distillation(delta, heat, azeo, wimm, highb)
        d = DISTILLATION_TYPES[rec]
        st.markdown(f'<div class="callout"><b>{d["icon"]} Recommended: {rec} Distillation.</b><br>'
                    + "<br>".join(f"• {r}" for r in reasons) + "</div>", unsafe_allow_html=True)
        flow_strip(FLOW_STRIPS[rec])
        if st.button(f"Open {rec} theory →"):
            st.session_state.learn_type = rec
            st.rerun()

    with tab_trouble:
        st.markdown("### Troubleshooting & root cause")
        tsel = st.selectbox("Distillation type", list(DISTILLATION_TYPES.keys()), index=1)
        rows = DISTILLATION_TYPES[tsel]["troubleshooting"]
        tdf = pd.DataFrame(rows, columns=["Problem / symptom", "Root cause", "Corrective action"])
        st.dataframe(tdf, use_container_width=True, hide_index=True)
        st.markdown("**General tips**")
        for t in GENERAL_TIPS:
            st.markdown(f"- {t}")

# ============================================================================
# PAGE 2 — EQUIPMENT COSTING
# ============================================================================
elif page == "💰 Equipment Costing":
    st.title("💰 Equipment Costing Studio")
    st.markdown(
        "Every cost below comes from **OpenPyTEA's** correlation database "
        "(`cost_correlations.csv`, Turton/Seider/Perry/Towler sources) with **CEPCI inflation adjustment**. "
        "Pick a category → type → size and watch purchased vs. installed (direct) cost update live."
    )

    cats = T.list_categories()
    c1, c2 = st.columns([1, 1])
    with c1:
        cat = st.selectbox("Equipment category", cats,
                           index=cats.index("Towers") if "Towers" in cats else 0)
        types = T.list_types(cat)
        typ = st.selectbox("Type", types, index=0) if types else None
        try:
            row = T.correlation_row(cat, typ)
        except KeyError as e:
            st.error(str(e))
            st.stop()
        st.markdown(f'<span class="pill">correlation: <b>{row.get("key")}</b></span> '
                    f'<span class="pill">form: {row.get("form")}</span> '
                    f'<span class="pill">cost year: {int(row.get("cost_year")) if pd.notna(row.get("cost_year")) else "—"}</span>',
                    unsafe_allow_html=True)
        try:
            _cy = int(row.get("cost_year"))
        except (TypeError, ValueError):
            _cy = None
        _cepci_years = list(map(int, T.cepci_df().index.tolist()))
        if _cy is not None and _cy not in _cepci_years:
            st.warning(f"⚠️ This correlation's cost year ({_cy}) is outside the CEPCI table "
                       f"({_cepci_years[0]}–{_cepci_years[-1]}), so OpenPyTEA cannot inflation-adjust it. "
                       f"Costing is unavailable for this entry (upstream data gap).")
        st.markdown(f"**Sizing parameter:** `{row.get('units') or '—'}`")
        try:
            _lo, _hi = float(row.get("s_lower")), float(row.get("s_upper"))
        except (TypeError, ValueError):
            _lo, _hi = float("nan"), float("nan")
        lo, hi = _lo, _hi
        has_bounds = pd.notna(lo) and pd.notna(hi) and hi > lo
        if has_bounds:
            st.caption(f"Valid range: **{lo:g} – {hi:g}**. Above the parallelisation limit the database splits into multiple units automatically.")
            default = float(np.sqrt(float(lo) * float(hi)))
            param = st.number_input("Size parameter (s)", min_value=float(lo), max_value=float(hi) * 4,
                                    value=min(default, float(hi)), format="%.4g")
        else:
            st.caption("No size bounds in the database for this correlation — any positive size is accepted.")
            param = st.number_input("Size parameter (s)", min_value=0.01, value=10.0, format="%.4g")
        s2 = None
        if str(row.get("form", "")).lower() == "2-var power-law":
            s2 = st.number_input("Second size parameter (s₂)", min_value=0.01, value=10.0, format="%.4g")
            st.caption(f"s₂ bounds: {row.get('s2_lower')} – {row.get('s2_upper')}")

    with c2:
        ptype = st.selectbox("Process type", T.PROCESS_TYPES, index=T.PROCESS_TYPES.index("Fluids"))
        default_mat = str(row.get("default material", "") or "").strip()
        mat_options = ["(correlation default)"] + T.MATERIALS
        mat = st.selectbox("Material of construction", mat_options,
                           index=0, help=f"Correlation default: {default_mat or 'Carbon steel / n.a.'}. "
                           "Choosing another material applies OpenPyTEA's relative material factor.")
        mat = None if mat == "(correlation default)" else mat
        years = list(map(int, T.cepci_df().index.tolist()))
        tyear = st.selectbox("Target (installed-cost) year", years, index=years.index(2024))
        nunits = st.number_input("Number of identical units (1 = auto)", min_value=1, max_value=50, value=1)
        nunits = None if nunits == 1 else int(nunits)
        name = st.text_input("Equipment tag", value=f"{cat} unit")

    eq = None
    try:
        eq = T.cost_equipment(name, cat, typ, float(param), process_type=ptype,
                              material=mat, target_year=int(tyear), num_units=nunits,
                              s2=(float(s2) if s2 is not None else None))
        k1, k2, k3, k4 = st.columns(4)
        with k1:
            kpi_card("Purchased cost", fmt_money(eq.purchased_cost), f"{int(tyear)} basis · {eq.num_units or 1} unit(s)")
        with k2:
            kpi_card("Direct (installed) cost", fmt_money(eq.direct_cost), f"×{(eq.direct_cost/eq.purchased_cost if eq.purchased_cost else 0):.2f} install factor")
        with k3:
            try:
                f = T.cepci_factor(int(row["cost_year"]), int(tyear))
                kpi_card("CEPCI inflation factor", f"×{f:.3f}", f"{int(row['cost_year'])} → {int(tyear)}")
            except Exception:
                kpi_card("CEPCI inflation factor", "—", "")
        with k4:
            kpi_card("Material factor", f"×{eq.material_factor:.2f}", eq.material)
        with st.expander("📐 Cost breakdown factors (process-type installation)"):
            st.json({"process_factors": eq.process_factors.get(ptype, {}),
                     "material": eq.material, "material_factor": eq.material_factor,
                     "correlation_key": getattr(eq, "_cost_func", None) or row.get("key")})
    except Exception as e:
        st.error(f"Could not cost this equipment: {e}")

    st.divider()
    g1, g2 = st.columns(2)
    with g1:
        st.markdown("#### Cost vs. size curve")
        st.caption(f"{cat} · {typ} · {tyear} basis")
        try:
            (curve, r2) = T.cost_curve(cat, typ, process_type=ptype, material=mat, target_year=int(tyear))
            if curve is None:
                try:
                    _ccy = int(r2.get("cost_year"))
                except (TypeError, ValueError):
                    _ccy = None
                if _ccy is not None and _ccy not in list(map(int, T.cepci_df().index.tolist())):
                    st.info(f"No curve: cost year {_ccy} is outside the CEPCI table, so values "
                            f"can't be adjusted to the {int(tyear)} basis.")
                else:
                    st.info("No bounded size range for this correlation, so no curve is drawn.")
            else:
                ss, cc = curve
                fig, ax = plt.subplots(figsize=(7, 4))
                ax.plot(ss, cc, lw=2)
                if eq is not None and _finite(eq.purchased_cost):
                    ax.scatter([float(param)], [float(eq.purchased_cost)], s=60, zorder=5)
                ax.set_xscale("log"); ax.set_yscale("log")
                ax.set_xlabel(f"Size ({r2.get('units') or 's'}) [log]")
                ax.set_ylabel(f"Purchased cost ({int(tyear)} USD) [log]")
                ax.grid(True, which="both", alpha=0.25)
                show_fig(fig)
        except Exception as e:
            st.warning(f"Curve unavailable: {e}")
    with g2:
        st.markdown("#### CEPCI inflation history")
        st.caption("Chemical Engineering Plant Cost Index used for all adjustments.")
        cdf = T.cepci_df().reset_index()
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(cdf["year"], cdf["cepci"], marker="o", ms=3, lw=2)
        ax.axvline(int(tyear), ls="--", alpha=0.6)
        ax.set_xlabel("Year"); ax.set_ylabel("CEPCI")
        ax.grid(True, alpha=0.25)
        show_fig(fig)

    with st.expander("🗃️ Browse the full correlation database"):
        db = T.cost_db()
        q = st.text_input("Filter (category / type / key)", value="")
        show = db[["key", "category", "type", "units", "s_lower", "s_upper", "form", "cost_year", "default material"]]
        if q:
            m = show.apply(lambda r: q.lower() in str(r.values).lower(), axis=1)
            show = show[m]
        st.dataframe(show, use_container_width=True, hide_index=True)
        st.download_button("⬇️ Download cost_correlations.csv",
                           data=db.to_csv(index=False).encode(),
                           file_name="cost_correlations.csv", mime="text/csv")

# ============================================================================
# PAGE 3 — PLANT TEA BUILDER
# ============================================================================
elif page == "🏭 Plant TEA Builder":
    st.title("🏭 Plant TEA Builder")
    st.markdown(
        "Configure a distillation plant — equipment, products, utilities, finance — then run a full "
        "**OpenPyTEA** assessment: CAPEX, OPEX, cash flow, **NPV · IRR · ROI · payback · LCOP**, with breakdown charts."
    )

    cfg = st.session_state.plant_cfg
    specs = st.session_state.equipment_specs

    # ---- Plant basics ----
    with st.expander("⚙️ Plant basics & finance", expanded=True):
        b1, b2, b3, b4 = st.columns(4)
        with b1:
            set_cfg("plant_name", st.text_input("Plant name", value=cfg.get("plant_name", "My Distillation Plant")), rerun=False)
            set_cfg("process_type", st.selectbox("Process type", T.PROCESS_TYPES,
                index=T.PROCESS_TYPES.index(cfg.get("process_type", "Fluids"))))
            set_cfg("production_type", st.selectbox("Production mode", ["continuous", "batch"],
                index=["continuous", "batch"].index(cfg.get("production_type", "continuous"))))
            cfg = st.session_state.plant_cfg  # refresh alias after writes
        with b2:
            countries = T.COUNTRIES
            ci = countries.index(cfg.get("country", "Netherlands")) if cfg.get("country") in countries else 0
            set_cfg("country", st.selectbox("Country", countries, index=ci))
            cfg = st.session_state.plant_cfg
            regions = T.regions_for_country(cfg["country"])
            ri = regions.index(cfg.get("region", regions[0])) if cfg.get("region") in regions else 0
            picked_region = st.selectbox("Region", regions, index=ri)
            # "—" means the country has a single national factor
            if picked_region != "—":
                set_cfg("region", picked_region)
            st.caption(f"Location factor ≈ **{T.loc_factor_for(cfg['country'], cfg.get('region', '')):.2f}**")
        with b3:
            set_cfg("interest_rate", st.number_input("Interest / discount rate", 0.0, 0.30, float(cfg.get("interest_rate", 0.09)), 0.005, format="%.3f"))
            set_cfg("project_lifetime", st.number_input("Project lifetime (years)", 5, 40, int(cfg.get("project_lifetime", 20)), 1))
            set_cfg("plant_utilization", st.number_input("Plant utilisation", 0.1, 1.0, float(cfg.get("plant_utilization", 0.95)), 0.01, format="%.2f"))
            cfg = st.session_state.plant_cfg
        with b4:
            set_cfg("tax_rate", st.number_input("Tax rate", 0.0, 0.5, float(cfg.get("tax_rate", 0.0)), 0.01, format="%.2f"))
            op_rate = cfg.get("operator_hourly_rate", {})
            base_rate = op_rate.get("rate", 38.0) if isinstance(op_rate, dict) else 38.0
            new_rate = st.number_input("Operator hourly rate (USD/h)", 5.0, 150.0, float(base_rate), 1.0)
            set_cfg("operator_hourly_rate", {"rate": new_rate, **({"rate_uncertainty": op_rate.get("rate_uncertainty")} if isinstance(op_rate, dict) and op_rate.get("rate_uncertainty") else {})})
            cfg = st.session_state.plant_cfg

    # ---- Equipment editor ----
    with st.expander(f"🧰 Equipment ({len(specs)} items) — sized & costed live", expanded=True):
        st.caption("Edit cells directly. Category/Type must match the OpenPyTEA database (see Equipment Costing page for valid pairs).")
        eq_df = pd.DataFrame([
            {"Tag": s.get("name"), "Category": s.get("category"), "Type": s.get("type", ""),
             "Size (s)": s.get("param"), "Units": s.get("num_units", 1) or 1,
             "Material": s.get("material", "Carbon steel"), "Target yr": s.get("target_year", 2024)}
            for s in specs
        ])
        _ever = st.session_state.get("editor_ver", 0)
        edited = st.data_editor(eq_df, use_container_width=True, num_rows="dynamic", hide_index=True, key=f"eq_editor_{_ever}")
        a1, a2, a3 = st.columns([1, 1, 2])
        with a1:
            if st.button("✅ Apply equipment table", use_container_width=True):
                new_specs = []
                for _, r in edited.iterrows():
                    if pd.isna(r["Category"]) or str(r["Category"]).strip() == "":
                        continue
                    new_specs.append({
                        "name": str(r["Tag"] if pd.notna(r["Tag"]) and str(r["Tag"]).strip() else f"EQ-{len(new_specs)+1}"),
                        "category": str(r["Category"]).strip(),
                        "type": str(r["Type"]).strip() or None,
                        "param": safe_float(r["Size (s)"], 0.0),
                        "num_units": safe_int(r["Units"], 1) or None,
                        "material": str(r["Material"] if pd.notna(r["Material"]) else "Carbon steel"),
                        "process_type": cfg.get("process_type", "Fluids"),
                        "target_year": safe_int(r["Target yr"], 2024),
                    })
                st.session_state.equipment_specs = new_specs
                mark_dirty()
                st.session_state.editor_ver = st.session_state.get("editor_ver", 0) + 1
                st.rerun()
        with a2:
            # quick-add distillation kit
            kit = st.selectbox("＋ Quick-add", ["—", "Fractionating column", "Kettle reboiler", "Condenser",
                                                "Reflux drum", "Reflux pump", "Sieve trays ×20", "Vacuum ejector"])
            if kit != "—" and st.button("Add", use_container_width=True):
                add = {
                    "Fractionating column": {"name": "T-1 Column", "param": 8.0, "category": "Towers", "type": "Tray and packed", "material": "Carbon steel"},
                    "Kettle reboiler": {"name": "E-1 Reboiler", "param": 60.0, "category": "Heat exchangers", "type": "Kettle reboiler", "material": "Carbon steel"},
                    "Condenser": {"name": "E-2 Condenser", "param": 45.0, "category": "Heat exchangers", "type": "Fixed tube", "material": "Carbon steel"},
                    "Reflux drum": {"name": "V-1 Reflux drum", "param": 6.0, "category": "Pressure vessels", "type": "Horizontal", "material": "Carbon steel"},
                    "Reflux pump": {"name": "P-1 Pump", "param": 15.0, "category": "Pumps", "type": "Centrifugal", "material": "Carbon steel"},
                    "Sieve trays ×20": {"name": "Trays", "param": 1.2, "category": "Trays", "type": "Sieve", "material": "Carbon steel", "num_units": 20},
                    # NOTE: ejector sizing unit is kg/h/(N/m²); valid range ≈ 0.0007–0.034
                    "Vacuum ejector": {"name": "J-1 Ejector", "param": 0.02, "category": "Ejectors", "type": "Two-stage, including condenser and piping", "material": "Carbon steel"},
                }[kit]
                add.update({"process_type": cfg.get("process_type", "Fluids"), "target_year": 2024})
                st.session_state.equipment_specs.append(add)
                mark_dirty()
                st.session_state.editor_ver = st.session_state.get("editor_ver", 0) + 1
                st.rerun()
        with a3:
            st.caption("Tip: costs use the plant's process type for installation factors. "
                       "Trays: set Units = tray count (size = column diameter).")

        # live cost preview
        eq_objs, eq_errors = T.build_equipment_list(specs)
        if eq_errors:
            for e in eq_errors:
                st.error(f"Equipment error — {e}")
        elif eq_objs:
            prev = pd.DataFrame([{
                "Tag": e.name, "Purchased": e.purchased_cost, "Direct": e.direct_cost,
                "Units": e.num_units or 1, "Material": e.material,
            } for e in eq_objs])
            c1, c2 = st.columns([3, 1])
            with c1:
                st.dataframe(prev.style.format({"Purchased": "${:,.0f}", "Direct": "${:,.0f}"}),
                             use_container_width=True, hide_index=True)
            with c2:
                kpi_card("Σ Purchased", fmt_money(prev["Purchased"].sum()))
                kpi_card("Σ Direct", fmt_money(prev["Direct"].sum()))

    # ---- Products & OPEX ----
    p1, p2 = st.columns(2)
    with p1:
        with st.expander("📦 Products (production kg/day · price USD/kg)", expanded=True):
            prods = cfg.get("plant_products", {})
            pdf = pd.DataFrame([{"Product": k, "Production": v.get("production"), "Price": v.get("price")}
                                for k, v in prods.items()])
            ed = st.data_editor(pdf, use_container_width=True, num_rows="dynamic", hide_index=True, key=f"prod_editor_{st.session_state.get('editor_ver', 0)}")
            if st.button("✅ Apply products"):
                newp = {}
                for _, r in ed.iterrows():
                    if pd.isna(r["Product"]) or str(r["Product"]).strip() == "":
                        continue
                    newp[str(r["Product"]).strip()] = {"production": safe_float(r["Production"], 0.0),
                                                       "price": safe_float(r["Price"], 0.0)}
                cfg["plant_products"] = newp
                mark_dirty()
                st.session_state.editor_ver = st.session_state.get("editor_ver", 0) + 1
                st.rerun()
    with p2:
        with st.expander("🔌 Variable OPEX (consumption/day · price)", expanded=True):
            ins = cfg.get("variable_opex_inputs", {})
            idf = pd.DataFrame([{"Input": k, "Consumption": v.get("consumption"), "Price": v.get("price")}
                                for k, v in ins.items()])
            ed2 = st.data_editor(idf, use_container_width=True, num_rows="dynamic", hide_index=True, key=f"opex_editor_{st.session_state.get('editor_ver', 0)}")
            if st.button("✅ Apply OPEX inputs"):
                newi = {}
                for _, r in ed2.iterrows():
                    if pd.isna(r["Input"]) or str(r["Input"]).strip() == "":
                        continue
                    newi[str(r["Input"]).strip()] = {"consumption": safe_float(r["Consumption"], 0.0),
                                                     "price": safe_float(r["Price"], 0.0)}
                cfg["variable_opex_inputs"] = newi
                mark_dirty()
                st.session_state.editor_ver = st.session_state.get("editor_ver", 0) + 1
                st.rerun()

    run = st.button("🚀 Run TEA", type="primary", use_container_width=True)
    if run or st.session_state.get("tea_ran", False):
        st.session_state.tea_ran = True
        # friendly pre-validation before calling OpenPyTEA
        if not specs:
            st.error("No equipment defined — add at least one equipment item (or ↺ reset to the preset).")
            st.stop()
        if not (cfg.get("plant_products") or {}):
            st.error("No products defined — add at least one product (OpenPyTEA needs a production profile).")
            st.stop()
        plant, errors = current_plant()
        if errors:
            for e in errors:
                st.error(e)
            st.stop()
        try:
            kpis = T.plant_kpis(plant)
        except Exception as e:
            st.error(f"TEA calculation failed: {e}")
            st.stop()

        st.divider()
        st.markdown(f"## Results — {cfg.get('plant_name')}")
        r1, r2, r3, r4, r5 = st.columns(5)
        with r1:
            kpi_card("NPV", fmt_money(kpis["npv"]), f"@ {cfg.get('interest_rate',0):.0%} · {cfg.get('project_lifetime')} yr")
        with r2:
            irr = kpis["irr"]
            kpi_card("IRR", f"{irr:.1%}" if _finite(irr) else "—", "internal rate of return")
        with r3:
            kpi_card("ROI", f"{kpis['roi']:.0f}%" if _finite(kpis["roi"]) else "—", "return on investment")
        with r4:
            kpi_card("Payback", f"{kpis['payback']:.1f} yr" if _finite(kpis["payback"]) else "—", "break-even time")
        with r5:
            kpi_card("LCOP", f"${kpis['lcop']:.3f}/kg" if _finite(kpis["lcop"]) else "—", "levelised cost of product")

        c1, c2, c3, c4 = st.columns(4)
        with c1:
            kpi_card("Fixed capital", fmt_money(kpis["fixed_capital"]), f"ISBL {fmt_money(kpis['isbl'])}")
        with c2:
            kpi_card("Working capital", fmt_money(kpis["working_capital"]))
        with c3:
            kpi_card("Variable OPEX/yr", fmt_money(kpis["variable_opex"]))
        with c4:
            kpi_card("Fixed OPEX/yr", fmt_money(kpis["fixed_opex"]))

        t1, t2, t3 = st.tabs(["💵 Cost breakdowns", "📈 Cash flow", "🧾 Details & export"])
        with t1:
            g1, g2 = st.columns(2)
            with g1:
                st.markdown("**Direct equipment costs**")
                fig, _ = OP.plot_stacked_bar(OA.direct_costs_data(plant), figsize=(7, 4), show=False); show_fig(fig)
                st.markdown("**Fixed capital**")
                fig, _ = OP.plot_stacked_bar(OA.fixed_capital_data(plant), figsize=(7, 4), show=False); show_fig(fig)
                st.markdown("**Levelised cost (LCOP)**")
                fig, _ = OP.plot_stacked_bar(OA.levelized_cost_data(plant), figsize=(7, 4), show=False); show_fig(fig)
            with g2:
                st.markdown("**Variable OPEX**")
                fig, _ = OP.plot_stacked_bar(OA.variable_opex_data(plant), figsize=(7, 4), show=False); show_fig(fig)
                st.markdown("**Fixed OPEX**")
                fig, _ = OP.plot_stacked_bar(OA.fixed_opex_data(plant), figsize=(7, 4), show=False); show_fig(fig)
                st.markdown("**Revenue vs OPEX**")
                fig, ax = plt.subplots(figsize=(7, 4))
                ax.bar(["Revenue/yr", "Variable OPEX/yr", "Fixed OPEX/yr"],
                       [kpis["revenue"], kpis["variable_opex"], kpis["fixed_opex"]])
                ax.set_ylabel("USD/year"); ax.grid(axis="y", alpha=0.25)
                for i, v in enumerate([kpis["revenue"], kpis["variable_opex"], kpis["fixed_opex"]]):
                    ax.text(i, v, f" {fmt_money(v)}", va="bottom", fontsize=9)
                show_fig(fig)
        with t2:
            st.markdown("**Cumulative cash flow** — construction dip, max investment, break-even, climb into profit.")
            cf_data = OA.cash_flow_data(plant)
            fig, _ax = OP.plot_cash_flow(cf_data, figsize=(9, 4.5), show=False)
            show_fig(fig)
            curve = (cf_data.get("curves") or [{}])[0]
            cf1, cf2, cf3 = st.columns(3)
            with cf1:
                kpi_card("Max investment", fmt_money(curve.get("max_investment", float("nan"))),
                         f"year {curve.get('max_investment_year', '—')}")
            with cf2:
                be = curve.get("breakeven_year", None)
                kpi_card("Break-even", f"year {be:.1f}" if be is not None else "— (no crossing)",
                         "cumulative cash crosses zero")
            with cf3:
                cum = curve.get("cumulative", None)
                end_cash = float(np.asarray(cum)[-1]) if cum is not None else float("nan")
                kpi_card("End-of-life cash", fmt_money(end_cash),
                         f"year {curve.get('project_life', '—')}")
        with t3:
            st.markdown("**Cash-flow table (first rows)**")
            try:
                st.text(str(plant)[:3000])
            except Exception:
                pass
            colx, coly = st.columns(2)
            with colx:
                js = json.dumps(T.plant_to_jsonable(cfg, specs), indent=2)
                st.download_button("⬇️ Download plant JSON", js.encode(),
                                   file_name="plant_config.json", mime="application/json",
                                   use_container_width=True)
            with coly:
                kdf = pd.DataFrame([{"metric": k, "value": v} for k, v in kpis.items()])
                st.download_button("⬇️ Download KPI CSV", kdf.to_csv(index=False).encode(),
                                   file_name="tea_kpis.csv", mime="text/csv", use_container_width=True)

# ============================================================================
# PAGE 4 — SENSITIVITY & UNCERTAINTY
# ============================================================================
elif page == "📊 Sensitivity & Uncertainty":
    st.title("📊 Sensitivity & Uncertainty")
    st.markdown(
        "Which assumptions move the needle — and how sure are we? One-way sweeps, tornado rankings, "
        "and Monte Carlo propagation, all honouring OpenPyTEA's **parameter-dependency graph**."
    )
    plant, errors = current_plant()
    if errors:
        for e in errors:
            st.error(e)
        st.stop()

    # candidate parameters
    cfg = st.session_state.plant_cfg
    price_keys = [f"variable_opex_inputs.{k}" for k in (cfg.get("variable_opex_inputs", {}) or {})]
    price_keys += [f"plant_products.{k}" for k in (cfg.get("plant_products", {}) or {})]
    qty_keys = [f"variable_opex_inputs.{k}.consumption" for k in (cfg.get("variable_opex_inputs", {}) or {})]
    qty_keys += [f"plant_products.{k}.production" for k in (cfg.get("plant_products", {}) or {})]
    top_keys = ["fixed_capital", "fixed_opex", "project_lifetime", "interest_rate",
                "operator_hourly_rate", "plant_utilization", "tax_rate"]

    tab1, tab2, tab3 = st.tabs(["📉 One-way sensitivity", "🌪️ Tornado ranking", "🎲 Monte Carlo"])

    with tab1:
        c1, c2, c3 = st.columns(3)
        with c1:
            param = st.selectbox("Parameter to sweep", price_keys + qty_keys + top_keys, index=0)
        with c2:
            metric = st.selectbox("Metric", ["LCOP", "NPV", "ROI", "PBT", "IRR"], index=0)
        with c3:
            pm = st.slider("± variation", 0.05, 0.8, 0.5, 0.05, format="±%.0f%%")
        npts = st.slider("Sweep points", 11, 51, 21, 2)
        if st.button("Run sensitivity sweep", type="primary"):
            with st.spinner("Sweeping…"):
                try:
                    data = OA.sensitivity_data(plant, parameter=param, plus_minus_value=float(pm),
                                               n_points=int(npts), metric=metric)
                    fig, _ = OP.plot_sensitivity(data, figsize=(8, 4.5), show=False)
                    show_fig(fig)
                    st.success(f"Baseline {metric}: **{data['curves'][0]['baseline']:,.4g}** · "
                               f"parameter: `{data['parameter']}`")
                    curve = data["curves"][0]
                    cdf = pd.DataFrame({"Δparam (%)": curve["x"], metric: curve["y"]})
                    st.dataframe(cdf.style.format({"Δparam (%)": "{:.1f}", metric: "{:,.4g}"}, na_rep="—"),
                                 use_container_width=True, hide_index=True)
                except Exception as e:
                    st.error(f"Sensitivity failed: {e}")

    with tab2:
        c1, c2, c3 = st.columns(3)
        with c1:
            tmetric = st.selectbox("Metric ", ["LCOP", "NPV", "ROI", "PBT", "IRR"], index=0, key="tmetric")
        with c2:
            tpm = st.slider("± variation ", 0.05, 0.8, 0.3, 0.05, format="±%.0f%%", key="tpm")
        with c3:
            incl = st.checkbox("Include process quantities (consumption/production)", value=False)
        if st.button("Run tornado ranking", type="primary"):
            with st.spinner("Ranking drivers…"):
                try:
                    tdata = OA.tornado_data(plant, plus_minus_value=float(tpm), metric=tmetric,
                                            include_process_params=incl)
                    plot_data, dropped, base_ok = sanitize_tornado(tdata)
                    if not base_ok:
                        st.warning(f"Baseline {tmetric} is not finite (no payback / no IRR at baseline) — "
                                   "showing the ranking table only.")
                    elif dropped:
                        st.warning(f"{dropped} factor(s) gave non-finite {tmetric} under ±{tpm:.0%} "
                                   f"(e.g. never pays back / IRR undefined) and were omitted from the chart — "
                                   f"see the full table below.")
                    if plot_data is not None:
                        try:
                            fig, _ = OP.plot_tornado(plot_data, show=False)
                            # enlarge tornado figure for readability
                            fig.set_size_inches(8, max(3.5, 0.55 * len(plot_data["factors"]) + 1.5))
                            try:
                                fig.tight_layout()
                            except Exception:
                                pass
                            show_fig(fig)
                        except Exception as e:
                            st.warning(f"Tornado chart unavailable ({e}) — showing the ranking table only.")
                    tdf = pd.DataFrame({"factor": tdata["factors"], "low": tdata["lows"], "high": tdata["highs"]})
                    tdf["swing"] = (tdf["high"] - tdf["low"]).abs()
                    st.dataframe(tdf.sort_values("swing", ascending=False).style.format(
                        {"low": "{:,.4g}", "high": "{:,.4g}", "swing": "{:,.4g}"}, na_rep="—"),
                        use_container_width=True, hide_index=True)
                except Exception as e:
                    st.error(f"Tornado failed: {e}")

    with tab3:
        st.markdown("**Monte Carlo uncertainty propagation** — samples prices, quantities (if configured), "
                    "and project-level factors through the dependency graph.")
        c1, c2, c3 = st.columns(3)
        with c1:
            n = st.select_slider("Samples", [2_000, 5_000, 10_000, 20_000, 50_000, 100_000], value=20_000)
        with c2:
            seed = st.number_input("Random seed (0 = random)", 0, 999999, 42, 1)
        with c3:
            mmetric = st.selectbox("Plot metric", ["LCOP", "NPV", "ROI", "PBT"], index=0, key="mmetric")
        with st.expander("🎚️ Uncertainty assumptions (edit JSON, applied on run)", expanded=False):
            st.caption("Add `price_uncertainty` / `consumption_uncertainty` / `production_uncertainty` blocks "
                       "with {std, min, max}; and `project_uncertainties` for capital/OPEX/lifetime/interest. "
                       "Omitted → OpenPyTEA defaults.")
            unc_view = {
                "project_uncertainties": cfg.get("project_uncertainties", {}),
                "variable_opex_inputs": {k: {kk: vv for kk, vv in v.items() if "uncertainty" in kk}
                                         for k, v in (cfg.get("variable_opex_inputs", {}) or {}).items()},
                "plant_products": {k: {kk: vv for kk, vv in v.items() if "uncertainty" in kk}
                                   for k, v in (cfg.get("plant_products", {}) or {}).items()},
            }
            unc_txt = st.text_area("Uncertainties JSON", json.dumps(unc_view, indent=2), height=220)
        if st.button("🎲 Run Monte Carlo", type="primary"):
            try:
                unc = json.loads(unc_txt)
                if isinstance(unc, dict):
                    _changed = False
                    if "project_uncertainties" in unc:
                        if cfg.get("project_uncertainties", {}) != (unc["project_uncertainties"] or {}):
                            cfg["project_uncertainties"] = unc["project_uncertainties"] or {}
                            _changed = True
                    for sec in ("variable_opex_inputs", "plant_products"):
                        for k, v in (unc.get(sec, {}) or {}).items():
                            if k in (cfg.get(sec, {}) or {}) and isinstance(v, dict):
                                for uk, uv in v.items():
                                    if cfg[sec][k].get(uk) != uv:
                                        cfg[sec][k][uk] = uv
                                        _changed = True
                    if _changed:
                        mark_dirty()  # changed uncertainties invalidate old MC
                plant2, e2 = current_plant()
                if e2:
                    for e in e2:
                        st.error(e)
                    st.stop()
                plant = plant2
            except Exception as e:
                st.warning(f"Uncertainty JSON ignored ({e}); using current config.")
            with st.spinner(f"Sampling {n:,} draws…"):
                try:
                    mc = T.run_monte_carlo(plant, num_samples=int(n),
                                           random_seed=(None if seed == 0 else int(seed)))
                    st.session_state.mc_data = mc
                    st.session_state.mc_n = int(n)
                except Exception as e:
                    st.error(f"Monte Carlo failed: {e}")
                    st.stop()
        mc = st.session_state.mc_data
        if mc is not None:
            vals = np.asarray(mc["metrics"][mmetric], dtype=float)
            n_total = len(vals)
            vals = vals[np.isfinite(vals)]
            if len(vals) == 0:
                st.warning(f"All {n_total:,} {mmetric} draws were non-finite (e.g. the plant never pays back "
                           f"under uncertainty) — no distribution to show. Try LCOP/NPV or narrower uncertainties.")
                st.stop()
            if len(vals) < n_total:
                st.caption(f"Note: {n_total - len(vals):,} of {n_total:,} draws were non-finite and excluded.")
            s1, s2, s3, s4 = st.columns(4)
            with s1:
                kpi_card(f"{mmetric} mean", f"{np.mean(vals):,.4g}", f"σ = {np.std(vals):,.3g}")
            with s2:
                kpi_card("P10 / P50 / P90",
                         f"{np.percentile(vals,10):,.3g} / {np.percentile(vals,50):,.3g} / {np.percentile(vals,90):,.3g}")
            with s3:
                kpi_card("P(loss)" if mmetric == "NPV" else "P(LCOP > 2× base)",
                         f"{np.mean(vals < 0):.1%}" if mmetric == "NPV"
                         else f"{np.mean(vals > 2*np.median(vals)):.1%}" if np.median(vals) else "—")
            with s4:
                kpi_card("Samples", f"{len(vals):,}", f"seed {seed}")
            fig, _ = OP.plot_monte_carlo(mc, metric=mmetric, figsize=(8, 4.5), show=False)
            show_fig(fig)
            with st.expander("🔍 Sampled input distributions (process vs economic)"):
                try:
                    figs = OP.plot_monte_carlo_inputs(mc, show=False)
                    # "both" → (fig_process, axes_process, fig_economic, axes_economic)
                    if isinstance(figs, tuple) and len(figs) == 4:
                        if figs[0] is not None:
                            st.markdown("**Process inputs** (consumption / production)")
                            show_fig(figs[0])
                        if figs[2] is not None:
                            st.markdown("**Economic inputs** (prices, rates, project factors)")
                            show_fig(figs[2])
                    elif isinstance(figs, tuple) and len(figs) == 2 and hasattr(figs[0], "savefig"):
                        show_fig(figs[0])
                    else:
                        st.info("Input-distribution figure format not recognised; see summary below.")
                    inp = pd.DataFrame([{"input": k, "mean": float(np.mean(np.asarray(v, dtype=float))),
                                                   "std": float(np.std(np.asarray(v, dtype=float)))}
                                        for k, v in mc["inputs"].items()])
                    st.dataframe(inp.style.format({"mean": "{:,.4g}", "std": "{:,.4g}"}),
                                 use_container_width=True, hide_index=True)
                except Exception as e:
                    st.warning(f"Input plot unavailable: {e}")

# ============================================================================
# PAGE 5 — COMPARE
# ============================================================================
elif page == "⚖️ Compare Designs":
    st.title("⚖️ Compare Designs")
    st.markdown("Pit presets (or your edited working plant) against each other: KPIs, cash-flow overlay, LCOP bars.")
    names = list(T.PRESETS.keys()) + ["✏️ Current working plant"]
    sel = st.multiselect("Plants to compare (2–4)", names, default=names[:2])
    if len(sel) < 2:
        st.info("Select at least two plants to compare.")
        st.stop()
    if len(sel) > 4:
        st.warning("Maximum 4 plants — comparing the first four selected.")
        sel = sel[:4]

    plants, kpis, labels = [], [], []
    ok = True
    for s in sel:
        if s == "✏️ Current working plant":
            pcfg, peq = deepcopy(st.session_state.plant_cfg), deepcopy(st.session_state.equipment_specs)
            label = pcfg.get("plant_name", "Working plant") + " (working)"
        else:
            p = T.PRESETS[s]
            pcfg, peq = deepcopy(p["plant"]), deepcopy(p["equipment"])
            label = pcfg.get("plant_name", s)
        eq_objs, errs = T.build_equipment_list(peq)
        if errs:
            st.error(f"{s}: " + "; ".join(errs)); ok = False; break
        try:
            pl = T.build_plant(pcfg, eq_objs)
            k = T.plant_kpis(pl)
        except Exception as e:
            st.error(f"{s}: {e}"); ok = False; break
        plants.append(pl); kpis.append(k); labels.append(label)
    if not ok:
        st.stop()

    kdf = pd.DataFrame([{
        "Plant": lb, "Fixed capital": k["fixed_capital"], "NPV": k["npv"],
        "IRR": k["irr"], "ROI": k["roi"], "Payback (yr)": k["payback"], "LCOP ($/kg)": k["lcop"],
    } for lb, k in zip(labels, kpis)]).set_index("Plant")
    st.dataframe(kdf.style.format({"Fixed capital": "${:,.0f}", "NPV": "${:,.0f}", "IRR": "{:.1%}",
                                             "ROI": "{:.0f}%", "Payback (yr)": "{:.1f}", "LCOP ($/kg)": "{:.3f}"},
                                  na_rep="—"),
                 use_container_width=True)

    g1, g2 = st.columns(2)
    with g1:
        st.markdown("**Cash-flow overlay**")
        fig, _ = OP.plot_cash_flow(OA.cash_flow_data(plants), figsize=(7.5, 4.5), show=False)
        show_fig(fig)
    with g2:
        st.markdown("**LCOP comparison**")
        fig, _ = OP.plot_stacked_bar(OA.levelized_cost_data(plants), figsize=(7.5, 4.5), show=False)
        show_fig(fig)
    g3, g4 = st.columns(2)
    with g3:
        st.markdown("**Direct-cost comparison**")
        fig, _ = OP.plot_stacked_bar(OA.direct_costs_data(plants), figsize=(7.5, 4.5), show=False)
        show_fig(fig)
    with g4:
        st.markdown("**Fixed-capital comparison**")
        fig, _ = OP.plot_stacked_bar(OA.fixed_capital_data(plants), figsize=(7.5, 4.5), show=False)
        show_fig(fig)

# ============================================================================
# PAGE 6 — JSON & ABOUT
# ============================================================================
elif page == "📁 JSON & About":
    st.title("📁 JSON Workflow & About")
    t1, t2 = st.tabs(["🔄 Import / Export", "ℹ️ About & Methods"])

    with t1:
        st.markdown("OpenPyTEA's reproducible workflow is JSON-based. Export your working plant, "
                    "or import a config to continue editing it here.")
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**Export working plant**")
            js = json.dumps(T.plant_to_jsonable(st.session_state.plant_cfg,
                                                st.session_state.equipment_specs), indent=2)
            st.download_button("⬇️ Download JSON", js.encode(), file_name="distillation_plant.json",
                               mime="application/json", use_container_width=True)
            st.code(js[:2000] + ("\n…" if len(js) > 2000 else ""), language="json")
        with c2:
            st.markdown("**Import plant JSON**")
            up = st.file_uploader("Upload {plant, equipment} JSON", type=["json"])
            # import each uploaded file exactly once (guarded by id), then
            # rerun so the sidebar badge + editors refresh in one motion
            if up is not None:
                raw = up.getvalue()
                file_id = (up.name, len(raw))
                if st.session_state.get("last_upload_id") != file_id:
                    try:
                        import_plant_dict(json.loads(raw.decode()))
                        st.session_state.import_notice = (
                            True, "Imported! Head to the Plant TEA Builder to review & run.")
                    except Exception as e:
                        st.session_state.import_notice = (False, f"Import failed: {e}")
                    st.session_state.last_upload_id = file_id
                    st.rerun()
            if st.session_state.get("import_notice"):
                _ok, _msg = st.session_state.import_notice
                (st.success if _ok else st.error)(_msg)
                del st.session_state.import_notice  # show once
            st.markdown("**Try the bundled example**")
            if st.button("Load Fractional preset JSON"):
                try:
                    bundled = json.loads(Path("presets/fractional.json").read_text())
                    import_plant_dict(bundled)
                    st.session_state.import_notice = (
                        True, "Loaded presets/fractional.json into the working plant.")
                    st.rerun()
                except Exception as e:
                    st.error(f"Could not load bundled file: {e}")

    with t2:
        st.markdown("## About this app")
        st.markdown(
            "**Distillation TEA Studio** is an interactive web app built on "
            "[**OpenPyTEA**](https://github.com/pbtamarona/OpenPyTEA) — the open-source Python "
            "toolkit for techno-economic assessment (TEA) of chemical and energy systems "
            "(TU Delft, MIT licence). It pairs OpenPyTEA's economics engine with the "
            "distillation study notes shipped in this repository (`1788342025167.pdf`)."
        )
        m1, m2 = st.columns(2)
        with m1:
            st.markdown("### 🔬 Methods (how the numbers are made)")
            st.markdown(
                "- **Equipment costing** — each unit looks up a published correlation "
                "(Turton, Seider, Perry, Towler…) by category/type, evaluates it at size `s`, "
                "then inflation-adjusts with the **CEPCI index** to the target year.\n"
                "- **Installed (direct) cost** — purchased cost × process-type installation "
                "factors (erection, piping, instrumentation, electrical, civil, structural, "
                "lagging) × relative material factor.\n"
                "- **CAPEX** — inside battery limits (ISBL) from direct costs, plus outside "
                "battery limits (OSBL), design & engineering, contingency and location factor "
                "→ fixed capital + working capital.\n"
                "- **OPEX** — variable (feed, utilities at consumption × price) + fixed "
                "(labour, supervision, maintenance, overhead, taxes/insurance, R&D…).\n"
                "- **Cash flow & metrics** — construction ramp, production ramp, discounting "
                "→ **NPV, IRR, ROI, payback, LCOP** (levelised cost of product).\n"
                "- **Uncertainty** — sensitivity sweeps, tornado rankings and Monte Carlo "
                "sampling honour the same **parameter-dependency graph** (e.g. utility use "
                "scaling with production)."
            )
        with m2:
            st.markdown("### 📖 Study-notes source")
            st.markdown(
                "The *Learn Distillation* pages transcribe the 8-page handwritten reference in "
                "this repo: Simple, Fractional, Flash, Steam, Vacuum, Azeotropic and Extractive "
                "distillation, plus the troubleshooting matrix. Definitions, principles, "
                "equipment lists, working steps, applications, advantages/limitations and "
                "corrective actions all mirror that source."
            )
            st.markdown("### 🔗 Links")
            st.markdown(
                "- OpenPyTEA repo: `github.com/pbtamarona/OpenPyTEA`\n"
                "- Docs: `openpytea.readthedocs.io`\n"
                "- Walkthrough: `walkthrough.ipynb` in the OpenPyTEA repo\n"
                "- One-day workshop (TU Delft, Nov 2026) — see OpenPyTEA README\n"
                "- This app's presets: `presets/*.json`"
            )
            st.markdown("### ⚠️ Caveats")
            st.markdown(
                "Class-4/5 screening estimates (±30–50%). Correlations have valid size ranges; "
                "extrapolation, location factors and price forecasts all carry uncertainty — "
                "use the Monte Carlo page to quantify it. Not a substitute for detailed design."
            )
        st.markdown("### 📝 Citation")
        st.code(
            "Tamarona, P.B. et al. OpenPyTEA: An open-source Python toolkit for\n"
            "techno-economic assessment of process plants. TU Delft. MIT Licence.\n"
            "https://github.com/pbtamarona/OpenPyTEA",
            language="text",
        )
