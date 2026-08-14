# Requirements: Cocuyo Mobile

**Defined:** 2026-05-25
**Core Value:** Venezuelans get instant push notifications when power goes out or comes back in their zone, and can check outage status even without internet.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Status Display

- [x] **STAT-01**: User can view real-time outage status for any zone
- [x] **STAT-02**: User can see how long a zone has been without power
- [x] **STAT-03**: User can view cached status data when offline, with visible staleness indicator
- [x] **STAT-04**: User can view outage history for their zone and see estimated return time based on past patterns

### Reporting

- [x] **REPT-01**: User can submit an outage report with their zone auto-detected via GPS
- [x] **REPT-02**: User can manually select their zone if GPS is denied or unavailable
- [x] **REPT-03**: User can submit reports while offline, queued and synced when connectivity returns

### Notifications

- [ ] **NOTF-01**: User receives push notification when power goes out in their zone
- [ ] **NOTF-02**: User receives push notification when power is restored in their zone
- [x] **NOTF-03**: User receives push notification when food items approach spoilage limits
- [ ] **NOTF-04**: User receives push notification when neighboring zones have outages (early warning)

### Food Safety

- [x] **FOOD-01**: User can view pre-built list of common Venezuelan foods with spoilage times
- [x] **FOOD-02**: User can add custom food items with their own spoilage thresholds
- [x] **FOOD-03**: Food timers auto-start when an outage is detected in user's zone
- [x] **FOOD-04**: User receives local notification when a food item is approaching its spoilage limit

### Trust & Privacy

- [x] **TRST-01**: User sees trust onboarding screen on first launch explaining open source status, anonymity, and non-government affiliation
- [x] **TRST-02**: User can access persistent privacy and open-source section in app settings with GitHub link

### Sharing

- [x] **SHAR-01**: User can share outage status to WhatsApp with one tap (pre-formatted Spanish text)

### Battery & Accessibility

- [x] **BATT-01**: User can enable AMOLED true-black dark mode for battery conservation
- [x] **BATT-02**: App automatically reduces refresh frequency when device battery drops below 20%
- [x] **BATT-03**: User can view emergency contacts (utility company, emergency services) for their zone

### Platform

- [ ] **PLAT-01**: App runs on Android (API 24+)
- [ ] **PLAT-02**: App runs on iOS (15+)
- [ ] **PLAT-03**: App supports OTA updates via Expo EAS Update
- [ ] **PLAT-04**: App is published on Google Play Store
- [ ] **PLAT-05**: App is published on Apple App Store

### Infrastructure

- [ ] **INFR-01**: Pipeline sends push notifications via Expo Push Service when zone status changes
- [ ] **INFR-02**: Supabase `push_tokens` table stores device tokens with zone subscriptions
- [ ] **INFR-03**: Pipeline compares previous vs current status to detect transitions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Widgets

- **WIDG-01**: Home screen widget showing zone power status
- **WIDG-02**: Lock screen widget with outage duration

### Wearables

- **WEAR-01**: Apple Watch companion showing zone status
- **WEAR-02**: Wear OS companion showing zone status

### Advanced

- **ADVN-01**: User can view a map of all zones with color-coded outage status
- **ADVN-02**: User can set multiple zones to monitor simultaneously

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | App is fully anonymous — trust signal for Venezuelan users |
| Social feed / community features | Cocuyo is a utility, not a social network |
| In-app chat or forums | Adds complexity, WhatsApp is the social layer |
| Paid features / monetization | Open source public good |
| Individual-identifying analytics | Privacy constraint — no tracking that identifies users |
| Server-side reads / custom API | Breaks static JSON architecture — core design constraint |
| Real-time WebSocket / SSE | Battery drain during outages; polling + push is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAT-01 | Phase 1 | Complete |
| STAT-02 | Phase 1 | Complete |
| STAT-03 | Phase 1 | Complete |
| STAT-04 | Phase 5 | Complete (code) — on-device visual check pending |
| REPT-01 | Phase 2 | Complete |
| REPT-02 | Phase 2 | Complete |
| REPT-03 | Phase 2 | Complete |
| NOTF-01 | Phase 3 | Pending (device UAT) |
| NOTF-02 | Phase 3 | Pending (device UAT) |
| NOTF-03 | Phase 4 | Complete |
| NOTF-04 | Phase 3 | Pending (device UAT) |
| FOOD-01 | Phase 4 | Complete |
| FOOD-02 | Phase 4 | Complete |
| FOOD-03 | Phase 4 | Complete |
| FOOD-04 | Phase 4 | Complete |
| TRST-01 | Phase 1 | Complete |
| TRST-02 | Phase 1 | Complete |
| SHAR-01 | Phase 2 | Complete |
| BATT-01 | Phase 2 | Complete |
| BATT-02 | Phase 2 | Complete |
| BATT-03 | Phase 2 | Complete |
| PLAT-01 | Phase 1 | Pending (Android preview APK built; store build human-gated) |
| PLAT-02 | Phase 1 | Pending (Apple Dev Program blocked) |
| PLAT-03 | Phase 1 | Complete (EAS Update URL configured) |
| PLAT-04 | Phase 5 | Pending (human gate: Play Console) |
| PLAT-05 | Phase 5 | Pending (human gate: Apple Dev Program) |
| INFR-01 | Phase 3 | Pending (device UAT) |
| INFR-02 | Phase 3 | Pending (device UAT) |
| INFR-03 | Phase 3 | Pending (device UAT) |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-25*
*Last updated: 2026-05-25 after roadmap creation — all 29 requirements mapped*
