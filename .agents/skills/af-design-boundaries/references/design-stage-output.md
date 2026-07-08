# Design Stage Output

Write design results according to the active mode.

## Stage Runner Proposed-First Mode

When a run folder is present, write only:

```text
<run-dir>/proposed-artifacts/analysis-result.json
<run-dir>/proposed-artifacts/boundary-design.md
```

Do not edit canonical artifacts or approval gates from the stage run.

## Standalone Canonical Mode

When the user supplied a direct artifact root outside Stage Runner, write only design-owned canonical files:

- `analysis-result.json`
- `boundary-design.md`
- derived split artifacts only when explicitly maintaining a standalone artifact root

Do not write `runtime-stub/`, `catalog/*.yaml`, or deployment files.

## Boundary Design Markdown

`boundary-design.md` should summarize:

- candidate decisions and unresolved gates
- Graph IR changes
- runtime contract readiness
- Remote A2A review result
- catalog reuse/proposal notes
- remaining blockers before Build

## Approval Boundary

The skill reports readiness. Human review endpoints own `manifest.approvals.*` and stage status projection.

## Grounding

- `packages/web/server/stageRunner.ts`
- `packages/web/server/afArtifactCrudApi.ts`
- `packages/web/server/artifactSync.ts`
- `docs/workbench/agent-factory-harness.md`
