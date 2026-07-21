# S08 Synthetic Callback Guardrail Boundary

## Target Contract

- Decision status: the callback behavior and synthetic data boundary are design-reviewed.
- Scaffold Readiness: `Not Ready`.
- Source requirement: `req-s08-callback-guardrail`.
- Root Workflow: `workflow-s08-callback-guardrail`.
- Guarded Tool: `tool-s08-synthetic-operation`, invoked only by the Workflow after an allow decision.
- Runtime contract: `rtc-s08-before-tool-callback`, kind `adk_callback`, status `approved` for design semantics only.
- Reviewed Graph: `graph-s08-callback-guardrail`; `edge-s08-before-tool-callback` preserves callback control instead of lowering it to an ordinary transition.
- Callback scope: runner-wide `before_tool` guardrail for this isolated synthetic runtime.
- Continue semantics: allow returns no override and preserves default Tool execution.
- Override semantics: block, exception, timeout, missing decision, or invalid decision returns a typed blocked result before Tool execution.
- State and audit boundary: write only the synthetic request ID, normalized decision, and reason code to `audit:last_guardrail_decision` and redacted audit evidence. Never persist raw prompts, Tool arguments, or secrets.
- Data boundary: fixed synthetic identifiers and payloads only. No actor data, customer data, private endpoint, credential, deployment, or Catalog write is approved.
- Raw requirement to code: `false`; any future generation must consume the reviewed artifact set.

## Current Implementation

- The generic runnable generator has no lowering implementation for `control.kind: callback` and deliberately fails closed.
- `scaffold-plan.json` therefore keeps the requested `output_mode: runnable` but records `validation.can_generate_source: false` with explicit blockers.
- `af-run-manifest.json` records Analyze and Design complete, Build blocked, and `stub_ready_for_followup: false`.
- No runtime stub, implementation handoff, local prototype, runnable command, or callback support claim is approved by this scenario.

## Stop And Reopen Behavior

- `af-scaffold-runtime` must stop before source generation when it reads the scaffold blocker.
- Do not change the callback edge to `next`, switch to `smoke`, write a custom callback prototype, or alter approvals to force generation.
- Reopen Build only after the generic generator implements and runtime-verifies runner-wide `before_tool` Continue/Override, pre-Tool short-circuit, fail-closed errors, state writes, and redacted audit behavior. Re-derive and review the scaffold plan at that time.
