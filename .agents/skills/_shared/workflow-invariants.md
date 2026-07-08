# Workflow Invariants

These rules apply to every Agent Factory DLC stage.

## Stage Order

| Stage | Consumes | Produces |
| --- | --- | --- |
| Analyze | raw/imported requirement | proposed or canonical `analysis-result.json` |
| Design | reviewed analysis | boundary decisions, Graph IR review, runtime/A2A readiness |
| Build | approved scaffold-plan artifacts | `runtime-stub/` and `implementation-handoff.md` |
| Verify | artifacts or generated handoff | `validation-report.md`, `catalog-delta.yaml` proposals |

Never skip the order: analyze -> design -> build -> verify.

## Hard Invariants

- `raw_requirement_to_code=false`.
- Runtime handoff is generated only from approved workbench artifacts.
- Do not emit deploy scripts, credentials, private endpoints, customer data, private banking data, or production business logic.
- Generated smoke mode is TODO/runtime wiring. Runnable mode is reviewed synthetic ADK workflow wiring only.
- Skills report readiness; they do not toggle manifest approvals or stage statuses directly.

## Primary And Secondary Modes

| Mode | Use | Write discipline |
| --- | --- | --- |
| Stage Runner primary | Workbench run folders exist under an artifact root | write only the allowed `runs/<stage>/<run-id>/proposed-artifacts/*` files |
| Standalone canonical | CLI/import/dry-run work outside Stage Runner | write only canonical artifact files under `artifacts/af/<req-id>/` |

When both modes are possible, prefer Stage Runner proposed-first. Use standalone canonical mode only when the user supplied a non-Stage Runner artifact root or fixture.

## Verification

Run from repo root:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Stop if validation fails or if the target path is ambiguous.

## Grounding

- `docs/workbench/agent-factory-harness.md`
- `packages/web/server/stageRunner.ts`
- `packages/web/server/afArtifactCrudApi.ts`
- `packages/web/src/analyzer/scaffoldPlan.ts`
- `scripts/adk-source/context.mjs`
