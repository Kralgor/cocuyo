# Roadmap: Cocuyo Mobile

## Overview

Five phases from Expo scaffold to published stores. Phase 1 builds the offline-first foundation that every later feature depends on. Phase 2 adds reporting and Venezuela-specific quick wins. Phase 3 wires push notification infrastructure across the pipeline and app. Phase 4 delivers food spoilage timers — the highest-differentiation feature. Phase 5 ships history/patterns and submits to both stores.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Offline Core** - Expo scaffold, MMKV status cache, trust onboarding, privacy strings
- [x] **Phase 2: Reporting + Sharing + Quick Wins** - GPS report flow, offline queue, WhatsApp sharing, emergency contacts, AMOLED, low-battery mode (completed 2026-06-12)
- [x] **Phase 3: Push Notifications** - Expo push infrastructure, push_tokens table, notify.py pipeline module, NotificationHandler (code-complete 2026-06-13, 6/6 plans; device UAT pending)
- [x] **Phase 4: Food Spoilage Timers** - Pre-built Venezuelan food list, custom items, local notifications, outage auto-start (completed 2026-06-19, 4/4 plans)
- [ ] **Phase 5: Polish + Store Submission** - Outage history, return time estimate, EAS Submit to Google Play and App Store

## Phase Details

### Phase 1: Foundation + Offline Core
**Goal**: Users can open the app, see current outage status for any zone, view it offline with a staleness indicator, and trust the app is not government surveillance
**Depends on**: Nothing (first phase)
**Requirements**: STAT-01, STAT-02, STAT-03, TRST-01, TRST-02, PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. User can open the app on Android and iOS and see real-time outage status for any Venezuelan zone
  2. User can see how long a zone has been without power (outageSince timestamp displayed)
  3. User can view cached status data when offline, with a visible staleness banner if cache is older than 15 minutes
  4. User sees trust onboarding screen on first launch explaining open source status, anonymity, and non-government affiliation
  5. User can access privacy and open-source section in settings with a working GitHub link
**Plans**: 5 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold Expo SDK 56 + config + core lib (api/storage/regions/i18n/theme/query) + test harness [split into 01-01a + 01-01b]
- [x] 01-02-PLAN.md — Theme context, hooks (useStatus/useOffline/useTheme), root layout (Stack.Protected), 5-tab bar + placeholders
- [x] 01-03-PLAN.md — Trust onboarding screen + zone picker (state-grouped, searchable, status dots)
- [x] 01-04-PLAN.md — Zone detail (hero/duration/staleness/signal cards) + settings modal (privacy/GitHub)
- [x] 01-05-PLAN.md — EAS dev builds (Android/iOS) + OTA + on-device verification gate [Android built; iOS deferred — Apple Developer Program]
**UI hint**: yes

### Phase 2: Reporting + Sharing + Quick Wins
**Goal**: Users can submit outage reports (online and offline), share status to WhatsApp, access emergency contacts, and the app conserves battery
**Depends on**: Phase 1
**Requirements**: REPT-01, REPT-02, REPT-03, SHAR-01, BATT-01, BATT-02, BATT-03
**Success Criteria** (what must be TRUE):
  1. User can submit an outage report with zone auto-detected via GPS (within 10 seconds) or manually selected via zone picker
  2. User can submit a report while offline; it is queued locally and synced automatically when connectivity returns
  3. User can share outage status to WhatsApp with one tap, producing pre-formatted Spanish text
  4. User can view emergency contacts (utility company, emergency services) for their selected zone
  5. User can enable AMOLED true-black dark mode, and the app automatically reduces refresh frequency when battery drops below 20%
**Plans**: 7 plans
Plans:
- [x] 02-01-PLAN.md — Foundation: install deps, app.json (anon Supabase + expo-location), storage/i18n/jest mocks, parroquia schema doc + migration checkpoint
- [x] 02-02-PLAN.md — Wave 0: curate parroquias.json (incl. Zulia + DC) + contacts.json; 5 failing unit-test files
- [x] 02-03-PLAN.md — Reporting core: submitReport (anon POST), MMKV offline queue (idempotent + cooldown), GPS nearest-zone detection
- [x] 02-04-PLAN.md — Share lib (composeShareText honesty + WhatsApp/system fallback) + parroquias lookup
- [x] 02-05-PLAN.md — AMOLED theme/context + useBattery + battery-adaptive useStatus + useReportQueue auto-sync
- [x] 02-06-PLAN.md — Report flow UI: Toast + ReportConfirmSheet + full Report tab (GPS/manual, online/offline, cooldown)
- [x] 02-07-PLAN.md — Zone tab: WhatsApp share button, Números útiles contacts card, share prompt, battery banner + Settings AMOLED option
**UI hint**: yes

