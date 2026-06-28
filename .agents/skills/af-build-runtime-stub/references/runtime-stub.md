# Runtime Stub

## Inputs

- `artifacts/af/<req-id>/normalized-requirement.json`
- `artifacts/af/<req-id>/analysis-result.json`
- `artifacts/af/<req-id>/af-run-manifest.json`
- `artifacts/af/<req-id>/process-flow.json`
- `artifacts/af/<req-id>/scaffold-plan.json`
- `artifacts/af/<req-id>/a2a-contracts.json` when Remote A2A exists
- Optional reviewed catalog contract files referenced by the scaffold plan.

`analysis-result.json` is canonical. If split `normalized-requirement.json` or `process-flow.json` is absent, `scripts/generate-adk-source.mjs` hydrates `normalizedRequirement` and `processFlow` from `analysis-result.json`.

## Output Location

Default output:

```text
artifacts/af/<req-id>/runtime-stub/
```

The generated bundle must carry `scaffold-plan.json`, a workflow manifest, generated source, and tests that prove the contract is wired without pretending production business logic exists. Smoke mode keeps TODO/runtime-wiring stubs explicit. Reviewed runnable mode may emit synthetic ADK Workflow wiring for local smoke review.

## Preferred Command

When the required artifacts exist, use:

```bash
node scripts/generate-adk-source.mjs artifacts/af/<req-id> artifacts/af/<req-id>/runtime-stub
```

When the output path is inside the artifact root and `af-run-manifest.json` exists, the command records the build stage outputs and verification commands in the manifest. It does not mark verification as passed; `af-verify-feedback` must record actual command evidence.

Then run structural verification where dependencies are available:

```bash
python3 -m compileall artifacts/af/<req-id>/runtime-stub
```

For runnable bundles, run the generated package tests from inside the runtime-stub root when dependencies are available:

```bash
cd artifacts/af/<req-id>/runtime-stub
python3 -m pytest -q
```

If installing ADK dependencies is required, ask before network or package installation.
