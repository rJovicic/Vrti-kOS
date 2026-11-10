# ADR-0013: Backup and restore

- Status: Proposed — **requires owner approval** (paid add-on for production)
- Date: 2026-11-10
- Related: ADR-0003, R-22, Q-S03, SR-LOG-03, incident-response-plan P-08, §8

## Context
Loss or corruption of children's records must be recoverable; restoring must not overwrite evidence or production blindly.

## Decision (proposed)
| Environment | Backup | Restore |
|---|---|---|
| Local/demo | none needed — `pnpm db:reset` recreates the synthetic state | n/a |
| Staging | provider daily backups | restore drills performed here first |
| Production | provider daily backups **plus point-in-time recovery** (paid add-on), target RPO ≤ 15 min, RTO ≤ 8 h (Q-S03 proposal) | always restore into a **separate** project, verify, then controlled cut-over or selective re-import (IRP §8) |

Additional controls: quarterly restore drill with synthetic data (P13-2); migration discipline (no manual prod DDL,
SR-OPS-01); backups inherit retention questions (Q-P09, DI-27) — deletion requests do not immediately purge backups;
the retention policy must state the backup window ⚖️.

## Consequences
Restore procedure is documented before pilot; PITR cost accepted only with D-3.
