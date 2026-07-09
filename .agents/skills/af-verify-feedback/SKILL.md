---
name: af-verify-feedback
description: Use when Agent Factory artifacts, Stage Runner output, generated runtime stubs, validation evidence, or catalog-delta proposals need verification and feedback closure without direct catalog edits.
---

# AF Verify Feedback

Use this fourth DLC stage to prove artifact and handoff claims with observable evidence. Verify may propose reports and catalog deltas; it does not silently edit catalog seed files or claim completion without fresh command output.

1. Read `../_shared/artifact-root-stage-runner.md` -> identify the latest relevant canonical root or Stage Runner run -> verify with `test -f <artifact-root>/af-run-manifest.json` -> stop if no artifact root or completed run exists.
2. Read `references/stage-runner-verify-output.md` -> distinguish Stage Runner proposed files from manual verify command evidence -> verify with `test -f <run-dir>/result-summary.json` -> stop if the chosen run is absent or incomplete.
3. Read `references/validation-allowlist.md` -> choose `validate_artifact_root`, `build_web`, or `test_analyzer`, or the exact manual equivalent -> verify with `node scripts/validate-artifacts.mjs <artifact-root>` -> stop on non-zero exit or if a heavier claim needs an unrun allow-list command.
4. Read `references/runtime-stub-checks.md` -> compile/test generated runtime only when `runtime-stub/` and dependencies exist -> verify with `python3 -m compileall <artifact-root>/runtime-stub` -> mark unverified explicitly if dependencies are missing.
5. Read `../_shared/catalog-feedback.md` -> keep catalog feedback proposal-only and outside `catalog/*.yaml` -> verify with `git diff --name-only -- catalog` -> stop if any catalog seed file changed directly.
6. Read `references/catalog-delta-proposal.md` -> write or inspect only `catalog-delta.yaml` proposals -> verify with `test -f <artifact-root>/catalog-delta.yaml` -> stop if proposals include private endpoints, credentials, or production business logic.
7. Read `references/evidence-report.md` -> record exact commands, outputs, failures, and residual uncertainty in `validation-report.md` -> verify with `test -f <artifact-root>/validation-report.md` -> gate: no complete/fixed/passing claim without observable verification.
