# Coding Conventions

**Analysis Date:** 2026-05-24

## Naming Patterns

**Files:**
- Python: `snake_case.py` — all pipeline modules follow this (`collector_cloudflare.py`, `outage_lifecycle.py`, `cross_validation.py`)
- TypeScript components: `PascalCase.tsx` — (`RegionCard.tsx`, `MobileShell.tsx`, `ForecastCurve.tsx`)
- TypeScript utilities/libs: `camelCase.ts` — (`api.ts`, `demoData.ts`, `i18n.ts`, `theme.ts`)
- Test files: `test_<module>.py` — mirror the pipeline module name exactly

**Functions:**
- Python: `snake_case` — `compute_region_score()`, `fetch_traffic_anomalies()`, `detect_outage_from_timeseries()`
- Python private helpers: `_snake_case` prefix — `_headers()`, `_check_ip_rate()`, `_threshold_status()`, `_parse_ts()`
- TypeScript: `camelCase` — `fetchStatus()`, `submitReport()`, `useAutoRefresh()`, `isOutageActive()`
- React hooks: `use` prefix — `useAutoRefresh`, `useApp`, `useRegionHistory`

**Variables:**
- Python: `snake_case` — `crowd_score`, `inet_score`, `baseline_avg`
- TypeScript: `camelCase` — `statusColor`, `effectiveRegionKey`, `timerRef`
- Module-level constants: `_UPPER_SNAKE` for private (`_WEIGHTS`, `_PASSIVE_SIGNALS`, `_RATE_WINDOW_MIN`), `UPPER_SNAKE` for public (`CF_API`, `VE_ASNS`, `TIMEOUT_S`, `BASELINE_RADIANCE`)

**Types / Interfaces:**
- Python dataclasses: `PascalCase` — `RegionScore`, `ValidationResult`, `QuorumResult`, `RegionMeta`
- TypeScript interfaces: `PascalCase` with `I` omitted — `RegionEntry`, `StatusJson`, `OutageInfo`, `RegionSignals`
- TypeScript union types: string literal unions — `'no_power' | 'power_back' | 'unstable'`, `'high' | 'medium' | 'low'`

**Database / API values:**
- Region keys: `lowercase_no_spaces` — `"maracaibo"`, `"ciudad_guayana"`, `"guarenas_guatire"`
- Status values: `snake_case` strings — `"no_power"`, `"power_back"`, `"unstable"`, `"confirmed_outage"`, `"likely_outage"`, `"at_risk"`, `"normal"`, `"no_data"`

## Code Style

**Formatting:**
- Python: no autoformatter configured; code is manually consistent at 4-space indentation
- TypeScript: no Prettier config detected; consistent 2-space indentation throughout `app/`
- Both languages: aligned assignment blocks used in constants for readability:
  ```python
  _WEIGHTS: dict[str, float] = {
      "internet":    0.35,
      "crowdsource": 0.30,
      "satellite":   0.20,
      "weather":     0.15,
  }
  ```

**Linting:**
- TypeScript: `next lint` (ESLint via Next.js defaults); `strict: true` in `app/tsconfig.json`
- Python: no linting tool configured; type hints enforced by convention per CLAUDE.md

**TypeScript strict mode:** All interfaces use explicit types. `any` types are prohibited per CLAUDE.md. Optional fields use `?:` not `| undefined`. Null-or-type expressed as `number | null`, `string | null`.

## Import Organization

**Python — order:**
1. Standard library (`import json`, `import logging`, `import os`, `import sys`)
2. Third-party (`import requests`, `from dataclasses import dataclass`)
3. Internal pipeline modules (`from pipeline.regions import REGIONS`, `from pipeline.scorer import compute_region_score`)

**TypeScript — order:**
1. React/Next.js imports (`import { useState, useEffect } from 'react'`, `import type { NextPage } from 'next'`)
2. Internal lib imports (`from '../lib/api'`, `from '../lib/i18n'`)
3. Component imports (`from '../components/mobile/MobileShell'`)

**Path Aliases:**
- TypeScript: `@/*` maps to `./` in `app/tsconfig.json`, but components use relative paths in practice (`'../lib/api'`, `'../components/Map'`)

**Python test imports:** Test files import from `pipeline.<module>` directly (no relative imports). Module-level constants sometimes re-declared in tests as documentation: `MIN_REPORTS = 3  # cold-start quorum constant — matches module`.

## Error Handling

