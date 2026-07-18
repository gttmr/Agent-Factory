# A2A

## Problem this pattern solves

Expose or consume an independently owned Agent across a formal network boundary. Treat exposing and consuming as separate designs and tests.

## Evidence for use

Require material boundary evidence such as independent owner, deployment lifecycle, language/framework, network boundary, or formal task contract. Also require Agent Card/discovery, request/message/task semantics, lifecycle, auth, timeout, retry, fallback, audit, and data policy.

## When not to use

- Do not use A2A for internal code organization, helpers, same-process reuse, low-latency calls, or shared in-memory state.
- Do not infer A2A from several Agents or a long Workflow.
- Do not model A2A as a fourth asset type or as an MCP Tool.
- Prefer a local Agent, Function Node, or Tool when no independent service boundary exists.

## Required questions

- Is the task exposing a local Agent, consuming a remote Agent, or both?
- Who owns discovery, version, deployment, and support?
- What Agent Card, auth, request/message/task, streaming, artifact, and long-running semantics apply?
- What timeout, retry, fallback, cancellation, compatibility, and audit policy applies?
- How will local tests simulate Agent Card discovery and task lifecycle?

## Agent Factory representation

Represent an Agent asset plus A2A Binding/Connection for consumption or A2A Exposure for serving. Show a protocol boundary on the Agent Node/edge. Do not create a Remote A2A asset type in Target reasoning.

## Compose Artifact

Record owner, direction, Agent reference, Agent Card/discovery, auth reference, operation and task lifecycle, input/output modes, streaming, artifacts, timeout, retry, fallback, audit, data policy, version compatibility, local mock, and required approvals. Current canonical payloads retain the 1:1 embedded contract through the Compatibility Layer.

## Scaffold Output

Installed consumer imports are module-qualified:

```python
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.a2a.agent import A2aRemoteAgentConfig, RequestInterceptor
from a2a.types import AgentCard
```

`RemoteA2aAgent(name, agent_card, *, description='', httpx_client=None, timeout=600.0, ..., config=None, use_legacy=True, **kwargs)` accepts an `AgentCard`, URL string, or JSON file path. It is not re-exported from `google.adk.agents` in installed 2.3.0. `A2aRemoteAgentConfig` accepts `request_interceptors`; `RequestInterceptor` accepts before/after request hooks.

Installed exposure uses:

```python
from google.adk.a2a.utils.agent_to_a2a import to_a2a
```

`to_a2a(agent, *, host='localhost', port=8000, protocol='http', agent_card=None, ..., runner=None, ...)` returns a Starlette app. The package signature accepts `BaseAgent | Workflow`, but the checked official evidence did not directly establish Workflow exposure as a general Target rule. Do not generalize it without separate approval and official verification. `to_a2a` is not re-exported from `google.adk.a2a.utils`.

Preserve valid current-generator knowledge during review: runnable consumption requires one matching approved embedded A2A contract, an Agent Card URL, and valid runtime policy. The current generator emits `RemoteA2aAgent` with `use_legacy=False`, can add request-interceptor auth for `bearer_env` or `metadata_env` only when the environment name matches `AF_A2A_*`, and leaves retry/fallback as handoff policy rather than emitted wrappers. Reverify the generator before changing those limits.

## Verification Scenarios

- Agent Card discovery and version compatibility;
- exposing and consuming tested separately;
- successful message/task and terminal lifecycle;
- streaming and artifact handling when approved;
- auth missing/invalid, timeout, remote failure, cancellation, retry, and fallback;
- local mock server and audit correlation;
- contract-to-Agent 1:1 validation in current artifacts.

## Failure / Retry / Timeout

Define remote timeout and task deadline separately. Retry only eligible operations; preserve task identity and duplicate-side-effect rules. Make fallback observable and never silently replace remote judgment with a local path.

## Security / Audit

Use least-privilege auth references, approved data modes, outbound allow-lists, sanitized Agent Cards, and correlation across local invocation and remote task. Never persist runtime task IDs in analysis, Graph, scaffold plan, Catalog, or generated source.

## Official sources

- [ADK A2A](https://adk.dev/a2a/index.md)
- [ADK consuming A2A](https://adk.dev/a2a/quickstart-consuming/index.md)
- [ADK exposing A2A](https://adk.dev/a2a/quickstart-exposing/index.md)
- Installed signature evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section C

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK A2A overview, consuming, and exposing guides
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: A2A is documented as experimental; installed `to_a2a` accepts Workflow, but checked official evidence did not justify making Workflow exposure a general Agent Factory rule.
