"""Core TEA logic: thin, UI-friendly wrappers around OpenPyTEA.

Keeps Streamlit code (app.py) lean and makes the economics testable.
"""
from __future__ import annotations

import io
import json
from copy import deepcopy
from typing import Any, Dict, List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from openpytea.equipment import Equipment, CostCorrelationDB, CEPCI_DF, COST_DB_DF
from openpytea.plant import Plant
from openpytea import analysis as OA
from openpytea import plotting as OP


# ----------------------------------------------------------------------------
# Cost database helpers
# ----------------------------------------------------------------------------

def cost_db() -> pd.DataFrame:
    df = COST_DB_DF.copy()
    df.columns = [c.strip() for c in df.columns]
    return df


def list_categories() -> List[str]:
    df = cost_db()
    cats = sorted(df["category"].dropna().unique().tolist())
    # Put distillation-relevant categories first
    priority = ["Towers", "Trays", "Heat exchangers", "Pressure vessels",
                "Pumps", "Tanks", "Boilers, heaters, & furnaces",
                "Packings & adsorbents", "Ejectors"]
    ordered = [c for c in priority if c in cats] + [c for c in cats if c not in priority]
    return ordered


def list_types(category: str) -> List[str]:
    df = cost_db()
    sub = df[df["category"] == category]
    return sorted(sub["type"].dropna().unique().tolist())


def correlation_row(category: str, type_: str | None) -> Dict[str, Any]:
    df = cost_db()
    sub = df[df["category"] == category]
    if type_:
        sub = sub[sub["type"] == type_]
    if sub.empty:
        raise KeyError(f"No correlation for {category} / {type_}")
    return sub.iloc[0].to_dict()


def cepci_df() -> pd.DataFrame:
    df = CEPCI_DF.copy()
    df.index.name = "year"
    return df


def cepci_factor(cost_year: int, target_year: int) -> float:
    df = CEPCI_DF
    return float(df.loc[target_year, "cepci"] / df.loc[cost_year, "cepci"])


MATERIALS = list(Equipment.material_factors.keys())
PROCESS_TYPES = list(Equipment.process_factors.keys())

COUNTRIES = sorted(list(Plant.locFactors.keys()))


def regions_for_country(country: str) -> List[str]:
    v = Plant.locFactors.get(country)
    if isinstance(v, dict):
        return sorted(list(v.keys()))
    return ["—"]


def loc_factor_for(country: str, region: str) -> float:
    v = Plant.locFactors.get(country)
    if isinstance(v, dict):
        return float(v.get(region, list(v.values())[0]))
    return float(v)


def cost_equipment(name: str, category: str, type_: str | None, param: float,
                   process_type: str = "Fluids", material: str | None = None,
                   target_year: int = 2024, num_units: int | None = None,
                   s2: float | None = None) -> Equipment:
    p = (param, s2) if s2 is not None else param
    eq = Equipment(
        name=name, param=p, process_type=process_type,
        category=category, type=type_, material=material,
        target_year=target_year, num_units=num_units,
    )
    return eq


def cost_curve(category: str, type_: str | None, n: int = 60,
               process_type: str = "Fluids", material: str | None = None,
               target_year: int = 2024):
    """Purchased-cost curve across the correlation's valid size range."""
    row = correlation_row(category, type_)
    import numpy as np
    try:
        lo, hi = float(row.get("s_lower")), float(row.get("s_upper"))
    except (TypeError, ValueError):
        return None, row
    if pd.isna(lo) or pd.isna(hi) or lo <= 0 or hi <= lo:
        return None, row
    ss = np.geomspace(float(lo), float(hi), n) if float(lo) > 0 else np.linspace(float(lo), float(hi), n)
    db = CostCorrelationDB()
    key = row["key"]
    costs = []
    for s in ss:
        try:
            c, _, _ = db.evaluate(key, float(s))
        except Exception:
            c = float("nan")
        costs.append(c)
    # inflation adjust to target year; if the correlation's cost year is
    # outside the CEPCI table, refuse to draw rather than show stale dollars
    try:
        f = cepci_factor(int(row["cost_year"]), target_year)
        costs = [c * f for c in costs]
    except Exception:
        return None, row
    return (ss, costs), row


