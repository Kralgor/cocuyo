"""
VIIRS nighttime lights satellite collector (NASA LANCE NRT).

Compares observed radiance vs per-region baseline to detect light
anomalies correlated with power outages.

Download only runs inside the daily publication window (06:00-08:00 UTC)
because VNP46A2NRT is a daily product; downloading outside the window
wastes bandwidth and yields stale tiles (approved decision #7).
HDF5 parsing uses h5py (approved decision #1). rasterio removed.

Used by main.py as satellite_score input to scorer.py.
Spec section 5.2.
"""
import logging
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import numpy as np
import requests

logger = logging.getLogger(__name__)

CMR_URL   = "https://cmr.earthdata.nasa.gov/search/granules.json"
TIMEOUT_S = 20

VE_BBOX = {
    "west":  -73.38,
    "south":   0.65,
    "north":  12.20,
    "east":  -59.80,
}

# Seed baselines (nW·cm⁻²·sr⁻¹) — calibrate from Black Marble historical avg.
# Spec values where given; remaining estimated from city population/area.
BASELINE_RADIANCE: dict[str, float] = {
    "caracas":          45.2,
    "maracaibo":        38.7,
    "valencia":         29.1,
    "barquisimeto":     22.4,
    "maracay":          20.8,
    "ciudad_guayana":   18.3,
    "guarenas_guatire": 19.4,
    "barcelona":        21.3,
    "los_teques":       16.7,
    "maturin":          17.9,
    "porlamar":         18.5,
    "cumana":           16.8,
    "san_cristobal":    15.2,
    "punto_fijo":       14.2,
    "barinas":          13.1,
    "valera":           11.5,
    "merida":           12.8,
}

_STATUS_TO_SCORE: dict[str, float] = {
    "major_outage":   0.90,
    "partial_outage": 0.60,
    "degraded":       0.30,
    "normal":         0.00,
}

# VNP46A2NRT tile grid constants.
# Tiles are 10° × 10° linear-lat, 2400 × 2400 px (15 arcsec/px).
# Tile h{H}v{V}: lon_min = -180 + H*10, lat_max = 90 - V*10.
_TILE_DEG   = 10      # degrees per tile
_TILE_PX    = 2400    # pixels per tile side
_PX_PER_DEG = _TILE_PX / _TILE_DEG  # 240 px/degree

# HDF5 dataset paths within a VNP46A2NRT granule.
_DATASET_NTL = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/DNB_BRDF-Corrected_NTL"
_DATASET_QF  = "HDFEOS/GRIDS/VIIRS_Grid_DNB_2d/Data Fields/Mandatory_Quality_Flag"

# NTL scale factor and fill value per product spec.
_SCALE_FACTOR = 0.1
_FILL_VALUE   = 65535

# Region bounding box half-width in degrees (~15 km at VE latitudes).
_REGION_HALF_DEG = 0.15


def classify_ratio(ratio: float) -> str:
    """Map observed/baseline radiance ratio to status string."""
    if ratio < 0.3:
        return "major_outage"
    if ratio < 0.6:
        return "partial_outage"
    if ratio < 0.85:
        return "degraded"
    return "normal"


# ── pure pixel math helpers ───────────────────────────────────────────────────

def lonlat_to_tile_pixel(
    lat: float,
    lon: float,
    tile_h: int,
    tile_v: int,
) -> Optional[tuple[int, int]]:
    """
    Convert a lat/lon coordinate to a (row, col) pixel index within a tile.

    VNP46A2NRT tile conventions used here (Black Marble linear-lat grid):
      lon: [-180 + H*10, -180 + (H+1)*10)
      lat: [(7-V)*10, (8-V)*10)
           so V=7 -> lat [0, 10), V=6 -> lat [10, 20)

    Row 0 is at the NORTH edge of the tile (lat_max). Row increases southward.
    Col 0 is at the WEST edge of the tile (lon_min). Col increases eastward.

    Returns None when coord falls outside tile span.
    """
    lon_min = -180.0 + tile_h * _TILE_DEG
    lon_max = lon_min + _TILE_DEG
    lat_max = (8 - tile_v) * _TILE_DEG
    lat_min = (7 - tile_v) * _TILE_DEG

    # Tile covers [lat_min, lat_max] and [lon_min, lon_max) inclusive.
    if lon < lon_min or lon >= lon_max or lat < lat_min or lat > lat_max:
        return None

    col = int((lon - lon_min) * _PX_PER_DEG)
    # lat exactly at lat_max -> row 0 (top edge)
    row = int((lat_max - lat) * _PX_PER_DEG)

    # Clamp to valid pixel range
    col = min(col, _TILE_PX - 1)
    row = min(row, _TILE_PX - 1)

    return (row, col)


