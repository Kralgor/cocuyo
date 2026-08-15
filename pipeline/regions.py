"""
Single source of truth for all 17 canonical Cocuyo regions.

To add a region: add it to REGIONS here, nowhere else.
"""

from typing import TypedDict


class RegionMeta(TypedDict):
    display_name: str
    state: str
    lat: float
    lon: float


# Keys are canonical region identifiers used throughout the pipeline,
# in Supabase, and in status.json.
REGIONS: dict[str, RegionMeta] = {
    "maracaibo": {
        "display_name": "Maracaibo (Zulia)",
        "state": "Zulia",
        "lat": 10.6427,
        "lon": -71.6125,
    },
    "san_cristobal": {
        "display_name": "San Cristóbal (Táchira)",
        "state": "Táchira",
        "lat": 7.7669,
        "lon": -72.2311,
    },
    "merida": {
        "display_name": "Mérida (Mérida)",
        "state": "Mérida",
        "lat": 8.5897,
        "lon": -71.1440,
    },
    "valera": {
        "display_name": "Valera (Trujillo)",
        "state": "Trujillo",
        "lat": 9.3197,
        "lon": -70.6068,
    },
    "barquisimeto": {
        "display_name": "Barquisimeto (Lara)",
        "state": "Lara",
        "lat": 10.0647,
        "lon": -69.3571,
    },
    "punto_fijo": {
        "display_name": "Punto Fijo (Falcón)",
        "state": "Falcón",
        "lat": 11.7069,
        "lon": -70.2153,
    },
    "valencia": {
        "display_name": "Valencia (Carabobo)",
        "state": "Carabobo",
        "lat": 10.1579,
        "lon": -68.0075,
    },
    "maracay": {
        "display_name": "Maracay (Aragua)",
        "state": "Aragua",
        "lat": 10.2469,
        "lon": -67.5958,
    },
    "caracas": {
        "display_name": "Caracas (Distrito Capital)",
        "state": "Distrito Capital",
        "lat": 10.4806,
        "lon": -66.9036,
    },
    "los_teques": {
        "display_name": "Los Teques (Miranda)",
        "state": "Miranda",
        "lat": 10.3432,
        "lon": -67.0448,
    },
    "guarenas_guatire": {
        "display_name": "Guarenas-Guatire (Miranda)",
        "state": "Miranda",
        "lat": 10.4667,
        "lon": -66.5333,
    },
    "barinas": {
        "display_name": "Barinas (Barinas)",
        "state": "Barinas",
        "lat": 8.6226,
        "lon": -70.2075,
    },
    "maturin": {
        "display_name": "Maturín (Monagas)",
        "state": "Monagas",
        "lat": 9.7458,
        "lon": -63.1833,
    },
    "barcelona": {
        "display_name": "Barcelona (Anzoátegui)",
        "state": "Anzoátegui",
        "lat": 10.1337,
        "lon": -64.6864,
    },
    "cumana": {
        "display_name": "Cumaná (Sucre)",
        "state": "Sucre",
        "lat": 10.4631,
        "lon": -64.1731,
    },
    "porlamar": {
        "display_name": "Porlamar (Nueva Esparta)",
        "state": "Nueva Esparta",
        "lat": 10.9578,
        "lon": -63.8497,
    },
    "ciudad_guayana": {
        "display_name": "Ciudad Guayana (Bolívar)",
        "state": "Bolívar",
        "lat": 8.3667,
        "lon": -62.6500,
    },
    # ── states added 2026-08-15 (per-municipio map): capitals of the 8
    # previously region-less states, so every municipio is selectable.
    "guanare": {
        "display_name": "Guanare (Portuguesa)",
        "state": "Portuguesa",
        "lat": 9.0479,
        "lon": -69.7492,
    },
    "san_felipe": {
        "display_name": "San Felipe (Yaracuy)",
        "state": "Yaracuy",
        "lat": 10.3375,
        "lon": -68.7392,
    },
    "san_carlos": {
        "display_name": "San Carlos (Cojedes)",
        "state": "Cojedes",
        "lat": 9.6608,
        "lon": -68.5860,
    },
    "san_juan_de_los_morros": {
        "display_name": "San Juan de los Morros (Guárico)",
        "state": "Guárico",
        "lat": 9.9109,
        "lon": -67.3582,
    },
    "san_fernando_de_apure": {
        "display_name": "San Fernando de Apure (Apure)",
        "state": "Apure",
        "lat": 7.8813,
        "lon": -67.4723,
    },
    "puerto_ayacucho": {
        "display_name": "Puerto Ayacucho (Amazonas)",
        "state": "Amazonas",
        "lat": 5.6636,
        "lon": -67.6240,
    },
    "tucupita": {
        "display_name": "Tucupita (Delta Amacuro)",
        "state": "Delta Amacuro",
        "lat": 9.0578,
        "lon": -62.0553,
    },
    "la_guaira": {
        "display_name": "La Guaira (La Guaira)",
        "state": "La Guaira",
        "lat": 10.6032,
        "lon": -66.9330,
    },
}