# ----------------------------------------------------------------------------
# Plant presets — distillation-flavoured TEA starting points
# ----------------------------------------------------------------------------

def _eq(name, param, category, type_, material="Carbon steel", process_type="Fluids",
        target_year=2024, num_units=None):
    return {
        "name": name, "param": param, "process_type": process_type,
        "category": category, "type": type_, "material": material,
        "target_year": target_year, **({"num_units": num_units} if num_units else {}),
    }


PRESETS: Dict[str, Dict[str, Any]] = {
    "Fractional — Ethanol/Water (continuous)": {
        "blurb": "Continuous sieve-tray column with kettle reboiler, condenser, reflux drum + pump. The default teaching case.",
        "plant": {
            "plant_name": "Ethanol-Water Fractionation",
            "process_type": "Fluids",
            "country": "Netherlands",
            "interest_rate": 0.09,
            "project_lifetime": 20,
            "plant_utilization": 0.95,
            "plant_products": {
                "ethanol_distillate": {"production": 40_000, "price": 1.35},
                "bottoms_credit": {"production": 60_000, "price": 0.05},
            },
            "variable_opex_inputs": {
                "steam_LP": {"consumption": 120_000, "price": 0.020},
                "electricity": {"consumption": 60, "price": 85},
                "cooling_water": {"consumption": 500_000, "price": 0.00025},
                "feed_ethanol_water": {"consumption": 100_000, "price": 0.30},
            },
        },
        "equipment": [
            _eq("T-101 Fractionating column", 8.0, "Towers", "Tray and packed"),
            _eq("E-101 Kettle reboiler", 60.0, "Heat exchangers", "Kettle reboiler"),
            _eq("E-102 Condenser", 45.0, "Heat exchangers", "Fixed tube"),
            _eq("V-101 Reflux drum", 6.0, "Pressure vessels", "Horizontal"),
            _eq("P-101 Reflux pump", 15.0, "Pumps", "Centrifugal"),
            _eq("Trays (sieve, 20)", 1.2, "Trays", "Sieve", num_units=20),
        ],
    },
    "Vacuum — High-boiler specialty": {
        "blurb": "Vacuum column + steam ejector + larger condenser. Higher CAPEX, lower temperature.",
        "plant": {
            "plant_name": "Vacuum Specialty Distillation",
            "process_type": "Fluids",
            "country": "Netherlands",
            "interest_rate": 0.09,
            "project_lifetime": 20,
            "plant_utilization": 0.92,
            "plant_products": {
                "specialty_distillate": {"production": 12_000, "price": 5.00},
            },
            "variable_opex_inputs": {
                "steam_LP": {"consumption": 60_000, "price": 0.020},
                "electricity": {"consumption": 90, "price": 85},
                "cooling_water": {"consumption": 350_000, "price": 0.00025},
                "feed_specialty": {"consumption": 13_500, "price": 2.20},
            },
        },
        "equipment": [
            _eq("T-201 Vacuum column", 12.0, "Towers", "Tray and packed", material="Stainless steel"),
            _eq("E-201 Reboiler", 40.0, "Heat exchangers", "Thermosiphon reboiler"),
            _eq("E-202 Vacuum condenser", 70.0, "Heat exchangers", "Fixed tube"),
            _eq("V-201 Receiver", 8.0, "Pressure vessels", "Horizontal"),
            _eq("J-201 Steam ejector stage", 0.02, "Ejectors", "Two-stage, including condenser and piping"),
            _eq("P-201 Bottoms pump", 10.0, "Pumps", "Centrifugal"),
        ],
    },
    "Simple — Batch still / solvent recovery": {
        "blurb": "Jacketed kettle + condenser + receivers. Cheapest CAPEX; batch operation.",
        "plant": {
            "plant_name": "Batch Solvent Recovery Still",
            "process_type": "Mixed",
            "country": "Netherlands",
            "interest_rate": 0.09,
            "project_lifetime": 15,
            "plant_utilization": 0.80,
            "production_type": "batch",
            "plant_products": {
                "recovered_solvent": {"production": 12_000, "price": 2.40},
            },
            "variable_opex_inputs": {
                "steam_LP": {"consumption": 32_000, "price": 0.020},
                "electricity": {"consumption": 25, "price": 85},
                "cooling_water": {"consumption": 150_000, "price": 0.00025},
                "spent_solvent_feed": {"consumption": 13_500, "price": 0.15},
            },
        },
        "equipment": [
            _eq("V-301 Jacketed still", 2.0, "Boilers, heaters, & furnaces", "Kettle, jacketed, glass-lined"),
            _eq("E-301 Condenser", 25.0, "Heat exchangers", "Fixed tube"),
            _eq("V-302 Receiver", 2.0, "Pressure vessels", "Horizontal"),
            _eq("TK-301 Feed tank", 30.0, "Tanks", "Cone-roof tank"),
        ],
    },
    "Steam — Essential oils": {
        "blurb": "Steam-fed vessel + condenser + separator. Heat-sensitive botanicals.",
        "plant": {
            "plant_name": "Essential Oil Steam Distillation",
            "process_type": "Mixed",
            "country": "Netherlands",
            "interest_rate": 0.09,
            "project_lifetime": 15,
            "plant_utilization": 0.85,
            "plant_products": {
                "essential_oil": {"production": 400, "price": 85.0},
                "hydrosol_credit": {"production": 5_000, "price": 0.40},
            },
            "variable_opex_inputs": {
                "steam_LP": {"consumption": 40_000, "price": 0.020},
                "electricity": {"consumption": 25, "price": 85},
                "cooling_water": {"consumption": 150_000, "price": 0.00025},
                "botanical_feed": {"consumption": 6_000, "price": 1.50},
            },
        },
        "equipment": [
            _eq("V-401 Steam vessel", 4.0, "Pressure vessels", "Vertical"),
            _eq("E-401 Condenser", 30.0, "Heat exchangers", "Fixed tube"),
            _eq("V-402 Separator", 1.5, "Pressure vessels", "Horizontal"),
            _eq("B-401 Steam boiler", 2000.0, "Boilers, heaters, & furnaces", "Steam boiler"),
        ],
    },
    "Flash — Refinery pre-fractionator": {
        "blurb": "Flash drum + preheater + pumps. Bulk light/heavy split upstream of the main column.",
        "plant": {
            "plant_name": "Flash Pre-fractionator",
            "process_type": "Fluids",
            "country": "Netherlands",
            "interest_rate": 0.09,
            "project_lifetime": 25,
            "plant_utilization": 0.96,
            "plant_products": {
                "light_ends": {"production": 90_000, "price": 0.60},
                "flashed_liquid": {"production": 210_000, "price": 0.44},
            },
            "variable_opex_inputs": {
                "electricity": {"consumption": 80, "price": 85},
                "cooling_water": {"consumption": 250_000, "price": 0.00025},
                "feed_crude_cut": {"consumption": 305_000, "price": 0.34},
            },
        },
        "equipment": [
            _eq("V-501 Flash drum", 20.0, "Pressure vessels", "Horizontal"),
            _eq("E-501 Feed preheater", 55.0, "Heat exchangers", "Floating head"),
            _eq("P-501 Feed pump", 45.0, "Pumps", "Centrifugal"),
            _eq("P-502 Liquid pump", 30.0, "Pumps", "Centrifugal"),
        ],
    },
}


