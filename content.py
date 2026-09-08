"""Distillation knowledge base — curated from the handwritten study notes
(1788342025167.pdf) shipped with this repository.

Covers 7 distillation types + troubleshooting + decision helper data.
"""

DISTILLATION_TYPES = {
    "Simple": {
        "icon": "🧪",
        "tagline": "Single-stage batch still for large boiling-point gaps (ΔTb > 25–30 °C)",
        "definition": (
            "Simple distillation is the simplest method of distillation. It is used to separate "
            "a liquid from non-volatile impurities or to separate two miscible liquids having a "
            "large difference in boiling points (ΔTb > 25–30 °C)."
        ),
        "principle": [
            "The feed is heated in the still.",
            "The more volatile component vaporises first.",
            "Vapours rise and pass through the condenser.",
            "In the condenser, vapours are cooled and condensed.",
            "Condensed liquid (distillate) is collected in the receiver.",
            "The less volatile component remains in the still as residue.",
        ],
        "equipment": ["Still / kettle (jacketed)", "Condenser", "Distillate receivers (R1, R2)", "Steam supply + jacket", "Residue outlet"],
        "working": [
            "Feed is charged into the still and steam is passed through the jacket.",
            "Mixture is heated; the more volatile component vaporises.",
            "Vapours pass to the condenser.",
            "Cooling water enters at the bottom and leaves at the top of the condenser.",
            "Vapours condense and liquid collects in the receivers.",
            "The less volatile component remains in the still as residue.",
        ],
        "applications": [
            "Purification of liquids",
            "Separation of liquids with large boiling-point differences",
            "Recovery of solvents",
            "Desalination of water",
        ],
        "advantages": [
            "Simple construction and easy operation",
            "Low initial cost",
            "Suitable for large boiling-point differences",
            "Easy to clean and maintain",
            "Can handle high feed rates",
        ],
        "limitations": [
            "Not suitable for close-boiling liquids",
            "Low separation efficiency",
            "More energy consumption",
            "Not used for azeotropic mixtures",
        ],
        "key_point": "Feed → heat in still → vapour → condenser → distillate (top, more volatile) + residue (bottom, less volatile).",
        "troubleshooting": [
            ("Low distillate rate", "Insufficient heating / fouled reboiler", "Increase heat input / clean the reboiler"),
            ("Low product purity", "High boiling impurities / too fast distillation", "Reduce distillation rate / improve feed quality"),
            ("High pressure in system", "Condenser blocked / vent line blocked", "Clean condenser / clear vent line"),
            ("Temperature fluctuation", "Unstable heat supply / irregular feed", "Stabilise heat input"),
            ("Foaming in column", "Surface-active impurities", "Add antifoam agent / reduce heat input"),
            ("Bumping in reboiler", "Sudden boiling / superheating", "Boil gently / use boiling chips"),
            ("Leakage", "Loose connections / gasket failure", "Tighten connections / replace gasket"),
            ("Low recovery", "Poor condensation / heat loss", "Improve cooling / insulate system"),
        ],
    },
    "Fractional": {
        "icon": "🗼",
        "tagline": "Multi-stage fractionating column for close-boiling mixtures",
        "definition": (
            "Fractional distillation separates a liquid mixture into components having close "
            "boiling points by using a fractionating column with repeated vapour–liquid contact "
            "on trays or packing."
        ),
        "principle": [
            "Based on difference in volatility of components.",
            "More volatile component rises in vapour phase; less volatile stays in liquid phase.",
            "Repeated vapour–liquid contact on trays/packing gives better separation.",
        ],
        "equipment": ["Fractionating column", "Reboiler", "Condenser", "Reflux drum", "Reflux pump", "Trays / packing", "Feed inlet", "Bottoms + distillate outlets"],
        "working": [
            "Feed is introduced into the column.",
            "Reboiler heats the bottom liquid and vapour is generated.",
            "Vapour rises upward through the column.",
            "Liquid from upper trays flows downward.",
            "On each tray/packing, vapour and liquid contact each other.",
            "More volatile component goes to top, less volatile to bottom.",
            "Top vapour is condensed in the condenser.",
            "Condensed liquid collects in the reflux drum.",
            "Part is returned as reflux; the rest is withdrawn as distillate.",
            "Bottom liquid is withdrawn as bottoms (residue).",
        ],
        "applications": [
            "Separation of close-boiling liquids",
            "Petroleum refining (crude oil)",
            "Solvent recovery",
            "Alcohol purification",
            "Chemical industries",
        ],
        "advantages": [
            "Can separate close-boiling liquids",
            "High purity of products",
            "Continuous operation possible",
            "Better efficiency",
        ],
        "limitations": [
            "High initial cost",
            "More energy requirement",
            "Complex operation",
            "Flooding, weeping, entrainment may occur",
        ],
        "key_point": "More volatile → Top (distillate). Less volatile → Bottoms (residue). Trays: sieve, valve, bubble-cap. Packing: random (Raschig, Pall, saddle) or structured (Mellapak).",
        "troubleshooting": [
            ("Low separation efficiency", "Less number of trays / improper reflux ratio", "Increase trays / optimise reflux ratio"),
            ("Flooding in column", "High vapour velocity / excessive feed rate", "Reduce vapour/feed rate"),
            ("Weeping", "Low vapour velocity / high reflux ratio", "Increase vapour rate / reduce reflux"),
            ("Low distillate quality", "Poor reflux / tray weeping or damage", "Check and clean trays"),
            ("High pressure drop", "Tray hole blockage / fouling", "Clean trays / remove scale"),
            ("Irregular level in column", "Faulty condenser / uneven heat input", "Check condenser / calibrate sensors"),
            ("Low bottom product withdrawal", "Sump level low / bottom valve partly closed", "Maintain level / fully open bottom valve"),
            ("Entrainment of liquid", "High vapour velocity / damaged internals", "Reduce vapour rate / check internals"),
            ("Reboiler fouling", "Scale / polymer deposits / poor quality feed", "Clean reboiler / improve feed quality"),
        ],
    },
    "Flash": {
        "icon": "⚡",
        "tagline": "Single-stage equilibrium flash by sudden pressure reduction",
        "definition": (
            "Flash distillation (flash vaporisation) is a single-stage equilibrium separation in "
            "which a feed is partially vaporised by a sudden reduction in pressure (at nearly "
            "constant temperature), producing vapour and liquid streams in equilibrium."
        ),
        "principle": [
            "When the pressure of a liquid mixture is reduced suddenly (throttling), its boiling point decreases.",
            "Part of the liquid 'flashes' into vapour until vapour–liquid equilibrium is reached.",
            "The two phases are then separated in the flash drum.",
        ],
        "equipment": ["Throttling valve", "Flash drum (separator)", "Pressure control valve (PV)", "Level control valve (LC)", "Condenser / downstream processing"],
        "working": [
            "Liquid feed (P₁, T₁, zᵢ) passes through the throttling valve.",
            "Sudden pressure reduction causes partial vaporisation.",
            "Vapour disengages from liquid in the flash drum.",
            "Pressure control valve maintains drum operating pressure.",
            "Level control valve maintains liquid level in the drum.",
        ],
        "applications": [
            "Separation of light ends from heavy hydrocarbons (refineries)",
            "Removal of dissolved gases from liquids",
            "Pre-treatment of feeds before further separation",
            "Evaporation, degassing and stabiliser units",
        ],
        "advantages": [
            "Single stage, simple equilibrium unit",
            "No external heat needed — sensible heat of feed drives vaporisation",
            "Adiabatic operation, no heat exchanger",
            "Good pre-treatment / bulk separation step",
        ],
        "limitations": [
            "Only one equilibrium stage — poor separation",
            "Cannot produce high-purity products",
            "Performance depends strongly on pressure drop and feed condition",
        ],
        "key_point": "Balances: F = V + L and F·zᵢ = V·yᵢ + L·xᵢ. Flash fraction V/F = (hF − hL)/(hV − hL). Lower pressure ⇒ more vapour.",
        "troubleshooting": [
            ("Insufficient flash", "Pressure not reduced enough / high initial temperature", "Reduce pressure / control feed temperature"),
            ("Low vapour yield", "Low feed temperature / high system pressure", "Increase feed temperature / reduce pressure"),
            ("Carryover of liquid", "High feed rate / poor inlet device", "Reduce feed rate / improve inlet device"),
            ("Temperature not as expected", "Incorrect pressure / temperature control issue", "Check pressure control / calibrate instruments"),
            ("Fouling / scaling", "Impurities in feed / high solids content", "Pre-treat feed / clean vessel"),
            ("Unstable operation", "Fluctuating feed / pressure fluctuations", "Stabilise feed / improve control"),
            ("Safety valve lifting", "Over pressure / valve setting low", "Check pressure / reset valve"),
            ("High energy consumption", "Excessive pressure drop / heat loss", "Optimise pressure / insulate system"),
        ],
    },
    "Steam": {
        "icon": "♨️",
        "tagline": "Steam co-distillation for volatile, water-immiscible, heat-sensitive compounds",
        "definition": (
            "Steam distillation uses steam to distil volatile, water-immiscible and heat-sensitive "
            "compounds at a temperature lower than their normal boiling point."
        ),
        "principle": [
            "Steam and the organic compound are immiscible.",
            "Total vapour pressure equals the external pressure at a temperature below the organic's normal boiling point.",
            "Hence the mixture boils and volatile compounds distil over with steam.",
        ],
        "equipment": ["Distillation vessel (steam inlet + heater)", "Condenser", "Receiver / separating funnel", "Steam boiler", "Cooling-water system"],
        "working": [
            "Steam is generated in a boiler and introduced into the vessel.",
            "Steam passes through the material (mixed with water or on a tray).",
            "Volatile, water-immiscible compounds vaporise with steam.",
            "Vapour mixture (steam + organic) passes through the condenser.",
            "Vapour is cooled and condensed to liquid.",
            "Distillate collects in the receiver as two layers (organic + aqueous).",
            "Organic layer is separated (lighter or heavier than water).",
        ],
        "applications": [
            "Extraction of essential oils (eucalyptus, peppermint, rose oil)",
            "Heat-sensitive materials",
            "Purification of volatile organics",
            "Pharmaceutical and chemical industries",
            "Extraction of flavours and fragrances",
        ],
        "advantages": [
            "Distillation at lower temperature",
            "Suitable for heat-sensitive materials",
            "Prevents decomposition",
            "Simple and easy operation",
            "Good for water-immiscible volatiles",
        ],
        "limitations": [
            "Compound must be volatile with steam",
            "Not suitable for water-soluble compounds",
            "Large quantity of steam required",
            "Not suitable for very high boilers",
        ],
        "key_point": "Types: direct steam, steam-and-water, water distillation. T(mixture) < T(organic) because P(total) = P(water) + P(organic).",
        "troubleshooting": [
            ("Low distillate rate", "Insufficient steam supply / steam leaks", "Increase steam flow / check for leaks"),
            ("Poor oil / yield recovery", "Insufficient contact time / high steam rate", "Increase contact time / optimise steam"),
            ("Emulsion formation", "High oil content in layer / impurities in feed", "Allow settling / use demulsifier"),
            ("Foaming", "Impurities / saponins present", "Add antifoam / reduce steam rate"),
            ("Condensate not separating", "Dirty separator / high oil droplets", "Clean separator / maintain proper temp"),
            ("Carryover of water in distillate", "High steam rate / too much entrainment", "Reduce steam rate / improve demister"),
            ("Unpleasant odor", "Overheating / long distillation time", "Reduce heat / optimise time"),
            ("High pressure in system", "Blocked vent / condenser issue", "Clear vent line / check condenser"),
        ],
    },
    "Vacuum": {
        "icon": "🫧",
        "tagline": "Sub-atmospheric distillation for high-boiling / heat-sensitive feeds",
        "definition": (
            "Vacuum distillation is carried out below atmospheric pressure. Reduced pressure lowers "
            "the boiling point so high-boiling / heat-sensitive liquids can be distilled at lower temperature."
        ),
        "principle": [
            "A liquid boils when its vapour pressure equals the surrounding pressure.",
            "Reducing external pressure with a vacuum pump lowers the boiling point.",
            "The vapour formed is condensed and distillate is collected.",
        ],
        "equipment": ["Feed tank", "Preheater (optional)", "Heater / reboiler", "Vacuum distillation column", "Condenser", "Distillate receiver", "Vacuum pump / ejector + gauge", "Pressure control + cooling-water system", "Vacuum breaker", "Bottom product outlet"],
        "working": [
            "Feed is taken from the feed tank.",
            "It may be preheated (if required).",
            "It enters the heater/reboiler where heat is supplied.",
            "Vacuum pump removes non-condensables and reduces pressure.",
            "Liquid boils at lower temperature and vapours are generated.",
            "Vapours rise through the column; vapour–liquid contact on trays/packing separates them.",
            "Overhead vapours go to the condenser and get condensed.",
            "Condensed liquid collects in the distillate receiver.",
            "Heavier/less volatile liquid leaves as bottom product.",
        ],
        "applications": [
            "Petroleum industry (vacuum gas oil, lube base oils, heavy fractions)",
            "Pharmaceuticals (heat-sensitive compounds)",
            "High-boiling chemicals",
            "Essential oils and fragrances",
            "Solvent recovery / edible-oil purification",
        ],
        "advantages": [
            "Lower boiling temperature",
            "Prevents thermal decomposition",
            "Suitable for heat-sensitive materials",
            "Better product quality",
            "Helps distil high boilers",
        ],
        "limitations": [
            "Requires vacuum system; air leakage disturbs operation",
            "Vacuum equipment is costly",
            "Vacuum-pump maintenance required",
            "Condensation under vacuum is harder",
            "Foaming and entrainment may occur",
        ],
        "key_point": "Pressure ↓ ⇒ boiling point ↓ (P₁ < P₂ ⇒ Tb₁ < Tb₂). All components must be well sealed. Packing preferred (low ΔP); large column diameter at low pressure.",
        "troubleshooting": [
            ("High boiling at low temperature", "Vacuum not achieved / air leaks", "Check vacuum system / eliminate leaks"),
            ("Low throughput", "Insufficient heating / fouled reboiler", "Increase heating / clean reboiler"),
            ("Foaming", "Decomposition of material / too high vacuum", "Reduce vacuum level / control temperature"),
            ("Back diffusion of air", "Vacuum seal broken / leak in system", "Check vacuum breaker / repair leaks"),
            ("Bumping", "Sudden pressure change / superheated liquid", "Boil gently / use boiling chips"),
            ("Low product quality", "Thermal decomposition / high temperature", "Reduce temperature / increase vacuum"),
            ("Condenser overload", "High vapour flow / inadequate cooling", "Increase cooling / reduce feed rate"),
            ("Oil carryover in distillate", "High vapour velocity / damaged demister", "Reduce vapour rate / check demister"),
        ],
    },
    "Azeotropic": {
        "icon": "🔬",
        "tagline": "Entrainer-based separation for constant-boiling (azeotropic) mixtures",
        "definition": (
            "Azeotropic distillation separates liquid mixtures which form azeotropes and cannot be "
            "completely separated by ordinary fractional distillation, by adding an entrainer."
        ),
        "principle": [
            "An azeotrope is a constant-boiling mixture: at azeotropic composition, vapour and liquid compositions are identical.",
            "An added entrainer changes relative volatility and destroys/shifts the azeotropic point.",
            "Types: minimum-boiling and maximum-boiling azeotropes.",
        ],
        "equipment": ["Azeotropic column", "Reboiler", "Condenser", "Decanter (separator)", "Entrainer feed + recycle", "Bottoms + distillate outlets"],
        "working": [
            "Feed (azeotropic mixture) and entrainer are fed to the column.",
            "In the reboiler the mixture is partially vaporised.",
            "Entrainer changes relative volatility of key components.",
            "Vapour rises; liquid flows down.",
            "Overhead vapour is condensed in the condenser.",
            "Condensed liquid goes to the decanter where two liquid phases form.",
            "Organic/entrainer-rich phase returns as reflux.",
            "Product-rich phase is withdrawn as distillate.",
            "Bottoms may be water-rich or heavy component depending on the system.",
        ],
        "applications": [
            "Ethanol–water (benzene entrainer)",
            "Isopropanol–water (cyclohexane)",
            "Acetic acid–water, nitrobenzene–water",
            "Solvent dehydration and purification",
        ],
        "advantages": [
            "Azeotropic mixtures can be separated",
            "High purity products",
            "Effective for difficult separations",
            "Useful in solvent dehydration",
        ],
        "limitations": [
            "Extra entrainer required",
            "Additional equipment (decanter, recovery) increases cost",
            "Higher energy consumption",
            "Entrainer must be recovered and recycled",
        ],
        "key_point": "Entrainer: high-boiling, selective, forms minimum-boiling azeotrope with one component, easily recovered, stable, cheap. Works by changing VLE behaviour.",
        "troubleshooting": [
            ("Azeotrope composition not broken", "Improper entrainer / insufficient entrainer", "Select proper entrainer / increase entrainer feed"),
            ("Low purity of product", "Low reflux ratio / insufficient stages", "Increase reflux / increase stages"),
            ("High entrainer in product", "Poor separation / high reboiler temp", "Improve separation / reduce temp"),
            ("Loss of entrainer", "Carryover in distillate / high boil-up", "Improve reflux / recover entrainer"),
            ("Emulsion formation", "Water in feed / incompatible liquids", "Remove water / add demulsifier"),
            ("High energy consumption", "High reflux ratio / inefficient condenser", "Optimise reflux / improve condenser"),
            ("Irregular operation", "Unstable feed / control issues", "Stabilise feed / check control loops"),
        ],
    },
    "Extractive": {
        "icon": "⚗️",
        "tagline": "High-boiling solvent shifts relative volatility (α) for close-boiling / azeotropic feeds",
        "definition": (
            "Extractive distillation adds a high-boiling solvent (entraining solvent) to the feed to "
            "change the relative volatility of the components and achieve separation by distillation."
        ),
        "principle": [
            "The entrainer (solvent) interacts preferentially with one feed component.",
            "This changes (increases) the relative volatility α_AB = (yA/xA)/(yB/xB).",
            "Without entrainer α ≈ 1 (difficult); with entrainer α >> 1 (easy).",
        ],
        "equipment": ["Extractive distillation column", "Reboiler", "Condenser", "Solvent recovery column", "Entrainer feed + solvent recycle", "Distillate + bottom outlets"],
        "working": [
            "Feed (A+B) and high-boiling entrainer enter the extractive column.",
            "Solvent alters VLE; more volatile A goes overhead.",
            "Top vapour is condensed; distillate is usually component A.",
            "Bottoms (entrainer + less volatile B) go to the solvent recovery column.",
            "Solvent is recovered overhead and recycled; product B leaves the bottom.",
        ],
        "applications": [
            "Benzene–cyclohexane (sulfolane)",
            "Ethanol–water (glycerol, EG)",
            "Acetone–chloroform (DMSO)",
            "Acetic acid–water (glycols)",
            "Many petrochemical separations",
        ],
        "advantages": [
            "Can break azeotropes",
            "Greatly improves relative volatility",
            "High-purity products",
            "Wide range of systems",
        ],
        "limitations": [
            "Requires additional solvent",
            "More energy for solvent recovery",
            "More complex (extra column)",
            "Cost of solvent and recovery",
        ],
        "key_point": "Good entrainer: selective, high boiling (usually non-volatile), stable, inert, non-toxic, easy to separate, affordable. Entrainer does not appear in distillate (high-boiling case).",
        "troubleshooting": [
            ("Low separation factor", "Wrong solvent / low solvent ratio", "Select proper solvent / increase ratio"),
            ("High solvent in product", "Low reflux / high vapour flow", "Increase stages / increase reflux"),
            ("Solvent loss", "Carryover in distillate / high vapour rate", "Reduce vapour rate / improve reflux"),
            ("High energy consumption", "High solvent flow / inefficient reboiler", "Optimise solvent flow / improve efficiency"),
            ("Corrosion", "Incompatible solvent", "Select compatible solvent/material"),
            ("Foaming", "Solvent + feed interaction", "Reduce vapour rate"),
            ("Difficulty in solvent recovery", "Close boiling pts / improper column design", "Redesign column / adjust pressure"),
            ("Poor product purity", "Improper solvent ratio / insufficient contact", "Optimise solvent/feed ratio / increase contact time"),
        ],
    },
}

