---
name: af-verify-feedback
description: Verify Agent Factory artifacts, runtime stubs, schema conformance, and feedback loops. Use when Codex must run validation commands, summarize evidence, produce catalog-delta proposals, record failures, and close the DLC cycle without directly editing catalog runtime contracts.
---

# AF Verify Feedback

## Overview

Use this skill for the fourth DLC stage: artifact/stub verification -> review evidence and feedback.
It closes the loop by proving claims with commands and proposing catalog feedback as a delta, not by silently editing runtime catalogs.

## Required Reading

- Read `../_shared/agent-factory-dlc.md`.
- Read `../_shared/artifact-contracts.md`.
- Read `references/verification-feedback.md`.
- Read repo-root `<repo>/docs/workbench/validation.md` for current verification commands.

## Workflow

1. Load `artifacts/af/<req-id>/af-run-manifest.json` and identify the latest completed stage.
2. Run schema/artifact validation commands that match the changed artifacts. If the user supplies a single fixture file, validate its containing scenario directory; if the user supplies an artifact root, validate that root; if schema/templates changed, validate the relevant parent fixture collections.
3. Run build/typecheck only when TypeScript, React, analyzer, schema, validator, or source-generator logic changed.
4. Verify generated runtime stubs structurally when present.
5. Write `validation-report.md` with exact commands, pass/fail results, and remaining risk.
6. Write `catalog-delta.yaml` only as a proposed change set for reuse, runtime mocks, or contract gaps.
7. Update `af-run-manifest.json` with verification evidence and feedback artifact paths.

## Gate

Do not call work complete without observable verification.
Do not edit `catalog/*.yaml` directly from this skill; catalog changes require a separate approval task.
