# Cocuyo Mobile

## What This Is

Native Android and iOS apps for Cocuyo, Venezuela's power outage monitoring system. Built with React Native (Expo), the apps read the same `status.json` from CDN and submit reports to the same Supabase backend as the web app — but add push notifications, food spoilage timers, full offline mode, and WhatsApp sharing. Designed for trust: anonymous, open source, no government affiliation.

## Core Value

Venezuelans get instant push notifications when power goes out or comes back in their zone, and can check outage status even without internet.

## Requirements

### Validated

- ✓ Pipeline collects multi-source outage data (crowd, internet, satellite, weather) — existing
- ✓ status.json CDN delivery via Cloudflare R2 — existing
- ✓ Web frontend displays outage status per region — existing
- ✓ Users can submit anonymous outage reports — existing
- ✓ Outage lifecycle tracking (open/close events) — existing
- ✓ Bilingual support (ES/EN) — existing
- ✓ Interactive Leaflet map — existing
- ✓ Outage history data per region — existing

### Active

- [ ] React Native (Expo) app for Android and iOS
- [ ] View real-time outage status per zone (same status.json source)
- [ ] Submit outage reports with GPS auto-detect + manual zone fallback
- [ ] Push notifications: power out in zone, power restored, food spoilage warning, nearby zone outages
- [ ] Food spoilage timers: pre-built Venezuelan food list + user-customizable items
- [ ] Full offline mode: cached status, local timers, queued reports that sync when connectivity returns
- [ ] Trust onboarding screen: open source, not govt, anonymous data, GitHub link
- [ ] Persistent privacy/open-source section in settings
- [ ] WhatsApp sharing: one-tap share outage status ("sin luz hace 3 horas en Maracaibo")
- [ ] Dark mode with AMOLED true black (battery saving during outages)
- [ ] Outage history and patterns per zone ("power usually returns in ~X hours")
- [ ] Emergency contacts section: per-zone utility company and emergency numbers
- [ ] Low battery mode: reduced refresh frequency below 20% battery

### Out of Scope

- Widgets — deferred, not priority for v1
- User accounts / authentication — app is fully anonymous
- In-app chat or social features — Cocuyo is a utility, not a social network
- Paid features / monetization — open source public good
- Apple Watch / Wear OS — mobile first

## Context

Cocuyo already has a working pipeline (Python, GitHub Actions cron every 10 min) and a web frontend (Next.js static export). The mobile app is a new frontend that plugs into the same data architecture: reads `status.json` from CDN, submits reports to Supabase REST API with anon key.

Push notifications are a new infrastructure concern — the pipeline needs to trigger notifications via Firebase Cloud Messaging when outage status changes. This extends the pipeline's responsibility but doesn't break the "no server for reads" architecture.

Venezuela context: unreliable internet, frequent power outages, people rely heavily on WhatsApp, distrust of government surveillance. The app must work offline, conserve battery, and clearly communicate independence from any government.

Leo is the founder, Venezuelan, deep domain expertise. First time building mobile apps — Expo simplifies the build/deploy/OTA-update workflow.

## Constraints

- **Tech stack**: React Native with Expo — shared React/TypeScript knowledge with web app
- **Data contract**: Must read same `status.json` format as web — no custom mobile API
- **Reports**: Must POST to same Supabase `outage_reports` table — no backend changes for submission
- **Privacy**: No user tracking, no analytics that identify individuals, no location storage
- **Keys**: Only `SUPABASE_ANON_KEY` in the app — never service_role key (ADR-007)
- **Push infra**: Firebase Cloud Messaging for Android, APNs via FCM for iOS
- **Deployment**: Expo EAS Build (cloud builds), EAS Submit (store submission), EAS Update (OTA)
- **Store fees**: Google Play $25 one-time, Apple Developer $99/year

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native + Expo over Flutter/native | Shared React/TS knowledge with web app, Expo handles builds/OTA/store submission | — Pending |
| Anonymous, no accounts | Trust signal for Venezuelan users, simpler architecture, matches web app behavior | — Pending |
| FCM for push notifications | Industry standard, works for both platforms via Expo, free tier sufficient | — Pending |
| Food timer auto-start on detected outage | Higher utility than manual-only — users get warned without action | — Pending |
| GPS with manual fallback for reports | Best UX — auto-detect when possible, graceful degradation when GPS denied | — Pending |
| Full offline (status + timers + queued reports) | Venezuelan internet is unreliable — app must be useful without connectivity | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 after initialization*