**Python — collectors:**
Bare `except Exception as exc:` with `logger.warning()` or `logger.error()`, return safe empty fallback. Pattern used in every collector:
```python
except Exception as exc:
    logger.warning("CF traffic_anomalies: %s", exc)
    return []
```

**Python — DB operations:**
`except Exception as exc:` with `logger.error()`, return `0` or `{}` or `False`:
```python
except Exception as exc:
    logger.error("backfill %s failed: %s", region, exc)
    return 0
```

**TypeScript — fetch:**
`try/catch` wrapping `fetch`, return typed `{ data: null, offline: true }` on network failure:
```typescript
catch {
    return { data: null, offline: true };
}
```
`submitReport()` throws on non-OK response: `if (!res.ok) throw new Error(\`HTTP ${res.status}\`)`.

**Rule:** Never return raw API responses — always parse to typed dicts (Python) or typed interfaces (TypeScript). Never let a single collector failure block the main pipeline.

## Logging

**Framework:** Python `logging` module throughout. No `print()` allowed.

**Setup:** `logging.basicConfig(level=logging.INFO, ...)` in `pipeline/main.py`. Each module creates its own logger: `logger = logging.getLogger(__name__)`.

**Patterns:**
- `logger.debug()` for per-cycle computed values: `logger.debug("score=%.3f status=%s signals=%s", ...)`
- `logger.info()` for state transitions: `logger.info("active_outage created: region=%s event=%s", region, event_id)`
- `logger.warning()` for recoverable collector failures: `logger.warning("CF traffic_anomalies: %s", exc)`
- `logger.error()` for DB failures: `logger.error("backfill %s failed: %s", region, exc)`
- Format: `"<context_key>=<value>"` positional args, never f-strings in log calls

**TypeScript:** No logging framework; `console.error` not used in current code — errors are silently swallowed or thrown.

## Comments

**When to Comment:**
- Section dividers use `# ── section name ─────────` (Python) or `// ── section name ─────────` (TypeScript) — consistent pattern across all files
- ADR references inline: `# Normalize by available signal weight — absent ≠ zero (ADR-009)`
- Phase deferral comments: `# Device fingerprint: deferred to Phase 4 per ADR-005`
- Business logic rationale: `# GPS absence lowers trust but never blocks the report (ADR-006).`
- TODO items always include phase and ADR reference

**Module docstrings (Python):**
Every pipeline module has a top-level docstring explaining: what the module does, the algorithm, and what calls it. Example pattern from `pipeline/collector_cloudflare.py`:
```python
"""
Cloudflare Radar traffic collector.

Pulls per-ASN HTTP traffic timeseries and anomaly events for Venezuela.
Detects >60% traffic drops vs rolling baseline — correlates with outages.

Used by collector_internet_unified.py. Never called directly by main.py.
"""
```

**Test file docstrings:**
Each test file has a brief docstring: `"""Tests for pipeline/<module>.py. All offline — no real HTTP."""`

**JSDoc/TSDoc:** Not used. TypeScript interfaces and functions rely on type signatures. Component intent documented via JSDoc comment at top of component files.

## Function Design

**Size:** Functions are small and single-purpose. `compute_region_score()` is 40 lines, `_threshold_status()` is 8 lines. Private helpers extracted for testability.

**Parameters:** Python functions use keyword-only `None` defaults for optional signals: `internet_score: float | None = None`. TypeScript uses optional `?` props. Injected sessions for testability: `_session: requests.Session | None = None`.

**Return Values:**
- Python: typed dataclasses (`RegionScore`, `ValidationResult`, `QuorumResult`) or plain dicts for API payloads
- TypeScript: typed interfaces or union `{ data: T | null; offline: boolean }` — never untyped objects
- Collectors always return empty list/dict on error, never `None` (avoids caller null-checks)

## Module Design

**Python exports:** No explicit `__all__`. Public API is functions and dataclasses with no leading underscore. Private helpers use `_` prefix.

**TypeScript exports:** Named exports for functions and interfaces. `export default` for React components. `export interface` for shared types in `app/lib/api.ts`.

**Barrel Files:** Not used — components are imported directly from their file paths.

**Stateless collectors:** Collectors are pure stateless functions. No class-level state in collectors. `ReportValidator` is the only stateful-looking class, but its `validate()` method is stateless — all state passed as parameters.

**Dataclasses:** Used for all structured return types in Python: `@dataclass` with type hints. `field(default_factory=list)` for mutable defaults.

---

*Convention analysis: 2026-05-24*
