---
name: af-analyze-requirement
description: Use when a raw or imported Agent Factory requirement must become schema-first analysis artifacts, including evidence extraction, taxonomy classification, Graph IR draft, missing-information records, and Stage Runner analysis proposals without runtime code.
---

# AF Analyze Requirement

Use this first DLC stage to turn raw or imported requirements into reviewable analysis artifacts. Stage Runner proposed-first mode is primary; standalone canonical mode is secondary. Do not generate runtime source, catalog writes, deployment files, or production business logic.

1. Read `../_shared/workflow-invariants.md` -> identify the artifact root or Stage Runner run context -> verify with `test -d <artifact-root>` -> stop if the target root or run directory is ambiguous.
2. Read `references/stage-runner-analyze-output.md` -> choose proposed-only output or standalone canonical output -> verify with `test -d <run-dir>/proposed-artifacts` -> stop if Stage Runner mode lacks a run folder.
3. Read `references/evidence-and-normalization.md` -> extract factual evidence, assumptions, contradictions, requester/domain hints, inputs, outputs, systems, and requirement-level missing information -> verify with `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' <analysis-result-path>` -> stop if facts and assumptions are mixed.
4. Read `../_shared/taxonomy-boundaries.md` -> classify candidates only as `agent`, `workflow`, `adapter`, or `remote_a2a` with valid subtype fields -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop on invalid category or inferred Remote A2A without contract evidence.
5. Read `../_shared/missing-information-gates.md` -> record requirement-level and candidate-level missing information separately -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop if unresolved candidate missing information is marked approved.
6. Read `references/analysis-result-shape.md` -> write only `analysis-result.json` in the allowed location -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> stop if runtime source, catalog, docs, or approval fields changed.
7. Read `references/graph-ir-draft.md` -> draft process flow and Graph IR only from reviewed evidence -> verify with `node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>` -> gate: no code, no catalog write, no approval toggle.
