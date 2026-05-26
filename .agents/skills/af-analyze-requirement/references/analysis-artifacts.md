# Analysis Artifacts

Create artifacts directly against repository schemas. Do not treat the workbench UI as the analyzer of record for this stage.

## Inputs

- Raw requirement text or a referenced requirement file.
- Optional requester, domain, target systems, and constraint notes.
- Existing catalog files under `catalog/` when reuse signals matter.
- Existing templates under `templates/` for shape examples, not private runtime behavior.

## Outputs

Write these files under `artifacts/af/<req-id>/`:

- `analysis-result.json`: canonical combined artifact.
- `normalized-requirement.json`: extracted from `analysis-result.normalizedRequirement`.
- `module-candidates.json`: extracted from `analysis-result.moduleCandidates`.
- `process-flow.json`: extracted from `analysis-result.processFlow`.
- `commonization-notes.json`: reuse and registration observations.
- `analysis-summary.md`: concise human review notes.
- `af-run-manifest.json`: updated with stage status and output paths.

## Review Rules

- Requirement-level missing information is a soft gate; record it in evidence.
- Candidate-level missing information is a hard gate; keep that candidate `needs_info`.
- Remote A2A requires independent owner, protocol boundary, auth, task lifecycle, timeout, retry, fallback, audit, and data policy evidence.
- Catalog matches are reuse candidates until a human approves catalog binding.
- Never add private endpoints, credentials, customer data, or deployment scripts.
