# Municipio-level map + per-municipio status (municipio layer)

- **Created:** 2026-08-14
- **Status:** In progress (code complete; awaiting live pipeline data to validate)
- **Source:** https://github.com/Kralgor/cocuyo/issues/none (feature request via chat)

## What

1. **Geography dataset**: `pipeline/municipios.py` + `app/public/municipios.json` —
   24 states, 332 municipios with coordinates (Wikipedia anexo + OSM Nominatim geocoding).
2. **Per-municipio status**: `pipeline/municipio_status.py` — each municipio gets its
   own status entry in `status.json` (`municipios` section): own VIIRS satellite sample
   at the municipio centroid + state-region attributed signals. Status rule: own
   satellite outage dominates (v1 approximation); blend otherwise.
3. **Web map**: state-level aggregate circles (worst status, click selects state's
   region) that break down into municipio markers at zoom ≥ 8 (each colored by its own
   status, tooltip with name + status, click selects state region).

## Validation notes

- Pipeline: 564 tests (17 new) pass. Web: build + lint clean. Browser E2E passed
  (states view → click Carabobo → Valencia selected; zoom → 332 municipio markers;
  tooltips; no console errors).
- The `municipios` section flows to the CDN automatically with the 10-min collect run
  (no workflow change).

## Open items

- [ ] Validate the first real VIIRS per-municipio run (publication window 06:00-08:00 UTC) —
      watch for states without a region baseline reading no_data.
- [ ] Consider state boundaries as actual polygons (currently circles at centroids).
- [ ] Parroquia-level reporting integration (existing pending todo) can reuse the dataset.