def mask_valid_radiance(
    ntl: np.ndarray,
    qf: np.ndarray,
) -> np.ndarray:
    """
    Apply scale factor, remove fill values, remove cloud/poor-quality pixels.

    Keeps QF==0 (high quality) and QF==1 (acceptable).
    Drops QF==2 (cloud/poor); apply scale 0.1.
    Returns 1-D array of valid scaled radiance values (float).

    Note: verify exact QF convention against product documentation
    before adjusting threshold.
    """
    ntl_flat = ntl.ravel().astype(np.float64)
    qf_flat  = qf.ravel().astype(np.uint8)

    # Mask: not fill AND not cloud/poor (QF != 2)
    valid_mask = (ntl_flat != _FILL_VALUE) & (qf_flat != 2)
    return ntl_flat[valid_mask] * _SCALE_FACTOR


def mean_region_radiance(
    ntl: np.ndarray,
    qf: np.ndarray,
    rows: list[int],
    cols: list[int],
) -> Optional[float]:
    """
    Compute mean radiance over a rectangular pixel window defined by rows/cols.

    rows and cols are lists of integer indices into the 2-D tile array.
    Returns None when zero valid pixels exist (cloud-heavy night — absent != zero, ADR-009).
    """
    row_slice = np.array(sorted(set(rows)))
    col_slice = np.array(sorted(set(cols)))

    # Extract sub-window using outer indexing
    sub_ntl = ntl[np.ix_(row_slice, col_slice)]
    sub_qf  = qf[np.ix_(row_slice, col_slice)]

    valid = mask_valid_radiance(sub_ntl, sub_qf)
    if valid.size == 0:
        return None
    return float(np.mean(valid))