def build_equipment_list(specs: List[Dict[str, Any]]) -> Tuple[List[Equipment], List[str]]:
    """Build Equipment objects from UI spec dicts. Returns (objects, errors)."""
    objs, errors = [], []
    for i, s in enumerate(specs, start=1):
        try:
            objs.append(Equipment(
                name=s.get("name", f"EQ-{i}"),
                param=s.get("param", 0.0),
                process_type=s.get("process_type", "Fluids"),
                category=s["category"],
                type=s.get("type"),
                material=s.get("material"),
                num_units=s.get("num_units"),
                purchased_cost=s.get("purchased_cost"),
                cost_year=s.get("cost_year"),
                target_year=s.get("target_year", 2024),
            ))
        except Exception as e:
            errors.append(f"#{i} {s.get('name', '')}: {e}")
    return objs, errors


def build_plant(plant_cfg: Dict[str, Any], equipment: List[Equipment]) -> Plant:
    cfg = deepcopy(plant_cfg)
    cfg["equipment"] = equipment
    return Plant(cfg)


def _safefloat(v, default=float("nan")) -> float:
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return default


def plant_kpis(plant: Plant, additional_capex: bool = False) -> Dict[str, Any]:
    plant.calculate_all(additional_capex=additional_capex)
    out: Dict[str, Any] = {}
    out["purchased_cost"] = _safefloat(getattr(plant, "purchased_cost", float("nan")))
    out["isbl"] = _safefloat(getattr(plant, "isbl", float("nan")))
    out["fixed_capital"] = _safefloat(getattr(plant, "fixed_capital", float("nan")))
    out["working_capital"] = _safefloat(getattr(plant, "working_capital", 0.0) or 0.0, default=0.0)
    out["variable_opex"] = _safefloat(getattr(plant, "variable_production_costs",
                                              getattr(plant, "variable_opex", float("nan"))))
    out["fixed_opex"] = _safefloat(getattr(plant, "fixed_production_costs",
                                            getattr(plant, "fixed_opex", float("nan"))))
    out["revenue"] = _safefloat(getattr(plant, "revenue", float("nan")))
    try:
        out["npv"] = float(plant.calculate_npv())
    except Exception:
        out["npv"] = float("nan")
    try:
        out["lcop"] = float(plant.calculate_levelized_cost())
    except Exception:
        out["lcop"] = float("nan")
    try:
        out["roi"] = float(plant.calculate_roi())
    except Exception:
        out["roi"] = float("nan")
    try:
        out["payback"] = float(plant.calculate_payback_time())
    except Exception:
        out["payback"] = float("nan")
    try:
        out["irr"] = float(plant.calculate_irr())
    except Exception:
        out["irr"] = float("nan")
    return out


