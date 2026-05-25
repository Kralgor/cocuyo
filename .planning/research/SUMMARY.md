# Research Summary: Cocuyo Mobile

**Date:** 2026-05-25
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall Confidence:** MEDIUM

## Executive Summary

Cocuyo Mobile is an offline-first emergency alert app solving a domain-specific problem: Venezuelan power outages last hours to days, internet drops simultaneously, and users cannot charge phones during outages. Every architecture and feature decision flows from these three constraints.

The recommended approach is Expo SDK 52 + Expo Router on the native side, with the existing static JSON / CDN / Supabase architecture unchanged — the mobile app is a display and reporting layer, not a new backend. Push notifications (via Expo Push Service), MMKV for offline persistence, and React Query for CDN cache management are the three load-bearing technical choices.

The highest-value differentiators — food spoilage timers, WhatsApp sharing, AMOLED true-black dark mode, and low-battery mode — are all Venezuela-specific features absent from US/EU utility apps. Trust onboarding (open source, no accounts, GitHub link) is a prerequisite for adoption given Venezuela's surveillance context.

## Stack Recommendation

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Expo SDK 52 + Expo Router 4 | File-based routing (same model as Next.js), EAS Build eliminates Mac requirement |
| Storage | MMKV 2.x | Synchronous reads, 30x faster than AsyncStorage, C++ native |
| Data Fetching | React Query 5.x + MMKV persister | Stale-while-revalidate, offline disk cache |
| Push | expo-notifications | One module for local timers AND remote FCM/APNs push |
| State | Zustand 4.x | Cross-cutting state without provider boilerplate |
| Styling | NativeWind 4.x | Tailwind CSS, AMOLED dark via `dark:bg-black` |
| Maps | react-native-maps | Only mature option in RN ecosystem |
| Backend | Supabase JS v2 + MMKV adapter | Anonymous report submission only (no auth) |
| Push Relay | Expo Push Service | One token/endpoint for both platforms |

## Feature Prioritization

**Table Stakes (must ship):**
- Current outage status per zone
- Push notifications (power out + restored)
- GPS zone auto-detect + manual fallback
- Offline status cache with visible staleness indicator
- Report submission
- Trust onboarding (open source, anonymous, not govt)

**Differentiators (competitive moat):**
- Food spoilage timers (Venezuelan food list + customizable)
- WhatsApp sharing (pre-formatted Spanish text)
- AMOLED true-black dark mode
- Emergency contacts per zone
- Queued offline reports with sync
- Food timer auto-start on outage detection
- Nearby zone early warning notifications
- Outage history + return time estimate
- Low battery mode

**Anti-features (never build):**
- User accounts, social feed, paid tiers
- Individual-identifying analytics
- Server-side reads (breaks static JSON architecture)
- Widgets/wearables (v1)

## Architecture Highlights

- Pipeline gains one new module: `pipeline/notify.py` — diffs previous vs current status, fires Expo Push API on zone transitions
- One new Supabase table: `push_tokens` (token → zone_subscriptions array, GIN index)
- Mobile app is additive — existing architecture unchanged
- Component dependency chain: StatusCache → StatusSyncService → ReportQueue → PushTokenService → NotificationHandler → FoodTimerStore
- Store `outageSince` ISO timestamp, never "time remaining" — JS timers drift when backgrounded

## Critical Pitfalls

1. **Push permission iOS permanent denial** — gate behind value-proposition screen; never prompt on mount
2. **Expo Go vs production notification divergence** — test only with EAS dev build on real device
3. **Stale offline cache without indicator** — always show `generated_at` timestamp; banner if >15 min old
4. **GPS blocking report submission** — GPS optional always; 10s timeout; immediate fallback to zone picker
5. **Background notification absent** — `TaskManager.defineTask` for background task; test killed-state device
6. **OEM battery killers (Xiaomi/Huawei)** — silent push delivery failure; onboarding education needed
7. **App Store rejection** — privacy strings in `app.json` from Phase 1; 2-4 week review buffer

## Suggested Phase Structure

| Phase | Focus | Rationale |
|-------|-------|-----------|
| 1 | Foundation + Offline Core | MMKV/StatusCache/trust onboarding — offline-first cannot be retrofitted |
| 2 | Reports + Zone Selection + Quick Wins | GPS report flow, offline queue, WhatsApp sharing, emergency contacts |
| 3 | Push Notifications | push_tokens schema, notify.py, NotificationHandler — requires EAS dev build |
| 4 | Food Spoilage Timers | FoodTimerStore, local notifications, auto-start via background task |
| 5 | Polish + Store Submission | History, nearby-zone alerts, return estimate, EAS Submit to both stores |

**Phase ordering is forced by dependencies:** MMKV before all features, zone selection before push subscriptions, push infrastructure before timer auto-start, store submission last.

## Research Flags for Planning

| Phase | Research Needed? | Why |
|-------|-----------------|-----|
| 1 | Skip | MMKV, React Query, Zustand — stable, well-documented |
| 2 | Skip | GPS permission, offline queue — established RN patterns |
| 3 | Yes | Expo Push Token receipt polling, background-fetch iOS, breaking changes |
| 4 | Skip | expo-notifications local scheduling — standard Expo patterns |
| 5 | Yes | Google Play Data Safety form, Apple guidelines, POST_NOTIFICATIONS |

## Open Questions

- Expo SDK version at project start (may be 53) — verify before scaffolding
- NativeWind v4 stability with current SDK — fallback is StyleSheet + manual dark-mode context
- push_tokens RLS policy — evaluate tighter policy than `UPDATE USING (true)`
- Historical outage data availability for return time estimate — validate before scheduling Phase 5 history UI
- CORPOELEC emergency contacts — manual research needed for per-state numbers

---
*Synthesized: 2026-05-25*
