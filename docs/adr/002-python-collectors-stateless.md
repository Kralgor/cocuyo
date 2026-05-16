# ADR-002: Collectors are stateless and never raise

## Status: Accepted

## Decision
Every collector function returns a dict. On any failure (timeout,
API error, parse error) it returns {"error": str}. It never raises.

## Rationale
If VIIRS goes down we still want IODA data. If IODA goes down we
still want crowd data. One collector failure must not stop
materialization of status.json.

## Consequences
- main.py must check for "error" key in every collector output
- scorer.py must handle None gracefully for any signal
- Failures are logged not raised