COMPARISON_TABLE = [
    {"Aspect": "Stages", "Simple": "1 (batch still)", "Fractional": "Many (trays/packing)", "Flash": "1 (equilibrium)", "Steam": "1 + condenser", "Vacuum": "Many under vacuum", "Azeotropic": "Column + decanter", "Extractive": "2 columns (extract + recovery)"},
    {"Aspect": "Best feed", "Simple": "ΔTb > 25–30 °C", "Fractional": "Close boilers", "Flash": "Bulk light/heavy split", "Steam": "Heat-sensitive, water-immiscible", "Vacuum": "High boilers / heat-sensitive", "Azeotropic": "Azeotropes", "Extractive": "Close boilers / azeotropes"},
    {"Aspect": "Key addition", "Simple": "—", "Fractional": "Reflux", "Flash": "ΔP (throttling)", "Steam": "Steam", "Vacuum": "Vacuum", "Azeotropic": "Entrainer", "Extractive": "Solvent"},
    {"Aspect": "Purity", "Simple": "Low", "Fractional": "High", "Flash": "Very low", "Steam": "Medium", "Vacuum": "High", "Azeotropic": "High", "Extractive": "High"},
    {"Aspect": "CAPEX", "Simple": "€", "Fractional": "€€€", "Flash": "€", "Steam": "€€", "Vacuum": "€€€+", "Azeotropic": "€€€+", "Extractive": "€€€€"},
    {"Aspect": "OPEX driver", "Simple": "Steam", "Fractional": "Reboiler duty", "Flash": "Compression/pumping", "Steam": "Steam use", "Vacuum": "Vacuum + heat", "Azeotropic": "Entrainer + duty", "Extractive": "Solvent + duty"},
]

