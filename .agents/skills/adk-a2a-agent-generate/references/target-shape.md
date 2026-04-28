# Target Shape

Default agent scaffold shape:

```text
agents/<agent_name>/
  agent.py
  README.md
  tests/
```

Recommended `agent.py` responsibilities:

- expose one top-level ADK agent object
- keep the external contract narrow
- wrap deterministic integrations as tools
- place internal workflow composition behind the same boundary
- leave TODO business logic explicit

Adapter scaffold notes:

- keep deterministic integrations, retrieval, rule registries, data queries, templates, computations, and external services outside agent ownership when they do not reason independently
- record `adapter_kind` as `legacy_api`, `retrieval`, `rule_registry`, `data_query`, `template`, `computation`, `external_service`, or `unknown`
- expose a narrow contract that agents or workflows can reuse

Workflow scaffold notes:

- keep deterministic sequence, parallel fan-out/fan-in, and bounded loops inside one runtime unless evidence requires a remote boundary
- record whether the workflow is the selected `module_category` or only `internal_workflow` inside an agent

When A2A is required, add a protocol note or adapter file that describes the remote agent interaction. Do not fake a working remote call without configuration.
