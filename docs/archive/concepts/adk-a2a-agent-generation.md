# ADK A2A Agent Generation

This note captures the design thinking behind the workbench taxonomy and the later scaffold bridge.

## The Problem

Agent projects often over-split early. A multi-step workflow can be mistaken for many remote agents before ownership, contract, and lifecycle boundaries are proven. That adds latency, authentication, failure modes, and operational work.

The workbench uses a narrower default:

- classify reasoning responsibilities as Agent
- classify local control flow as Workflow
- classify callable capabilities as Adapter
- use Remote A2A only when another agent is independently owned, deployed, discovered, and invoked through a remote contract

## Public Technical Basis

Google ADK describes agents as self-contained execution units. It distinguishes LLM agents, workflow agents such as `SequentialAgent`, `ParallelAgent`, and `LoopAgent`, and custom agents built from `BaseAgent`.

A2A describes interoperability between independent agents. The protocol centers on discoverable Agent Cards, JSON-RPC request/response structures, message sending, streaming, task state, artifacts, and security considerations.

The workbench treats these as different design layers:

- ADK decides how an agent is built internally.
- Workflow describes local control flow.
- Adapter describes callable capabilities used by agents or workflows.
- Remote A2A describes independent agent communication across a protocol boundary.

## Decision Model

Use Agent when the requirement has a reasoning responsibility and a clear input/output contract.

Use Workflow when deterministic or semi-deterministic sequencing, fan-out/fan-in, loop, orchestration, or human review is needed inside the local boundary.

Use Adapter when the reusable unit is a callable API, retrieval source, managed rule registry, data query, template, computation, or external service.

Use Remote A2A when the dependency is an independently hosted or independently governed agent and the interaction must cross a remote protocol boundary.

## Why Evidence Comes First

The workbench asks for evidence before classification because sparse requirements are normal. Evidence makes assumptions visible:

- what the user actually asked for
- what each candidate module owns
- what it explicitly does not own
- what reusable boundaries already exist
- what remains speculative

This keeps the handoff honest. The output can be useful even when business logic remains TODO.
