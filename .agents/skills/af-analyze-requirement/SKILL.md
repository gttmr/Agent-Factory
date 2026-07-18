---
name: af-analyze-requirement
description: Legacy compatibility path for explicit legacy invocations only (the Stage Runner now calls the canonical skill directly); immediately hands off to af-discover-assets.
---

# Legacy Compatibility Shim

This ID is a legacy compatibility path only.
Immediately read `.agents/skills/af-discover-assets/SKILL.md` and follow its procedure; do not rely on `$af-discover-assets` triggering.
In Stage Runner mode, write exactly `runs/analyze/<run-id>/proposed-artifacts/analysis-result.json`, keep it valid under `validateAnalysisResult`, and write no canonical artifact.
Write nowhere else; do not change approvals or stage status and do not add an independent procedure or reference.
Removal condition: follow `docs/migration/skill-vnext-status.md`.
