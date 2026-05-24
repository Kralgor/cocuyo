"""
Backfill real outage history from multiple sources.

Sources:
  1. IODA alerts        — per-state BGP/ping anomaly detection (primary)
  2. NASA GWM           — Guri dam water level (supply risk)
  3. NASA POWER         — temperature + rainfall per region (demand + Guri inflow)
  4. Cloudflare Radar   — country-level HTTP traffic (outage confirmation)

Usage:
    export CF_API_TOKEN="..."   # optional
    python pipeline/backfill_history.py [--days 365] [--gap-hours 2]

Outputs: app/public/history/{region}.json
"""

import argparse
import json
import logging
import math
import os
import time
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

from regions import REGIONS

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

IODA_BASE  = "https://api.ioda.inetintel.cc.gatech.edu/v2"
GWM_GURI   = "https://earth.gsfc.nasa.gov/gwm/timeseries/lake000432.10d.2.txt"
POWER_BASE = "https://power.larc.nasa.gov/api/temporal/daily/point"
CF_BASE    = "https://api.cloudflare.com/client/v4/radar/http/timeseries"
VET        = timezone(timedelta(hours=-4))

IODA_STATE_TO_REGIONS: dict[int, list[str]] = {
    4488: ["maracaibo"],
    4486: ["san_cristobal"],
    4485: ["merida"],
    4487: ["valera"],
    4491: ["barquisimeto"],
    4482: ["punto_fijo"],
    4490: ["valencia"],
    4497: ["maracay"],
    4499: ["caracas"],
    4503: ["los_teques", "guarenas_guatire"],
    4484: ["barinas"],
    4502: ["maturin"],
    4496: ["barcelona"],
    4505: ["cumana"],
    4504: ["porlamar"],
    4495: ["ciudad_guayana"],
}

REGION_TO_IODA: dict[str, int] = {
    k: code
    for code, keys in IODA_STATE_TO_REGIONS.items()
    for k in keys
}

# ── Data structures ───────────────────────────────────────────────────

@dataclass
class OutageWindow:
    start: datetime
    end: datetime
    datasource: str
    alert_count: int = 1
    confirmed: bool = False   # True if Cloudflare traffic also dipped

    @property
    def duration_h(self) -> float:
        return max((self.end - self.start).total_seconds() / 3600, 0.17)

    @property
    def start_vet(self) -> datetime:
        return self.start.astimezone(VET)


@dataclass
class DetectedPattern:
    detected: bool
    description: str
    frequency: str
    typical_days: list[int]
    typical_start_hour: float
    typical_duration_h: float
    confidence: float


@dataclass
class GuriContext:
    level_m: float
    trend: str             # "rising" | "falling" | "stable"
    percentile: float      # 0-100 vs all historical May readings
    supply_risk: float     # 0-1  (higher = more likely to cause rationing)
    last_updated: str      # YYYYMMDD


# ── 1. IODA ──────────────────────────────────────────────────────────

def fetch_ioda_alerts(from_ts: int, until_ts: int, limit: int = 5000) -> list[dict]:
    params = {
        "entityType": "region",
        "relatedTo": "country/VE",
        "from": from_ts,
        "until": until_ts,
        "limit": limit,
    }
    d0 = datetime.fromtimestamp(from_ts, tz=timezone.utc).strftime("%Y-%m-%d")
    d1 = datetime.fromtimestamp(until_ts, tz=timezone.utc).strftime("%Y-%m-%d")
    log.info(f"IODA {d0} → {d1}")
    for attempt in range(3):
        try:
            resp = requests.get(f"{IODA_BASE}/outages/alerts", params=params, timeout=90)
            resp.raise_for_status()
            alerts = resp.json().get("data", [])
            log.info(f"  → {len(alerts)} alerts")
            return alerts
        except requests.RequestException as e:
            log.warning(f"  attempt {attempt+1}: {e}")
            time.sleep(2 ** attempt)
    return []


