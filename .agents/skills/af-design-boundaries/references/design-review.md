# Design Review

## Inputs

- `artifacts/af/<req-id>/analysis-result.json`
- `artifacts/af/<req-id>/module-candidates.json`
- `artifacts/af/<req-id>/process-flow.json`
- Catalog files under `catalog/`
- Contract registry files under `catalog/contracts/`

For dry-runs, a single canonical `analysis-result.json` may stand in for the split files. In that case, do not claim stage approval is recorded unless `af-run-manifest.json` also exists.

## Outputs

- Updated `analysis-result.json`
- Updated split artifacts
- `boundary-design.md`
- `commonization-notes.json`
- Optional `a2a-contracts.json` when Remote A2A exists
- Updated `af-run-manifest.json`

## Approval Criteria

- Every approved candidate has the matching subtype field.
- `workflow_kind` is only `orchestration`, `graph`, `dynamic`, or `unknown`.
- Graph IR has no isolated module-bound nodes.
- Required runtime contracts are `approved` before scaffold-plan generation.
- Remote A2A candidates have owner, Agent Card or discovery, auth, lifecycle, timeout, retry, fallback, audit, and data policy.
- Catalog decisions distinguish confirmed reuse from proposed registration.
