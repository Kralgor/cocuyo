"""
Seed historical outage data per region based on documented Venezuelan rationing patterns.
Generates 365 days of outage records + pattern analysis + 48h forecast curve.
Outputs: app/public/history/{region}.json

Usage:
    python pipeline/seed_history.py

Sources for patterns:
- Known CORPOELEC rationing schedules (2023-2026)
- Public reporting on Zulia/Táchira/Mérida outage frequency
- Seasonal load curves (peak: March-September)
"""

import json
import math
import os
import random
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path


# ── Region rationing profiles ─────────────────────────────────────────────────

@dataclass
class RationingProfile:
    region: str
    display_name: str
    frequency: str
    days_per_week: float
    typical_start_hour: int
    typical_duration_h: float
    duration_variance: float
    start_variance: float
    multi_block: bool
    severity: float  # 0-1 scale, affects extra random outages


PROFILES: list[RationingProfile] = [
    RationingProfile("maracaibo", "Maracaibo (Zulia)",
                     "interdiario", 3.5, 13, 4.0, 1.5, 2.0, True, 0.85),
    RationingProfile("san_cristobal", "San Cristóbal (Táchira)",
                     "daily", 6.0, 10, 5.0, 2.0, 1.5, True, 0.90),
    RationingProfile("merida", "Mérida (Mérida)",
                     "daily", 5.5, 12, 4.5, 1.5, 1.5, False, 0.80),
    RationingProfile("valera", "Valera (Trujillo)",
                     "4x/week", 4.0, 13, 3.5, 1.0, 2.0, False, 0.65),
    RationingProfile("barquisimeto", "Barquisimeto (Lara)",
                     "3-4x/week", 3.5, 14, 3.0, 1.2, 1.5, False, 0.60),
    RationingProfile("punto_fijo", "Punto Fijo (Falcón)",
                     "3x/week", 3.0, 14, 3.0, 1.0, 2.0, False, 0.55),
    RationingProfile("valencia", "Valencia (Carabobo)",
                     "2-3x/week", 2.5, 14, 2.5, 1.0, 2.0, False, 0.45),
    RationingProfile("maracay", "Maracay (Aragua)",
                     "2-3x/week", 2.5, 14, 2.5, 1.0, 2.0, False, 0.45),
    RationingProfile("caracas", "Caracas (Distrito Capital)",
                     "1-2x/week", 1.5, 15, 2.0, 0.8, 2.0, False, 0.25),
    RationingProfile("los_teques", "Los Teques (Miranda)",
                     "2-3x/week", 2.5, 13, 2.8, 1.0, 1.5, False, 0.50),
    RationingProfile("guarenas_guatire", "Guarenas-Guatire (Miranda)",
                     "2-3x/week", 2.5, 13, 2.5, 1.0, 2.0, False, 0.45),
    RationingProfile("barinas", "Barinas (Barinas)",
                     "4x/week", 4.0, 12, 4.0, 1.5, 1.5, True, 0.70),
    RationingProfile("maturin", "Maturín (Monagas)",
                     "3x/week", 3.0, 14, 3.0, 1.0, 2.0, False, 0.55),
    RationingProfile("barcelona", "Barcelona (Anzoátegui)",
                     "2-3x/week", 2.5, 14, 2.5, 1.0, 2.0, False, 0.45),
    RationingProfile("cumana", "Cumaná (Sucre)",
                     "3x/week", 3.0, 13, 3.0, 1.0, 1.5, False, 0.55),
    RationingProfile("porlamar", "Porlamar (Nueva Esparta)",
                     "2x/week", 2.0, 14, 2.0, 0.8, 2.0, False, 0.35),
    RationingProfile("ciudad_guayana", "Ciudad Guayana (Bolívar)",
                     "1-2x/week", 1.5, 15, 2.0, 0.8, 2.0, False, 0.20),
]


# ── Outage generation ─────────────────────────────────────────────────────────

@dataclass
class OutageRecord:
    date: str
    start_hour: float
    duration_h: float
    outage_type: str


def seasonal_multiplier(date: datetime) -> float:
    """Peak demand March-September, trough Nov-Jan."""
    day_of_year = date.timetuple().tm_yday
    return 0.8 + 0.4 * math.sin((day_of_year - 60) / 365 * 2 * math.pi)


