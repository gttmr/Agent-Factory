# Graph and Dynamic Workflows

## Problem this pattern solves

Lower an approved Workflow into a static Graph or a dynamic runtime-selected shape with explicit routes, joins, loop bounds, and resume behavior.

## Evidence for use

- Use a static Graph when nodes and edges are reviewable before execution.
- Use dynamic execution when runtime repetition or node selection cannot be represented safely as a finite static route graph.
- Use Join when fan-in must wait for all required predecessors.
- Use the Human Input card when a node pauses for a response.

## When not to use

- Do not create a Workflow for one sufficient Agent or Tool.
- Do not choose dynamic execution for ordinary conditional routing.
- Do not encode an unbounded loop or recursion without an approved exit and resource bound.
- Do not make router, loop controller, Join, callback, or resume into Catalog assets.
- Do not hand-write ADK graph code from a raw requirement.

## Required questions

- Is a Workflow required, and is its representation static or dynamic?
- Are all nodes reachable from start and able to reach an end or approved pause?
- What are route values, aliases, defaults, and invalid-route behavior?
- Where do fan-out/fan-in and Join occur?
- What bounds, back/exit edges, state, timeout, cancellation, and resume behavior govern loops?
- Which nodes and edges are supported by the current generator?

## Agent Factory representation

Use canonical Graph IR for Agent, Tool, Function, Human Input, Subworkflow, Join, Input, and Output nodes. Represent route and loop through `control`, `channel`, and `regions`. Keep Invocation Control Workflow or Agent.

## Compose Artifact

Record standalone-versus-Workflow decision; representation and coordination; root Workflow; nodes, edges, typed asset references, control, channel, and regions; route/default rules; fan-in; loop bound and exit conditions; channel schemas; Human Input/resume; failure paths; and validation results.

## Scaffold Output

Installed public imports include:

```python
from google.adk.workflow import JoinNode, START, Workflow, node
from google.adk.agents import Context
```

Verified surfaces:

```text
Workflow(*, name, description='', rerun_on_resume=True, wait_for_output=False,
         retry_config=None, timeout=None, input_schema=None, output_schema=None,
         state_schema=None, edges=[], max_concurrency=None, graph=None)
JoinNode(*, name, description='', rerun_on_resume=False, wait_for_output=False,
         retry_config=None, timeout=None, input_schema=None, output_schema=None,
         state_schema=None)
node(node_like=None, *, name=None, rerun_on_resume=None, retry_config=None,
     timeout=None, parallel_worker=False, auth_config=None)
Context.run_node(node, node_input=None, *, use_as_output=False, run_id=None,
                 use_sub_branch=False, override_branch=None,
                 override_isolation_scope=None, raise_on_wait=False)
```

Await `ctx.run_node(...)` directly. Installed runtime enforces `rerun_on_resume=True` on the calling dynamic node.

Preserve valid lowering knowledge from the current generator: static routes use reviewed route dictionaries; explicit or synthesized `JoinNode` handles fan-in; static runnable graphs must be reachable and acyclic; loop/back-edge shapes route to dynamic lowering. Dynamic selection is signaled by an approved dynamic Workflow or dynamic/loop region. A loop region needs a lowerable body, explicit control with back and exit decisions, and a bounded counter. Reverify current generator source before changing these limits.

## Verification Scenarios

- linear static Graph and terminal reachability;
- route value, alias, default, and invalid result;
- fan-out/fan-in with explicit or synthesized Join;
- unreachable node and static cycle rejection;
- bounded dynamic loop, exit, max-iteration failure, and cancellation;
- direct awaited `run_node` and rerun-on-resume enforcement;
- unsupported node/edge rejection before runnable output;
- state/artifact and Human Input integration through their cards.

## Failure / Retry / Timeout

Define node timeout/retry separately from Workflow or loop bounds. Make error, fallback, cancellation, and loop-exhaustion paths explicit. Avoid retrying completed side effects when dynamic nodes rerun on resume.

## Security / Audit

Audit route inputs/results, selected nodes, loop count, exit reason, Tool side effects, pause/resume, and failures without exposing sensitive payloads. Bound concurrency and repetition to prevent resource abuse.

## Official sources

- [ADK workflows](https://adk.dev/workflows/index.md)
- [ADK graphs](https://adk.dev/graphs/index.md)
- [ADK routes](https://adk.dev/graphs/routes/index.md)
- [ADK dynamic workflows](https://adk.dev/graphs/dynamic/index.md)
- Installed signature evidence: [r1-adk-package-check.md](../../../../tests/skills/evidence/research/r1-adk-package-check.md), section E

## Checked date and Package Version

- Checked date: 2026-07-18
- Official sources: ADK workflows, graphs, routes, and dynamic-workflow documentation
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: `ctx.run_node` requires a rerunnable caller, and current generator node/edge limits are Current Implementation constraints that must be reverified before expansion.