def cluster_outages(all_alerts: list[dict], gap_s: int = 7200) -> dict[int, list[OutageWindow]]:
    """Group critical alerts per state into outage episodes."""
    by_entity: dict[int, list[dict]] = defaultdict(list)
    for a in all_alerts:
        try:
            code = int(a.get("entity", {}).get("code", ""))
        except (ValueError, TypeError):
            continue
        if a.get("level") == "critical":
            by_entity[code].append(a)

    result: dict[int, list[OutageWindow]] = {}
    for code, crits in by_entity.items():
        crits.sort(key=lambda a: a["time"])
        windows: list[OutageWindow] = []
        cs = ce = crits[0]["time"]
        count = 1
        ds = crits[0].get("datasource", "unknown")

        for c in crits[1:]:
            if c["time"] - ce > gap_s:
                windows.append(OutageWindow(
                    start=datetime.fromtimestamp(cs, tz=timezone.utc),
                    end=datetime.fromtimestamp(ce + 600, tz=timezone.utc),
                    datasource=ds, alert_count=count,
                ))
                cs = c["time"]
                count = 0
                ds = c.get("datasource", "unknown")
            ce = c["time"]
            count += 1

        windows.append(OutageWindow(
            start=datetime.fromtimestamp(cs, tz=timezone.utc),
            end=datetime.fromtimestamp(ce + 600, tz=timezone.utc),
            datasource=ds, alert_count=count,
        ))
        result[code] = windows
    return result


# ── 2. NASA GWM — Guri water level ───────────────────────────────────

def fetch_guri(all_windows: dict[int, list[OutageWindow]]) -> GuriContext:
    """Download Guri water level time series from NASA GWM."""
    try:
        resp = requests.get(GWM_GURI, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        log.warning(f"Guri fetch failed: {e}")
        return GuriContext(level_m=0, trend="unknown", percentile=50,
                          supply_risk=0.3, last_updated="unknown")

    records: list[tuple[str, float]] = []
    for line in resp.text.splitlines():
        parts = line.split()
        if len(parts) < 7:
            continue
        try:
            date_str = parts[2]
            if len(date_str) != 8 or date_str == "99999999":
                continue
            h = float(parts[5])
            if h > 900 or h < -50:
                continue
            records.append((date_str, h))
        except (ValueError, IndexError):
            continue

    if not records:
        return GuriContext(level_m=0, trend="unknown", percentile=50,
                          supply_risk=0.3, last_updated="unknown")

    # Current level (last valid reading)
    current_date, current_level = records[-1]

    # Trend: compare last 3 readings
    if len(records) >= 3:
        delta = records[-1][1] - records[-3][1]
        trend = "rising" if delta > 0.3 else "falling" if delta < -0.3 else "stable"
    else:
        trend = "stable"

    # Percentile vs same calendar month historically
    current_month = current_date[4:6]
    same_month = [h for d, h in records if d[4:6] == current_month and d < current_date]
    if same_month:
        below = sum(1 for h in same_month if h <= current_level)
        percentile = round(below / len(same_month) * 100, 1)
    else:
        percentile = 50.0

    # Supply risk: 0 above 14m, scales to 1 at -7m (2016 crisis low)
    supply_risk = round(max(0.0, min(1.0, (14 - current_level) / 21)), 3)

    log.info(f"Guri: {current_level:.2f}m  trend={trend}  "
             f"pct={percentile}  risk={supply_risk}  ({current_date})")

    return GuriContext(
        level_m=round(current_level, 2),
        trend=trend,
        percentile=percentile,
        supply_risk=supply_risk,
        last_updated=current_date,
    )


# ── 3. NASA POWER — temperature + rainfall per region ────────────────

def fetch_weather(lat: float, lon: float, days: int = 30) -> dict:
    """Fetch temp + precipitation for a city over the last N days."""
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).strftime("%Y%m%d")
    end   = (now - timedelta(days=3)).strftime("%Y%m%d")  # 3-day lag in POWER

    try:
        resp = requests.get(POWER_BASE, params={
            "parameters": "T2M,T2M_MAX,PRECTOTCORR,RH2M",
            "community": "RE",
            "longitude": lon,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "json",
        }, timeout=20)
        resp.raise_for_status()
        params = resp.json().get("properties", {}).get("parameter", {})

        def valid(vals: dict) -> list[float]:
            return [v for v in vals.values() if v > -900]

        t2m    = valid(params.get("T2M", {}))
        t2m_mx = valid(params.get("T2M_MAX", {}))
        prec   = valid(params.get("PRECTOTCORR", {}))
        rh2m   = valid(params.get("RH2M", {}))

        return {
            "avg_temp_c":    round(sum(t2m)    / len(t2m),    1) if t2m    else None,
            "max_temp_c":    round(max(t2m_mx),               1) if t2m_mx else None,
            "avg_rain_mm":   round(sum(prec)   / len(prec),   1) if prec   else None,
            "avg_humidity":  round(sum(rh2m)   / len(rh2m),   1) if rh2m   else None,
        }
    except Exception as e:
        log.warning(f"  POWER({lat},{lon}): {e}")
        return {"avg_temp_c": None, "max_temp_c": None,
                "avg_rain_mm": None, "avg_humidity": None}