def generate_outages(profile: RationingProfile, seed: int = 42) -> list[OutageRecord]:
    """Generate 365 days of outage history for a region."""
    rng = random.Random(seed + hash(profile.region))
    today = datetime(2026, 5, 17)
    records: list[OutageRecord] = []

    for day_offset in range(365, 0, -1):
        date = today - timedelta(days=day_offset)
        dow = date.weekday()
        season = seasonal_multiplier(date)

        # Scheduled rationing probability per day
        daily_prob = (profile.days_per_week / 7.0) * season

        # Some regions skip weekends
        if dow >= 5 and profile.severity < 0.7:
            daily_prob *= 0.4

        # Primary scheduled outage
        if rng.random() < daily_prob:
            start = profile.typical_start_hour + rng.gauss(0, profile.start_variance)
            start = max(6, min(22, start))
            dur = profile.typical_duration_h + rng.gauss(0, profile.duration_variance * 0.5)
            dur = max(0.5, min(12, dur))

            records.append(OutageRecord(
                date=date.strftime("%Y-%m-%d"),
                start_hour=round(start, 1),
                duration_h=round(dur, 1),
                outage_type="scheduled",
            ))

            # Multi-block: second outage later in the day
            if profile.multi_block and rng.random() < 0.35 * season:
                start2 = start + dur + rng.uniform(2, 5)
                if start2 < 23:
                    dur2 = rng.uniform(1, profile.typical_duration_h * 0.7)
                    records.append(OutageRecord(
                        date=date.strftime("%Y-%m-%d"),
                        start_hour=round(start2, 1),
                        duration_h=round(dur2, 1),
                        outage_type="scheduled",
                    ))

        # Unscheduled outage (feeder fault, storm, etc.)
        unscheduled_prob = profile.severity * 0.08 * season
        if rng.random() < unscheduled_prob:
            start = rng.uniform(0, 22)
            dur = rng.expovariate(1 / 2.0)  # mean 2h
            dur = max(0.3, min(8, dur))
            otype = rng.choice(["feeder", "feeder", "substation", "weather_dmg"])
            records.append(OutageRecord(
                date=date.strftime("%Y-%m-%d"),
                start_hour=round(start, 1),
                duration_h=round(dur, 1),
                outage_type=otype,
            ))

    return records


# ── Pattern detection ─────────────────────────────────────────────────────────

@dataclass
class DetectedPattern:
    detected: bool
    description: str
    frequency: str
    typical_days: list[int]
    typical_start_hour: float
    typical_duration_h: float
    confidence: float


def detect_pattern(records: list[OutageRecord]) -> DetectedPattern:
    """Analyze last 90 days for recurring schedule."""
    if not records:
        return DetectedPattern(False, "", "", [], 0, 0, 0)

    today = datetime(2026, 5, 17)
    cutoff = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    recent = [r for r in records if r.date >= cutoff and r.outage_type == "scheduled"]

    if len(recent) < 10:
        return DetectedPattern(False, "", "", [], 0, 0, 0)

    # Count outages per day-of-week
    dow_counts: dict[int, int] = {i: 0 for i in range(7)}
    starts: list[float] = []
    durations: list[float] = []

    for r in recent:
        d = datetime.strptime(r.date, "%Y-%m-%d")
        dow_counts[d.weekday()] += 1
        starts.append(r.start_hour)
        durations.append(r.duration_h)

    # Find dominant days (above average)
    avg_count = len(recent) / 7
    typical_days = [d for d, c in dow_counts.items() if c > avg_count * 0.8]

    avg_start = sum(starts) / len(starts)
    avg_dur = sum(durations) / len(durations)

    # Confidence based on consistency
    start_std = (sum((s - avg_start) ** 2 for s in starts) / len(starts)) ** 0.5
    dur_std = (sum((d - avg_dur) ** 2 for d in durations) / len(durations)) ** 0.5
    confidence = max(0.4, min(0.95, 1.0 - (start_std / 6 + dur_std / 4) / 2))

    days_per_week = len(recent) / 13  # 90 days ≈ 13 weeks
    if days_per_week >= 5.5:
        freq = "daily"
    elif days_per_week >= 3.5:
        freq = "interdiario"
    elif days_per_week >= 2.5:
        freq = f"{round(days_per_week)}x/week"
    else:
        freq = f"{round(days_per_week)}x/week"

    day_names_es = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
    days_str = ", ".join(day_names_es[d] for d in sorted(typical_days))
    desc = (f"{freq}, ~{avg_dur:.1f}h, "
            f"típicamente {int(avg_start)}:00-{int(avg_start + avg_dur)}:00 "
            f"({days_str})")

    return DetectedPattern(
        detected=True,
        description=desc,
        frequency=freq,
        typical_days=sorted(typical_days),
        typical_start_hour=round(avg_start, 1),
        typical_duration_h=round(avg_dur, 1),
        confidence=round(confidence, 2),
    )


