# Callbacks and Plugins

## Problem this pattern solves

Observe, validate, mutate, guard, short-circuit, replace, cache, audit, notify, or update state around Agent, inference, and Tool execution without turning cross-cutting policy into a business asset.

## Evidence for use

- A policy must run immediately before or after one execution boundary.
- A cache or guard may intentionally override the default operation.
- Audit or masking needs access to runtime context.
- A consistent guardrail must span multiple Agents or Tools in one Runner.

Prefer a Plugin for Runner-wide security or policy behavior. Use per-Agent callbacks for behavior genuinely owned by one Agent configuration.

## When not to use

- Do not use callbacks as hidden Workflow steps or undocumented business logic.
- Do not register a callback as a Tool unless it is independently callable and reusable.
- Do not use callbacks where an explicit Graph node makes control, approval, or side effects more reviewable.
- Do not mutate state or perform notifications without idempotency and audit decisions.

## Required questions

- Which hook point and scope apply: one Agent or Runner-wide?
- Is the intent observe, validate, mutate, guard, short-circuit, replace, cache, audit, notify, or state-update?
- Which context/state is read or written?
- What does Continue return, and what typed value causes Override?
- What ordering, exception, duplicate-side-effect, privacy, and teardown policy applies?

## Agent Factory representation

Represent a callback as a runtime hook attached to an Agent/Tool execution contract. Represent a shared guardrail as a Plugin candidate. Neither is a top-level asset or Graph Node by default. Invocation Control remains Workflow or Agent.

## Compose Artifact

Record hook point, scope, purpose, input context, state reads/writes, Continue behavior, Override behavior, ordering, side effects, idempotency, exception policy, privacy, audit, and Plugin-versus-callback decision.

## Scaffold Output

Installed per-Agent fields include `before_agent_callback`, `after_agent_callback`, `before_model_callback`, `after_model_callback`, `before_tool_callback`, and `after_tool_callback`; one callback or an ordered list is accepted.

Verified callable shapes are:

- Agent: `(CallbackContext) -> Content | None | Awaitable[...]`
- before inference: `(CallbackContext, LlmRequest) -> LlmResponse | None | Awaitable[...]`
- after inference: `(CallbackContext, LlmResponse) -> LlmResponse | None | Awaitable[...]`
- before Tool: `(BaseTool, dict, ToolContext) -> dict | None | Awaitable[...]`
- after Tool: `(BaseTool, dict, ToolContext, dict) -> dict | None | Awaitable[...]`

`None` continues default behavior; a typed return overrides it. `CallbackContext` and `ToolContext` are aliases for installed `Context`.

Installed `google.adk.plugins` exports `BasePlugin` and `PluginManager`; `BasePlugin(name)` supplies keyword-only Agent/inference/Tool hooks. Official docs register Plugins at Runner scope and run them before object-level callbacks. The package probe also found `on_model_error_callback` and `on_tool_error_callback` fields on `LlmAgent`, while checked official guidance describes error hooks as Plugin capabilities. Prefer Plugin policy and source-test any per-Agent error-hook use.

## Verification Scenarios

- callback absent baseline;
- Continue and each approved Override path;
- state read/write and committed outcome;
- blocked Tool and cached inference response;
- callback/Plugin ordering and Plugin short-circuit;
- callback exception and error-hook fallback;
- duplicate notification or state side effect;
- redaction and audit evidence.

## Failure / Retry / Timeout

Specify whether callback exceptions fail the operation, are converted to a safe override, or are handled by an approved Plugin. Do not retry non-idempotent callback side effects implicitly. Keep callback latency within the wrapped operation's deadline.

## Security / Audit

Prefer Plugins for consistent guardrails. Minimize captured prompt/argument/result data, redact before logging, prevent secret leakage through overrides, and preserve hook, actor, decision, correlation, and outcome.

## Official sources

- [ADK callbacks](https://adk.dev/callbacks/index.md)
- [ADK callback types](https://adk.dev/callbacks/types-of-callbacks/index.md)
- [ADK plugins](https://adk.dev/plugins/index.md)
- Installed signature evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section A

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK callbacks, callback types, and plugins
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Official checked guidance places error hooks on Plugins, while installed `LlmAgent` exposes same-named error callback fields; prefer Plugin scope unless per-Agent behavior is separately verified.
