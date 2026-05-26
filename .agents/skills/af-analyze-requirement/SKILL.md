---
name: af-analyze-requirement
description: Convert raw Agent Factory requirements into schema-first reviewed analysis artifacts. Use when Codex must normalize a request, extract evidence, classify first-pass module candidates, draft Graph IR, record missing information, and write artifact files under artifacts/af without generating runtime code.
---

# AF Analyze Requirement

## Overview

Use this skill for the first DLC stage: raw requirement -> reviewed analysis artifacts.
The workbench can later import, visualize, and edit the artifacts, but this skill is responsible for producing the schema-first draft.

## Required Reading

- Read `../_shared/agent-factory-dlc.md`.
- Read `../_shared/artifact-contracts.md`.
- Read `../_shared/boundary-rules.md`.
- Read `references/analysis-artifacts.md`.
- Read repo-root docs only as needed: `<repo>/docs/workbench/analysis-guide.md`, `<repo>/docs/workbench/taxonomy.md`, `<repo>/schemas/analysis-result.schema.json`, `<repo>/schemas/normalized-requirement.schema.json`, `<repo>/schemas/module-candidate.schema.json`, and `<repo>/schemas/process-flow.schema.json`.

## Workflow

1. Resolve `repo_path` to the current Agent Factory repository and choose `artifacts/af/<req-id>/` as the output root.
2. Capture the raw requirement, requester/domain/system hints, explicit constraints, and source paths.
3. Produce factual evidence first. Put guesses in `assumptions`; put blockers in `missing_information`.
4. Classify candidates only with `module_category`: `agent`, `workflow`, `adapter`, or `remote_a2a`.
5. Draft Graph IR using existing schema vocabulary. Model sequence, fan-out/fan-in, loop, route, join, and human input as Graph IR details, not new taxonomy values.
6. Write `analysis-result.json` and convenience split artifacts listed in `../_shared/artifact-contracts.md`.
7. Update `af-run-manifest.json` with stage status, output paths, assumptions, and validation commands to run next.

## Gate

Do not generate runtime code, stubs, catalog edits, or deployment files in this stage.
If the requirement lacks enough information for safe classification, keep the candidate as `needs_info` rather than inventing contract details.
