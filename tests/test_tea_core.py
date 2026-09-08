"""Regression tests for Distillation TEA Studio (tea_core + content).

Run:  pip install -r requirements-dev.txt
      pytest tests/ -q
"""
import json
import sys
from copy import deepcopy
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import tea_core as T
from content import DISTILLATION_TYPES, recommend_distillation
from openpytea import analysis as OA
from openpytea import plotting as OP


@pytest.fixture(scope="module")
def fractional_plant():
    p = T.PRESETS["Fractional — Ethanol/Water (continuous)"]
    eq, errs = T.build_equipment_list(deepcopy(p["equipment"]))
    assert not errs
    plant = T.build_plant(deepcopy(p["plant"]), eq)
    T.plant_kpis(plant)
    return plant


# ---- presets ---------------------------------------------------------------

def test_all_presets_build_with_sane_kpis():
    for name, p in T.PRESETS.items():
        eq, errs = T.build_equipment_list(deepcopy(p["equipment"]))
        assert not errs, (name, errs)
        k = T.plant_kpis(T.build_plant(deepcopy(p["plant"]), eq))
        assert np.isfinite(k["fixed_capital"]) and k["fixed_capital"] > 0, name
        assert np.isfinite(k["variable_opex"]) and np.isfinite(k["fixed_opex"]), name


def test_preset_json_files_roundtrip():
    for f in (Path(__file__).parents[1] / "presets").glob("*.json"):
        obj = json.loads(f.read_text())
        pcfg, peq = T.parse_uploaded_json(obj)
        eq, errs = T.build_equipment_list(peq)
        assert not errs, (f.name, errs)
        T.build_plant(pcfg, eq)


# ---- cost database ----------------------------------------------------------

def test_cost_db_sweep_mid_range():
    """Every (category, type) must cost at mid-range — except the single
    correlation whose cost year predates the CEPCI table (upstream gap)."""
    known_cepci_gaps = {"h2_compressor_pandolfo_1987"}
    cepci_years = set(map(int, T.cepci_df().index.tolist()))
    n = 0
    for cat in T.list_categories():
        for typ in T.list_types(cat):
            row = T.correlation_row(cat, typ)
            form = str(row.get("form", "")).lower()
            try:
                lo, hi = float(row["s_lower"]), float(row["s_upper"])
                mid = float(np.sqrt(lo * hi)) if lo > 0 and hi > lo else 10.0
            except (TypeError, ValueError):
                mid = 10.0
            kw = {}
            if form == "2-var power-law":
                try:
                    a, b = float(row["s2_lower"]), float(row["s2_upper"])
                    kw["s2"] = float(np.sqrt(a * b)) if a > 0 and b > a else 10.0
                except (TypeError, ValueError):
                    kw["s2"] = 10.0
            if int(row["cost_year"]) not in cepci_years:
                assert row["key"] in known_cepci_gaps, f"new CEPCI gap: {row['key']}"
                continue
            e = T.cost_equipment("t", cat, typ, mid, **kw)
            assert e.purchased_cost > 0 and np.isfinite(e.purchased_cost)
            assert e.direct_cost > 0 and np.isfinite(e.direct_cost)
            n += 1
    assert n > 350


def test_cost_curve_refuses_unadjustable():
    curve, _row = T.cost_curve("Compressors & blowers", "H2 compressor")
    assert curve is None  # cost year 1987 outside CEPCI → no stale-dollar curve


# ---- analysis + plotting smoke -----------------------------------------------

def test_breakdown_and_cashflow_plots(fractional_plant):
    for fn in (OA.direct_costs_data, OA.fixed_capital_data, OA.variable_opex_data,
               OA.fixed_opex_data, OA.levelized_cost_data):
        fig, _ = OP.plot_stacked_bar(fn(fractional_plant), figsize=(7, 4), show=False)
        plt.close(fig)
    cfd = OA.cash_flow_data(fractional_plant)
    assert len(cfd["curves"]) == 1
    fig, _ = OP.plot_cash_flow(cfd, figsize=(9, 4.5), show=False)
    plt.close(fig)


def test_sensitivity_smoke(fractional_plant):
    d = OA.sensitivity_data(fractional_plant, parameter="electricity",
                            plus_minus_value=0.3, n_points=7, metric="LCOP")
    fig, _ = OP.plot_sensitivity(d, figsize=(8, 4.5), show=False)
    plt.close(fig)


def test_tornado_sanitize_handles_pbt_irr(fractional_plant):
    for metric in ("PBT", "IRR"):
        td = OA.tornado_data(fractional_plant, plus_minus_value=0.3, metric=metric)
        plot_data, dropped, base_ok = T.sanitize_tornado(td)
        assert isinstance(dropped, int) and dropped >= 0
        if plot_data is not None:
            assert base_ok
            fig, _ = OP.plot_tornado(plot_data, show=False)
            plt.close(fig)