GENERAL_TIPS = [
    "Maintain proper feed quality and steady feed rate.",
    "Ensure proper heat input and uniform distribution.",
    "Keep condensers and reboilers clean.",
    "Monitor pressure, temperature and levels regularly.",
    "Follow preventive maintenance to avoid downtime.",
]

ABBREVIATIONS = {
    "Temp": "Temperature",
    "Reflux": "Return of condensed liquid to column",
    "Feed": "Raw material inlet",
    "Reboiler": "Heater at bottom of column",
    "Condenser": "Heat exchanger at top of column",
    "VLE": "Vapour–Liquid Equilibrium",
}


def recommend_distillation(delta_tb, heat_sensitive, azeotrope, water_immiscible, high_boiler):
    """Simple rule-based recommender used by the interactive decision helper."""
    reasons = []
    if azeotrope:
        if water_immiscible:
            rec = "Azeotropic"
            reasons.append("Azeotrope present → ordinary distillation cannot cross the azeotropic composition; an entrainer is needed.")
        else:
            rec = "Extractive"
            reasons.append("Azeotrope / very low relative volatility → a high-boiling solvent (extractive) is usually the most robust choice.")
    elif heat_sensitive and high_boiler:
        rec = "Vacuum"
        reasons.append("Heat-sensitive + high boiler → lower the pressure to lower the boiling point.")
    elif heat_sensitive and water_immiscible:
        rec = "Steam"
        reasons.append("Heat-sensitive + water-immiscible volatile → steam co-distillation below the normal boiling point.")
    elif delta_tb is not None and delta_tb < 25:
        rec = "Fractional"
        reasons.append(f"ΔTb ≈ {delta_tb} °C (< 25 °C) → multi-stage fractionation with reflux is required.")
    elif delta_tb is not None and delta_tb >= 25:
        rec = "Simple"
        reasons.append(f"ΔTb ≈ {delta_tb} °C (≥ 25 °C) → a single-stage still is sufficient and cheapest.")
    else:
        rec = "Fractional"
        reasons.append("Default for continuous, reasonably difficult separations.")
    if rec in ("Simple", "Fractional") and heat_sensitive:
        reasons.append("Note: if thermal decomposition is observed, consider Vacuum or Steam instead.")
    return rec, reasons