# ----------------------------------------------------------------------------
# Plotting wrappers (matplotlib → Streamlit)
# ----------------------------------------------------------------------------

def _fig_to_png(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    return buf.getvalue()


def fig_direct_costs(plant, **kw):
    data = OA.direct_costs_data(plant, **kw)
    fig, ax = OP.plot_stacked_bar(data, show=False)
    return fig, data


def fig_fixed_capital(plant, **kw):
    data = OA.fixed_capital_data(plant, **kw)
    fig, ax = OP.plot_stacked_bar(data, show=False)
    return fig, data


def fig_variable_opex(plant, **kw):
    data = OA.variable_opex_data(plant, **kw)
    fig, ax = OP.plot_stacked_bar(data, show=False)
    return fig, data


def fig_fixed_opex(plant, **kw):
    data = OA.fixed_opex_data(plant, **kw)
    fig, ax = OP.plot_stacked_bar(data, show=False)
    return fig, data


def fig_lcop(plant, **kw):
    data = OA.levelized_cost_data(plant, **kw)
    fig, ax = OP.plot_stacked_bar(data, show=False)
    return fig, data


def fig_cash_flow(plants, **kw):
    data = OA.cash_flow_data(plants, **kw)
    fig, ax = OP.plot_cash_flow(data, show=False)
    return fig, data


def fig_sensitivity(plant, parameter, **kw):
    data = OA.sensitivity_data(plant, parameter=parameter, **kw)
    fig, ax = OP.plot_sensitivity(data, show=False)
    return fig, data


def fig_tornado(plant, **kw):
    data = OA.tornado_data(plant, **kw)
    fig, ax = OP.plot_tornado(data, show=False)
    return fig, data


def run_monte_carlo(plant, num_samples=20_000, **kw):
    data = OA.monte_carlo(plant, num_samples=num_samples, **kw)
    return data


def fig_monte_carlo(mc_data, **kw):
    fig, ax = OP.plot_monte_carlo(mc_data, show=False, **kw)
    return fig


def fig_monte_carlo_inputs(mc_data, **kw):
    figs = OP.plot_monte_carlo_inputs(mc_data, show=False, **kw)
    return figs


# ----------------------------------------------------------------------------
# UI-robustness helpers (unit-testable; used by app.py)
# ----------------------------------------------------------------------------

def is_finite_number(x) -> bool:
    """True for real finite numbers (rejects None/NaN/±inf)."""
    try:
        import numpy as _np
        return x is not None and pd.notna(x) and bool(_np.isfinite(float(x)))
    except (TypeError, ValueError):
        return False


def safe_float(v, default=0.0) -> float:
    """NaN/None/''-proof float coercion for editable-table cells."""
    try:
        f = float(v)
        return f if pd.notna(f) else default
    except (TypeError, ValueError):
        return default


def safe_int(v, default=1) -> int:
    """NaN/None/''-proof int coercion for editable-table cells."""
    try:
        f = float(v)
        return int(f) if pd.notna(f) else default
    except (TypeError, ValueError):
        return default


def sanitize_tornado(tdata: dict):
    """Drop non-finite tornado factors so plotting can't crash.

    PBT (=inf when a perturbation never pays back) and IRR (=NaN with no
    sign change) routinely produce non-finite lows/highs. Returns
    (plot_data_or_None, dropped_count, base_ok).
    """
    import numpy as _np
    td = dict(tdata)
    try:
        lows = _np.asarray(td["lows"], dtype=float)
        highs = _np.asarray(td["highs"], dtype=float)
    except Exception:
        return None, len(td.get("factors", [])), False
    base_ok = is_finite_number(td.get("base_value", float("nan")))
    mask = _np.isfinite(lows) & _np.isfinite(highs)
    dropped = int(len(mask) - _np.sum(mask))
    if not base_ok or not _np.any(mask):
        return None, dropped, base_ok
    td["lows"] = lows[mask]
    td["highs"] = highs[mask]
    td["factors"] = [f for f, m in zip(td["factors"], mask) if m]
    td["labels"] = [lb for lb, m in zip(td.get("labels", td["factors"]), mask) if m]
    return td, dropped, base_ok


# ----------------------------------------------------------------------------
# JSON import / export
# ----------------------------------------------------------------------------

def plant_to_jsonable(plant_cfg: Dict[str, Any], equipment_specs: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"plant": deepcopy(plant_cfg), "equipment": deepcopy(equipment_specs)}


def normalize_equipment_specs(entries: List[Dict[str, Any]],
                               default_process_type: str = "Fluids") -> List[Dict[str, Any]]:
    """Fill defaults for imported equipment dicts (missing keys, process type)."""
    norm = []
    for e in entries:
        norm.append({
            "name": e.get("name", f"EQ-{len(norm)+1}"),
            "category": e.get("category"),
            "type": e.get("type"),
            "param": e.get("param", 0.0),
            "material": e.get("material", "Carbon steel"),
            "process_type": e.get("process_type", default_process_type),
            "target_year": e.get("target_year", 2024),
            "num_units": e.get("num_units"),
        })
    return norm


def parse_uploaded_json(obj: Dict[str, Any]):
    """Accept {plant, equipment} or OpenPyTEA-style configs. Returns (plant_cfg, equipment_specs)."""
    if "plant" in obj and "equipment" in obj:
        return obj["plant"], obj["equipment"]
    if "plant" in obj and isinstance(obj["plant"], dict):
        plant = obj["plant"]
        eq = obj.get("equipment", plant.pop("equipment", []))
        return plant, eq
    if "equipment" in obj and isinstance(obj["equipment"], list):
        return {}, obj["equipment"]
    raise ValueError("JSON must contain 'plant' and/or 'equipment' keys.")


def fmt_money(x) -> str:
    try:
        import math
        if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
            return "—"
        sign = "-" if x < 0 else ""
        ax = abs(x)
        if ax >= 1e9:
            return f"{sign}${ax/1e9:.2f}B"
        if ax >= 1e6:
            return f"{sign}${ax/1e6:.2f}M"
        if ax >= 1e3:
            return f"{sign}${ax/1e3:.0f}k"
        return f"{sign}${ax:,.0f}"
    except Exception:
        return "—"
