# Feature Landscape

**Domain:** Power outage monitoring / emergency alert mobile app (Venezuela context)
**Researched:** 2026-05-24
**Confidence note:** WebSearch and WebFetch unavailable this session. Findings based on training knowledge of apps in this category (Outage Map, Duke Energy, PG&E, FEMA, Weather Underground, Zello, Waze), Venezuelan-specific constraints from project context, and domain reasoning. Confidence levels reflect this.

---

## Table Stakes

Features users expect from any utility/outage app. Missing = product feels broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Current outage status per zone | Core reason to open the app | Low | Already exists in status.json — mobile is display layer |
| Push notification: power out | Primary value prop of a mobile app over web | Medium | FCM + pipeline trigger required |
| Push notification: power restored | Equally critical — users need to know when to return to normal | Medium | Same infrastructure as above |
| Zone auto-detection (GPS or manual) | Users expect "show me MY area" — hunting for a zone is friction | Medium | GPS permission optional, manual fallback required |
| Offline status display | Venezuela-specific: internet drops with power — app must work anyway | High | Cache last known status.json locally |
| Report submission | Crowd-sourcing is the product's trust foundation | Low | Same Supabase POST as web |
| Outage duration display | "How long has it been?" is the first question everyone asks | Low | Derive from outage_start timestamp in status.json |

**Confidence:** HIGH — These are universal across every outage app in the category. Absence of any one causes immediate user dissatisfaction.

---

## Differentiators

Features not universally expected but that create meaningful competitive advantage in this specific context.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Food spoilage timers (Venezuelan food list) | Unique to Venezuelan context — "cuánto aguanta el pollo?" is a real daily concern | Medium | Pre-built list (pollo, carne, leche, etc.) + custom items |
| Food timer auto-start on detected outage | Reduces user friction to zero — timers start without opening app | High | Requires background task on FCM receive |
| WhatsApp sharing (formatted Spanish text) | WhatsApp is the primary communication channel in Venezuela — sharing outage status is a social norm | Low | Pre-formatted string: "Sin luz hace 3h en Maracaibo" |
| Dark mode / AMOLED true black | Battery conservation during outages when phone may not be chargeable for hours | Low | CSS-trivial in RN; signal of domain understanding |
| Low-battery mode (reduced refresh) | Below 20% battery — app pulls back aggressively | Medium | Battery API + reduced polling interval |
| Outage history + return estimate | "Power usually returns in ~4h" — sets expectations, reduces anxiety | Medium | Requires historical data aggregation in status.json or separate endpoint |
| Emergency contacts per zone (CORPOELEC, etc.) | During outage, users need to call someone — having numbers in-app saves time | Low | Static data, per-region lookup |
| Trust onboarding screen | Venezuela context: extreme distrust of surveillance, government apps | Low | One-time screen with open source, anon, GitHub link |
| Queued reports sync offline | Reports submitted when offline get sent when connectivity returns | Medium | Local queue + sync on reconnect |
| Nearby zone outage notifications | "Your neighbors have power — yours might return soon" or "outage spreading" | Medium | Geofence-adjacent zone logic |

**Confidence:** MEDIUM-HIGH — WhatsApp sharing and food timers are Venezuela-specific differentiators with no direct comparables in US-market apps. Emergency contacts and trust onboarding are well-established patterns in disaster/crisis apps (FEMA app, Red Cross Emergency). Dark mode / AMOLED and low-battery mode are validated by power-outage app reviews where users explicitly mention battery concerns.

---

## Anti-Features