def which_tiles(lat: float, lon: float) -> list[str]:
    """
    Return VNP46A2NRT tile id(s) containing a given lat/lon coordinate.

    Tile h{H}v{V}:
      H = int((lon + 180) / 10)
      V = 7 - floor(lat / 10)  — so lat [0,10) -> V=7, lat [10,20) -> V=6

    Returns a list because coords near tile boundaries may need adjacent tiles.
    In practice most VE cities fall cleanly within one tile.
    """
    h = int((lon + 180.0) / _TILE_DEG)
    # lat_max = (8-V)*10 => V = 8 - ceil(lat/10) for lat at boundary
    # simpler: V = 7 - floor(lat // 10) for lat >= 0
    v = 7 - int(lat // _TILE_DEG)
    return [f"h{h:02d}v{v:02d}"]


def in_publication_window(now_utc: datetime) -> bool:
    """
    Return True only when inside the daily VNP46A2NRT publication window.

    VNP46A2NRT is published daily around 06:00 UTC; this guard avoids
    unnecessary downloads outside [06:00, 08:00) UTC.
    """
    return 6 <= now_utc.hour < 8


# ── download + read helpers ───────────────────────────────────────────────────

def _download_granule(link_url: str, session: requests.Session) -> Optional[str]:
    """
    Download a VNP46A2NRT HDF5 granule to a temporary file.

    Returns the tempfile path, or None on failure. Caller is responsible
    for deleting the tempfile (use a finally block).
    """
    token = os.environ.get("NASA_TOKEN", "")
    try:
        resp = session.get(
            link_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT_S,
            stream=True,
        )
        resp.raise_for_status()
        fd, path = tempfile.mkstemp(suffix=".h5")
        try:
            with os.fdopen(fd, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=1 << 20):
                    fh.write(chunk)
        except Exception:
            os.unlink(path)
            raise
        return path
    except Exception as exc:
        logger.warning("VIIRS granule download failed: %s", exc)
        return None


def _read_granule_radiance(path: str) -> Optional[tuple[np.ndarray, np.ndarray]]:
    """
    Read DNB_BRDF-Corrected_NTL and Mandatory_Quality_Flag arrays from HDF5.

    Lazy import of h5py so tests not exercising download stay import-light.
    Returns (ntl_array, qf_array) or None on error.

    Note: verify exact QF convention (drop 2=cloud/poor) against the
    VNP46A2NRT product documentation — QF values may differ across versions.
    """
    try:
        import h5py  # noqa: PLC0415
        with h5py.File(path, "r") as f:
            ntl = f[_DATASET_NTL][()]
            qf  = f[_DATASET_QF][()]
        return ntl, qf
    except Exception as exc:
        logger.warning("VIIRS HDF5 read failed: %s", exc)
        return None


# ── CMR + extraction ──────────────────────────────────────────────────────────

def _fetch_granule_list(
    date_str: str,
    session: requests.Session,
) -> list[dict]:
    """Query NASA CMR for VNP46A2NRT granules covering Venezuela."""
    token = os.environ.get("NASA_TOKEN", "")
    try:
        resp = session.get(
            CMR_URL,
            params={
                "short_name":   "VNP46A2NRT",
                "temporal":     f"{date_str}T00:00:00Z,{date_str}T23:59:59Z",
                "bounding_box": (
                    f"{VE_BBOX['west']},{VE_BBOX['south']},"
                    f"{VE_BBOX['east']},{VE_BBOX['north']}"
                ),
                "page_size": 10,
            },
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT_S,
        )
        resp.raise_for_status()
        return resp.json().get("feed", {}).get("entry", [])
    except Exception as exc:
        logger.warning("VIIRS CMR query failed: %s", exc)
        return []


def _extract_region_radiance(
    granules: list[dict],
    region: str,
) -> Optional[float]:
    """
    Download HDF5 granule(s) and extract mean radiance for region bbox.

    Maps region center (pipeline/regions.py REGIONS[region]) ± _REGION_HALF_DEG
    to tile pixel indices via which_tiles + lonlat_to_tile_pixel, selects
    matching granule by tile id, downloads, reads, masks, and returns mean.

    Returns float radiance or None when cloud-heavy (absent != zero, ADR-009).
    Existing signature (granules, region) -> float | None kept stable.
    """
    from pipeline.regions import REGIONS  # noqa: PLC0415

    region_meta = REGIONS.get(region)
    if region_meta is None:
        return None

    lat = region_meta["lat"]
    lon = region_meta["lon"]

    tile_ids = which_tiles(lat, lon)

    # Find a granule that covers any of the required tiles.
    # Granule title or URL typically contains the tile id e.g. "h11v07".
    matching_granule: Optional[dict] = None
    matched_tile: Optional[str] = None
    for tile_id in tile_ids:
        for g in granules:
            title = g.get("title", "") or ""
            links = g.get("links", []) or []
            link_urls = " ".join(lnk.get("href", "") for lnk in links)
            if tile_id in title or tile_id in link_urls:
                matching_granule = g
                matched_tile = tile_id
                break
        if matching_granule:
            break

    if matching_granule is None:
        logger.debug("VIIRS: no granule for region %s (tiles %s)", region, tile_ids)
        return None

    # Find download URL — prefer "data" rel links, fall back to first href.
    download_url: Optional[str] = None
    for lnk in matching_granule.get("links", []):
        if lnk.get("rel") in ("http://esipfed.org/ns/fedsearch/1.1/data#", "data"):
            download_url = lnk.get("href")
            break
    if not download_url and matching_granule.get("links"):
        download_url = matching_granule["links"][0].get("href")

    if not download_url:
        logger.warning("VIIRS: no download URL for region %s granule", region)
        return None

    # Derive tile H/V from matched_tile string e.g. "h11v07"
    try:
        tile_h = int(matched_tile[1:3])
        tile_v = int(matched_tile[4:6])
    except (TypeError, ValueError, IndexError):
        logger.warning("VIIRS: cannot parse tile id %s", matched_tile)
        return None

    # Build pixel window for region bbox
    lat_min = lat - _REGION_HALF_DEG
    lat_max = lat + _REGION_HALF_DEG
    lon_min = lon - _REGION_HALF_DEG
    lon_max = lon + _REGION_HALF_DEG

    corners = [
        (lat_min, lon_min),
        (lat_min, lon_max),
        (lat_max, lon_min),
        (lat_max, lon_max),
    ]
    pixel_coords = [
        lonlat_to_tile_pixel(c_lat, c_lon, tile_h, tile_v)
        for c_lat, c_lon in corners
    ]
    valid_pixels = [p for p in pixel_coords if p is not None]
    if not valid_pixels:
        logger.debug("VIIRS: region %s bbox outside tile %s", region, matched_tile)
        return None

    rows = [p[0] for p in valid_pixels]
    cols = [p[1] for p in valid_pixels]
    row_range = list(range(min(rows), max(rows) + 1))
    col_range = list(range(min(cols), max(cols) + 1))

    # Download and read granule
    import requests as _req  # noqa: PLC0415
    session = _req.Session()
    tmp_path: Optional[str] = None
    try:
        tmp_path = _download_granule(download_url, session)
        if tmp_path is None:
            return None
        arrays = _read_granule_radiance(tmp_path)
        if arrays is None:
            return None
        ntl, qf = arrays
        return mean_region_radiance(ntl, qf, row_range, col_range)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def fetch_latest_viirs(
    date_str: str | None = None,
    _session: requests.Session | None = None,
    _extract_fn=_extract_region_radiance,
    now: datetime | None = None,
) -> dict[str, dict]:
    """
    Return per-region radiance analysis keyed by region string.

    Each entry: {observed, baseline, ratio, status, score}.
    Region absent from result when granule missing or extract fails.

    Only downloads inside the daily publication window (06:00-08:00 UTC) —
    VNP46A2NRT is a daily product; HDF5 download is heavy and the granule
    is not refreshed outside this window (approved decision #7).
    """
    # Publication-window guard: skip download outside 06:00-08:00 UTC.
    if now is None:
        now = datetime.now(timezone.utc)
    if not in_publication_window(now):
        logger.info("VIIRS: outside publication window — skipping download")
        return {}

    if date_str is None:
        date_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    session  = _session or requests.Session()
    granules = _fetch_granule_list(date_str, session)

    if not granules:
        logger.warning("VIIRS: no granules for %s — satellite signal unavailable", date_str)
        return {}

    results: dict[str, dict] = {}
    for region, baseline in BASELINE_RADIANCE.items():
        observed = _extract_fn(granules, region)
        if observed is None:
            continue
        ratio = observed / baseline
        status = classify_ratio(ratio)
        results[region] = {
            "observed": round(observed, 2),
            "baseline": baseline,
            "ratio":    round(ratio, 3),
            "status":   status,
            "score":    _STATUS_TO_SCORE[status],
        }

    return results
