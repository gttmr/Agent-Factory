# Stage Runner Analyze Output

Use this reference when a Stage Runner run folder exists.

## Proposed-First Output

Analyze Stage Runner mode writes exactly one proposed file:

```text
<run-dir>/proposed-artifacts/analysis-result.json
```

Do not write canonical artifacts from the run. Canonical files change only after review/diff apply.

## Standalone Canonical Output

When the user supplies an artifact root outside Stage Runner, write canonical:

```text
<artifact-root>/analysis-result.json
```

Split artifacts are derived later by artifact sync. Do not write `scaffold-plan.json` in Analyze.

## Prompt Boundary

Stage Runner prompts already instruct:

- write proposed analysis only
- preserve taxonomy and review gates
- do not write credentials, private endpoints, deployment scripts, or production business logic

## Stop Conditions

- writing `normalized-requirement.json`, `module-candidates.json`, or `process-flow.json` inside a Stage Runner analyze run
- editing `af-run-manifest.json` approvals
- generating runtime source

## Grounding

- `packages/web/server/stageRunner.ts`
- `packages/web/server/artifactSync.ts`
- `docs/workbench/agent-factory-harness.md`
