# Validation Modules (Planned Scaffold)

This directory is intentionally reserved for pluggable account validation contracts.

## Why this exists

- Preserve the intended modular contract architecture.
- Let contributors work on isolated validation modules without changing `account` internals.
- Keep roadmap scope visible in-repo.

## Planned module candidates

- Policy-based session key guards
- Spending/velocity limits
- Destination allow/deny lists
- Time-window execution controls
- Step-up verification gates

## Current status

- Scaffold only (no production contract implementation yet)
- Tracked as planned feature work
