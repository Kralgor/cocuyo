# Cocuyo
## Venezuela Power Outage Prediction System — Full Project Specification

**Name Origin:** Taino word *kukuyo* — the firefly (*Pyrophorus* beetle). A bioluminescent creature that makes its own light when everything around it is dark. The Taino captured cocuyos and released them inside their homes as natural lanterns. We are the light because they won't give us any.

**Domain:** cocuyo.app

**Document Version:** 1.0  
**Date:** May 15, 2026  
**Status:** Design / Pre-Development

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Competitive Landscape](#2-competitive-landscape)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Sources](#4-data-sources)
5. [Data Collectors](#5-data-collectors)
   - 5.1 Internet Connectivity (IODA)
   - 5.2 Satellite Nighttime Lights (VIIRS)
   - 5.3 Weather & Grid Stress (NASA POWER)
   - 5.4 Cloudflare Radar
   - 5.5 OONI (Network Interference)
   - 5.6 Unified Internet Monitoring
   - 5.7 Crowdsource Reports
6. [Scoring Engine](#6-scoring-engine)
7. [Outage Type Classification](#7-outage-type-classification)
8. [Duration Prediction & Restoration Tracking](#8-duration-prediction--restoration-tracking)
   - 8.1 Outage Type Classifier
   - 8.2 Duration Estimator (Survival Analysis)
   - 8.3 Restoration Tracker
9. [Zone Mapping System](#9-zone-mapping-system)
10. [Anti-Abuse & Validation Layer](#10-anti-abuse--validation-layer)
11. [Quorum System](#11-quorum-system)
12. [Cross-Validation With Passive Signals](#12-cross-validation-with-passive-signals)
13. [Device Trust Scores](#13-device-trust-scores)
14. [Auto-Calibration](#14-auto-calibration)
15. [Consequence Layers](#15-consequence-layers)
    - 15.1 Water Supply Prediction
    - 15.2 Food Safety Timer
    - 15.3 Medical Vulnerability Alerts
    - 15.4 Economic Impact Tracker
    - 15.5 Voltage Quality / Bajones Tracker
    - 15.6 Cross-Service Dashboard
    - 15.7 Community Resilience Network
16. [The Dataset as a Product](#16-the-dataset-as-a-product)
17. [Frontend Design](#17-frontend-design)
18. [Cron / Scheduler Setup](#18-cron--scheduler-setup)
19. [Database Schemas](#19-database-schemas)
20. [Scaling Analysis & Cost](#20-scaling-analysis--cost)
21. [Phased Roadmap](#21-phased-roadmap)
22. [Attack Scenarios & Mitigations](#22-attack-scenarios--mitigations)

---

## 1. Problem Statement

Venezuela has **no real-time electricity outage tracker**. Corpoelec, the state-owned utility, does not publish outage data, real-time grid status, or reliable rationing schedules. As of May 2026:

- Electricity consumption hit a **9-year high of 15,570 MW** on May 7, 2026, triggering emergency "stabilization maneuvers."
- The **Guri Dam** hydroelectric plant (source of ~70% of national generation) operates at **40% of optimal capacity**. El Niño has reduced Caroni basin rainfall by **35% below average**.
- **Thermoelectric plants** compensate at only **~15% capacity** due to lack of fuel and spare parts.
- **60% of substations** are in critical condition. Transmission lines are up to 70 years old with ~30% energy loss.
- Western states (Zulia, Tachira, Merida, Trujillo) experience **6-12 hours of daily outages**.
- On May 14, 2026, strong voltage fluctuations hit **at least 14 states simultaneously** with ongoing 5-hour daily rationing.

When a Venezuelan loses power today, they have **zero information** about:
- Whether it is rationing, a fault, or a national event
- How long it will last
- When it will end
- Whether it affects their water, internet, or cell service
- Whether their food and medication are still safe

This project fills that gap.

---

## 2. Competitive Landscape

| Tool | Description | Limitations |
|------|-------------|-------------|
| **GeoBlackout** | US/European outage tracker built on utility-reported data (PG&E, Con Edison) | US-only. Has a `/ve` page but it is a thin shell with no real data or community |
| **Apagon App** | iOS/Android one-tap outage reporter. Built for Puerto Rico after Hurricane Maria | Only 30 App Store ratings. No prediction, no passive monitoring, no classification |
| **haxaco/apagon** | Code for Venezuela hackathon project (2019). GeoJSON-based | 3 GitHub stars, 73 commits, abandoned |
| **VE Sin Filtro** | NGO monitoring CANTV internet connectivity by state | Publishes graphs on Twitter, not a consumer app. No outage prediction |
| **NetBlocks** | London-based internet observatory. Documented 2019 Venezuelan crisis | Proprietary tools, no public API, methodological opacity criticized by researchers |
| **poweroutage.live/ve** | Generic template site | Confusingly mixes Venezuela with Cuba data. Not useful |

**Conclusion:** The field is wide open. Nobody does prediction, classification (rationing vs fault), consequence tracking (water, food, medical), passive satellite/internet monitoring integrated with crowdsource, or zone learning from report clustering. The "bajoneitor" culture on social media demonstrates massive unmet demand.

---

## 3. Architecture Overview

### Three Layers

```
Layer 1 - DATA COLLECTION (scheduled jobs, every 5-30 min)
  Pulls from free external sources. No utility cooperation needed.
  Sources: VIIRS satellite, IODA, Cloudflare Radar, OONI, NASA POWER, crowdsource

Layer 2 - ANALYSIS & PREDICTION (runs after collection)
  Scores each region with an outage probability.
  Detects current outages. Classifies type. Estimates duration.

Layer 3 - STATIC FRONTEND (reads pre-computed JSON)
  Map-based UI. Users see current status and predictions.
  Can report outages (crowdsource). Reads JSON from CDN.
```

### Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Frontend | Next.js (static export) or Astro + Leaflet.js map | $0 |
| Hosting | Cloudflare Pages (unlimited bandwidth free) | $0 |
| Backend | Python scripts on cron (GitHub Actions / $5 VPS) | $0-5/mo |
| Database | Supabase free tier (500MB, 50k MAU) | $0 |
| JSON Storage | Cloudflare R2 (10GB free) | $0 |
| ML Model | Scikit-learn / XGBoost, retrained weekly | $0 |
| Satellite Data | NASA Earthdata (free) | $0 |
| Internet Monitoring | IODA + Cloudflare Radar + OONI (all free) | $0 |
| Domain | cocuyo.app | ~$12/yr |

### The Static Site Trick

The backend writes output as **JSON files** to a CDN (Cloudflare R2). The frontend fetches those JSON files. No server handles user requests.

```
READS (99.9% of traffic):
  User opens app
    -> fetches status.json from Cloudflare CDN
    -> Cloudflare serves from edge cache, 330+ locations worldwide
    -> Cost: $0 regardless of traffic

WRITES (0.1% of traffic):
  User taps "no power" or "power back"
    -> POST to Supabase (or Cloudflare Worker -> R2/D1)
    -> One small INSERT
    -> Cost: fractions of a cent
```

This separation is what makes the system serve millions of users for near-zero cost.

---

## 4. Data Sources

### 4.1 Satellite Nighttime Lights (VIIRS)

NASA's **VIIRS Day/Night Band (DNB)** aboard Suomi NPP and NOAA-20/21 satellites captures nighttime light emissions globally at ~500m resolution, daily. NASA's **Black Marble** product processes this into analysis-ready composites. The Blue/Yellow composite from NASA LANCE was specifically designed for power outage detection.

- **Product:** VNP46A2NRT (Near Real-Time daily)
- **Resolution:** ~500m per pixel
- **Latency:** ~12 hours
- **Cost:** Free (NASA Earthdata account required)
- **Use:** Compare nightly radiance against historical baseline. Drops in radiance = outage.

### 4.2 Internet Connectivity - IODA

Georgia Tech's **Internet Outage Detection and Analysis** monitors BGP routes, active probing, and darknet traffic. Tracks Venezuela outages historically.

- **API:** `https://api.ioda.inetintel.cc.gatech.edu/v2`
- **Resolution:** Per-ASN (per ISP)
- **Latency:** Minutes
- **Cost:** Free

### 4.3 Internet Traffic - Cloudflare Radar

Cloudflare handles ~20% of global web traffic. Their Radar API provides traffic anomaly detection, per-ASN timeseries at 15-minute resolution, and connection quality metrics.

- **API:** `https://api.cloudflare.com/client/v4/radar`
- **Rate Limit:** 10,000 requests/day (free)
- **Resolution:** Per-ASN, 15-minute buckets
- **Latency:** Minutes
- **Key Advantage:** Compare CANTV vs Digitel vs Inter vs Movistar. All drop = power outage. One drops = ISP issue.

### 4.4 Network Interference - OONI

The **Open Observatory of Network Interference** detects content blocking and censorship, not just connectivity loss. Used by Venezuela Inteligente and IPYS Venezuela to document CANTV social media blocks.

- **API:** `https://api.ooni.io/api/v1`
- **Use:** Distinguish "internet down because power is out" from "internet censored but power is fine"
- **Cost:** Free, fully open source

### 4.5 Weather & Grid Stress - NASA POWER

NASA POWER provides solar, meteorological, and climate data globally, free via API, specifically designed for energy applications.

- **API:** `https://power.larc.nasa.gov/api/temporal/daily/point`
- **Parameters:** Temperature, humidity, precipitation
- **Use:** High temps (>35C) + high humidity = high AC demand = grid stress. Predictive signal.

### 4.6 Corpoelec Announcements

Scrape Corpoelec's website, Electricity Ministry (MPPEE), and state media for keywords: "plan de ahorro," "administracion de cargas," "maniobras correctivas." Every major rationing wave has been preceded by an official statement.

### 4.7 Crowdsource Reports

User-submitted reports via the app. Users tap "no power" / "power back" / "unstable" with optional GPS location and symptom selection (explosion, flickering, storm).

### 4.8 Internet Society Pulse

Tracks Venezuelan shutdowns with structured start/end times and descriptions. Publicly accessible.

---

## 5. Data Collectors

### 5.1 Internet Connectivity Collector (IODA)

**File:** `collector_internet.py`  
**Frequency:** Every 5 minutes  
**Signal type:** Near real-time proxy for power outages

```python
# collector_internet.py
import requests
import json
from datetime import datetime, timezone

IODA_API = "https://api.ioda.inetintel.cc.gatech.edu/v2"

# Venezuelan ASNs (Autonomous System Numbers)
# CANTV (AS8048) is the state telecom, largest provider
ASNS = {
    "AS8048": "CANTV",
    "AS21826": "Inter",
    "AS264731": "Movistar VE",
    "AS22313": "Digitel",
}

def fetch_ioda_signals():
    """
    Pull BGP visibility and active probing scores from IODA.
    A drop in 'normalized score' below ~0.7 indicates significant
    connectivity loss, which correlates with power outages.
    """
    now = int(datetime.now(timezone.utc).timestamp())
    one_hour_ago = now - 3600

    results = {}
    for asn, name in ASNS.items():
        asn_number = asn.replace("AS", "")
        url = (
            f"{IODA_API}/signals/raw/asn/{asn_number}"
            f"?from={one_hour_ago}&until={now}"
        )
        try:
            resp = requests.get(url, timeout=15)
            data = resp.json()
            # Extract the latest normalized score (0 to 1)
            # Scores near 1.0 = normal, below 0.7 = trouble
            results[asn] = {
                "provider": name,
                "score": extract_latest_score(data),
                "timestamp": now,
            }
        except Exception as e:
            results[asn] = {"provider": name, "score": None, "error": str(e)}

    return results


def extract_latest_score(data):
    """Parse IODA response to get most recent normalized value."""
    try:
        series = data.get("data", [])
        if series and len(series) > 0:
            values = series[0].get("values", [])
            # Return last non-null value
            for v in reversed(values):
                if v is not None:
                    return round(v, 3)
    except (KeyError, IndexError):
        pass
    return None
```

### 5.2 Satellite Nighttime Lights Collector (VIIRS)

**File:** `collector_viirs.py`  
**Frequency:** Every ~12 hours  
**Signal type:** Independent confirmation, covers areas with zero users

```python
# collector_viirs.py
import requests
import numpy as np
from datetime import date, timedelta

# NASA Earthdata credentials (free account at urs.earthdata.nasa.gov)
NASA_TOKEN = "your_earthdata_bearer_token"

# Bounding box for Venezuela
VE_BBOX = {
    "west": -73.38,
    "south": 0.65,
    "north": 12.20,
    "east": -59.80,
}

# Pre-computed baseline radiance per region (from historical average)
# You build this once from a few months of Black Marble data
BASELINE_RADIANCE = {
    "caracas":    45.2,
    "maracaibo":  38.7,
    "valencia":   29.1,
    "barquisimeto": 22.4,
    "maracay":    20.8,
    "ciudad_guayana": 18.3,
    # ... more cities
}

def fetch_latest_viirs():
    """
    Pull latest VNP46A1 (daily nighttime lights) from LANCE NRT.
    Compare observed radiance vs baseline to compute an anomaly score.
    """
    yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")

    # Use NASA's CMR (Common Metadata Repository) to find granules
    cmr_url = "https://cmr.earthdata.nasa.gov/search/granules.json"
    params = {
        "short_name": "VNP46A2NRT",  # NRT daily product
        "temporal": f"{yesterday}T00:00:00Z,{yesterday}T23:59:59Z",
        "bounding_box": f"{VE_BBOX['west']},{VE_BBOX['south']},"
                        f"{VE_BBOX['east']},{VE_BBOX['north']}",
        "page_size": 10,
    }
    headers = {"Authorization": f"Bearer {NASA_TOKEN}"}

    resp = requests.get(cmr_url, params=params, headers=headers)
    granules = resp.json().get("feed", {}).get("entry", [])

    # Download and process each granule (HDF5 files)
    # Extract mean radiance per region, compare to baseline
    anomalies = {}
    for region, baseline in BASELINE_RADIANCE.items():
        observed = extract_region_radiance(granules, region)
        if observed is not None:
            ratio = observed / baseline
            anomalies[region] = {
                "observed": round(observed, 2),
                "baseline": baseline,
                "ratio": round(ratio, 3),
                # ratio < 0.5 means lights are less than half of normal
                "status": classify_ratio(ratio),
            }

    return anomalies


def classify_ratio(ratio):
    if ratio < 0.3:
        return "major_outage"
    elif ratio < 0.6:
        return "partial_outage"
    elif ratio < 0.85:
        return "degraded"
    else:
        return "normal"
```

### 5.3 Weather & Grid Stress Collector (NASA POWER)

**File:** `collector_weather.py`  
**Frequency:** Every 6 hours  
**Signal type:** Predictive (demand-side stress indicator)

```python
# collector_weather.py
import requests

# NASA POWER API (free, no key needed)
POWER_API = "https://power.larc.nasa.gov/api/temporal/daily/point"

# Key cities with coordinates
CITIES = {
    "caracas":       {"lat": 10.50, "lon": -66.92},
    "maracaibo":     {"lat": 10.63, "lon": -71.63},
    "valencia":      {"lat": 10.16, "lon": -68.01},
    "ciudad_guayana": {"lat": 8.37, "lon": -62.63},
}

def fetch_weather_stress():
    """
    Pull temperature and humidity forecasts.
    High temps (>35C) + high humidity = high AC demand = grid stress.
    """
    results = {}
    for city, coords in CITIES.items():
        params = {
            "parameters": "T2M,T2M_MAX,RH2M,PRECTOTCORR",
            "community": "RE",  # Renewable Energy community
            "longitude": coords["lon"],
            "latitude": coords["lat"],
            "start": "20260510",
            "end": "20260515",
            "format": "JSON",
        }
        resp = requests.get(POWER_API, params=params, timeout=30)
        data = resp.json()
        props = data.get("properties", {}).get("parameter", {})

        # Get the latest day's values
        max_temp = list(props.get("T2M_MAX", {}).values())[-1]
        humidity = list(props.get("RH2M", {}).values())[-1]
        precip = list(props.get("PRECTOTCORR", {}).values())[-1]

        # Simple heat stress index
        heat_stress = 0
        if max_temp > 33:
            heat_stress += 1
        if max_temp > 36:
            heat_stress += 1
        if humidity > 70:
            heat_stress += 1

        results[city] = {
            "max_temp_c": max_temp,
            "humidity_pct": humidity,
            "precipitation_mm": precip,
            "heat_stress_score": heat_stress,  # 0-3
        }

    return results
```

### 5.4 Cloudflare Radar Collector

**File:** `collector_cloudflare.py`  
**Frequency:** Every 10 minutes  
**Signal type:** Per-ISP traffic anomaly detection

```python
# collector_cloudflare.py
import requests
from datetime import datetime, timezone

CF_API = "https://api.cloudflare.com/client/v4/radar"
CF_TOKEN = "your_free_api_token"  # from dash.cloudflare.com

HEADERS = {"Authorization": f"Bearer {CF_TOKEN}"}

# Venezuelan ASNs
VE_ASNS = {
    "8048":   "CANTV",
    "21826":  "Inter",
    "264731": "Movistar VE",
    "22313":  "Digitel",
}


def fetch_traffic_anomalies():
    """
    Pull traffic anomaly events for Venezuela.
    Cloudflare flags these automatically when traffic
    deviates significantly from the baseline.
    """
    resp = requests.get(
        f"{CF_API}/traffic_anomalies",
        params={
            "location": "VE",
            "dateRange": "1d",
            "limit": 50,
        },
        headers=HEADERS,
        timeout=15,
    )
    data = resp.json()
    anomalies = data.get("result", {}).get("trafficAnomalies", [])

    return [
        {
            "type": a.get("type"),            # e.g., "OUTAGE"
            "asn": a.get("asnDetails", {}).get("asn"),
            "asn_name": a.get("asnDetails", {}).get("name"),
            "start": a.get("startDate"),
            "end": a.get("endDate"),
            "location": a.get("locationDetails", {}).get("code"),
            "visible_in_data_sources": a.get("visibleInDataSources", []),
        }
        for a in anomalies
    ]


def fetch_traffic_timeseries_by_asn(asn: str, date_range: str = "1d"):
    """
    Get normalized HTTP traffic timeseries for a specific ISP.
    A sudden drop in the timeseries = that ISP's users went offline.

    By comparing CANTV vs Digitel vs Inter, you can tell if it is
    a national grid issue (all drop) or an ISP issue (one drops).
    """
    resp = requests.get(
        f"{CF_API}/http/timeseries",
        params={
            "asn": asn,
            "dateRange": date_range,
            "aggInterval": "15m",  # 15-minute buckets
        },
        headers=HEADERS,
        timeout=15,
    )
    data = resp.json()
    series = data.get("result", {}).get("httpRequests", {})
    timestamps = series.get("timestamps", [])
    values = series.get("values", [])

    return {
        "asn": asn,
        "provider": VE_ASNS.get(asn, "Unknown"),
        "timestamps": timestamps,
        "values": values,
    }


def fetch_connection_quality():
    """
    Get bandwidth, latency, and DNS response times for Venezuela.
    Degraded quality often precedes or accompanies outages.
    """
    resp = requests.get(
        f"{CF_API}/quality/iqi/summary",
        params={
            "location": "VE",
            "dateRange": "1d",
        },
        headers=HEADERS,
        timeout=15,
    )
    return resp.json().get("result", {})


def detect_outage_from_timeseries(timeseries: dict) -> dict:
    """
    Analyze a traffic timeseries to detect drops.
    Compare each 15-min bucket to the rolling average.
    A drop below 40% of the average = likely outage.
    """
    values = timeseries.get("values", [])
    timestamps = timeseries.get("timestamps", [])

    if len(values) < 8:
        return {"detected": False, "reason": "insufficient_data"}

    # Use the first 75% as baseline, check the last 25%
    baseline_end = int(len(values) * 0.75)
    baseline_values = [v for v in values[:baseline_end] if v is not None]

    if not baseline_values:
        return {"detected": False, "reason": "no_baseline"}

    baseline_avg = sum(baseline_values) / len(baseline_values)

    if baseline_avg == 0:
        return {"detected": False, "reason": "zero_baseline"}

    # Check recent values for drops
    recent_values = values[baseline_end:]
    recent_timestamps = timestamps[baseline_end:]

    drops = []
    for i, val in enumerate(recent_values):
        if val is not None and val < baseline_avg * 0.4:
            drops.append({
                "timestamp": recent_timestamps[i],
                "value": val,
                "ratio": round(val / baseline_avg, 3),
            })

    if drops:
        return {
            "detected": True,
            "provider": timeseries.get("provider"),
            "drop_count": len(drops),
            "worst_ratio": min(d["ratio"] for d in drops),
            "first_drop_at": drops[0]["timestamp"],
            "drops": drops,
        }

    return {"detected": False}
```

### 5.5 OONI Collector (Network Interference)

**File:** `collector_ooni.py`  
**Frequency:** Every 30 minutes  
**Signal type:** Distinguishes censorship from connectivity loss

```python
# collector_ooni.py
import requests

OONI_API = "https://api.ooni.io/api/v1"


def fetch_recent_measurements_ve():
    """
    Get recent network measurements from OONI probes in Venezuela.
    Looks for anomalies (blocking) and failures (connectivity loss).
    """
    resp = requests.get(
        f"{OONI_API}/measurements",
        params={
            "probe_cc": "VE",
            "since": "2026-05-14",
            "until": "2026-05-16",
            "limit": 100,
            "order_by": "measurement_start_time",
            "order": "desc",
        },
        timeout=15,
    )
    data = resp.json()
    results = data.get("results", [])

    anomalies = []
    failures = []

    for m in results:
        if m.get("anomaly"):
            anomalies.append({
                "test_name": m.get("test_name"),
                "input": m.get("input"),
                "probe_asn": m.get("probe_asn"),
                "measurement_start": m.get("measurement_start_time"),
            })
        if m.get("failure"):
            failures.append({
                "test_name": m.get("test_name"),
                "input": m.get("input"),
                "probe_asn": m.get("probe_asn"),
                "measurement_start": m.get("measurement_start_time"),
            })

    return {
        "total_measurements": len(results),
        "anomalies": anomalies,
        "failures": failures,
        "anomaly_rate": (
            len(anomalies) / len(results) if results else 0
        ),
    }
```

### 5.6 Unified Internet Monitoring Collector

**File:** `collector_internet_unified.py`  
**Purpose:** Combines all four internet sources and classifies the situation

```python
# collector_internet_unified.py

from datetime import datetime, timezone


def collect_all_internet_signals() -> dict:
    """
    Pull from all four internet monitoring sources.
    Each source has different strengths:

    - IODA:       BGP routing level. Catches total disconnections.
    - Cloudflare: HTTP traffic level. Catches partial degradation.
    - OONI:       Application level. Catches censorship vs outage.
    - ISOC Pulse: Curated events. Catches government-ordered blocks.

    By combining them, we can classify:
    1. Power outage (all ISPs drop on IODA + Cloudflare)
    2. ISP failure (one ISP drops, others stable)
    3. Government censorship (OONI anomalies, traffic stable)
    4. Transmission fault (regional drop pattern)
    """

    ioda = fetch_ioda_signals()          # from collector_internet.py
    cloudflare = {
        "anomalies": fetch_traffic_anomalies(),
        "per_asn": {},
    }

    for asn in VE_ASNS:
        ts = fetch_traffic_timeseries_by_asn(asn, "1d")
        cloudflare["per_asn"][asn] = detect_outage_from_timeseries(ts)

    ooni = fetch_recent_measurements_ve()

    # Classify the situation
    classification = classify_internet_situation(
        ioda, cloudflare, ooni
    )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ioda": ioda,
        "cloudflare": cloudflare,
        "ooni": ooni,
        "classification": classification,
    }


def classify_internet_situation(ioda, cloudflare, ooni) -> dict:
    """
    Cross-reference all sources to determine what is happening.
    """

    # Count how many ISPs show drops on Cloudflare
    isps_dropping = sum(
        1 for asn, result in cloudflare["per_asn"].items()
        if result.get("detected")
    )
    total_isps = len(cloudflare["per_asn"])

    # Check IODA for BGP-level drops
    ioda_dropping = sum(
        1 for asn, data in ioda.items()
        if data.get("score") is not None and data["score"] < 0.7
    )

    # Check OONI for censorship patterns
    ooni_anomaly_rate = ooni.get("anomaly_rate", 0)

    # CASE 1: All ISPs dropping on both IODA and Cloudflare
    #         = Almost certainly a power outage
    if isps_dropping >= total_isps * 0.75 and ioda_dropping >= 2:
        return {
            "situation": "power_outage",
            "confidence": "high",
            "detail": (
                f"{isps_dropping}/{total_isps} ISPs show traffic drops. "
                f"BGP routing disrupted for {ioda_dropping} ASNs. "
                f"Cross-ISP failure indicates infrastructure (power) cause."
            ),
        }

    # CASE 2: One ISP dropping, others stable
    #         = ISP-specific problem, not power
    if isps_dropping == 1 and ioda_dropping <= 1:
        dropping_asn = [
            asn for asn, r in cloudflare["per_asn"].items()
            if r.get("detected")
        ]
        return {
            "situation": "isp_failure",
            "confidence": "medium",
            "affected_isp": VE_ASNS.get(
                dropping_asn[0], "Unknown"
            ) if dropping_asn else "Unknown",
            "detail": (
                f"Only one ISP affected. Other providers stable. "
                f"Likely ISP equipment or routing issue, not power."
            ),
        }

    # CASE 3: OONI shows high anomaly rate but traffic is stable
    #         = Censorship / blocking, not outage
    if ooni_anomaly_rate > 0.3 and isps_dropping == 0:
        return {
            "situation": "censorship",
            "confidence": "medium",
            "detail": (
                f"OONI anomaly rate at {ooni_anomaly_rate:.0%}. "
                f"Traffic volumes normal. Likely content blocking, "
                f"not connectivity loss."
            ),
        }

    # CASE 4: Cloudflare shows traffic anomalies flagged as outage
    cf_outage_anomalies = [
        a for a in cloudflare.get("anomalies", [])
        if a.get("type") == "OUTAGE"
    ]
    if cf_outage_anomalies:
        return {
            "situation": "confirmed_disruption",
            "confidence": "high",
            "detail": (
                f"Cloudflare flagged {len(cf_outage_anomalies)} "
                f"outage anomalies for Venezuela in the last 24h."
            ),
            "anomalies": cf_outage_anomalies,
        }

    # CASE 5: Everything looks normal
    return {
        "situation": "normal",
        "confidence": "high",
        "detail": "All sources show normal connectivity.",
    }
```

### Internet Monitoring Comparison

| Capability | NetBlocks | Your Stack (IODA + Cloudflare + OONI) |
|------------|-----------|---------------------------------------|
| Detects national outages | Yes | Yes |
| Per-ISP breakdown | Sometimes in tweets | Yes, structured, per 15-min bucket |
| Distinguishes power vs censorship | Manually in reports | Automatically via OONI cross-ref |
| Historical API access | No | Yes (Cloudflare 1yr+, OONI keeps everything) |
| Real-time structured data | No public API | Yes, all sources have APIs |
| Cost | N/A (no access) | $0 |
| Latency | Hours (blog post) | Minutes (API polling) |

### 5.7 Crowdsource Reports

See [Section 19: Database Schemas](#19-database-schemas) for the Supabase table design, and [Section 10: Anti-Abuse & Validation Layer](#10-anti-abuse--validation-layer) for report validation.

---

## 6. Scoring Engine

**File:** `scorer.py`  
**Purpose:** Combines all signals into a single status per region

```python
# scorer.py
import json
from datetime import datetime, timezone

# Weights for each signal (tune these over time)
WEIGHTS = {
    "internet":     0.35,  # fastest signal
    "crowdsource":  0.30,  # ground truth from users
    "satellite":    0.20,  # most reliable but delayed
    "weather":      0.15,  # predictive, not confirmatory
}

def compute_region_score(region, internet, satellite, weather, crowd_reports):
    """
    Returns a dict with:
      - current_score: 0 (normal) to 1 (definite outage)
      - prediction_score: 0 to 1 for next 6 hours
      - status: 'normal' | 'at_risk' | 'likely_outage' | 'confirmed_outage'
    """

    # Internet signal (inverted: low connectivity = high outage score)
    inet_score = 0
    if internet and internet.get("score") is not None:
        inet_score = max(0, 1.0 - internet["score"])

    # Satellite signal
    sat_score = 0
    sat_status = satellite.get("status", "normal") if satellite else "normal"
    sat_map = {"normal": 0, "degraded": 0.4, "partial_outage": 0.7, "major_outage": 1.0}
    sat_score = sat_map.get(sat_status, 0)

    # Crowdsource signal
    crowd_score = 0
    if crowd_reports:
        recent = [r for r in crowd_reports if r["age_minutes"] < 30]
        no_power = [r for r in recent if r["status"] == "no_power"]
        if len(recent) > 0:
            crowd_score = len(no_power) / max(len(recent), 1)
            # Boost if many reports in short time (like DownDetector spike)
            if len(no_power) >= 10:
                crowd_score = min(crowd_score * 1.3, 1.0)

    # Weather / prediction signal
    weather_score = 0
    if weather:
        weather_score = weather.get("heat_stress_score", 0) / 3.0

    # Current outage score (weighted blend)
    current = (
        WEIGHTS["internet"]    * inet_score
        + WEIGHTS["crowdsource"] * crowd_score
        + WEIGHTS["satellite"]   * sat_score
        + WEIGHTS["weather"]     * weather_score
    )
    current = round(min(current, 1.0), 3)

    # Prediction score for next 6 hours
    # Heavier weight on weather and historical patterns
    # For v1, simple heuristic; replace with ML model later
    prediction = round(
        0.20 * inet_score
        + 0.15 * crowd_score
        + 0.15 * sat_score
        + 0.50 * weather_score,
        3
    )

    # Classify
    if current >= 0.7:
        status = "confirmed_outage"
    elif current >= 0.45:
        status = "likely_outage"
    elif current >= 0.25:
        status = "at_risk"
    else:
        status = "normal"

    return {
        "region": region,
        "current_score": current,
        "prediction_score": prediction,
        "status": status,
        "signals": {
            "internet": round(inet_score, 3),
            "satellite": round(sat_score, 3),
            "crowdsource": round(crowd_score, 3),
            "weather": round(weather_score, 3),
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
```

---

## 7. Outage Type Classification

**File:** `outage_type_classifier.py`  
**Purpose:** Classifies detected outages into one of six types based on multi-signal fingerprints

### Outage Type Fingerprints

| Signal | Rationing | Feeder Fault | Substation Fault | Transmission Fault | National Blackout | Weather |
|--------|-----------|--------------|------------------|--------------------|-------------------|---------|
| Zones affected | 1-3 | 1 | 3-10 | All in region | All everywhere | 1-5 |
| Regions affected | 1 | 1 | 1 | 2-5 | 5+ | 1 |
| Matches schedule | Yes | No | No | No | No | No |
| Repeats regularly | Yes | No | Rare | Rare | Very rare | Seasonal |
| Onset | Gradual | Sudden | Sudden | Sudden | Instant | Variable |
| Duration | 2-6h | 30min-24h | 2-12h | 1-8h | 4-20h | 1-48h |
| Precursor | None | Fluctuations | Fluctuations | None | Freq. drop | Storm |
| User reports | "Again..." | "Explosion!" | "Whole area dark" | "Multiple states" | "All of VZ" | "Storm damage" |
| Internet drop | Gradual, local | Small, local | Medium, local | Large, regional | Massive, national | Small, local |
| Satellite | Dark patch | Tiny dark spot | Medium dark area | Regional dark | Country dark | Small dark |

### Classifier Code

```python
# outage_type_classifier.py

from datetime import datetime
from dataclasses import dataclass


@dataclass
class OutageSignature:
    """All the signals available at detection time."""
    # Geographic scope
    regions_affected: list         # which regions/cities
    zones_affected: list           # which learned zones within a city
    total_zones_in_region: int     # how many zones exist in this region

    # Temporal
    started_at: datetime
    day_of_week: int               # 0=Monday
    matches_known_schedule: bool   # does this match a PAC block time?
    time_since_last_outage_hours: float

    # Speed of onset
    reports_first_5min: int        # how fast did reports come in?
    reports_first_15min: int

    # Internet connectivity
    inet_drop_pct: float           # 0-100, how much connectivity dropped
    inet_drop_speed: str           # "instant" | "gradual" | "none"

    # Crowd report content
    reports_mention_explosion: int
    reports_mention_transformer: int
    reports_mention_smoke_fire: int
    reports_mention_fluctuation: int  # "bajones" before going out

    # Weather at time of outage
    active_storm: bool
    wind_speed_kmh: float
    lightning_nearby: bool

    # Historical pattern
    similar_outage_count_90days: int  # how many times this zone went dark


def classify_outage_type(sig: OutageSignature) -> dict:
    """
    Classify an outage into one of these types:

    1. RATIONING (administracion de cargas / PAC)
       - Scheduled load shedding by Corpoelec
       - Predictable, follows a pattern

    2. FEEDER_FAULT (local infrastructure failure)
       - A transformer blew, a line went down
       - Affects one zone/circuit only

    3. SUBSTATION_FAULT (regional infrastructure failure)
       - A substation failed
       - Affects multiple adjacent zones

    4. TRANSMISSION_FAULT (multi-region failure)
       - A high-voltage transmission line went down
       - Affects multiple cities/states simultaneously

    5. NATIONAL_BLACKOUT (system collapse)
       - Generation failure or cascading grid collapse
       - Affects 50%+ of the country

    6. WEATHER_DAMAGE (storm-related)
       - Storm knocked out local infrastructure
       - Correlated with active severe weather
    """

    scores = {
        "rationing": 0.0,
        "feeder_fault": 0.0,
        "substation_fault": 0.0,
        "transmission_fault": 0.0,
        "national_blackout": 0.0,
        "weather_damage": 0.0,
    }

    # === GEOGRAPHIC SCOPE ===

    pct_zones_affected = (
        len(sig.zones_affected) / max(sig.total_zones_in_region, 1)
    )

    if len(sig.regions_affected) >= 5:
        scores["national_blackout"] += 0.4
    elif len(sig.regions_affected) >= 2:
        scores["transmission_fault"] += 0.3

    if len(sig.zones_affected) == 1:
        # Single zone = almost certainly local
        scores["rationing"] += 0.2
        scores["feeder_fault"] += 0.2
    elif 2 <= len(sig.zones_affected) <= 5:
        scores["substation_fault"] += 0.2
        scores["rationing"] += 0.1  # PAC can hit a few zones at once
    elif pct_zones_affected > 0.5:
        scores["substation_fault"] += 0.3

    # === TEMPORAL PATTERN ===

    if sig.matches_known_schedule:
        scores["rationing"] += 0.35
    else:
        # Does NOT match schedule = less likely to be rationing
        scores["feeder_fault"] += 0.1
        scores["substation_fault"] += 0.1

    # Rationing tends to happen on weekdays during specific hours
    if sig.day_of_week < 5 and 10 <= sig.started_at.hour <= 21:
        scores["rationing"] += 0.1

    # Regular interval since last outage (e.g., ~24h or ~48h)
    if sig.time_since_last_outage_hours > 0:
        interval = sig.time_since_last_outage_hours
        # Check if it is close to 24, 48, or 72 hours (periodic)
        for period in [24, 48, 72]:
            if abs(interval - period) < 6:
                scores["rationing"] += 0.15
                break

    # High recurrence in last 90 days = likely rationing zone
    if sig.similar_outage_count_90days > 20:
        scores["rationing"] += 0.15
    elif sig.similar_outage_count_90days < 3:
        # Rare event in this zone = probably not rationing
        scores["feeder_fault"] += 0.15
        scores["weather_damage"] += 0.1

    # === ONSET SPEED ===

    # Rationing: reports trickle in as people notice over 10-15 min
    # Fault: reports spike immediately because it is sudden
    if sig.reports_first_5min > 20:
        # Sudden spike = fault, not gradual rationing
        scores["feeder_fault"] += 0.1
        scores["substation_fault"] += 0.1
        scores["national_blackout"] += 0.1
    elif sig.reports_first_5min < 5 and sig.reports_first_15min > 15:
        # Slow ramp = rationing (gradual awareness)
        scores["rationing"] += 0.1

    # === INTERNET DROP PATTERN ===

    if sig.inet_drop_speed == "instant" and sig.inet_drop_pct > 80:
        # Instant deep drop = infrastructure failure
        scores["national_blackout"] += 0.2
        scores["transmission_fault"] += 0.15
    elif sig.inet_drop_speed == "gradual":
        # Gradual = rolling rationing across zones
        scores["rationing"] += 0.1

    # === USER-REPORTED SYMPTOMS ===

    if sig.reports_mention_explosion > 0 or sig.reports_mention_smoke_fire > 0:
        scores["feeder_fault"] += 0.25
        scores["weather_damage"] += 0.1

    if sig.reports_mention_transformer > 2:
        scores["feeder_fault"] += 0.2

    if sig.reports_mention_fluctuation > 5:
        # "Bajones" (voltage fluctuations) before total loss
        # = grid struggling, could be rationing or overload fault
        scores["substation_fault"] += 0.15
        scores["rationing"] += 0.05

    # === WEATHER ===

    if sig.active_storm:
        scores["weather_damage"] += 0.3
    if sig.lightning_nearby:
        scores["weather_damage"] += 0.15
    if sig.wind_speed_kmh > 60:
        scores["weather_damage"] += 0.2

    # If no storm activity, reduce weather score
    if not sig.active_storm and not sig.lightning_nearby:
        scores["weather_damage"] *= 0.2

    # === DETERMINE WINNER ===

    # Normalize
    total = sum(scores.values())
    if total > 0:
        scores = {k: round(v / total, 3) for k, v in scores.items()}

    best_type = max(scores, key=scores.get)
    confidence = scores[best_type]

    return {
        "type": best_type,
        "confidence": confidence,
        "all_scores": scores,
        "explanation": build_explanation(best_type, sig),
    }


def build_explanation(outage_type: str, sig: OutageSignature) -> str:
    explanations = {
        "rationing": (
            f"Matches scheduled rationing pattern. "
            f"{sig.similar_outage_count_90days} similar outages in this "
            f"zone in the last 90 days. "
            f"{'Matches known PAC schedule.' if sig.matches_known_schedule else ''}"
        ),
        "feeder_fault": (
            f"Localized to a single zone. "
            f"{'Users report explosion/smoke. ' if sig.reports_mention_explosion or sig.reports_mention_smoke_fire else ''}"
            f"Does not match typical rationing schedule."
        ),
        "substation_fault": (
            f"{len(sig.zones_affected)} adjacent zones affected simultaneously. "
            f"Likely substation or major distribution equipment failure."
        ),
        "transmission_fault": (
            f"{len(sig.regions_affected)} regions affected simultaneously. "
            f"Consistent with high-voltage transmission line failure."
        ),
        "national_blackout": (
            f"{len(sig.regions_affected)} regions affected. "
            f"Internet connectivity dropped {sig.inet_drop_pct}% instantly. "
            f"Possible generation failure or cascading grid collapse."
        ),
        "weather_damage": (
            f"Active storm in area with {sig.wind_speed_kmh} km/h winds. "
            f"{'Lightning detected nearby. ' if sig.lightning_nearby else ''}"
            f"Outage likely caused by weather damage to local infrastructure."
        ),
    }
    return explanations.get(outage_type, "Unable to determine cause.")
```

---

## 8. Duration Prediction & Restoration Tracking

### Why Duration Is Predictable

Outage durations in Venezuela cluster into distinct categories:

- **Rationing cuts:** Follow blocks. Tachira: 3-4 blocks/day totaling 10-12h. Zulia: shifted from 3h to 6h daily after March 2026 energy plan. Lara: 2-5h after 2pm.
- **Transmission faults:** March 20, 2026 event hit Zulia/Tachira/Merida/Trujillo at 2:49am. Maracaibo recovered in ~2h, Trujillo in ~4h. Closer to Guri = faster recovery.
- **National blackouts:** August 2024 event: most of country dark for 12h, some areas 20h.
- **Key insight:** If you know the TYPE of outage and the REGION, you have a strong prior on duration.

### 8.1 Outage Type Classifier (for duration estimation)

**File:** `outage_classifier.py`

```python
# outage_classifier.py

from dataclasses import dataclass
from datetime import datetime

@dataclass
class OutageEvent:
    region: str
    started_at: datetime
    # Signals at detection time
    inet_drop_national: float    # 0-1, how much of the country lost connectivity
    inet_drop_regional: float    # 0-1, how much of this region lost connectivity
    adjacent_regions_affected: list  # which neighboring regions also went dark
    crowd_reports_count: int
    time_since_last_outage_hours: float
    last_outage_duration_min: float


def classify_outage(event: OutageEvent) -> dict:
    """
    Classify an outage into a type based on real-time signals.
    Returns type and initial duration estimate.
    """

    # NATIONAL BLACKOUT: internet drops across 70%+ of the country
    if event.inet_drop_national > 0.70:
        return {
            "type": "national_blackout",
            "confidence": 0.9,
            "estimated_duration_hours": {
                "min": 4,
                "median": 10,
                "max": 20,
            },
            "explanation": (
                "Major national event detected. "
                "Multiple regions affected simultaneously."
            ),
        }

    # TRANSMISSION FAULT: multiple adjacent western states drop together
    western_states = {"zulia", "tachira", "merida", "trujillo", "barinas"}
    affected_western = set(event.adjacent_regions_affected) & western_states
    if len(affected_western) >= 3:
        return {
            "type": "transmission_fault",
            "confidence": 0.8,
            "estimated_duration_hours": {
                "min": 1.5,
                "median": 3,
                "max": 8,
            },
            "explanation": (
                "Likely transmission line failure. "
                "Multiple western states affected together."
            ),
        }

    # SCHEDULED RATIONING: fits a known pattern for this region
    # Check if this looks like the recurring pattern
    pattern = check_rationing_pattern(event)
    if pattern["is_rationing"]:
        return {
            "type": "rationing",
            "confidence": pattern["confidence"],
            "estimated_duration_hours": {
                "min": pattern["typical_duration_min"] / 60,
                "median": pattern["typical_duration_median"] / 60,
                "max": pattern["typical_duration_max"] / 60,
            },
            "explanation": (
                f"Matches rationing pattern for {event.region}. "
                f"Similar cuts have lasted "
                f"{pattern['typical_duration_median']} min recently."
            ),
        }

    # UNKNOWN / EQUIPMENT FAILURE: single region, doesn't match pattern
    return {
        "type": "unknown",
        "confidence": 0.5,
        "estimated_duration_hours": {
            "min": 0.5,
            "median": 3,
            "max": 12,
        },
        "explanation": "Outage detected but cause unclear. Monitoring.",
    }


def check_rationing_pattern(event: OutageEvent) -> dict:
    """
    Compare this outage against the historical pattern for this region.
    Uses time-of-day, day-of-week, and interval since last outage.
    """

    # These thresholds come from crowdsourced data over time.
    # Hardcoded here for illustration; in production, learned from DB.
    REGION_PATTERNS = {
        "zulia": {
            # Zulia: every other day, 2-6 hours, usually afternoon
            "interval_hours_typical": 48,  # interdiario
            "interval_tolerance": 12,
            "duration_min": 120,
            "duration_median": 300,
            "duration_max": 420,
            "peak_start_hour": 13,  # usually after 1pm
        },
        "tachira": {
            # Tachira: daily, 10-12 hours total in 3-4 blocks
            "interval_hours_typical": 6,  # multiple blocks per day
            "interval_tolerance": 4,
            "duration_min": 120,
            "duration_median": 240,  # per block
            "duration_max": 360,
            "peak_start_hour": 10,
        },
        "lara": {
            # Lara: 3-4 times per week, 2-5 hours, after 2pm
            "interval_hours_typical": 48,
            "interval_tolerance": 24,
            "duration_min": 120,
            "duration_median": 180,
            "duration_max": 300,
            "peak_start_hour": 14,
        },
        "merida": {
            "interval_hours_typical": 24,
            "interval_tolerance": 12,
            "duration_min": 180,
            "duration_median": 300,
            "duration_max": 420,
            "peak_start_hour": 12,
        },
    }

    pattern = REGION_PATTERNS.get(event.region)
    if not pattern:
        return {"is_rationing": False, "confidence": 0}

    confidence = 0.0

    # Check 1: Does the interval since last outage match the pattern?
    expected_interval = pattern["interval_hours_typical"]
    tolerance = pattern["interval_tolerance"]
    interval_diff = abs(
        event.time_since_last_outage_hours - expected_interval
    )
    if interval_diff < tolerance:
        confidence += 0.4

    # Check 2: Is it the right time of day?
    hour = event.started_at.hour
    if hour >= pattern["peak_start_hour"]:
        confidence += 0.3

    # Check 3: Is it isolated to this region? (rationing is local)
    if len(event.adjacent_regions_affected) <= 1:
        confidence += 0.2

    # Check 4: Is this NOT a weekend?
    # Rationing is sometimes lighter on weekends
    if event.started_at.weekday() < 5:
        confidence += 0.1

    return {
        "is_rationing": confidence >= 0.5,
        "confidence": round(min(confidence, 1.0), 2),
        "typical_duration_min": pattern["duration_min"],
        "typical_duration_median": pattern["duration_median"],
        "typical_duration_max": pattern["duration_max"],
    }
```

### 8.2 Duration Estimator (Survival Analysis)

**File:** `duration_estimator.py`  
**Key insight:** The estimate is not static. It refines itself as the outage continues. If you said "2 hours" and 2 hours have passed, the model updates using conditional survival analysis.

```python
# duration_estimator.py

from datetime import datetime, timezone, timedelta

def estimate_remaining(
    outage_start: datetime,
    outage_type: str,
    region: str,
    initial_estimate_hours: dict,  # {min, median, max}
    elapsed_minutes: float,
    crowd_restoration_reports: int,  # "power back" reports in region
    inet_recovering: bool,  # is internet connectivity ticking back up?
    historical_durations: list,  # past outage durations in minutes for region
) -> dict:
    """
    Returns updated estimate of when power will return.
    Called every few minutes while outage is active.
    """

    elapsed_hours = elapsed_minutes / 60

    # If we have enough historical data, use survival analysis approach.
    # "Given that the outage has already lasted X minutes, what is the
    # probability it ends in the next Y minutes?"
    #
    # This is the conditional survival function:
    # P(T > t + dt | T > t) = P(T > t + dt) / P(T > t)

    if len(historical_durations) >= 20:
        remaining = survival_estimate(
            historical_durations, elapsed_minutes
        )
    else:
        # Fallback: shift the initial estimate based on elapsed time
        remaining = fallback_estimate(
            initial_estimate_hours, elapsed_hours
        )

    # Adjust based on real-time signals

    # Signal 1: crowd reports saying power is back in nearby areas
    if crowd_restoration_reports >= 3:
        # Power is coming back in parts of the region
        remaining["median_remaining_min"] *= 0.6
        remaining["confidence_boost"] = (
            "Power restored in nearby areas, likely coming soon"
        )

    # Signal 2: internet connectivity recovering
    if inet_recovering:
        remaining["median_remaining_min"] *= 0.7
        remaining["confidence_boost"] = (
            "Internet connectivity recovering in region"
        )

    # Signal 3: if we have passed the max estimate, something is wrong
    max_min = initial_estimate_hours["max"] * 60
    if elapsed_minutes > max_min:
        remaining["status"] = "longer_than_expected"
        remaining["message"] = (
            f"This outage has lasted longer than the typical "
            f"maximum of {initial_estimate_hours['max']}h for "
            f"this type. Could be a more serious event."
        )

    # Compute ETA
    now = datetime.now(timezone.utc)
    eta = now + timedelta(minutes=remaining["median_remaining_min"])

    return {
        "elapsed_minutes": round(elapsed_minutes),
        "estimated_remaining_min": round(remaining["median_remaining_min"]),
        "estimated_remaining_range_min": {
            "optimistic": round(remaining["optimistic_remaining_min"]),
            "likely": round(remaining["median_remaining_min"]),
            "pessimistic": round(remaining["pessimistic_remaining_min"]),
        },
        "estimated_restoration_time": eta.isoformat(),
        "confidence": remaining.get("confidence", "medium"),
        "message": remaining.get("message", ""),
        "confidence_boost": remaining.get("confidence_boost", ""),
    }


def survival_estimate(historical_durations: list, elapsed: float) -> dict:
    """
    Conditional survival analysis.
    Given that this outage has lasted 'elapsed' minutes,
    what is the distribution of remaining time?
    """
    # Filter to only outages that lasted at least as long as current elapsed
    still_going = [d for d in historical_durations if d > elapsed]

    if len(still_going) < 5:
        # Not enough data, most outages of this type are shorter
        return {
            "median_remaining_min": 30,
            "optimistic_remaining_min": 10,
            "pessimistic_remaining_min": 120,
            "confidence": "low",
            "message": "Outage has lasted longer than most similar events",
        }

    # Compute remaining durations for outages that lasted this long
    remaining_durations = sorted([d - elapsed for d in still_going])

    p25 = remaining_durations[int(len(remaining_durations) * 0.25)]
    p50 = remaining_durations[int(len(remaining_durations) * 0.50)]
    p75 = remaining_durations[int(len(remaining_durations) * 0.75)]

    return {
        "optimistic_remaining_min": max(p25, 5),
        "median_remaining_min": p50,
        "pessimistic_remaining_min": p75,
        "confidence": "high" if len(still_going) >= 30 else "medium",
    }


def fallback_estimate(
    initial: dict, elapsed_hours: float
) -> dict:
    """Simple linear adjustment when historical data is sparse."""
    median_total = initial["median"] * 60  # to minutes
    min_total = initial["min"] * 60
    max_total = initial["max"] * 60
    elapsed_min = elapsed_hours * 60

    return {
        "optimistic_remaining_min": max(min_total - elapsed_min, 5),
        "median_remaining_min": max(median_total - elapsed_min, 10),
        "pessimistic_remaining_min": max(max_total - elapsed_min, 15),
        "confidence": "low",
    }
```

### 8.3 Restoration Tracker

**File:** `restoration_tracker.py`  
**Purpose:** Detects when power has actually been restored, closing the loop and feeding the ML model

```python
# restoration_tracker.py

from datetime import datetime, timezone, timedelta

# Thresholds for declaring power restored in a region
RESTORATION_THRESHOLDS = {
    "crowd_reports_power_back": 5,     # N users say "power back"
    "inet_recovery_ratio": 0.85,       # connectivity back to 85% of baseline
    "min_stable_minutes": 15,          # must stay up for 15 min (avoid false positives)
}


def check_restoration(
    region: str,
    outage_start: datetime,
    current_inet_score: float,  # 0-1, 1 = normal
    baseline_inet_score: float,
    crowd_power_back_reports: int,
    crowd_power_back_first_at: datetime | None,
    last_fluctuation_at: datetime | None,  # last "unstable" report
) -> dict:
    """
    Determine if power has been restored in a region.
    Returns status and confidence.
    """

    now = datetime.now(timezone.utc)
    signals = []

    # Signal 1: Internet connectivity recovered
    if baseline_inet_score > 0:
        recovery_ratio = current_inet_score / baseline_inet_score
    else:
        recovery_ratio = 0

    inet_recovered = (
        recovery_ratio >= RESTORATION_THRESHOLDS["inet_recovery_ratio"]
    )
    if inet_recovered:
        signals.append("internet_recovered")

    # Signal 2: Enough crowd reports saying power is back
    crowd_confirmed = (
        crowd_power_back_reports
        >= RESTORATION_THRESHOLDS["crowd_reports_power_back"]
    )
    if crowd_confirmed:
        signals.append("crowd_confirmed")

    # Signal 3: Stability check. No fluctuation reports in last 15 min.
    stable = True
    if last_fluctuation_at:
        minutes_since_fluctuation = (
            now - last_fluctuation_at
        ).total_seconds() / 60
        stable = (
            minutes_since_fluctuation
            >= RESTORATION_THRESHOLDS["min_stable_minutes"]
        )
    if stable and (inet_recovered or crowd_confirmed):
        signals.append("stable")

    # Decision
    if "stable" in signals and len(signals) >= 2:
        # Compute actual duration
        if crowd_power_back_first_at:
            actual_end = crowd_power_back_first_at
        else:
            actual_end = now

        duration_minutes = (actual_end - outage_start).total_seconds() / 60

        return {
            "status": "restored",
            "confidence": "high" if len(signals) >= 3 else "medium",
            "restored_at": actual_end.isoformat(),
            "outage_duration_minutes": round(duration_minutes),
            "signals": signals,
        }

    elif len(signals) >= 1:
        return {
            "status": "recovering",
            "confidence": "low",
            "signals": signals,
            "message": "Early signs of restoration, monitoring stability",
        }

    else:
        return {
            "status": "still_out",
            "signals": [],
        }
```

### Active Outage Output JSON

The output for an active outage in `status.json`:

```json
{
  "region": "maracaibo",
  "status": "confirmed_outage",
  "outage": {
    "type": "rationing",
    "started_at": "2026-05-15T14:12:00-04:00",
    "elapsed_minutes": 87,
    "estimated_remaining": {
      "optimistic": "45 min",
      "likely": "1h 33min",
      "pessimistic": "2h 45min"
    },
    "estimated_restoration": "~4:30 PM",
    "confidence": "high",
    "based_on": "142 similar outages in this area",
    "message": "Matches afternoon rationing pattern. Power restored in nearby sector Altamira 12 min ago.",
    "progress_pct": 55
  },
  "crowd": {
    "no_power_reports_30min": 34,
    "power_back_reports_30min": 3,
    "power_back_areas": ["Altamira", "Sabaneta"]
  }
}
```

### User-Facing UI Mockup

```
MARACAIBO - POWER OUT
Started: 2:12 PM (1h 27min ago)
Type: Scheduled rationing

[===========-----------] 55%

Likely back by: ~4:30 PM (1h 33min)
Range: 45 min to 2h 45min
Confidence: HIGH (based on 142 similar outages)

Power returning nearby: Altamira, Sabaneta

[ I have power back ]  [ Still out ]
```

The two buttons at the bottom are the crowdsource feedback loop. Every tap goes into Supabase and feeds the survival model for next time.

### Duration Model Training (weekly retrain)

**File:** `train_duration_model.py`

```python
# train_duration_model.py

import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import cross_val_score
import joblib

def train():
    df = pd.read_sql("SELECT * FROM outage_history", conn)

    features = [
        "hour_started", "day_of_week", "temperature_c",
        "humidity_pct", "inet_drop_depth",
    ]

    # Encode region and outage_type as categoricals
    df = pd.get_dummies(df, columns=["region", "outage_type", "season"])
    feature_cols = [
        c for c in df.columns
        if c not in [
            "id", "started_at", "ended_at", "duration_min",
            "predicted_dur", "prediction_error", "crowd_reports",
        ]
    ]

    X = df[feature_cols]
    y = df["duration_min"]

    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        objective="reg:squarederror",
    )

    scores = cross_val_score(
        model, X, y, cv=5, scoring="neg_mean_absolute_error"
    )
    print(f"MAE: {-scores.mean():.1f} +/- {scores.std():.1f} minutes")

    model.fit(X, y)
    joblib.dump(model, "models/duration_model.pkl")
    joblib.dump(feature_cols, "models/duration_features.pkl")

    return model
```

---

## 9. Zone Mapping System

**File:** `zone_mapper.py`  
**Purpose:** Learns the actual electrical zones (feeder circuits) from crowdsource GPS data, without needing Corpoelec cooperation

### Granularity Levels

```
Level 1: STATE (e.g., Zulia, Tachira, Miranda)
  Source: IODA internet monitoring, satellite nighttime lights
  Resolution: Detectable from day one with zero users
  Useful for: National dashboard view

Level 2: CITY / MUNICIPIO (e.g., Municipio Libertador, Chacao, Baruta)
  Source: IODA per-ASN data, VIIRS at 500m resolution
  Resolution: Detectable from day one
  Useful for: "Is Maracaibo out?"

Level 3: PARROQUIA / PARISH (e.g., El Paraiso, Caricuao, Petare)
  Source: Crowdsource reports with GPS, VIIRS pixel-level analysis
  Resolution: Needs ~20+ users per parroquia to be reliable
  Useful for: "My neighborhood vs the one next to me"

Level 4: SECTOR / CIRCUITO (e.g., Montalban III, Brisas de Propatria)
  Source: Crowdsource reports only (satellites cannot resolve this)
  Resolution: Needs 50+ active users per city to start mapping circuits
  Useful for: "My block is out but across the avenue they have power"
```

Satellites and internet monitoring give you Level 1-2 for free. Level 3-4 requires crowdsource data.

### Zone Mapper Code

```python
# zone_mapper.py

from dataclasses import dataclass
from collections import defaultdict
from datetime import datetime, timedelta
import math


@dataclass
class OutageCluster:
    """
    A group of reports that occurred at the same time in the same area.
    Over time, these clusters reveal the actual feeder circuit boundaries.
    """
    cluster_id: str
    region: str
    reports: list          # list of (lat, lon, timestamp) tuples
    centroid_lat: float
    centroid_lon: float
    radius_km: float
    started_at: datetime
    ended_at: datetime | None


class ZoneMapper:
    """
    Learns the actual electrical zones (feeder circuits) from
    historical outage patterns. If the same group of GPS coordinates
    always loses power together, they are on the same circuit.
    """

    def __init__(self):
        self.clusters = []
        self.learned_zones = {}  # zone_id -> list of (lat, lon) centroids

    def cluster_concurrent_reports(
        self,
        reports: list,
        time_window_min: int = 15,
        distance_threshold_km: float = 2.0,
    ) -> list:
        """
        Group reports that happened within the same time window
        and are geographically close to each other.

        Each cluster likely represents one feeder circuit going down.
        """

        # Sort by timestamp
        reports = sorted(reports, key=lambda r: r["timestamp"])

        clusters = []
        assigned = set()

        for i, report in enumerate(reports):
            if i in assigned:
                continue

            # Start a new cluster with this report
            cluster_reports = [report]
            assigned.add(i)

            # Find all reports within time window and distance
            for j, other in enumerate(reports):
                if j in assigned:
                    continue
                time_diff = abs(
                    (other["timestamp"] - report["timestamp"]).total_seconds()
                )
                if time_diff > time_window_min * 60:
                    continue

                dist = haversine(
                    report["lat"], report["lon"],
                    other["lat"], other["lon"],
                )
                if dist <= distance_threshold_km:
                    cluster_reports.append(other)
                    assigned.add(j)

            if len(cluster_reports) >= 2:
                lats = [r["lat"] for r in cluster_reports]
                lons = [r["lon"] for r in cluster_reports]
                centroid_lat = sum(lats) / len(lats)
                centroid_lon = sum(lons) / len(lons)

                # Compute radius (max distance from centroid)
                max_dist = max(
                    haversine(centroid_lat, centroid_lon, r["lat"], r["lon"])
                    for r in cluster_reports
                )

                cluster = OutageCluster(
                    cluster_id=f"cluster_{len(clusters)}",
                    region=report["region"],
                    reports=cluster_reports,
                    centroid_lat=centroid_lat,
                    centroid_lon=centroid_lon,
                    radius_km=max_dist,
                    started_at=min(r["timestamp"] for r in cluster_reports),
                    ended_at=None,
                )
                clusters.append(cluster)

        return clusters

    def learn_zones(self, historical_clusters: list, overlap_threshold: float = 0.6):
        """
        Over time, clusters that keep appearing in the same area
        are probably the same feeder circuit.

        If cluster A and cluster B overlap geographically by 60%+,
        and they never occur at the same time, they are the same zone.

        If they DO occur at the same time, they are different zones
        that happen to be near each other.
        """
        zones = []

        for cluster in historical_clusters:
            matched = False
            for zone in zones:
                overlap = compute_overlap(cluster, zone)
                if overlap >= overlap_threshold:
                    # Same zone, merge the data points
                    zone["clusters"].append(cluster)
                    zone["report_points"].extend(
                        [(r["lat"], r["lon"]) for r in cluster.reports]
                    )
                    matched = True
                    break

            if not matched:
                # New zone discovered
                zones.append({
                    "zone_id": f"zone_{len(zones)}",
                    "region": cluster.region,
                    "clusters": [cluster],
                    "report_points": [
                        (r["lat"], r["lon"]) for r in cluster.reports
                    ],
                    "centroid_lat": cluster.centroid_lat,
                    "centroid_lon": cluster.centroid_lon,
                })

        # Compute convex hull or bounding polygon for each zone
        for zone in zones:
            zone["boundary"] = compute_boundary(zone["report_points"])
            zone["avg_duration_min"] = compute_avg_duration(zone["clusters"])
            zone["typical_times"] = find_typical_times(zone["clusters"])

        self.learned_zones = {z["zone_id"]: z for z in zones}
        return zones


def haversine(lat1, lon1, lat2, lon2):
    """Distance between two GPS coordinates in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_overlap(cluster, zone):
    """
    What fraction of this cluster's reports fall within
    the zone's existing boundary?
    """
    if not zone.get("report_points"):
        return 0.0

    zone_centroid_lat = zone["centroid_lat"]
    zone_centroid_lon = zone["centroid_lon"]

    # Simple: count how many cluster points are within
    # the zone's typical radius
    zone_radius = max(
        haversine(
            zone_centroid_lat, zone_centroid_lon,
            p[0], p[1],
        )
        for p in zone["report_points"]
    )
    # Add 20% tolerance
    zone_radius *= 1.2

    inside = sum(
        1 for r in cluster.reports
        if haversine(
            zone_centroid_lat, zone_centroid_lon,
            r["lat"], r["lon"],
        ) <= zone_radius
    )

    return inside / max(len(cluster.reports), 1)


def compute_boundary(points):
    """Compute a simple bounding box for a set of GPS points."""
    if not points:
        return None
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    return {
        "min_lat": min(lats),
        "max_lat": max(lats),
        "min_lon": min(lons),
        "max_lon": max(lons),
    }


def compute_avg_duration(clusters):
    """Average duration of outages in this zone."""
    durations = []
    for c in clusters:
        if c.ended_at and c.started_at:
            dur = (c.ended_at - c.started_at).total_seconds() / 60
            durations.append(dur)
    if durations:
        return round(sum(durations) / len(durations))
    return None


def find_typical_times(clusters):
    """Find the most common start hours for outages in this zone."""
    hours = defaultdict(int)
    for c in clusters:
        hours[c.started_at.hour] += 1
    # Sort by frequency
    return sorted(hours.items(), key=lambda x: -x[1])[:3]
```

### Example: Learned Zones After a Few Weeks

After accumulating crowdsource data, the zone mapper produces:

```
Zone 47: "El Paraiso / Montalban cluster"
  Boundary: 10.478-10.492 N, 66.935-66.958 W
  Typical outage: Tue/Thu 2pm-5pm (rationing block B)
  Avg duration: 185 min
  Reports from: 34 unique users

Zone 48: "Propatria / La Paz cluster"
  Boundary: 10.505-10.518 N, 66.948-66.962 W
  Typical outage: Mon/Wed 10am-1pm (rationing block A)
  Avg duration: 172 min
  Reports from: 22 unique users
```

You did not need Corpoelec to tell you the circuit map. The users drew it for you.

### Symptom Reporting UI

To capture classification signals, the frontend shows quick-tap options when a user reports:

```
How did the power go out?

[ Suddenly, no warning ]
[ Flickering/fluctuations first, then out ]
[ Scheduled (I expected it) ]

Did you notice anything?

[ Explosion / loud bang ]
[ Smoke or fire near transformer ]
[ Storm / heavy rain / wind ]
[ Nothing unusual ]
```

These take 2 taps and provide classification signals. Over time, passive signals become sufficient without user input.

### What the User Sees (Granular City View)

```
EL PARAISO
  Status: POWER OUT (rationing)
  Type: Scheduled load shedding (92% confidence)
  Started: 2:05 PM
  Expected back: ~5:00 PM
  Pattern: This zone loses power Tue/Thu 2-5pm
  Last 30 days: 8 similar outages, avg 178 min

CHACAO
  Status: NORMAL
  No outages reported or detected

PETARE (sector Los Jardines)
  Status: POWER OUT (equipment failure)
  Type: Local transformer fault (78% confidence)
  Started: 11:42 AM
  Expected back: Unknown (no pattern match)
  Users report: Explosion heard near Av. Principal
  Note: Adjacent sectors have power
```

---

## 10. Anti-Abuse & Validation Layer

**File:** `validation.py`  
**Purpose:** Six-layer-deep validation pipeline: rate limit -> geo check -> contradiction check -> apply device trust -> quorum -> cross-validate against passive signals

```python
# validation.py

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from collections import defaultdict
import hashlib
import math


@dataclass
class Report:
    region: str
    sub_zone: str          # neighborhood / sector / parish
    status: str            # "no_power" | "power_back" | "unstable"
    ip_hash: str
    device_fingerprint: str  # hashed combo of user-agent + screen + timezone
    lat: float | None
    lon: float | None
    timestamp: datetime


# Estimated connected population per region (tune over time from analytics)
# Used to set dynamic quorum thresholds
REGION_POPULATION = {
    "caracas":          2_800_000,
    "maracaibo":        1_600_000,
    "valencia":           900_000,
    "barquisimeto":       800_000,
    "maracay":            750_000,
    "ciudad_guayana":     700_000,
    "san_cristobal":      350_000,
    "merida":             300_000,
    "barinas":            250_000,
    "maturin":            350_000,
    "cumana":             280_000,
    "punto_fijo":         200_000,
    "los_teques":         180_000,
    "porlamar":           150_000,
}

# How many active users you estimate per region
# Starts as a rough guess, updated weekly from real analytics
ESTIMATED_ACTIVE_USERS = {
    "caracas":        500,
    "maracaibo":      300,
    "valencia":       150,
    "barquisimeto":   120,
    "maracay":        100,
    "ciudad_guayana":  80,
    "san_cristobal":   60,
    "merida":          50,
    "barinas":         30,
    "maturin":         40,
    "cumana":          30,
    "punto_fijo":      20,
    "los_teques":      25,
    "porlamar":        15,
}


class ReportValidator:

    def __init__(self):
        # Sliding window storage (in production, use Redis or DB)
        self.recent_reports = []       # last 60 minutes
        self.ip_timestamps = defaultdict(list)  # ip_hash -> [timestamps]
        self.device_timestamps = defaultdict(list)

    def validate_report(self, report: Report) -> dict:
        """
        Run all checks on an incoming report.
        Returns accept/reject decision with reasons.
        """
        checks = []

        # Check 1: IP rate limit
        ip_check = self._check_ip_rate(report)
        checks.append(ip_check)

        # Check 2: Device fingerprint rate limit
        # Catches VPN hoppers who change IP but same browser
        device_check = self._check_device_rate(report)
        checks.append(device_check)

        # Check 3: Geographic consistency
        geo_check = self._check_geo_consistency(report)
        checks.append(geo_check)

        # Check 4: Contradiction check
        # Is this report contradicting the overwhelming consensus?
        contradiction_check = self._check_contradiction(report)
        checks.append(contradiction_check)

        # Decision: reject if any hard fail, flag if soft fail
        hard_fails = [c for c in checks if c["result"] == "reject"]
        soft_fails = [c for c in checks if c["result"] == "flag"]

        if hard_fails:
            return {
                "accepted": False,
                "reason": hard_fails[0]["reason"],
                "checks": checks,
            }

        # Compute trust weight (0.0 to 1.0)
        # Flagged reports count less toward the quorum
        weight = 1.0
        for sf in soft_fails:
            weight *= sf.get("weight_penalty", 0.5)

        # Store the validated report
        report_entry = {
            "report": report,
            "weight": round(weight, 2),
            "timestamp": report.timestamp,
        }
        self.recent_reports.append(report_entry)

        return {
            "accepted": True,
            "weight": round(weight, 2),
            "checks": checks,
        }

    def _check_ip_rate(self, report: Report) -> dict:
        """Max 3 reports per IP per 30 minutes."""
        now = report.timestamp
        cutoff = now - timedelta(minutes=30)

        # Clean old entries
        self.ip_timestamps[report.ip_hash] = [
            t for t in self.ip_timestamps[report.ip_hash]
            if t > cutoff
        ]

        recent_count = len(self.ip_timestamps[report.ip_hash])
        self.ip_timestamps[report.ip_hash].append(now)

        if recent_count >= 6:
            return {
                "check": "ip_rate",
                "result": "reject",
                "reason": "Too many reports from this IP",
            }
        elif recent_count >= 3:
            return {
                "check": "ip_rate",
                "result": "flag",
                "reason": "High frequency from this IP",
                "weight_penalty": 0.3,
            }
        return {"check": "ip_rate", "result": "pass"}

    def _check_device_rate(self, report: Report) -> dict:
        """
        Same logic but on device fingerprint.
        Catches: same person switching VPN/IP.
        """
        now = report.timestamp
        cutoff = now - timedelta(minutes=30)

        fp = report.device_fingerprint
        self.device_timestamps[fp] = [
            t for t in self.device_timestamps[fp] if t > cutoff
        ]

        recent_count = len(self.device_timestamps[fp])
        self.device_timestamps[fp].append(now)

        if recent_count >= 6:
            return {
                "check": "device_rate",
                "result": "reject",
                "reason": "Too many reports from this device",
            }
        elif recent_count >= 3:
            return {
                "check": "device_rate",
                "result": "flag",
                "weight_penalty": 0.3,
            }
        return {"check": "device_rate", "result": "pass"}

    def _check_geo_consistency(self, report: Report) -> dict:
        """
        If user provides lat/lon (from browser geolocation),
        verify it falls within the claimed region.
        Also flag if this IP was reporting from a different region recently.
        """
        if report.lat is None or report.lon is None:
            # No geolocation provided, mild penalty
            return {
                "check": "geo_consistency",
                "result": "flag",
                "reason": "No geolocation provided",
                "weight_penalty": 0.7,
            }

        # Check if lat/lon is plausibly in Venezuela at all
        if not (0.5 < report.lat < 12.5 and -73.5 < report.lon < -59.5):
            return {
                "check": "geo_consistency",
                "result": "reject",
                "reason": "Coordinates outside Venezuela",
            }

        # Check if this IP reported from a different region in last hour
        cutoff = report.timestamp - timedelta(hours=1)
        same_ip_reports = [
            r for r in self.recent_reports
            if r["report"].ip_hash == report.ip_hash
            and r["timestamp"] > cutoff
        ]
        other_regions = [
            r for r in same_ip_reports
            if r["report"].region != report.region
        ]
        if other_regions:
            return {
                "check": "geo_consistency",
                "result": "reject",
                "reason": "Same IP reporting from multiple regions",
            }

        return {"check": "geo_consistency", "result": "pass"}

    def _check_contradiction(self, report: Report) -> dict:
        """
        If 90% of recent reports in this region say 'no_power'
        and this report says 'power_back', it is suspicious
        (but not necessarily wrong -- could be partial restoration).
        Apply a weight penalty rather than rejection.
        """
        cutoff = report.timestamp - timedelta(minutes=30)
        region_reports = [
            r for r in self.recent_reports
            if r["report"].region == report.region
            and r["timestamp"] > cutoff
        ]

        if len(region_reports) < 5:
            return {"check": "contradiction", "result": "pass"}

        statuses = [r["report"].status for r in region_reports]
        total = len(statuses)
        same_status_count = statuses.count(report.status)
        agreement_ratio = same_status_count / total

        if agreement_ratio < 0.1:
            # This report contradicts 90%+ of others
            return {
                "check": "contradiction",
                "result": "flag",
                "reason": (
                    f"Contradicts {total - same_status_count}/{total} "
                    f"recent reports in {report.region}"
                ),
                "weight_penalty": 0.3,
            }

        return {"check": "contradiction", "result": "pass"}
```

---

## 11. Quorum System

**File:** `quorum.py`  
**Purpose:** Dynamic location-based thresholds that scale with population and user activity per region

```python
# quorum.py

import math
from datetime import datetime, timedelta


def compute_crowd_score(
    region: str,
    validated_reports: list,  # reports that passed validation, with weights
    window_minutes: int = 30,
) -> dict:
    """
    Compute a crowd-based outage score for a region.
    Uses a quorum threshold that scales with estimated active users.
    """

    now = datetime.now()
    cutoff = now - timedelta(minutes=window_minutes)

    # Filter to recent validated reports in this region
    recent = [
        r for r in validated_reports
        if r["report"].region == region
        and r["timestamp"] > cutoff
    ]

    if not recent:
        return {
            "score": 0.0,
            "confidence": "none",
            "report_count": 0,
            "quorum_met": False,
        }

    # Separate by status, apply weights
    no_power_weight = sum(
        r["weight"] for r in recent if r["report"].status == "no_power"
    )
    power_back_weight = sum(
        r["weight"] for r in recent if r["report"].status == "power_back"
    )
    unstable_weight = sum(
        r["weight"] for r in recent if r["report"].status == "unstable"
    )
    total_weight = no_power_weight + power_back_weight + unstable_weight

    # Dynamic quorum threshold
    estimated_users = ESTIMATED_ACTIVE_USERS.get(region, 10)
    quorum = compute_quorum(estimated_users)

    quorum_met = total_weight >= quorum["min_reports"]

    if not quorum_met:
        # Not enough reports to trust the crowd signal
        # Return a dampened score
        dampening = total_weight / quorum["min_reports"]
        raw_score = no_power_weight / max(total_weight, 1)
        return {
            "score": round(raw_score * dampening * 0.5, 3),
            "confidence": "very_low",
            "report_count": len(recent),
            "weighted_count": round(total_weight, 1),
            "quorum_needed": quorum["min_reports"],
            "quorum_met": False,
            "message": (
                f"Only {round(total_weight, 1)} weighted reports, "
                f"need {quorum['min_reports']} for reliable signal"
            ),
        }

    # Quorum met: compute real score
    outage_ratio = no_power_weight / total_weight

    # Sub-zone diversity bonus
    # More unique sub-zones reporting = more trustworthy
    sub_zones = set(r["report"].sub_zone for r in recent)
    diversity_bonus = min(len(sub_zones) / quorum["min_zones"], 1.0)

    # Unique IPs count
    unique_ips = set(r["report"].ip_hash for r in recent)
    ip_diversity = min(len(unique_ips) / quorum["min_unique_ips"], 1.0)

    # Final score: outage ratio weighted by diversity metrics
    score = outage_ratio * (0.5 + 0.25 * diversity_bonus + 0.25 * ip_diversity)
    score = round(min(score, 1.0), 3)

    # Confidence level
    if total_weight >= quorum["high_confidence"] and len(sub_zones) >= 3:
        confidence = "high"
    elif quorum_met and len(sub_zones) >= 2:
        confidence = "medium"
    else:
        confidence = "low"

    return {
        "score": score,
        "confidence": confidence,
        "report_count": len(recent),
        "weighted_count": round(total_weight, 1),
        "unique_ips": len(unique_ips),
        "sub_zones_reporting": list(sub_zones),
        "quorum_needed": quorum["min_reports"],
        "quorum_met": True,
        "breakdown": {
            "no_power": round(no_power_weight, 1),
            "power_back": round(power_back_weight, 1),
            "unstable": round(unstable_weight, 1),
        },
    }


def compute_quorum(estimated_active_users: int) -> dict:
    """
    Dynamic quorum thresholds based on how many users a region has.

    The idea: in Caracas with 500 active users, you need at least 8
    reports to take the crowd seriously. In Porlamar with 15 users,
    3 reports is already significant.

    Uses a log scale so it grows slowly with user count.
    """

    # Minimum reports needed (weighted sum)
    # Formula: max(3, 2 * log2(active_users))
    # 15 users  -> 3 (floor)
    # 50 users  -> 11
    # 150 users -> 14
    # 500 users -> 18
    min_reports = max(3, round(2 * math.log2(max(estimated_active_users, 2))))

    # Minimum unique sub-zones
    # At least 2 different neighborhoods need to report
    min_zones = max(2, round(math.log2(max(estimated_active_users, 2)) / 2))

    # Minimum unique IPs
    min_unique_ips = max(3, round(min_reports * 0.6))

    # High confidence threshold (2x the minimum)
    high_confidence = min_reports * 2

    return {
        "min_reports": min_reports,
        "min_zones": min_zones,
        "min_unique_ips": min_unique_ips,
        "high_confidence": high_confidence,
    }
```

---

## 12. Cross-Validation With Passive Signals

**File:** `cross_validation.py`  
**Purpose:** Even if attackers game the crowdsource layer, passive signals override when they disagree

```python
# cross_validation.py


def cross_validate(
    region: str,
    crowd_score: float,      # 0-1 from quorum system
    crowd_confidence: str,
    inet_score: float,        # 0-1, 1 = outage detected
    satellite_score: float,   # 0-1, 1 = lights out
) -> dict:
    """
    Compare crowd reports against passive signals.
    If they agree, boost confidence.
    If they disagree, investigate.
    """

    # Agreement matrix
    crowd_says_outage = crowd_score >= 0.5
    inet_says_outage = inet_score >= 0.5
    sat_says_outage = satellite_score >= 0.5

    signals_saying_outage = sum([
        crowd_says_outage,
        inet_says_outage,
        sat_says_outage,
    ])

    # Case 1: All agree there is an outage
    if signals_saying_outage == 3:
        return {
            "final_score": max(crowd_score, inet_score, satellite_score),
            "trust_crowd": True,
            "confidence": "very_high",
            "note": "All signals confirm outage",
        }

    # Case 2: All agree there is NO outage
    if signals_saying_outage == 0:
        return {
            "final_score": (crowd_score + inet_score + satellite_score) / 3,
            "trust_crowd": True,
            "confidence": "high",
            "note": "All signals indicate normal operation",
        }

    # Case 3: Crowd says outage, passive signals say no
    # This is the spam/manipulation scenario
    if crowd_says_outage and not inet_says_outage and not sat_says_outage:
        return {
            "final_score": crowd_score * 0.3,  # heavily dampen
            "trust_crowd": False,
            "confidence": "low",
            "note": (
                "Crowd reports indicate outage but internet connectivity "
                "and satellite data show normal. Possible false reports. "
                "Monitoring."
            ),
            "flag": "possible_manipulation",
        }

    # Case 4: Passive signals say outage, crowd says no
    # Possible: few users online to report (because the power is out)
    if not crowd_says_outage and (inet_says_outage or sat_says_outage):
        passive_avg = (inet_score + satellite_score) / 2
        return {
            "final_score": passive_avg,
            "trust_crowd": False,
            "confidence": "medium",
            "note": (
                "Passive monitoring detects outage but few crowd reports. "
                "Users may be offline."
            ),
        }

    # Case 5: Mixed signals (2 of 3 agree)
    if signals_saying_outage == 2:
        scores = []
        if crowd_says_outage:
            scores.append(crowd_score)
        if inet_says_outage:
            scores.append(inet_score)
        if sat_says_outage:
            scores.append(satellite_score)
        return {
            "final_score": sum(scores) / len(scores),
            "trust_crowd": crowd_says_outage,
            "confidence": "medium",
            "note": "Majority of signals indicate outage",
        }

    # Fallback
    return {
        "final_score": (crowd_score + inet_score + satellite_score) / 3,
        "trust_crowd": True,
        "confidence": "low",
    }
```

---

## 13. Device Trust Scores

**Purpose:** Over time, assign trust scores to devices based on their track record. Trusted veterans' reports count more toward quorum than brand new devices.

```python
def compute_device_trust(device_fingerprint: str, db) -> float:
    """
    Historical accuracy of this device's reports.
    """
    query = """
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN confirmed_by_passive THEN 1 ELSE 0 END) as confirmed
        FROM outage_reports
        WHERE device_fingerprint = %s
        AND created_at > NOW() - INTERVAL '90 days'
    """
    row = db.execute(query, [device_fingerprint]).fetchone()

    if row["total"] < 3:
        return 0.5  # not enough history, neutral trust

    accuracy = row["confirmed"] / row["total"]

    # Map to 0.2 - 1.0 range
    # 100% accuracy -> 1.0
    # 50% accuracy -> 0.5
    # 0% accuracy -> 0.2 (never fully zero, could be edge cases)
    return round(max(0.2, accuracy), 2)
```

**Full validation pipeline:** rate limit -> geo check -> contradiction check -> apply device trust as weight -> quorum with weighted votes -> cross-validate against passive signals. Six layers deep.

---

## 14. Auto-Calibration

**Purpose:** Automatically update estimated active users per region from real analytics, so quorum thresholds grow organically with the user base.

```python
# calibration.py (runs weekly)

from datetime import datetime, timedelta


def recalibrate_active_users(db_connection) -> dict:
    """
    Count distinct reporting users per region over the last 30 days.
    Use this to update quorum thresholds automatically.
    """
    query = """
        SELECT
            region,
            COUNT(DISTINCT ip_hash) as unique_reporters,
            COUNT(*) as total_reports
        FROM outage_reports
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY region
    """
    rows = db_connection.execute(query).fetchall()

    updated = {}
    for row in rows:
        region = row["region"]
        reporters = row["unique_reporters"]

        # Active users is estimated as reporters * multiplier
        # Not everyone who uses the app submits reports.
        # Typical ratio: 1 reporter per 5-20 viewers
        estimated_total = reporters * 10
        updated[region] = estimated_total

    return updated
```

A region that starts with 15 users and grows to 500 will automatically require more reports before the crowd signal is trusted.

---

## 15. Consequence Layers

**Core insight:** Electricity is not the product. Consequences are. Everyone tracks "is the power out?" Nobody answers the questions people actually have when the power goes out.

### 15.1 Water Supply Prediction

**The connection:** In Venezuela, water supply depends almost entirely on electric pumps. When power goes out, water stops. States like Lara, Portuguesa, Merida, Trujillo, and Apure have water reduced to a few hours per day or a few days per week. In Maracaibo, water arrives by pipe every 20 days; those without tanks pay $20-30 for cistern trucks.

**The model:** If you know a zone has been without power for X hours, and you know the typical tank size in that neighborhood (from user-reported data or census estimates), you can predict when water runs out.

**User reporting:**

```
Power out since: 2:15 PM (4h ago)
Water tank level: [Full] [Half] [Low] [Empty]
Water pressure: [Normal] [Low] [None]
```

Over time: "When Zone 47 loses power for more than 6 hours, 70% of users report water loss within 2 hours."

### 15.2 Food Safety Timer

**Context:** During the 2019 blackouts, Maracaibo families were buying spoiled meat at discounted prices, rinsing darkened cuts with vinegar and lemon just to afford protein. CDC guidelines say refrigerated food is safe for 4 hours without power, a full freezer for 48 hours, a half-full freezer for 24 hours. But those guidelines assume US ambient temperatures (~20-25C). In Maracaibo at 35C+, those windows are shorter.

**UI when outage is detected:**

```
FOOD SAFETY TIMER
Power out: 3h 12min

Refrigerator: SAFE (44 min remaining at current temp)
  -> Keep door closed to extend
Full freezer: SAFE (~44h remaining)
Half freezer: SAFE (~20h remaining)

Medications: CHECK BELOW
  Insulin (opened): Safe up to 28 days at room temp
  Insulin (unopened): Replace within 24h if not refrigerated
  Liquid antibiotics: Discard after 24h without refrigeration

Current ambient temp: 34C (shortens all windows by ~30%)
```

This is a timer with temperature-adjusted thresholds. Simple to build, solves real anxiety for millions of people.

### 15.3 Medical Vulnerability Alerts

**Context:** Between November 2018 and February 2019, 79 people died in Venezuelan hospitals during blackouts due to backup generator failures. At-risk individuals depend on refrigerated medications (insulin, biologics), powered medical devices (oxygen concentrators, CPAP, home dialysis, ventilators), and electric wheelchairs.

**Local profile (stored on device, never sent to servers):**

```
My medical needs:
[x] Refrigerated medication (insulin)
[x] Powered device (CPAP)
[ ] Home dialysis
[ ] Oxygen concentrator

-> When prediction score exceeds 60% for your zone:
   PUSH NOTIFICATION: "High outage risk in next 3h.
   Charge CPAP battery now. Insulin is safe for 28 days
   at room temp once opened."
```

This turns the prediction layer from "nice to know" into "potentially life-saving." Also gives a compelling story for press coverage and NGO partnerships (UNICEF, PAHO, Doctors Without Borders).

### 15.4 Economic Impact Tracker

**Context:** Businesses invest heavily in private power generation, increasing Total Cost of Ownership for all goods. Periodic grid failures disrupt cold chains and manufacturing. In January 2026, Venezuela's largest refinery (Amuay) shut down due to a blackout.

**Cost report form:**

```
Outage cost report:
Duration: 6h
Lost inventory (spoiled food/product): $___
Generator fuel used: $___
Lost revenue (store closed): $___
Equipment damage: $___
```

**Aggregated output:** "Zulia businesses lost an estimated $2.3M in May 2026 due to 847 documented outage-hours."

Journalists, economists, NGOs, and opposition politicians would cite this data. Cedice Libertad already publishes service-quality studies showing Venezuelans spend $30-50/month dealing with water shortages. Cocuyo produces the electricity equivalent, automatically.

### 15.5 Voltage Quality / Bajones Tracker

**Context:** In Venezuela, power doesn't just go out. It degrades. "Bajones" (voltage sags/surges) destroy appliances, fry electronics, and damage refrigerator compressors. On May 14, 2026, strong fluctuations hit at least 14 states before actual cuts.

**Why it matters:**
- **Bajones PRECEDE outages.** Detecting instability 10-30 minutes before a full cut provides real-time early warning.
- **Bajones damage appliances even when power stays on.** Users want to know when to unplug.
- **Differentiates from competitors** who only track binary on/off.

**Hardware approach:** ESP32 microcontrollers + frequency sensors on wall outlets measure grid frequency (nominally 60Hz). Frequency drops indicate supply/demand imbalance. A volunteer network of these across cities provides a live "pulse" of grid health (similar to the FNET/GridEye project at University of Tennessee).

**Software approach:** Let users report "flickering/unstable" as a status. Aggregate to detect instability waves.

### 15.6 Cross-Service Dashboard

**Context:** Electricity, water, internet, and cell service are all correlated. Power outages cause water pump failures, CANTV internet drops, and cell tower battery depletion. Nobody has a unified dashboard.

**UI mockup:**

```
YOUR ZONE: El Paraiso, Caracas

Electricity:  OUT (since 2:15 PM)
Water:        LOW PRESSURE (tank depleting)
Internet:     DOWN (CANTV at 53% in Miranda)
Cell signal:  DEGRADED (tower on battery backup)

Estimated full restoration: ~5:30 PM
Water impact: Tank should last until ~8 PM if power returns by 5:30
```

One screen, all four services, all correlated. The product people would set as their home screen during crisis periods.

### 15.7 Community Resilience Network

**Let users share resources during outages:**

```
Nearby resources (within 1km):
- Generator available at Farmacia San Jose (Av. Principal)
- Water cistern delivery: +58-414-XXX (last reported $25)
- Charging station at Cafe Digital (solar powered)
- Ice available at Bodega Maria ($2/bag, reported 30 min ago)
```

This turns the user base into a mutual aid network. Also gives people a reason to open the app even when there is no outage (to update resource availability), increasing engagement and data quality.

---

## 16. The Dataset as a Product

After 6 months of operation, you will have the most comprehensive structured dataset of Venezuelan infrastructure failures that exists anywhere. The government stopped publishing reliable data years ago.

### Who Would Use This Data

| Audience | Use Case | Model |
|----------|----------|-------|
| **Academic researchers** | Infrastructure collapse, climate resilience, political economy studies | Free API with attribution |
| **International organizations** (PAHO, UNICEF, World Bank) | Evidence for intervention programs, funding proposals | Partnership / data sharing agreement |
| **Journalists** (Infobae, El Nacional, Reuters, AP) | Currently rely on anecdotal reports; need structured data | Free public dashboard |
| **Insurance companies** | Risk assessment for Venezuelan operations | Paid API |
| **NGOs** (Cedice Libertad) | Already track service quality but lack granular data | Partnership |
| **Energy companies** (Siemens, GE) | Grid assessment; both were mentioned as partners for Zulia recovery | Paid quarterly reports |

### Business Model

- **Free:** Public dashboard for citizens, basic API for journalists and researchers
- **Paid:** Detailed API access (historical data, per-zone granularity, prediction endpoints), quarterly infrastructure reports for institutions
- **Value:** The data has value precisely because nobody else has it

---

## 17. Frontend Design

### Project Structure

```
/app
  /public
    index.html
  /src
    /components
      Map.tsx            -- Leaflet map with colored regions
      RegionCard.tsx     -- Detail panel when you click a region
      ReportButton.tsx   -- "I have no power" button
      StatusBar.tsx      -- Top bar with national summary
      PredictionChart.tsx -- 24h timeline of risk scores
    /lib
      api.ts             -- Fetches status.json + submits reports
    /pages
      index.tsx          -- Main page: map + sidebar
```

### Map Color Coding

```
Green  = normal (score < 0.25)
Yellow = at risk (0.25 - 0.45)
Orange = likely outage (0.45 - 0.70)
Red    = confirmed outage (> 0.70)
```

### Frontend Data Fetching

```typescript
// lib/api.ts
const STATUS_URL = "https://cdn.cocuyo.app/status.json";
const SUPABASE_URL = "https://cocuyo.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";

export async function fetchStatus() {
  const resp = await fetch(STATUS_URL, { cache: "no-store" });
  return resp.json();
}

export async function submitReport(report: {
  region: string;
  state: string;
  status: "no_power" | "power_back" | "unstable";
  lat?: number;
  lon?: number;
}) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/outage_reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      ...report,
      ip_hash: "computed-server-side",
    }),
  });
  return resp.ok;
}

// Auto-refresh every 5 minutes
export function useAutoRefresh(callback: () => void, intervalMs = 300000) {
  setInterval(callback, intervalMs);
}
```

### Output JSON Format (`status.json`)

```json
{
  "updated_at": "2026-05-15T16:30:00Z",
  "regions": {
    "caracas": {
      "display_name": "Caracas (Distrito Capital)",
      "current_score": 0.12,
      "prediction_score": 0.35,
      "status": "normal",
      "signals": {
        "internet": 0.05,
        "satellite": 0.0,
        "crowdsource": 0.1,
        "weather": 0.33
      },
      "crowd_reports_30min": 3,
      "prediction_text": "Moderate risk in next 6h due to high temperatures"
    },
    "maracaibo": {
      "current_score": 0.72,
      "prediction_score": 0.80,
      "status": "confirmed_outage",
      "signals": {
        "internet": 0.85,
        "satellite": 0.7,
        "crowdsource": 0.9,
        "weather": 0.66
      },
      "crowd_reports_30min": 47,
      "prediction_text": "Active outage confirmed by multiple sources"
    }
  }
}
```

### Design Considerations for Venezuelan Internet

- Target under **100KB total page weight** (many users on 2G/3G)
- **Progressive Web App (PWA)** that caches last known status offline
- No heavy JS frameworks; pre-rendered HTML with minimal client-side logic
- Useful when power is out and user is on mobile data

---

## 18. Cron / Scheduler Setup

### GitHub Actions Configuration

```yaml
# .github/workflows/collect.yml
name: Collect and Score
on:
  schedule:
    - cron: "*/10 * * * *"   # every 10 minutes
  workflow_dispatch:

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - run: pip install requests numpy supabase-py

      - name: Run collectors and scorer
        env:
          NASA_TOKEN: ${{ secrets.NASA_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          R2_ACCESS_KEY: ${{ secrets.R2_ACCESS_KEY }}
          R2_SECRET_KEY: ${{ secrets.R2_SECRET_KEY }}
        run: python pipeline/main.py

      # main.py runs all collectors, feeds into scorer,
      # writes status.json, uploads to R2/S3
```

**Note:** Public repos get unlimited Actions minutes for free. Recommended to keep the repo public since all data sources are public and the scoring logic is not a trade secret.

---

## 19. Database Schemas

### Outage Reports Table (crowdsource input)

```sql
-- Supabase table schema
CREATE TABLE outage_reports (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    region      TEXT NOT NULL,         -- e.g. 'maracaibo'
    state       TEXT,                  -- e.g. 'Zulia'
    sub_zone    TEXT,                  -- e.g. 'Altamira'
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    status      TEXT NOT NULL,         -- 'no_power' | 'power_back' | 'unstable'
    duration_min INTEGER,              -- how long has it been out
    ip_hash     TEXT,                  -- anonymized, for dedup
    device_fingerprint TEXT,           -- hashed, for device trust
    onset_type  TEXT,                  -- 'sudden' | 'flickering' | 'expected'
    symptom     TEXT,                  -- 'explosion' | 'smoke' | 'storm' | 'none'
    confirmed_by_passive BOOLEAN DEFAULT FALSE  -- set by backend after cross-validation
);

-- Index for fast recent queries
CREATE INDEX idx_reports_recent ON outage_reports (region, created_at DESC);
CREATE INDEX idx_reports_device ON outage_reports (device_fingerprint, created_at DESC);
```

### Outage History Table (completed outages for ML training)

```sql
CREATE TABLE outage_history (
    id              BIGSERIAL PRIMARY KEY,
    region          TEXT NOT NULL,
    sub_zone        TEXT,
    outage_type     TEXT,         -- rationing, transmission, national, feeder_fault, weather, unknown
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_min    INTEGER,
    day_of_week     INTEGER,
    hour_started    INTEGER,
    temperature_c   REAL,
    humidity_pct    REAL,
    season          TEXT,         -- dry, wet, transition
    inet_drop_depth REAL,        -- how far connectivity dropped
    crowd_reports   INTEGER,
    zones_affected  INTEGER,
    predicted_dur   INTEGER,     -- what the model said
    prediction_error INTEGER     -- actual - predicted (for model eval)
);

CREATE INDEX idx_history_region ON outage_history (region, started_at DESC);
```

---

## 20. Scaling Analysis & Cost

### Free Tier Limits

| Service | Free Tier | Bottleneck At |
|---------|-----------|---------------|
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/mo | Never (for this use case) |
| **Supabase** | 500 MB storage, 5 GB bandwidth/mo, 50k MAU | ~10,000 active users |
| **GitHub Actions** | 2,000 min/mo (private), unlimited (public) | N/A if public repo |
| **NASA Earthdata** | Unlimited | Never |
| **IODA API** | Free/academic | Never (one backend client) |
| **Cloudflare Radar** | 10,000 requests/day | Never (backend polling only) |
| **OONI API** | Free, open source | Never |

### Bandwidth Calculation (Cloudflare Pages)

status.json = ~50KB, polled every 5 minutes per user:

| Users | Requests/month | Bandwidth/month | Cost |
|-------|---------------|-----------------|------|
| 1,000 | 8.6M | 430 GB | $0 |
| 10,000 | 86M | 4.3 TB | $0 |
| 100,000 | 864M | 43 TB | $0 |
| 1,000,000 | 8.6B | 430 TB | $0 |

### Cost Per User Tier

| Monthly Active Users | Architecture | Monthly Cost |
|---------------------|-------------|-------------|
| 0 - 1,000 | Everything free tier | $0 + $12/yr domain |
| 1,000 - 10,000 | Add VPS for cron reliability | ~$5/month |
| 10,000 - 50,000 | Supabase Pro | ~$30/month |
| 50,000 - 200,000 | Supabase Pro + Cloudflare Workers for report ingestion | ~$35/month |
| 200,000+ | Dedicated backend, larger DB | ~$50-100/month |

### Cloudflare Workers/D1 Fallback

If Supabase write volume becomes the bottleneck, move report ingestion to a **Cloudflare Worker** (100,000 requests/day free) writing to **Cloudflare D1** (SQLite at the edge, 500MB and 5M reads/day free). Keeps everything on Cloudflare free tier for both reads and writes.

### Why It Scales So Cheaply

The static JSON + CDN architecture means reads (99.9% of traffic) cost $0 regardless of scale. Only writes (0.1%) cost money, and those are tiny INSERTs. Venezuela has ~28M people, ~60-70% internet penetration. Even serving the entire connected population stays under $100-200/month.

---

## 21. Phased Roadmap

### Phase 1: MVP (2-3 weeks)
**Crowdsource-only.** Users report outages, you aggregate into a DownDetector-style heatmap.
- Supabase + static Next.js on Vercel
- Zero cost
- Goal: validate demand, start collecting ground truth data
- Key features: report button, map, basic aggregation

### Phase 2: Add Passive Monitoring (2-4 weeks)
**IODA internet connectivity collector.** Automatic detection without relying solely on user reports.
- Poll IODA + Cloudflare Radar every 5-10 minutes
- Cross-validate crowd reports against internet data
- This separates you from a simple survey tool

### Phase 3: Add Satellite Data (4-6 weeks)
**VIIRS nighttime lights integration.**
- Independent confirmation, covers areas with few/zero users
- NASA Earthdata account (free) + raster processing with rasterio/numpy
- Zone learning from report clustering begins

### Phase 4: Add Prediction (ongoing)
**Train XGBoost/LSTM model** on accumulated data.
- Features: weather, time, day, season, historical patterns, reservoir proxy
- Duration prediction with survival analysis
- Outage type classification
- Start simple heuristics, iterate with ML

### Phase 5: Grow (ongoing)
- **Mobile app** (React Native or Flutter wrapping same JSON API)
- **Push notifications** ("Maracaibo: 78% chance of outage in next 3 hours")
- **Telegram bot** for users with limited data
- **Consequence layers** (water, food safety, medical alerts)
- **Economic impact reports**
- **Partnerships** with local media, NGOs, academic institutions
- **Paid API** for institutional users

### Differentiated Launch Strategy

Given that GeoBlackout is US-only and no real competitor exists in Venezuela:

**Month 1:** Launch with food safety timer + water impact prediction + medication alerts. Frame as "not just an outage tracker, but your outage survival companion."

**Month 2:** Add voltage quality reporting (bajones early warning). Something nobody else does.

**Month 3:** Add cross-service dashboard (power + water + internet + cell). Integrate VE Sin Filtro public CANTV data.

**Month 4+:** Add economic impact tracker, publish monthly reports. Partner with Cedice Libertad or university. The data becomes the moat.

---

## 22. Attack Scenarios & Mitigations

### Scenario 1: One Troll Spamming "No Power" From Caracas

**Attack:** Single person submits repeated "no_power" reports.

**Defense:**
- IP rate limit catches after 6 reports
- Even if 6 get through, Caracas needs quorum of ~18 weighted reports from 12+ unique IPs across 4+ sub-zones
- 6 reports from 1 IP does nothing to the score

### Scenario 2: VPN Rotator Submitting 50 Fake Reports

**Attack:** Same person uses VPN to change IP, submits many reports.

**Defense:**
- Device fingerprint rate limit catches same browser across IPs
- Geolocation check rejects reports where GPS doesn't match claimed region (VPN changes IP, not GPS)
- Even with GPS spoofing, still needs reports from multiple sub-zones
- Cross-validation layer sees CANTV connectivity is fine and overrides crowd score to 30% of raw value

### Scenario 3: Coordinated Political Group (100 Real People)

**Attack:** 100 real users from real IPs in real locations falsely report outages in a state.

**Defense:**
- Quorum system would initially trust them (this is the hardest attack)
- **But:** Cross-validation catches it. Internet connectivity data from IODA shows no drop, satellite nighttime lights are normal
- System flags as "possible manipulation," dampens crowd score by 70%
- User-facing UI shows: "Crowd reports indicate outage but passive monitoring shows normal. Unconfirmed."

### Scenario 4: Real Outage, Few Users Report (Rural Area)

**Non-attack scenario:** Real outage in area with only 10 users.

**Defense:**
- Quorum is low (3 reports needed)
- Even without crowd data, internet connectivity drop and satellite data detect it independently
- System shows: "Passive monitoring detects outage but few crowd reports. Users may be offline."
- This is the most common early scenario and exactly why passive monitoring matters

### Summary of Defense Layers

```
Layer 1: IP rate limiting (3 per 30 min, reject at 6)
Layer 2: Device fingerprint rate limiting
Layer 3: Geolocation consistency check
Layer 4: Contradiction detection (vs consensus)
Layer 5: Device trust scores (historical accuracy)
Layer 6: Dynamic quorum (weighted votes, zone diversity, IP diversity)
Layer 7: Cross-validation against passive signals (internet + satellite)
```

Gaming the system would require coordinated real users in real locations submitting reports that also happen to align with internet connectivity drops -- at which point, there is probably a real outage.

---

## Appendix: What Drives Government Rationing Decisions

The government cuts power when generation cannot meet demand. The inputs are measurable:

**Supply side (generation fails when):**
- Guri Dam reservoir is low (dry season: March-May)
- El Niño reduces rainfall (35% below average in 2026)
- Thermoelectric plants at ~15% capacity (lack of fuel/parts)
- 60% of substations in critical condition

**Demand side (consumption spikes when):**
- Temperature rises (demand hit 15,570 MW on May 7 at high temps)
- Time of day: afternoon/evening (AC peak)
- Weekdays: higher commercial/industrial load

**Geographic priority (who gets cut first):**
1. **Caracas** - almost never cut (political capital)
2. **Bolivar** - near Guri, usually stable
3. **Central states** (Carabobo, Aragua) - moderate risk
4. **Eastern states** - moderate risk
5. **Western states** (Zulia, Tachira, Merida, Lara, Trujillo, Falcon) - cut first, cut longest, cut most

This hierarchy has held for 15+ years. If supply drops 10%, Zulia gets hit. If it drops 20%, Tachira and Merida join.

**Prediction model:**

```
P(outage in region R in next T hours) =
    f(temperature, season, reservoir_proxy, time_of_day,
      day_of_week, recent_outage_pattern_in_R,
      government_announcement_flag, connectivity_in_adjacent_regions,
      crowd_reports_trend)
```

---

*End of specification. Last updated: May 15, 2026.*