# ADR-0011: Media and Storage design

- Status: Proposed
- Date: 2026-11-10
- Related: D-15, SR-STO-01…07, T-STO-01…07, R-11, R-28, ADR-0004

## Context
Photos are out of the MVP and the demo (D-15). Storage is still needed later for DSR exports (FS-15, Phase 12),
optional CSV import (FR-04-10) and photos (Phase 11). The bucket model must be fixed early so it cannot drift.

## Decision (proposed)
1. **No Storage use in the demo.** No buckets are created until a module needs them.
2. All buckets private (`public = false`), checked in CI (SR-STO-01).
3. Object path convention: `<organization_id>/<purpose>/<resource_id>/<uuid>.<ext>`; Storage policies on
   `storage.objects` check membership and relationships **from tables**, never the path alone (SR-STO-02).
4. Downloads only via signed URLs issued by an Edge Function after an explicit authorization check, TTL ≤ 5 min,
   never logged (SR-STO-03). Exports deleted after download/24 h (SR-STO-04).
5. Photos (Phase 11): client-side resize, server-side re-encode and EXIF/GPS strip, MIME allow-list, size limits,
   per-child consent check for every tagged child before issuing a URL (SR-STO-07). Separate threat-model update.
6. Supabase Storage first; switching to another S3-compatible EU store is possible because access goes through one
   Edge Function interface.

## Consequences
Signed URLs remain bearer tokens (R-28): mitigated by short TTL and object deletion; accepted residual risk.
