# Scaffold Bridge

The scaffold bridge converts approved Agent Factory artifacts into placeholder implementation shapes. It does not generate runnable business logic.

## Bridge Rule

Raw user requirements must never create code directly. Only approved `scaffold-plan.json` and `implementation-handoff.md` can drive scaffolding.

## Inputs

- `scaffold-plan.json`: approved module list and scaffold output type.
- `implementation-handoff.md`: reviewed rationale, remaining uncertainties, and guardrails.

The bridge must reject direct raw requirement text as an implementation source.

## Behavior By Category

### Agent

- Create an agent shell.
- Include TODO business logic.
- Include eval placeholders.
- Include input and output contracts.

### Workflow

- Create an orchestration shell.
- Represent sequential, parallel, loop, orchestration, and human review behavior explicitly.
- Do not hide business decision logic inside workflow control flow.

### Adapter

- Create an adapter contract or stub.
- Preserve `adapter_kind`.
- Retrieval adapters must include citation, grounding, and source ACL fields.
- Rule registry adapters must include owner, version, effective date, and audit fields.
- Legacy API adapters must include auth, timeout, retry, and side-effect fields.

### Remote A2A

- Create a contract placeholder only.
- Require owner, agent card, auth, task lifecycle, timeout, retry, fallback, and audit details.
- Do not implement remote business logic.

## Review Gate

The bridge can scaffold only modules with approved status in the workbench export. Deferred, rejected, or review-needed modules stay out of scaffold output.
