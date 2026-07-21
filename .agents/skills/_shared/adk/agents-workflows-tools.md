# Agents, Workflows, and Tools

## Problem this pattern solves

Choose the smallest ADK execution unit that implements an approved Agent Factory asset or Graph responsibility. Read this card when the base runtime shape is undecided or when generated output must be checked against installed ADK 2.3.0.

## Evidence for use

- An approved Agent has independent reasoning or selection responsibility.
- An approved Workflow owns sequence, branch, parallelism, repetition, pause/resume, or termination across multiple units.
- An approved Tool has a structured callable contract and result/error boundary.
- A Graph Node references one of those assets or owns a Workflow-private function/control step.

Evidence for several Agents is not, by itself, evidence for a Workflow. Evidence for a multi-step Agent is not, by itself, evidence to split that Agent.

## When not to use

- Do not add a Workflow around one sufficient Agent or Tool.
- Do not turn a resource, dependency, protocol, callback, event loop, or Human Input Node into an asset.
- Do not use ADK class names to override Agent Factory Target classification.
- Do not generate runtime code directly from a raw requirement.

## Required questions

- Which approved responsibility requires independent judgment?
- Which component owns deterministic flow?
- Which callable capabilities are independent Tool contracts?
- Is Tool Invocation Control Workflow or Agent?
- Is the Graph static, dynamic, or unnecessary?
- Which inputs, outputs, state, artifacts, side effects, and failure boundaries are approved?

## Agent Factory representation

Use only Agent, Workflow, and Tool as top-level assets. Keep Graph Nodes separate. A Function Node remains Workflow-private; a Function-bound Tool remains a Tool. Invocation Control is Workflow or Agent only.

Follow `_shared/taxonomy.md`, `_shared/graph-ir.md`, and `_shared/target-contract-v2.md` when those decisions are in scope. Use `_shared/runtime-pattern-selection.md` separately when evidence justifies a runtime pattern.

## Compose Artifact

Record:

- approved asset candidates with responsibility, I/O, owner, business scope, and reuse status;
- standalone-versus-Workflow decision;
- Graph nodes/edges or explicit no-Graph decision;
- Workflow representation and coordination rationale;
- Tool Binding, Transport, and Invocation Control;
- missing information, risks, approvals, and pattern-card links.

## Scaffold Output

Installed imports verified by the package check include:

```python
from google.adk.agents import Agent, BaseAgent
from google.adk.workflow import Workflow
```

Installed `Agent` is an alias of `LlmAgent`; this is an ADK implementation fact, not an Agent Factory subtype. The verified Workflow signature is:

```text
Workflow(*, name, description='', rerun_on_resume=True, wait_for_output=False,
         retry_config=None, timeout=None, input_schema=None, output_schema=None,
         state_schema=None, edges=[], max_concurrency=None, graph=None)
```

Use only reviewed fields. The package evidence did not record a general Agent constructor recipe or Function Tool constructor; inspect installed source before emitting exact parameters beyond the verified surface. Let the repository generator own generated Python when a supported lowering exists.

## Verification Scenarios

- Single Agent, no Tool, and no forced Workflow.
- Workflow-controlled Tool call.
- Agent-controlled optional Tool use without a fixed Tool Node in the main flow.
- Function Node versus Function-bound Tool distinction.
- Unsupported or missing approved asset blocks scaffolding.
- Generated import and minimal runtime construction under the installed venv.

## Failure / Retry / Timeout

Assign failure, retry, timeout, and cancellation to the component that owns the execution boundary. Do not place retries around non-idempotent Tools without a duplicate-side-effect contract. Stop if constructor or runtime semantics are unverified.

## Security / Audit

Keep prompts, state, Tool arguments, and outputs within approved data policy. Preserve actor, asset, Tool, side effect, correlation, and outcome in audit evidence. Do not put secrets or private endpoints in generated examples.

## Official sources

- [ADK agents](https://adk.dev/agents/index.md)
- [ADK Agent configuration](https://adk.dev/agents/llm-agents/index.md)
- [ADK workflows](https://adk.dev/workflows/index.md)
- [ADK graphs](https://adk.dev/graphs/index.md)
- Installed signature evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), sections A and E

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK agents, Agent configuration, workflows, and graphs
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: ADK `Agent` aliases `LlmAgent` in the installed package; that alias does not alter the Agent Factory Target responsibility or Invocation Control owner.
