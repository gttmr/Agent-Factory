# Remote A2A Review

Remote A2A is a high-friction boundary and must be explicit.

## Candidate Evidence

Do not approve `module_category: "remote_a2a"` unless the candidate records:

- independent owner
- Agent Card or discovery method
- request and response shape
- task lifecycle
- auth
- timeout
- retry
- fallback
- audit
- data policy

Do not infer Remote A2A from local sub-agents, MCP tools, legacy callbacks, or multi-step workflows.

## Contract Shape

Canonical contracts live in `analysis-result.json.a2aContracts[]`.

Each remote candidate needs exactly one matching contract:

- candidate `a2a_contract_id`
- contract `contract_id`
- contract `remote_module_id`

Do not rely on split `a2a-contracts.json` as the standard source.

## Runtime Policy

Review `adk_runtime_policy`:

- `timeout_seconds` is positive number or null
- auth mode is `none`, `bearer_env`, or `metadata_env`
- env-based auth uses an `AF_A2A_*` env var
- retry and fallback are recorded as handoff policy until runtime wrapper support exists

## Stop Conditions

- missing Agent Card URL for runnable Remote A2A
- unapproved contract
- invalid auth env var
- retry/fallback described as implemented when it is only a handoff policy

## Grounding

- `scripts/adk-source/remote-a2a.mjs`
- `scripts/validate-artifacts.mjs`
- `scripts/artifact-validation/constants.mjs`
- `packages/web/src/analyzer/types.ts`
- `https://adk.dev/a2a/quickstart-consuming/ (captured 2026-07-08)`
