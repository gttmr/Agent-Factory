# Graph IR Reference

## Purpose

Route Workflow execution-structure decisions to the canonical Graph IR without duplicating its node, edge, or control definitions.

## When to read

Read during composition, Graph review, runtime pattern selection, scaffold planning, or interpretation of current `legacy` `processFlow` data.

## Decision criteria

Use [the canonical Graph IR](../../../docs/workbench/graph-ir.md) as the sole Target definition source.

| Decision need | Canonical anchor | Local rule |
| --- | --- | --- |
| Asset versus node | [Catalog assets and Graph nodes](../../../docs/workbench/graph-ir.md#카탈로그catalog-자산과-그래프-노드graph-node) | A node does not create a Catalog asset. |
| Function versus Tool | [Function Node, Tool Node, Function Tool](../../../docs/workbench/graph-ir.md#function-node-tool-node-function-tool-구분) | Preserve ownership and invocation differences. |
| Tool use decision | [Tool Invocation Control](../../../docs/workbench/graph-ir.md#tool-invocation-control) | Use only Workflow or Agent. |
| Human and join control | [Human Input Node](../../../docs/workbench/graph-ir.md#human-input-node), [Join Node](../../../docs/workbench/graph-ir.md#join-node) | Keep pause/resume and fan-in as Graph semantics. |
| Runtime control | [Route, Loop, Callback](../../../docs/workbench/graph-ir.md#route-loop-callback-표현-원칙) | Do not promote control semantics to assets. |
| Current payload | [Current Implementation mapping](../../../docs/workbench/graph-ir.md#current-implementation-대응legacy) | Apply only through the Compatibility Layer. |

Do not copy the canonical node or edge enum into this routing reference. Reopen the linked Current Implementation section when writing a current payload.

## Required evidence

Before approving a Graph, preserve:

- root Workflow or a clear decision that no Workflow is needed;
- node responsibility and referenced asset, if any;
- edge source, target, data or control meaning, and schema/channel key;
- route conditions, defaults, loop bounds, and exit behavior;
- fan-out/fan-in and Join requirements;
- Human Input pause, response mapping, and resume contract;
- Tool Invocation Control as Workflow or Agent;
- A2A boundary evidence and state/artifact channel ownership;
- reachability, terminal path, and unresolved Graph errors.

## Artifact implications

- Discovery may record relationship hints but does not finalize topology.
- Composition owns the reviewed Graph or the standalone-asset decision.
- Current canonical `processFlow` remains a `legacy` serialized field; write it through [compatibility-current-schema.md](compatibility-current-schema.md).
- Keep Target rationale when a current node, edge, or control enum is lossy.

## Scaffold implications

- Lower only reviewed nodes, edges, containers, and contracts.
- Route static and dynamic shapes to the applicable card in [runtime-pattern-selection.md](runtime-pattern-selection.md).
- Let deterministic generators own emitted Python; do not hand-write runtime behavior from requirement prose.
- Reject unsupported node/edge shapes before writing runnable output.

## Verification

- Check reachability, terminal paths, route completeness, fan-in, loop exits, and channel keys.
- Check referenced assets and approved runtime/A2A contracts.
- Run `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` for current payloads.

## Stop conditions

Stop when the Workflow boundary is unresolved, required route/loop/resume evidence is missing, a node is incorrectly treated as an asset, Invocation Control is not Workflow or Agent, or current serialization would conceal a Target design blocker.

## Official sources checked

- [Agent Factory Graph IR](../../../docs/workbench/graph-ir.md)
- [Agent Factory Taxonomy](../../../docs/workbench/taxonomy.md)
- [Google ADK graphs](https://adk.dev/graphs/index.md)

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory Graph IR and Google ADK graphs
- Installed package version: `google-adk 2.3.0`
- Known compatibility note: Current `processFlow` node, edge, container, and call-control enums are `legacy` serialization and do not prove Target Graph IR support.