Features to explicitly NOT build. Each has a reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / login | Destroys trust signal in Venezuela — any auth feels like surveillance | Stay anonymous; use device-local preferences |
| In-app social feed / comments | Mission creep; moderation burden; government surveillance risk for users | WhatsApp sharing covers the social use case |
| Paid tiers / subscription | Open source public good — monetization undermines trust and adoption | Keep free; donations link in settings if needed |
| Analytics that identify individuals | Privacy constraint (ADR), legal risk, trust destruction | Aggregate-only: count reports per zone, never device ID |
| Real-time server-side logic for reads | Architecture constraint — "no server handles user read requests" | CDN-only reads via status.json |
| Widgets (home screen) | High complexity for v1; native per-platform implementation; deferred explicitly in PROJECT.md | Post-v1 if adoption justifies |
| Apple Watch / Wear OS | Tiny Venezuelan market, high dev cost, separate SDKs | Mobile first; wearables if demand is proven |
| Outage prediction / ML on device | On-device ML is high complexity; server-side scoring already exists in pipeline | Show pipeline's confidence scores from status.json |
| Chat / community forums | Moderation is a full product; creates surveillance surface | Users already use WhatsApp groups — don't replicate |
| Map with precise user locations | Privacy risk; storing GPS coordinates of outage reporters | Zone-level only; GPS used only to identify zone, never stored |
| Battery percentage display / system info | Goes beyond app scope into system monitoring | Low battery mode handles the battery concern implicitly |

**Confidence:** HIGH for trust/privacy anti-features (Venezuelan context is clear). MEDIUM for scope-creep anti-features (standard product discipline).

---

## Feature Dependencies

```
GPS zone detection → Report submission (GPS auto-fills zone)
GPS zone detection → Zone auto-subscription for push notifications
Push notifications (FCM infra) → Power out notification
Push notifications (FCM infra) → Power restored notification
Push notifications (FCM infra) → Nearby zone notification
Push notifications (FCM infra) → Food spoilage warning notification
Food spoilage timers → Food timer auto-start (auto-start extends timers, not prerequisite)
Offline status cache → Queued reports sync (both require local storage layer)
Outage duration display → Outage history + return estimate (history extends duration display)
Trust onboarding → Settings privacy section (settings is persistent; onboarding is first-run)
Pipeline outage change detection → All push notifications (pipeline must diff status and trigger FCM)
```

---

## Venezuela-Specific Feature Considerations

These features exist in the requirements because of Venezuela's specific context. They may not appear in comparable US/EU apps.

| Feature | Venezuelan Context |
|---------|-------------------|
| Food spoilage timers | Power outages last 4-24+ hours routinely; food loss is a real economic harm |
| AMOLED dark mode | During outages, phones can't charge; OLED pixel-off saves measurable battery |
| Low battery mode | Same reason — power conservation is survival mode, not comfort feature |
| WhatsApp sharing | 90%+ of Venezuelan internet communication happens on WhatsApp |
| Trust onboarding | Government surveillance is not paranoia but documented reality; users need reassurance |
| Queued reports offline | Power outages often correlate with internet loss (CANTV fails with power) |
| Spanish-first UI | ES primary; EN secondary; no other languages needed for v1 |
| Emergency contacts (CORPOELEC) | Venezuela's grid operator is CORPOELEC; per-state contact numbers are practically useful |

**Confidence:** HIGH — Venezuelan context from founder (Leo) who has domain expertise.

---

## MVP Recommendation

**Phase 1 (core utility, must ship):**
1. Current outage status display per zone
2. GPS zone auto-detection + manual fallback
3. Push notifications (power out + power restored)
4. Offline status cache
5. Report submission
6. Trust onboarding screen

**Phase 2 (differentiation, ship before wide promotion):**
1. Food spoilage timers with Venezuelan food list
2. WhatsApp sharing
3. Dark mode / AMOLED true black
4. Emergency contacts per zone
5. Outage duration display
6. Queued reports sync (complete offline story)

**Phase 3 (retention + delight):**
1. Food timer auto-start on FCM receive
2. Low battery mode
3. Outage history + return estimate
4. Nearby zone notifications
5. Persistent privacy section in settings

**Defer explicitly:**
- Widgets: complexity/benefit ratio too high for v1
- Wearables: market size does not justify for v1
- Outage return estimate: requires historical data quality validation before display

---

## Sources

- Project context: `/mnt/c/Users/Leo/claude/cocuyo/.planning/PROJECT.md`
- Training knowledge: FEMA app, Red Cross Emergency app, Duke Energy / PG&E outage apps, Outage Map, Weather Underground, Zello — feature patterns from ~2020-2025
- WebSearch/WebFetch: UNAVAILABLE this session — findings not web-verified
- Confidence note: Table stakes features are HIGH confidence (universal across category). Venezuela-specific differentiators are HIGH confidence (domain expertise in project context). Complexity estimates are MEDIUM confidence (no prototype yet).
