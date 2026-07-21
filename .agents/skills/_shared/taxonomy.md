# Taxonomy Reference

## Purpose

Route classification decisions to the canonical Agent Factory Taxonomy without duplicating its definitions.

## When to read

Read when discovering or reviewing assets, separating assets from resources and dependencies, assigning business scope or ownership, or evaluating reuse.

## Decision criteria

Use [the canonical Taxonomy](../../../docs/workbench/taxonomy.md) as the sole definition source.

| Decision need | Canonical anchor | Local rule |
| --- | --- | --- |
| Asset boundary | [Top-level assets](../../../docs/workbench/taxonomy.md#최상위-자산) | Use only Agent, Workflow, or Tool. |
| Non-assets | [Not assets](../../../docs/workbench/taxonomy.md#자산이-아닌-것) | Keep resources, dependencies, protocols, and Graph controls outside the asset enum. |
| Tool use decision | [Invocation Control](../../../docs/workbench/taxonomy.md#invocation-control) | Use only Workflow or Agent. |
| Connection axes | [Binding, Transport, Backend](../../../docs/workbench/taxonomy.md#binding-transport-backend-분리) | Do not create protocol-based asset types. |
| Context and reuse | [Business Context](../../../docs/workbench/taxonomy.md#business-context와-ownership), [Reuse Governance](../../../docs/workbench/taxonomy.md#reuse-governance) | Keep domain, owner, and reuse status independent. |
| Strict v2 payload | [Target Contract v2](target-contract-v2.md) | Write only Target fields and Agent/Workflow/Tool assets. |

Do not reproduce canonical enum or subtype definitions in a skill reference. Reopen the linked section when exact values matter.

## Required evidence

For each candidate, preserve:

- quoted or locatable requirement evidence;
- independent reasoning, flow-control, or callable-contract responsibility;
- input/output and side-effect boundary;
- resource/dependency distinction;
- domain scope, business domains, owner, and reuse status as separate decisions;
- missing information and an explicit rationale for the chosen asset class.

## Artifact implications

- Standalone design notes may use Target fields and vocabulary.
- New `analysis-result.json` writes must include strict Target v2 fields from [target-contract-v2.md](target-contract-v2.md).
- Preserve classification as structured fields; rationale explains evidence rather than carrying a hidden classification.
- Do not convert a Resource or Dependency into a Tool without callable-contract evidence.

## Scaffold implications

- Scaffold only approved assets and approved connection contracts.
- Keep Function Node, Tool Node, and Function-bound Tool distinct by following `_shared/graph-ir.md` when Graph classification is in scope.
- Runtime patterns such as MCP, A2A, callbacks, ambient entry, and event-loop behavior do not create new asset classes.

## Verification

- Confirm every top-level candidate is Agent, Workflow, or Tool in Target reasoning.
- Confirm Invocation Control is Workflow or Agent only.
- Confirm resources and dependencies were not promoted to assets.
- Validate strict v2 payloads with `node scripts/validate-artifacts.mjs <path>`.

## Stop conditions

Stop when responsibility evidence is insufficient, a resource/dependency is being forced into an asset class, domain and owner are conflated, or Target intent cannot be represented safely in strict v2.

## Official sources checked

- [Agent Factory Taxonomy](../../../docs/workbench/taxonomy.md)
- [Agent Factory Graph IR](../../../docs/workbench/graph-ir.md)
- [Google ADK agents](https://adk.dev/agents/index.md)
- [Google ADK workflows](https://adk.dev/workflows/index.md)

## Checked date

- Checked date: 2026-07-18
- Official sources: Agent Factory Taxonomy and linked ADK official pages
- Installed package version: `google-adk 2.3.0`
- Contract note: Strict v2 uses Agent, Workflow, and Tool as its only asset types.
