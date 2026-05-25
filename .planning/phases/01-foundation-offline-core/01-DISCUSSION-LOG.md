# Phase 1: Foundation + Offline Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 1-Foundation + Offline Core
**Areas discussed:** App shell & navigation, Styling foundation, Trust onboarding, Zone picker & status cards

---

## App Shell & Navigation

### Navigation scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full tab bar now | Build 5-tab bar matching web app. Non-Phase-1 tabs show placeholder. | ✓ |
| Minimal (status + settings) | Only build what Phase 1 needs. Add tabs later. | |
| You decide | Let Claude pick. | |

**User's choice:** Full tab bar now

### Settings placement

| Option | Description | Selected |
|--------|-------------|----------|
| Header gear icon | Gear icon top-right, opens modal/sheet. Standard mobile pattern. | ✓ |
| Sixth tab | Settings as its own tab in bottom bar. | |
| You decide | Let Claude pick. | |

**User's choice:** Header gear icon

### Tab identity

| Option | Description | Selected |
|--------|-------------|----------|
| Match web app tabs | Same names: Zone/Map/Forecast/Bajones/History. | |
| Adapt for mobile | Rename or reorder for mobile UX. Icons do most communication. | ✓ |
| You decide | Let Claude pick. | |

**User's choice:** Adapt for mobile

### Launch zone persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, persist in MMKV | First launch → zone picker. After that, opens to saved zone. | ✓ |
| Always show zone picker | Every launch starts at zone list. | |
| You decide | Let Claude pick. | |

**User's choice:** Yes, persist in MMKV

---

## Styling Foundation

### Styling approach

| Option | Description | Selected |
|--------|-------------|----------|
| StyleSheet + theme context | Plain RN StyleSheet.create() with ThemeProvider. No dependency risk. | ✓ |
| NativeWind v4 | Tailwind CSS classes in RN. Stability concern flagged. | |
| You decide | Let Claude pick. | |

**User's choice:** StyleSheet + theme context

### Theme identity

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh mobile palette | Colors optimized for mobile (sunlight, AMOLED, battery). Keep brand feel. | ✓ |
| Port tinta/estudio themes | Same two web themes adapted to RN. Brand consistency. | |
| You decide | Let Claude pick. | |

**User's choice:** Fresh mobile palette

### Dark mode timing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 1 light + dark | Build theme toggle now. Phase 2 adds AMOLED variant. | ✓ |
| Phase 1 light only | Less work now, more rework in Phase 2. | |
| You decide | Let Claude pick. | |

**User's choice:** Phase 1 light + dark

### Default theme

| Option | Description | Selected |
|--------|-------------|----------|
| Follow system | Respect OS dark/light preference. Can override in settings. | ✓ |
| Always light, user toggles | Predictable first impression. Manual dark mode. | |

**User's choice:** Follow system

---

## Trust Onboarding

### Format

| Option | Description | Selected |
|--------|-------------|----------|
| Single full-screen | One screen: logo, 4 trust points, GitHub link, Comenzar button. | ✓ |
| 3-slide carousel | Swipeable intro. More polished but more friction. | |
| You decide | Let Claude pick. | |

**User's choice:** Single full-screen

### Accessibility

| Option | Description | Selected |
|--------|-------------|----------|
| Once + settings section | First launch only (MMKV flag). Same content in Settings permanently. | ✓ |
| Show every install/update | Re-show after updates. More exposure, may annoy. | |
| You decide | Let Claude pick. | |

**User's choice:** Once + settings section

### Language default

| Option | Description | Selected |
|--------|-------------|----------|
| Device locale, Spanish fallback | Detect device lang. ES→Spanish, EN→English, else→Spanish. | ✓ |
| Always Spanish first | Primary audience is Venezuelan. English secondary. | |
| Language picker on trust screen | Explicit choice before trust content. Adds friction. | |

**User's choice:** Device locale, Spanish fallback

### Zone selection coupling

| Option | Description | Selected |
|--------|-------------|----------|
| Separate steps | Trust → dismiss → zone picker. Clear separation. | ✓ |
| Combined on trust screen | Trust + zone dropdown together. Fewer screens. | |

**User's choice:** Separate steps

---

## Zone Picker & Status Cards

### Zone picker layout

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by state | Zones under state headers with search bar. Status dots. | ✓ |
| Flat alphabetical list | Simple A-Z scrollable list. No grouping. | |
| You decide | Let Claude pick. | |

**User's choice:** Grouped by state

### Status detail layout

| Option | Description | Selected |
|--------|-------------|----------|
| Hero status + signal breakdown | Big status indicator, duration, then signal cards with bars. | ✓ |
| Simple status only | Zone name, status color/label, duration. No signals. | |
| You decide | Let Claude pick. | |

**User's choice:** Hero status + signal breakdown

### Staleness banner

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible, non-dismissible | Yellow/orange bar when cache >15 min. Critical safety info. | ✓ |
| Dismissible with re-show | User can swipe away. Re-appears later. | |
| You decide | Let Claude pick. | |

**User's choice:** Always visible, non-dismissible

### First-launch empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton loading + zone prompt | Zone picker after trust, skeleton cards while fetching, error message if offline. | |
| Full loading screen | Dedicated splash with spinner. | |
| You decide | Let Claude pick. | ✓ |

**User's choice:** You decide (Claude's discretion)

---

## Claude's Discretion

- **First-launch empty state (D-14):** User deferred to Claude. Recommended: skeleton loading with zone prompt approach.

## Deferred Ideas

None — discussion stayed within phase scope
