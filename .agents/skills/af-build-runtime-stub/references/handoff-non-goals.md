# Handoff Non-Goals

`runtime-stub/` is a reviewable handoff surface.

## Required Handoff Invariants

- `raw_requirement_to_code=false`
- no deploy scripts
- no credentials
- no private endpoints
- no real customer data
- no private banking data
- no production business logic
- no claim that the bundle is production-ready

## Smoke Mode

Smoke mode may emit:

- TODO runtime wiring
- synthetic runtime mocks
- deterministic local smoke behavior
- developer TODO boundaries

Smoke mode must not pretend to implement business behavior.

## Runnable Mode

Runnable mode may emit:

- reviewed ADK `Workflow` wiring
- `LlmAgent` nodes from approved modules
- synthetic Mock Lab MCP adapter calls
- contract-backed Remote A2A nodes

Runnable mode still remains generated from approved artifacts only.

## Implementation Handoff

`implementation-handoff.md` should state:

- output mode
- generated files
- TODOs and non-goals
- unverified runtime dependencies
- follow-up work that belongs outside the DLC skill

## Grounding

- `docs/workbench/agent-factory-harness.md`
- `scripts/adk-source/context.mjs`
- `scripts/adk-source/file-builder.mjs`
