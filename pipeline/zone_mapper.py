"""
Zone mapper — learns feeder circuit boundaries from crowdsource GPS data.

cluster_concurrent_reports() groups GPS reports that are close in time
and space. Repeated clusters in the same area → learned feeder zone.
No Corpoelec cooperation required.
"""
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class OutageCluster:
    cluster_id:   str
    region:       str
    reports:      list
    centroid_lat: float
    centroid_lon: float
    radius_km:    float
    started_at:   datetime
    ended_at:     datetime | None = None


class ZoneMapper:
    def __init__(self) -> None:
        self.clusters:      list         = []
        self.learned_zones: dict         = {}

    def cluster_concurrent_reports(
        self,
        reports: list[dict],
        time_window_min: float = 15.0,
        distance_threshold_km: float = 2.0,
    ) -> list[OutageCluster]:
        """
        Group reports within time_window_min and distance_threshold_km.
        Each cluster ≥ 2 reports likely represents one feeder circuit.
        Seed-based: distance measured from first report in each cluster.
        """
        if not reports:
            return []

        reports = sorted(reports, key=lambda r: r["timestamp"])
        clusters: list[OutageCluster] = []
        assigned: set[int]            = set()

        for i, report in enumerate(reports):
            if i in assigned:
                continue

            cluster_reports = [report]
            assigned.add(i)

            for j, other in enumerate(reports):
                if j in assigned:
                    continue
                time_diff = abs(
                    (other["timestamp"] - report["timestamp"]).total_seconds()
                )
                if time_diff > time_window_min * 60:
                    continue
                if haversine(report["lat"], report["lon"],
                             other["lat"], other["lon"]) <= distance_threshold_km:
                    cluster_reports.append(other)
                    assigned.add(j)

            if len(cluster_reports) < 2:
                continue

            lats = [r["lat"] for r in cluster_reports]
            lons = [r["lon"] for r in cluster_reports]
            c_lat = sum(lats) / len(lats)
            c_lon = sum(lons) / len(lons)
            radius = max(
                haversine(c_lat, c_lon, r["lat"], r["lon"])
                for r in cluster_reports
            )

            clusters.append(OutageCluster(
                cluster_id=f"cluster_{len(clusters)}",
                region=report.get("region", ""),
                reports=cluster_reports,
                centroid_lat=c_lat,
                centroid_lon=c_lon,
                radius_km=radius,
                started_at=min(r["timestamp"] for r in cluster_reports),
                ended_at=None,
            ))

        return clusters

    def learn_zones(
        self,
        historical_clusters: list[OutageCluster],
        overlap_threshold: float = 0.6,
    ) -> list[dict]:
        """
        Merge clusters that overlap ≥ overlap_threshold → same feeder zone.
        Concurrent clusters kept separate (different zones near each other).
        """
        zones: list[dict] = []

        for cluster in historical_clusters:
            matched = False
            for zone in zones:
                if compute_overlap(cluster, zone) >= overlap_threshold:
                    zone["clusters"].append(cluster)
                    zone["report_points"].extend(
                        (r["lat"], r["lon"]) for r in cluster.reports
                    )
                    matched = True
                    break
            if not matched:
                zones.append({
                    "zone_id":      f"zone_{len(zones)}",
                    "region":       cluster.region,
                    "clusters":     [cluster],
                    "report_points": [(r["lat"], r["lon"]) for r in cluster.reports],
                    "centroid_lat": cluster.centroid_lat,
                    "centroid_lon": cluster.centroid_lon,
                })

        for zone in zones:
            zone["boundary"]         = compute_boundary(zone["report_points"])
            zone["avg_duration_min"] = compute_avg_duration(zone["clusters"])
            zone["typical_times"]    = find_typical_times(zone["clusters"])

        self.learned_zones = {z["zone_id"]: z for z in zones}
        return zones


# ── pure helpers ──────────────────────────────────────────────────────────────

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km between two GPS coordinates."""
    R    = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a    = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_overlap(cluster: OutageCluster, zone: dict) -> float:
    """Fraction of cluster reports falling within zone radius (+20% tolerance)."""
    points = zone.get("report_points", [])
    if not points:
        return 0.0
    z_lat = zone["centroid_lat"]
    z_lon = zone["centroid_lon"]
    zone_radius = max(haversine(z_lat, z_lon, p[0], p[1]) for p in points) * 1.2
    inside = sum(
        1 for r in cluster.reports
        if haversine(z_lat, z_lon, r["lat"], r["lon"]) <= zone_radius
    )
    return inside / max(len(cluster.reports), 1)


def compute_boundary(points: list[tuple[float, float]]) -> dict | None:
    """Bounding box for a set of GPS (lat, lon) points."""
    if not points:
        return None
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    return {
        "min_lat": min(lats), "max_lat": max(lats),
        "min_lon": min(lons), "max_lon": max(lons),
    }


def compute_avg_duration(clusters: list[OutageCluster]) -> float | None:
    """Average outage duration in minutes across clusters with ended_at set."""
    durations = [
        (c.ended_at - c.started_at).total_seconds() / 60
        for c in clusters
        if c.ended_at and c.started_at
    ]
    return round(sum(durations) / len(durations)) if durations else None


def find_typical_times(clusters: list[OutageCluster]) -> list[tuple[int, int]]:
    """Top-3 most frequent start hours across clusters."""
    hours: dict[int, int] = defaultdict(int)
    for c in clusters:
        hours[c.started_at.hour] += 1
    return sorted(hours.items(), key=lambda x: -x[1])[:3]
