# Runtime Pattern Selection

## Purpose

Route evidence to the smallest applicable ADK pattern card. Do not load or apply every card by default.

## When to read

Read during discovery when recording runtime hints, during composition when turning evidence into reviewed contracts, and before scaffold or verification chooses pattern-specific checks.

## Decision criteria

Read only the cards justified by current evidence:

| Requirement or design evidence | Pattern candidate | Read |
| --- | --- | --- |
| External event starts execution | ambient entry contract | [ambient-agents.md](adk/ambient-agents.md) |
| Independently owned or deployed Agent service crosses a network boundary | A2A Agent binding/exposure | [a2a.md](adk/a2a.md) |
| Policy or observation must run before/after agent, inference, or Tool execution | callback or Plugin | [callbacks.md](adk/callbacks.md) |
| State or artifact commit timing affects correctness | event loop semantics | [event-loop.md](adk/event-loop.md) |
| External Tool server or protocol discovery is required | Function/MCP Tool binding | [function-and-mcp-tools.md](adk/function-and-mcp-tools.md) |
| Human approval/input pauses and later resumes execution | Human Input and resume | [human-input-and-resume.md](adk/human-input-and-resume.md) |
| Repetition, runtime-selected nodes, or a dynamic shape is required | Graph/dynamic Workflow | [graph-and-dynamic-workflows.md](adk/graph-and-dynamic-workflows.md) |
| Session/user/app/invocation state or named binary output crosses steps | state and artifact channels | [state-and-artifacts.md](adk/state-and-artifacts.md) |

Read [agents-workflows-tools.md](adk/agents-workflows-tools.md) only when choosing the base ADK execution unit or checking an exact installed baseline.

One requirement may justify multiple cards, but each selection needs separate evidence. “Enterprise,” “future-proof,” “several Agents,” or “ADK supports it” is not sufficient.

## Required evidence

For every selected pattern, record:

- requirement quote or approved design fact;
- problem the pattern solves;
- simpler alternative considered and why it is insufficient;
- owner, lifecycle, data, side effect, failure, timeout, retry, and audit boundaries as applicable;
- Compose fields and required contract status;
- scaffold output and verification scenarios;
- installed-package availability for exact APIs.

In discovery, record candidates as hints only. Composition owns the final pattern decision.

## Artifact implications

- Add only pattern-specific contracts and annotations justified by evidence.
- Do not create MCP, A2A, Callback, Event Loop, Ambient Agent, state, artifact, Human Input, or Join as new top-level asset types.
- Keep Invocation Control as Workflow or Agent.
- Route canonical writes through [target-contract-v2.md](target-contract-v2.md).

## Scaffold implications

- Read the chosen card immediately before generation and again before verification if context was compacted.
- Emit only installed and verified APIs.
- Keep unsupported policy as explicit handoff metadata or a Blocker; do not pretend a wrapper was generated.
- Do not scaffold all pattern variants “just in case.”

## Verification

For each selected card, execute its verification scenarios and preserve command/evidence records. Also verify that unselected patterns did not add files, contracts, dependencies, endpoints, or runtime hooks.

## Stop conditions

Stop when evidence is insufficient, the simpler design has not been considered, a required pattern contract is incomplete, exact API availability is unverified, or selecting the pattern would exceed the approved scope.

## Official sources checked

- [Agent Factory Taxonomy](../../../docs/workbench/taxonomy.md)
- [Agent Factory Graph IR](../../../docs/workbench/graph-ir.md)
- [Agent Factory Operating Model](../../../docs/workbench/operating-model.md)
- Pattern-specific Google ADK pages linked from the selected card

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory active docs and selected Google ADK pattern pages
- Installed package version: `google-adk 2.3.0`
- Contract note: Pattern selection is design evidence; unsupported strict v2 patterns remain Blockers.