# ── Forecast generation ───────────────────────────────────────────────────────

def generate_forecast(profile: RationingProfile, pattern: DetectedPattern) -> list[dict]:
    """Generate 48-point (half-hour) risk forecast for next 24h."""
    points: list[dict] = []
    now_hour = 14.0  # anchor: generate as if running at 2pm

    for i in range(48):
        hour = (now_hour + i * 0.5) % 24

        # Base risk from historical pattern
        risk = 0.05

        if pattern.detected:
            # Risk peaks around typical outage window
            center = pattern.typical_start_hour + pattern.typical_duration_h / 2
            dist = abs(hour - center)
            if dist > 12:
                dist = 24 - dist
            window_half = pattern.typical_duration_h / 2 + 1
            if dist < window_half:
                risk += 0.5 * (1 - dist / window_half) * pattern.confidence

            # Day-of-week factor (today = Friday = 4)
            today_dow = 4
            if today_dow in pattern.typical_days:
                risk *= 1.3
            else:
                risk *= 0.6

        # Demand curve overlay: peak 11am-5pm
        if 11 <= hour <= 17:
            risk += 0.1 * math.sin((hour - 11) / 6 * math.pi)

        # Evening secondary peak
        if 19 <= hour <= 22:
            risk += 0.05

        # Severity factor
        risk *= (0.5 + profile.severity * 0.8)

        risk = max(0.02, min(0.95, risk))
        points.append({"half_hour": i, "hour": round(hour, 1), "risk": round(risk, 3)})

    return points


# ── Stats computation ─────────────────────────────────────────────────────────

def compute_stats(records: list[OutageRecord], days: int) -> dict:
    """Compute summary stats for the last N days."""
    today = datetime(2026, 5, 17)
    cutoff = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    recent = [r for r in records if r.date >= cutoff]

    if not recent:
        return {"total_hours": 0, "count": 0, "avg_duration_h": 0, "longest_h": 0}

    total_h = sum(r.duration_h for r in recent)
    longest = max(r.duration_h for r in recent)
    avg = total_h / len(recent)

    return {
        "total_hours": round(total_h, 1),
        "count": len(recent),
        "avg_duration_h": round(avg, 1),
        "longest_h": round(longest, 1),
    }


# ── JSON output ───────────────────────────────────────────────────────────────

def build_region_json(profile: RationingProfile) -> dict:
    """Build complete history JSON for one region."""
    records = generate_outages(profile)
    pattern = detect_pattern(records)
    forecast = generate_forecast(profile, pattern)

    # Group outages by date for the last 90 days
    today = datetime(2026, 5, 17)
    cutoff_90 = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    recent_records = [r for r in records if r.date >= cutoff_90]

    days_map: dict[str, list] = {}
    for r in recent_records:
        days_map.setdefault(r.date, []).append({
            "start_hour": r.start_hour,
            "duration_h": r.duration_h,
            "type": r.outage_type,
        })

    days_list = []
    for day_offset in range(90, 0, -1):
        date_str = (today - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        days_list.append({
            "date": date_str,
            "outages": days_map.get(date_str, []),
        })

    return {
        "region": profile.region,
        "display_name": profile.display_name,
        "generated_at": today.isoformat() + "Z",
        "days_included": 90,
        "days": days_list,
        "stats_30d": compute_stats(records, 30),
        "stats_90d": compute_stats(records, 90),
        "pattern": asdict(pattern),
        "forecast_48h": forecast,
    }


def main():
    output_dir = Path(__file__).parent.parent / "app" / "public" / "history"
    output_dir.mkdir(parents=True, exist_ok=True)

    for profile in PROFILES:
        data = build_region_json(profile)
        path = output_dir / f"{profile.region}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  {profile.region}: {data['stats_30d']['count']} outages/30d, "
              f"{data['stats_30d']['total_hours']}h dark")

    print(f"\nDone. {len(PROFILES)} files written to {output_dir}")


if __name__ == "__main__":
    main()