def fetch_guri_rainfall(days: int = 30) -> float | None:
    """Rainfall at Guri watershed for the last N days (mm/day avg)."""
    try:
        now  = datetime.now(timezone.utc)
        resp = requests.get(POWER_BASE, params={
            "parameters": "PRECTOTCORR",
            "community": "RE",
            "longitude": -62.83,
            "latitude": 7.22,
            "start": (now - timedelta(days=days)).strftime("%Y%m%d"),
            "end":   (now - timedelta(days=3)).strftime("%Y%m%d"),
            "format": "json",
        }, timeout=20)
        resp.raise_for_status()
        vals = resp.json()["properties"]["parameter"]["PRECTOTCORR"]
        valid = [v for v in vals.values() if v > -900]
        return round(sum(valid) / len(valid), 2) if valid else None
    except Exception as e:
        log.warning(f"Guri rainfall: {e}")
        return None


# ── 4. Cloudflare — cross-correlate with IODA outages ────────────────

def fetch_cloudflare(token: str) -> list[tuple[datetime, float]]:
    try:
        resp = requests.get(CF_BASE, params={
            "location": "VE", "dateRange": "4w", "aggInterval": "1h",
        }, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        resp.raise_for_status()
        s = resp.json()["result"]["serie_0"]
        pts = list(zip(
            [datetime.fromisoformat(t.replace("Z", "+00:00")) for t in s["timestamps"]],
            [float(v) for v in s["values"]],
        ))
        log.info(f"Cloudflare: {len(pts)} hourly points")
        return pts
    except Exception as e:
        log.warning(f"Cloudflare: {e}")
        return []


def tag_confirmed(
    windows: list[OutageWindow],
    cf_data: list[tuple[datetime, float]],
    threshold: float = 0.75,
) -> tuple[list[OutageWindow], float]:
    """
    Mark outages as confirmed when Cloudflare traffic dips during them.
    Returns (tagged_windows, confirmed_pct).
    Only works well for large multi-state outages; single-state events
    may not show up in country-level traffic.
    """
    if not cf_data:
        return windows, 0.0

    # Build hour → value lookup
    cf_map = {ts.replace(minute=0, second=0, microsecond=0): val for ts, val in cf_data}
    baseline = sorted(v for _, v in cf_data)[len(cf_data) // 2]  # median

    confirmed = 0
    for w in windows:
        cur = w.start.replace(minute=0, second=0, microsecond=0)
        while cur <= w.end:
            val = cf_map.get(cur)
            if val is not None and val < threshold * baseline:
                w.confirmed = True
                break
            cur += timedelta(hours=1)
        if w.confirmed:
            confirmed += 1

    pct = round(confirmed / len(windows) * 100, 1) if windows else 0.0
    log.info(f"  Confirmed by Cloudflare: {confirmed}/{len(windows)} ({pct}%)")
    return windows, pct


# ── Pattern detection ────────────────────────────────────────────────

def detect_pattern(outages: list[OutageWindow]) -> DetectedPattern:
    if len(outages) < 5:
        return DetectedPattern(False, "", "", [], 0, 0, 0)

    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=90)
    recent = [o for o in outages if o.start >= cutoff]

    if len(recent) < 5:
        return DetectedPattern(False, "", "", [], 0, 0, 0)

    dow_counts: dict[int, int] = {i: 0 for i in range(7)}
    starts: list[float] = []
    durations: list[float] = []

    for o in recent:
        vet = o.start_vet
        dow_counts[vet.weekday()] += 1
        starts.append(vet.hour + vet.minute / 60)
        durations.append(o.duration_h)

    avg_count   = len(recent) / 7
    typical_days = [d for d, c in dow_counts.items() if c > avg_count * 0.7]
    avg_start   = sum(starts) / len(starts)
    avg_dur     = sum(durations) / len(durations)
    start_std   = (sum((s - avg_start) ** 2 for s in starts) / len(starts)) ** 0.5
    dur_std     = (sum((d - avg_dur)   ** 2 for d in durations) / len(durations)) ** 0.5
    confidence  = max(0.3, min(0.95, 1.0 - (start_std / 8 + dur_std / 6) / 2))

    weeks = max((now - cutoff).days / 7, 1)
    dpw   = len(recent) / weeks
    freq  = "diario" if dpw >= 5.5 else "interdiario" if dpw >= 3.5 else f"{round(dpw)}x/semana"

    day_names = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
    days_str  = ", ".join(day_names[d] for d in sorted(typical_days))
    desc = (f"{freq}, ~{avg_dur:.1f}h, "
            f"típicamente {int(avg_start)}:00–{int(avg_start + avg_dur)}:00 "
            f"({days_str})")

    return DetectedPattern(
        detected=True, description=desc, frequency=freq,
        typical_days=sorted(typical_days),
        typical_start_hour=round(avg_start, 1),
        typical_duration_h=round(avg_dur, 1),
        confidence=round(confidence, 2),
    )


# ── Forecast (pattern + Guri + temperature) ──────────────────────────

def generate_forecast(
    pattern: DetectedPattern,
    guri: GuriContext,
    avg_temp_c: float | None,
) -> list[dict]:
    """
    48 half-hour risk points for next 24h.
    Guri supply risk raises baseline; heat raises afternoon peaks.
    """
    now_hour = datetime.now(VET).hour + datetime.now(VET).minute / 60

    # Guri multiplier: low water → rationing more likely nationally
    guri_mult = 1.0 + guri.supply_risk * 0.8  # up to 1.8x at crisis level

    # Heat: every °C above 30 adds 0.5% baseline risk (AC load)
    heat_add = max(0, (avg_temp_c or 30) - 30) * 0.005

    points: list[dict] = []
    for i in range(48):
        hour = (now_hour + i * 0.5) % 24
        risk = 0.04 + heat_add

        if pattern.detected:
            center  = pattern.typical_start_hour + pattern.typical_duration_h / 2
            dist    = abs(hour - center)
            if dist > 12:
                dist = 24 - dist
            half_w  = pattern.typical_duration_h / 2 + 1
            if dist < half_w:
                risk += 0.5 * (1 - dist / half_w) * pattern.confidence

        # Demand curve: peak 11am-5pm, secondary 7-10pm
        if 11 <= hour <= 17:
            risk += 0.08 * math.sin((hour - 11) / 6 * math.pi)
        if 19 <= hour <= 22:
            risk += 0.04

        risk = max(0.02, min(0.95, risk * guri_mult))
        points.append({"half_hour": i, "hour": round(hour, 1), "risk": round(risk, 3)})

    return points


# ── Stats ────────────────────────────────────────────────────────────

def compute_stats(outages: list[OutageWindow], days: int) -> dict:
    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    recent = [o for o in outages if o.start >= cutoff]
    if not recent:
        return {"total_hours": 0, "count": 0, "avg_duration_h": 0, "longest_h": 0}
    total_h = sum(o.duration_h for o in recent)
    return {
        "total_hours":    round(total_h, 1),
        "count":          len(recent),
        "avg_duration_h": round(total_h / len(recent), 1),
        "longest_h":      round(max(o.duration_h for o in recent), 1),
    }


def classify_outage(w: OutageWindow) -> str:
    h, dur = w.start_vet.hour, w.duration_h
    if 1.5 <= dur <= 10.0 and 8 <= h <= 18:
        return "scheduled"
    if dur < 0.5:
        return "feeder"
    return "unplanned"


# ── Build JSON per region ─────────────────────────────────────────────

def build_region_json(
    region_key: str,
    outages: list[OutageWindow],
    guri: GuriContext,
    weather: dict,
    guri_rainfall_mm: float | None,
    cf_confirmed_pct: float,
) -> dict:
    meta    = REGIONS[region_key]
    pattern = detect_pattern(outages)
    forecast = generate_forecast(pattern, guri, weather.get("avg_temp_c"))

    now        = datetime.now(timezone.utc)
    now_vet    = now.astimezone(VET)
    cutoff_90  = now - timedelta(days=90)
    recent     = [o for o in outages if o.start >= cutoff_90]

    days_map: dict[str, list] = {}
    for o in recent:
        vet      = o.start_vet
        date_str = vet.strftime("%Y-%m-%d")
        days_map.setdefault(date_str, []).append({
            "start_hour": round(vet.hour + vet.minute / 60, 1),
            "duration_h": round(o.duration_h, 1),
            "type":        classify_outage(o),
            "confidence":  "confirmed" if o.confirmed else "detected",
        })

    days_list = []
    for offset in range(90, 0, -1):
        d = (now_vet - timedelta(days=offset)).strftime("%Y-%m-%d")
        days_list.append({"date": d, "outages": days_map.get(d, [])})

    return {
        "region":       region_key,
        "display_name": meta["display_name"],
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "days_included": 90,
        "days":         days_list,
        "stats_30d":    compute_stats(outages, 30),
        "stats_90d":    compute_stats(outages, 90),
        "pattern":      asdict(pattern),
        "forecast_48h": forecast,
        # ── enrichment fields ──
        "guri_m":            guri.level_m,
        "guri_trend":        guri.trend,
        "guri_percentile":   guri.percentile,
        "supply_risk":       guri.supply_risk,
        "guri_updated":      guri.last_updated,
        "guri_rainfall_mm":  guri_rainfall_mm,
        "avg_temp_c":        weather.get("avg_temp_c"),
        "max_temp_c":        weather.get("max_temp_c"),
        "avg_humidity":      weather.get("avg_humidity"),
        "cf_confirmed_pct":  cf_confirmed_pct,
    }


# ── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days",      type=int,   default=365)
    parser.add_argument("--gap-hours", type=float, default=2.0)
    args = parser.parse_args()

    output_dir = Path(__file__).parent.parent / "app" / "public" / "history"
    output_dir.mkdir(parents=True, exist_ok=True)

    cf_token  = (os.environ.get("CF_API_TOKEN") or "").strip()
    now       = datetime.now(timezone.utc)
    gap_s     = int(args.gap_hours * 3600)
    n_chunks  = math.ceil(args.days / 30)

    # ── 1. IODA ──
    all_alerts: list[dict] = []
    for i in range(n_chunks):
        chunk_end   = now - timedelta(days=i * 30)
        chunk_start = chunk_end - timedelta(days=30)
        all_alerts.extend(fetch_ioda_alerts(int(chunk_start.timestamp()),
                                            int(chunk_end.timestamp())))
        if i < n_chunks - 1:
            time.sleep(1)

    log.info(f"Total IODA alerts: {len(all_alerts)}")
    state_windows = cluster_outages(all_alerts, gap_s=gap_s)

    for code in sorted(state_windows):
        ws  = state_windows[code]
        lbl = (IODA_STATE_TO_REGIONS.get(code) or [f"code-{code}"])[0]
        log.info(f"  {lbl:20s} ({code}): {len(ws):4d} outages "
                 f"{sum(w.duration_h for w in ws):7.1f}h")

    # ── 2. Guri water level ──
    log.info("Fetching Guri water level...")
    guri = fetch_guri(state_windows)

    # ── 3. Guri watershed rainfall ──
    log.info("Fetching Guri watershed rainfall...")
    guri_rain = fetch_guri_rainfall(30)
    if guri_rain is not None:
        log.info(f"  Guri watershed: {guri_rain} mm/day avg (30d)")

    # ── 4. Cloudflare cross-correlation ──
    cf_data: list[tuple[datetime, float]] = []
    if cf_token:
        cf_data = fetch_cloudflare(cf_token)

    # Tag confirmed outages per state using Cloudflare
    state_cf_pct: dict[int, float] = {}
    for code, windows in state_windows.items():
        tagged, pct = tag_confirmed(windows, cf_data)
        state_windows[code] = tagged
        state_cf_pct[code]  = pct

    # ── 5. Weather per region + build JSON ──
    for region_key in REGIONS:
        ioda_code = REGION_TO_IODA.get(region_key)
        if ioda_code is None:
            log.warning(f"No IODA mapping for {region_key}")
            continue

        meta    = REGIONS[region_key]
        windows = state_windows.get(ioda_code, [])

        log.info(f"Weather for {region_key}...")
        weather = fetch_weather(meta["lat"], meta["lon"], days=30)

        data = build_region_json(
            region_key, windows, guri, weather,
            guri_rainfall_mm=guri_rain,
            cf_confirmed_pct=state_cf_pct.get(ioda_code, 0.0),
        )

        path = output_dir / f"{region_key}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

        s30 = data["stats_30d"]
        log.info(f"  → {region_key:22s}  {s30['count']:3d} outages  "
                 f"{s30['total_hours']:6.1f}h  "
                 f"temp={weather.get('avg_temp_c','?')}°C  "
                 f"supply_risk={guri.supply_risk}")

        time.sleep(0.3)  # be polite to NASA POWER

    log.info(f"Done. {len(REGIONS)} files → {output_dir}")


if __name__ == "__main__":
    main()
