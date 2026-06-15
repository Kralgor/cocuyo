# Phase 4: Food Spoilage Timers - Discussion Log

**Audit trail only.** Do not use as input to planning, research, or execution agents. Decisions are captured in CONTEXT.md; this log preserves the alternatives and conversation path.

**Date:** 2026-06-14
**Phase:** 4-Food Spoilage Timers

## Area Selection

Presented gray areas:
- Food Catalog Shape
- Timer Start Behavior
- Power-Restored Behavior
- Warning Thresholds + Notifications
- Custom Food UX

User selection:
- "claude decide, and food keep it with basic groceries"

## Claude's Discretion

Claude/planner is authorized to choose implementation details for:
- Exact basic grocery list
- Default spoilage thresholds
- Warning lead time
- Timer card layout and interaction details
- Local notification scheduling behavior
- Power-restored pause/stop/resume behavior

Constraints captured:
- Keep catalog limited to basic groceries.
- Keep the feature simple and practical for outage conditions.
- Preserve offline/local-first behavior.
- Do not turn this into a full pantry or inventory management system.

## Deferred Ideas

- Rich pantry inventory
- Shopping lists
- Barcode scanning
- Restaurant/business inventory
- Fridge temperature sensor integration
- Medication-specific workflows
- Cloud sync or household sharing

## Reviewed Todos

- "Parroquia-level reporting (hyperlocal)" was reviewed as a weak match and not folded into Phase 4 because it belongs to reporting/scoring scope, not food timers.

## Appendix — 2026-06-15

User selected append mode for the existing Phase 4 context.

### Timer Presets
- Presented: tiny fixed set vs broader grocery list vs Claude decide.
- Decision: Claude decide, constrained to basic groceries and no pantry-management expansion.

### Auto-Start Behavior
- Presented: automatic start vs prompt first.
- Decision: prompt or notify the user when an outage is detected so they can review/confirm food timers.

### Power-Restored Behavior
- Presented: pause, reset, or continue until confirmation.
- Decision: reset timers when power is restored.

### Warning Tone
- Presented: cautious early warning vs hard-limit warning.
- Decision: cautious warnings.

### Offline/Stale Status
- Presented: keep counting from last known outage start vs manual-only.
- Decision: keep counting.