### Phase 3: Push Notifications
**Goal**: Users receive push notifications for power outages, restorations, and nearby zone warnings in their subscribed zone
**Depends on**: Phase 2
**Requirements**: NOTF-01, NOTF-02, NOTF-04, INFR-01, INFR-02, INFR-03
**Success Criteria** (what must be TRUE):
  1. User receives a push notification when power goes out in their subscribed zone
  2. User receives a push notification when power is restored in their subscribed zone
  3. User receives a push notification when a neighboring zone experiences an outage (early warning)
  4. Pipeline detects status transitions (previous vs current zone status) and fires Expo Push API on changes
  5. Device push tokens with zone subscriptions are stored in Supabase push_tokens table and resolved at notification time
**Plans**: 6 plans
- [ ] 03-01-PLAN.md — Wave 0: failing offline tests for pipeline fan-out and mobile token registration
- [ ] 03-02-PLAN.md — Manual credential gate: Firebase FCM V1 and optional Expo push security
- [ ] 03-03-PLAN.md — Schema and adjacency foundation: push_tokens, notification_log, ADJACENCY_MAP
- [ ] 03-04-PLAN.md — Mobile registration plumbing: expo-notifications, registerToken, storage keys, adjacency mirror
- [ ] 03-05-PLAN.md — Pipeline fan-out: notify.py, cooldown, unstable suppression, Expo batch send
- [ ] 03-06-PLAN.md — Notify tab opt-in UX, permission helper, preferences hook, toggle sync

### Phase 4: Food Spoilage Timers
**Goal**: Users can track food safety during outages using a pre-built Venezuelan food list, custom items, and automatic timer start on outage detection
**Depends on**: Phase 3
**Requirements**: FOOD-01, FOOD-02, FOOD-03, FOOD-04, NOTF-03
**Success Criteria** (what must be TRUE):
  1. User can view a pre-built list of common Venezuelan foods with their spoilage time thresholds
  2. User can add a custom food item with a name and spoilage threshold
  3. Food timers auto-start when an outage is detected in the user's zone (no manual action required)
  4. User receives a local notification when a tracked food item is approaching its spoilage limit
**Plans**: 4 plans
Plans:
- [x] 04-01-PLAN.md — Food domain model + presets + MMKV helpers
- [x] 04-02-PLAN.md — Food timer lifecycle state layer + useFoodTimers
- [x] 04-03-PLAN.md — Spanish-first Food tab UI
- [x] 04-04-PLAN.md — Local food spoilage notifications (+ gate G4: dedicated Android 'food' channel)
**UI hint**: yes

### Phase 5: Polish + Store Submission
**Goal**: Users can see outage history and return time estimates for their zone; the app is published on both Google Play and Apple App Store
**Depends on**: Phase 4
**Requirements**: STAT-04, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. User can view outage history for their zone and see an estimated return time based on past patterns
  2. The app is live on Google Play Store and downloadable on Android devices
  3. The app is live on Apple App Store and downloadable on iOS devices
**Plans**: 3 plans
Plans:
- [ ] 05-01-PLAN.md — react-native-svg install + history fetch lib (fetchRegionHistory, useHistory) + types + Wave 0 tests
- [ ] 05-02-PLAN.md — History tab UI: HistoryStrip + ForecastCurve SVG port, real history.tsx screen (replaces PlaceholderTab)
- [ ] 05-03-PLAN.md — EAS submit profiles (eas.json), app.json metadata, production Android build + Play Console gate, iOS App Store gate
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Offline Core | 6/6 | Complete | 2026-06-10 |
| 2. Reporting + Sharing + Quick Wins | 7/7 | Complete | 2026-06-12 |
| 3. Push Notifications | 6/6 | Code-complete (device UAT pending) | 2026-06-13 |
| 4. Food Spoilage Timers | 4/4 | Code-complete (device UAT pending) | 2026-06-19 |
| 5. Polish + Store Submission | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-25*
*Last updated: 2026-06-23 — corrected stale status table; Phases 1–4 code-complete, Phase 4 gate G4 closed*
