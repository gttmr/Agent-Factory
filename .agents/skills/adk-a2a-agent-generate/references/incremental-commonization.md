# Incremental Commonization

Each run may discover reusable elements.

Classify them as:

- confirmed reuse binding
- proposed shared registration
- update to an existing shared item
- retrofit action for earlier agents
- rejected or deferred reuse

Keep the notes incremental. Do not rewrite the whole architecture for every request.

## Commonization Notes Shape

```json
{
  "current_module": "module-name",
  "reused_boundaries": [],
  "new_boundary_proposals": [],
  "updated_boundaries": [],
  "retrofit_actions": [],
  "a2a_interactions": [],
  "todo": []
}
```

Each boundary entry should include `module_category`. Agent entries may include `agent_kind`; adapter entries should include `adapter_kind`.

## Legacy Mapping

Older notes may contain `current_agent`, `new_shared_agents`, `new_tools`, or `updated_shared_items`. Treat those as legacy aliases during migration:

- `current_agent` -> `current_module`
- `new_shared_agents` -> `new_boundary_proposals` with `module_category: "agent"` and `agent_kind: "shared"`
- `new_tools` -> `new_boundary_proposals` with `module_category: "adapter"` and the best-supported `adapter_kind`
- `updated_shared_items` -> `updated_boundaries`

Do not rewrite the whole catalog when migrating one request. Preserve legacy evidence and add typed fields for new artifacts.