# ── adjacency map ──
# Source: Phase 3 CONTEXT.md D-07. If A lists B, B must list A.
# Changes MUST be mirrored in mobile/lib/regions.ts ADJACENCY_MAP.
ADJACENCY_MAP: dict[str, list[str]] = {
    "maracaibo": ["punto_fijo", "valera"],
    "punto_fijo": ["maracaibo", "barquisimeto"],
    "san_cristobal": ["merida", "barinas"],
    "merida": ["san_cristobal", "valera", "barinas"],
    "valera": ["merida", "maracaibo", "barquisimeto", "barinas"],
    "barinas": ["san_cristobal", "merida", "valera", "barquisimeto", "guanare", "san_fernando_de_apure"],
    "barquisimeto": ["punto_fijo", "valera", "barinas", "valencia", "guanare", "san_felipe"],
    "valencia": ["barquisimeto", "maracay", "san_carlos"],
    "maracay": ["valencia", "los_teques", "caracas", "san_juan_de_los_morros"],
    "caracas": ["los_teques", "guarenas_guatire", "maracay", "la_guaira"],
    "los_teques": ["caracas", "maracay", "guarenas_guatire"],
    "guarenas_guatire": ["caracas", "los_teques", "barcelona"],
    "barcelona": ["guarenas_guatire", "cumana", "maturin"],
    "cumana": ["barcelona", "porlamar", "maturin"],
    "maturin": ["barcelona", "cumana", "ciudad_guayana", "tucupita"],
    "porlamar": ["cumana"],
    "ciudad_guayana": ["maturin", "tucupita"],
    # 2026-08-15 additions — neighbors mirror the state map
    "guanare": ["barinas", "san_carlos", "barquisimeto"],
    "san_felipe": ["san_carlos", "barquisimeto"],
    "san_carlos": ["guanare", "san_felipe", "valencia", "san_juan_de_los_morros"],
    "san_juan_de_los_morros": ["san_carlos", "maracay", "san_fernando_de_apure"],
    "san_fernando_de_apure": ["san_juan_de_los_morros", "barinas"],
    "puerto_ayacucho": [],
    "tucupita": ["maturin", "ciudad_guayana"],
    "la_guaira": ["caracas"],
}


# Derived lookup: region key → state name.
# Used by pipeline to backfill the state column on outage_reports.
REGION_TO_STATE: dict[str, str] = {k: v["state"] for k, v in REGIONS.items()}

# Venezuela bounding box used by validation.py for geo consistency check.
# Approximately: 0.5–12.5° N, 59.5–73.5° W
VE_LAT_MIN: float = 0.5
VE_LAT_MAX: float = 12.5
VE_LON_MIN: float = -73.5
VE_LON_MAX: float = -59.5
