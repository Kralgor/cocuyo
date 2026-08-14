# Municipio-level map + per-municipio status (municipio layer)

- **Created:** 2026-08-14
- **Status:** In progress (code complete; awaiting live pipeline data to validate)
- **Source:** https://github.com/Kralgor/cocuyo/issues/none (feature request via chat)

## What

1. **Geography dataset**: `pipeline/municipios.py` + `app/public/municipios.json` —
   24 states, 332 municipios with coordinates (Wikipedia anexo + OSM Nominatim geocoding).
2. **Per-municipio status**: `pipeline/municipio_status.py` — each municipio gets its
   own status entry in `status.json` (`municipios` section), plus `municipio_baselines.py`
   (adaptive per-municipio VIIRS baselines, EMA of own history, persisted to R2).
3. **Web map**: state-level aggregate circles (worst status, click selects state's
   region) that break down into municipio markers at zoom ≥ 8 (each colored by its own
   status, tooltip with name + status, click selects state region).

## Independence model (v2)

- Each municipio's status is decided by its OWN VIIRS satellite sample when present
  (major→confirmed, partial→likely, degraded→at_risk, normal→normal). Region signals
  fill in only when the own sample is absent (clouds / outside the 06:00-08:00 UTC
  publication window).
- Outage detection uses the municipio's OWN adaptive baseline (EMA of its radiance
  history, seeded on first observation) — never the state capital's baseline, which
  would permanently flag lit rural municipios as outages.
- Cloud-covered municipios inherit the state region's satellite classification
  (not forced to normal).

## Validation notes

- Pipeline: 575 tests (28 municipio-related) pass. Web: build + lint clean. Browser E2E
  passed (states view → click Carabobo → Valencia selected; zoom → 332 municipio markers;
  wheel zoom; zero mixing of dots and circles; no console errors).
- The `municipios` section flows to the CDN automatically with the 10-min collect run.

## Open items

- [x] Adaptive per-municipio baselines (EMA, R2-persisted) — DONE 2026-08-14
- [x] Satellite-dominant status rule — DONE 2026-08-14
- [ ] Per-municipio weather sampling (NASA POWER point queries per municipio; watch API
      rate limits at 332 points/10min)
- [ ] Per-municipio crowd reports: map report `parroquia` field → municipio (mobile
      parroquias.json covers 18 municipios today; needs full dataset)
- [ ] State boundaries as actual polygons (currently circles at centroids)
- [ ] Validate the first real VIIRS per-municipio run (publication window 06:00-08:00 UTC)