def test_tornado_sanitize_unit():
    td = {"factors": ["a", "b", "c"], "labels": ["a", "b", "c"],
          "lows": np.array([1.0, np.inf, 2.0]), "highs": np.array([3.0, 4.0, np.nan]),
          "base_value": 2.0}
    plot_data, dropped, base_ok = T.sanitize_tornado(td)
    assert base_ok and dropped == 2 and plot_data["factors"] == ["a"]
    td_bad = dict(td, base_value=np.nan)
    assert T.sanitize_tornado(td_bad)[0] is None


def test_monte_carlo_smoke(fractional_plant):
    mc = T.run_monte_carlo(fractional_plant, num_samples=500, random_seed=7)
    assert set(mc["metrics"]) >= {"LCOP", "NPV", "ROI", "PBT"}
    fig, _ = OP.plot_monte_carlo(mc, metric="LCOP", show=False)
    plt.close(fig)


# ---- helpers -----------------------------------------------------------------

@pytest.mark.parametrize("v,exp", [(float("nan"), 0.0), (None, 0.0), ("", 0.0),
                                   ("12.5", 12.5), (12, 12.0)])
def test_safe_float(v, exp):
    assert T.safe_float(v) == exp


@pytest.mark.parametrize("v,exp", [(float("nan"), 1), (None, 1), ("", 1),
                                   ("20", 20), (20.9, 20)])
def test_safe_int(v, exp):
    assert T.safe_int(v) == exp


@pytest.mark.parametrize("v,exp", [(1.5, True), (0.0, True), (None, False),
                                   (float("nan"), False), (float("inf"), False),
                                   ("x", False)])
def test_is_finite_number(v, exp):
    assert T.is_finite_number(v) is exp


def test_malformed_inputs_graceful():
    with pytest.raises(ValueError):
        T.parse_uploaded_json({})
    _, errs = T.build_equipment_list([{"name": "x", "category": "Nope",
                                       "type": "Nah", "param": 5}])
    assert len(errs) == 1


# ---- content ------------------------------------------------------------------

def test_distillation_content_complete():
    assert len(DISTILLATION_TYPES) == 7
    for name, d in DISTILLATION_TYPES.items():
        for key in ("definition", "principle", "equipment", "working",
                    "applications", "advantages", "limitations", "key_point",
                    "troubleshooting"):
            assert d[key], (name, key)


def test_recommender_rules():
    assert recommend_distillation(50, False, False, False, False)[0] == "Simple"
    assert recommend_distillation(25, False, False, False, False)[0] == "Simple"  # boundary
    assert recommend_distillation(24, False, False, False, False)[0] == "Fractional"
    assert recommend_distillation(10, False, False, False, False)[0] == "Fractional"
    assert recommend_distillation(10, True, False, False, True)[0] == "Vacuum"
    assert recommend_distillation(10, True, False, True, False)[0] == "Steam"
    assert recommend_distillation(10, False, True, True, False)[0] == "Azeotropic"
    assert recommend_distillation(10, False, True, False, False)[0] == "Extractive"


# ---- formatting + import helpers ----------------------------------------------

@pytest.mark.parametrize("v,exp", [
    (1_500_000_000, "$1.50B"), (-37_448_192, "-$37.45M"), (2_500_000, "$2.50M"),
    (-1500, "-$2k"), (999, "$999"), (-999, "-$999"), (0, "$0"),
    (float("nan"), "—"), (float("inf"), "—"), (None, "—"),
])
def test_fmt_money(v, exp):
    assert T.fmt_money(v) == exp


def test_normalize_equipment_specs_defaults():
    out = T.normalize_equipment_specs([{"category": "Pumps", "type": "Centrifugal"}])
    assert out[0]["name"] == "EQ-1"
    assert out[0]["param"] == 0.0
    assert out[0]["material"] == "Carbon steel"
    assert out[0]["process_type"] == "Fluids"
    assert out[0]["target_year"] == 2024
    out2 = T.normalize_equipment_specs([{"name": "P", "category": "Pumps"}],
                                       default_process_type="Mixed")
    assert out2[0]["process_type"] == "Mixed"


def test_preset_files_match_in_memory_presets():
    """presets/*.json must mirror tea_core.PRESETS (the UI loads the file)."""
    preset_dir = Path(__file__).parents[1] / "presets"
    slug_of = {n.split("—")[0].strip().lower().replace(" ", "_").replace("/", "_"): n
               for n in T.PRESETS}
    assert set(slug_of) == {f.stem for f in preset_dir.glob("*.json")}
    for slug, name in slug_of.items():
        obj = json.loads((preset_dir / f"{slug}.json").read_text())
        assert obj["plant"] == T.PRESETS[name]["plant"], slug
        assert obj["equipment"] == T.PRESETS[name]["equipment"], slug
