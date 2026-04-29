# Agent Factory Taxonomy Audit

## Current Repo Role Conflicts

- `README.md` and `AGENTS.md` described the repository as a public skill-source extract.
- The actual repository also contains `packages/web`, `schemas`, `templates`, and workbench planning docs.
- The workbench package is runnable and uses `tsc --noEmit && vite build`.
- `.agents/skills` exists but was intentionally excluded from this refactor phase.

## Taxonomy Migration Map

| Legacy migration value | New primary category | New subtype |
| --- | --- | --- |
| `tool_adapter` | `adapter` | `legacy_api` or `data_query` |
| `knowledge_retrieval` | `adapter` | `retrieval` |
| `metadata_registry` | `adapter` | `rule_registry` |
| `internal_workflow` | `workflow` | `sequential`, `human_review`, or another workflow kind |
| `specialist_agent` | `agent` | `specialist` |
| `shared_agent` | `agent` | `shared` |
| `remote_a2a_contract` | `remote_a2a` | `a2a` |

## Schema Files To Change

- `schemas/module-candidate.schema.json`
- `schemas/process-flow.schema.json`

## TypeScript Files To Change

- `packages/web/src/analyzer/types.ts`
- `packages/web/src/analyzer/classificationRules.ts`
- `packages/web/src/analyzer/mockAnalyzer.ts`
- `packages/web/src/analyzer/providers.ts`

## UI And Export Files To Change

- `packages/web/src/components/ModuleReview.tsx`
- `packages/web/src/components/ProcessFlowView.tsx`
- `packages/web/src/components/ExportArtifacts.tsx`
- `packages/web/src/App.tsx`
- `packages/web/src/styles.css`

## Build/Test Command

```bash
cd packages/web
npm install
npm run build
```

Additional artifact smoke test:

```bash
node scripts/validate-artifacts.mjs
```

## Risks And Recommended Order

- Update repo role docs before analyzer/UI work so future agents do not treat the repo as only a skill extract.
- Change schemas before TypeScript models.
- Change mock analyzer before UI review/export components.
- Keep Remote A2A guarded; do not infer it from multi-step local workflows.
- Keep `.agents/skills` unchanged until a separate skill-sync branch or proposal step.
