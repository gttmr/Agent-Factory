# Verification Feedback

## Standard Commands

Run from the repository root when artifacts exist:

```bash
node scripts/validate-artifacts.mjs artifacts/af/<req-id>
```

When the input is a single `analysis-result.json` fixture, run validation against its containing directory. When the input is one regression scenario, run that scenario directory first; run all `templates/regression-scenarios` when shared schema, validator, or template expectations changed.

Run template and fixture validation when schemas, validator logic, or templates changed:

```bash
node scripts/validate-artifacts.mjs templates
node scripts/validate-artifacts.mjs templates/regression-scenarios
node scripts/validate-artifacts.mjs templates/saved-analysis-fixtures
node scripts/validate-artifacts.mjs catalog/contracts
```

Run web build when TypeScript, React, analyzer, schema wiring, validator, or generator behavior changed:

```bash
cd packages/web
npm run test:analyzer
npm run build
```

## Feedback Outputs

- `validation-report.md`: command evidence, result, failures, and residual risk.
- `catalog-delta.yaml`: proposed reuse/catalog changes only.
- Updated `af-run-manifest.json`: verification status and evidence references.

## Failure Handling

- Stop on schema mismatch and identify the exact artifact path.
- Distinguish missing information from implementation failure.
- Do not stack fixes without a root-cause statement.
- If network, package install, or host process access is required, request approval before rerunning outside the sandbox.
