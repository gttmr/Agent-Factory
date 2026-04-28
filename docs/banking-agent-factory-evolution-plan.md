# Agent Factory Evolution Plan

This repository keeps examples generic and does not include private banking data, credentials, endpoints, or deployment scripts.

## Direction

Agent Factory evolves from a requirement intake workbench into a review-gated scaffold bridge.

The taxonomy is:

- Agent
- Workflow
- Adapter
- Remote A2A

Retrieval and managed rule registries are Adapter subtypes. Remote A2A remains a separate independent remote agent contract boundary.

## Guardrails

- Raw requirements do not produce code.
- Approved artifacts drive any future scaffold bridge.
- Adapter scaffolds are contracts or stubs only.
- Agent scaffolds are shells with TODO business logic and eval placeholders.
- Workflow scaffolds are orchestration shells.
- Remote A2A scaffolds are contract placeholders only.
