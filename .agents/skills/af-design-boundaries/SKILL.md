---
name: af-design-boundaries
description: Use when Agent Factory analysis artifacts need module approval decisions, Graph IR review, runtime/A2A contract readiness, missing-information closure, or Stage Runner design proposals before Runtime Handoff.
---

# AF Design Boundaries

Use this second DLC stage after analysis exists and before Runtime Handoff. Stage Runner proposed-first mode writes only design proposals; standalone canonical mode is secondary. The skill may report approval readiness, but it never toggles manifest approvals or stage statuses.

1. Read `../_shared/artifact-root-stage-runner.md` -> determine Stage Runner proposed-output mode or standalone canonical mode -> verify with `test -f <artifact-root>/af-run-manifest.json` -> stop if canonical design lacks a reviewed analysis artifact.
2. Read `references/module-approval-rubric.md` -> approve, defer, or reject module candidates using existing taxonomy fields -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop on invalid category, subtype, owner, I/O, or risk fields.
3. Read `../_shared/missing-information-gates.md` -> close or preserve candidate missing-information gates -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop before scaffold/build if approved candidates still have unresolved `missing_information`.
4. Read `references/runtime-contract-review.md` -> review required `runtimeContracts` and runtime support decisions -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop if required runtime contracts remain unapproved or incoherent.
5. Read `references/remote-a2a-review.md` -> review Remote A2A candidates and embedded `a2aContracts` -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop if high-friction fields or 1:1 contract pairing are missing.
6. Read `references/graph-ir-review.md` -> review nodes, edges, route, state, artifact, human input, dynamic, callback, and remote edges -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop on Graph IR validation errors.
7. Read `references/design-stage-output.md` -> emit only allowed Stage Runner proposal files or standalone canonical design edits -> verify with `find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print` -> gate: do not write `catalog/*.yaml`, do not toggle approval booleans, and do not generate runtime source.
