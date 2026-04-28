# Artifact Validation

Exported Agent Factory artifacts must be validated before they are used for implementation planning or scaffolding.

## Required Checks

For `module-candidates.json`:

- `module_category` must be one of `agent`, `workflow`, `adapter`, or `remote_a2a`.
- Adapter modules must include `adapter_kind`.
- Agent modules must include `agent_kind`.
- Workflow modules must include `workflow_kind`.
- Remote A2A modules must include `remote_contract_kind`.
- `legacy_recommended_type` is migration metadata only and must not be used as the primary classifier.
- Remote A2A modules are high-friction. Incomplete remote contract placeholders must call out missing owner, agent card, auth, task lifecycle, timeout, retry, fallback, and audit fields before implementation.

For `scaffold-plan.json`:

- The source must be an approved workbench artifact.
- Raw requirements must not drive code generation directly.
- Adapter modules produce contracts or stubs only.
- Agent modules produce agent shells only.
- Workflow modules produce orchestration shells only.
- Remote A2A modules produce contract placeholders only.
- Runnable business logic is out of scope.

## Lightweight Validator

Run the local validator against a directory containing exported artifacts:

```bash
node scripts/validate-artifacts.mjs path/to/exported-artifacts
```

If no directory is provided, the script checks `templates/` as a smoke test:

```bash
node scripts/validate-artifacts.mjs
```

The validator is intentionally lightweight and dependency-free. It checks the taxonomy contract, subtype presence, Remote A2A friction, and the scaffold guard that raw requirements cannot generate code directly.
