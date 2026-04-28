# Minimal Input Contract

Sparse first-pass requirements are valid.

Minimum useful shape:

```json
{
  "request_unit": "boundary_request",
  "goal": "Describe the single responsibility or reusable boundary.",
  "module_name": "optional-stable-ascii-id",
  "domain_key": "optional-owner-or-domain",
  "additional_context_paths": []
}
```

Optional fields:

- `agent_name`
- `specialist_role`
- `specialist_input_contract`
- `specialist_output_contract`
- `specialist_parent_context`
- `prior_delta_paths`
- `shared_boundary_catalog_paths`

Older callers may still send `request_unit: "specialist_agent_request"`. Treat it as a legacy alias for `boundary_request` and preserve the original value only as migration evidence.

Do not require reuse or A2A answers in the first input. Those are decisions produced by the skill.
