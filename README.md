# Cocuyo

Real-time power outage monitoring for Venezuela. Anonymous, open source, independent of any government.

Cocuyo watches the grid with public data (satellite, internet signals, weather, crowd reports) and publishes per-zone outage status every 10 minutes — no Corpoelec cooperation needed. When the power goes out, Venezuelans find out instantly: where, how long, when it might come back.

## Live

| What | Where |
|------|-------|
| Web app | https://app.cocuyo.kralgor.com |
| Current status (machine-readable) | https://cocuyo.kralgor.com/status.json |
| Per-region history (weekly) | https://cocuyo.kralgor.com/history/{region}.json |
| Mobile app | Android/iOS via Expo EAS (store submission pending) |

## Why

Corpoelec publishes no outage data. Venezuelans have zero information when the power goes out: cause, duration, or ETA. Cocuyo exists to fill that gap with data that is open, anonymous, and trustworthy.

**Design constraints that shape everything:**

- **No server for reads** — the frontend is a static site that reads pre-computed JSON from a CDN. It survives outages, has no single point of failure, and costs almost nothing to run.
- **Anonymous by design** — no accounts, no tracking, no location storage. Reports carry no identity.
- **Offline-first** — Venezuelan internet is unreliable; the mobile app caches status and queues reports for when connectivity returns.
- **Privacy over analytics** — the only key in client code is the Supabase anon key (ADR-007).

## Features

**Web app** — per-zone status with signal breakdown, 30-day outage history strip, 48h risk forecast, detected rationing patterns, bajones (voltage sag) tracking, report submission, bilingual ES/EN, interactive map, offline-capable service worker.

**Mobile app (React Native / Expo)** — everything the web has plus:

- Push notifications for outages, restorations, and nearby-zone warnings
- Food spoilage timers that auto-start on outage detection (Venezuelan food presets + custom items)
- Full offline mode: cached status, local timers, queued reports that sync when connectivity returns
- WhatsApp sharing ("sin luz hace 3 horas en Maracaibo")
- AMOLED true-black dark mode + low-battery refresh reduction
- Emergency contacts per zone
- Trust onboarding + persistent privacy/open-source section

## Architecture

```
External APIs → collectors → scorer → status.json → Cloudflare R2 CDN → frontend
User tap → Supabase outage_reports → pipeline reads on next cron
```

Three layers, each independently replaceable:

1. **Collection** — Python pipeline (GitHub Actions cron, every 10 min) pulls from free public sources
2. **Analysis** — blends signals into a 0–1 score per region, writes `status.json`, uploads to R2; weekly retrain job builds duration models + per-region history
3. **Static frontends** — web (Next.js static export) and mobile (Expo) both read the same `status.json` contract; no server handles reads

**Data sources:** satellite night lights (VIIRS), internet signal (RIPE Atlas, M-Lab, Cloudflare Radar), NASA POWER weather, Supabase crowd reports, and a duration model trained on historical patterns.

**Coverage:** 17 regions across all of Venezuela (Occidente → Centro → Oriente).

## Repository layout

```
/               this repo
  /pipeline     Python: collectors, scorer, notify (push fan-out), history backfill
  /tests        pipeline test suite (547 tests)
  /app          web frontend — Next.js static export
  /mobile       mobile app — React Native (Expo SDK 56), Expo Router
  /models       trained duration models
  /docs         SPEC.md (full spec), ARCHITECTURE.md, ADRs, schema.sql
  /.github      collect.yml — 10-min collection + weekly retrain
  /.planning    GSD planning: roadmap, requirements, phase plans
```

## Getting started

### Pipeline

```bash
pip install -r requirements.txt
cp .env.example .env          # fill in Supabase/R2/NASA tokens
python -m pipeline.main
python -m pytest tests/ -q    # 547 tests
```

### Web app

```bash
cd app
npm install
npm run dev                   # or: npm run build && npx serve out
npm run lint
```

The web app is a static export — `npm run build` produces `app/out/`, deployable to any static host. `status.json` and `history/` are fetched from the CDN at runtime (override with `NEXT_PUBLIC_STATUS_URL` / `NEXT_PUBLIC_HISTORY_BASE`).

### Mobile app

```bash
cd mobile
npm install
npx expo start                # Expo Go / emulator / dev build
npm test                      # 206 tests (jest-expo)
npx tsc --noEmit
npx expo lint
```

Production builds and store submission go through EAS (`eas build --profile production`). Store submission is pending the Google Play ($25) and Apple Developer ($99/yr) accounts — see `.planning/phases/05-polish-store-submission/05-03-SUMMARY.md` for the human gate checklist.

### Supabase

Create the `outage_reports`, `push_tokens`, and `notification_log` tables by running [`docs/schema.sql`](docs/schema.sql) in the Supabase SQL editor (tables + RLS + functions + trigger). The pipeline reads with the `service_role` key; client apps only ever embed the anon key.

## Testing

| Suite | Command | Count |
|-------|---------|-------|
| Pipeline | `python -m pytest tests/ -q` | 547 |
| Mobile | `cd mobile && npm test` | 206 |
| Web | `cd app && npm run lint` + build | clean |

## Status

All five roadmap phases are code-complete:

1. ✅ Foundation + offline core
2. ✅ Reporting, WhatsApp sharing, battery optimizations
3. ✅ Push notifications (code; on-device UAT pending)
4. ✅ Food spoilage timers
5. ✅ History + return-time estimates (code; store submission human-gated)

Ongoing human items: physical-device UAT (push + food timers), Play/App Store submission, and real CORPOELEC emergency contact numbers.

## Trust

Cocuyo is open source by conviction — surveillance is not the business. No user accounts, no tracking, no data resale. Every line of code is in this repository. Reports are anonymous: location is used only to auto-detect your zone at submit time and is never stored, and nothing identifies the reporter.

## License

Open source public good. A license decision hasn't been made yet — see the maintainer before reusing code commercially.
