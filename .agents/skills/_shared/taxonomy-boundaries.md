# Taxonomy Boundaries

Classify with current Agent Factory taxonomy only.

## Top-Level Categories

| `module_category` | Use when | Required subtype |
| --- | --- | --- |
| `agent` | reasoning, judgment, summarization, classification, recommendation, policy interpretation | `agent_kind` |
| `workflow` | orchestration of known steps | `workflow_kind` |
| `adapter` | callable capability that does not reason independently | `adapter_kind` |
| `remote_a2a` | independent remote agent with protocol-level contract evidence | `remote_contract_kind` |

Allowed `workflow_kind`: `orchestration`, `graph`, `dynamic`, `unknown`.

Allowed `adapter_kind`: `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, `unknown`.

Retrieval, rule registries, tools, MCP access, legacy access, Context Manager, and Callback Broker are not top-level categories.

## Remote A2A High-Friction Gate

Use `remote_a2a` only when evidence exists for:

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

Do not infer Remote A2A from a multi-step workflow, MCP tool, legacy callback, local adapter, or sub-agent.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Stop on an invalid category/subtype, or on a `remote_a2a` candidate without a matching embedded `analysis-result.json.a2aContracts[]` contract.

## Grounding

- `scripts/artifact-validation/constants.mjs`
- `packages/web/src/analyzer/types.ts`
- `scripts/validate-artifacts.mjs`
