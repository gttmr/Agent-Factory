---
name: af-design-boundaries
description: Legacy compatibility path for explicit legacy invocations only (the Stage Runner now calls the canonical skill directly); immediately hands off to af-compose-solution.
---

# Legacy Compatibility Shim

This ID is a legacy compatibility path only.
Immediately read `.agents/skills/af-compose-solution/SKILL.md` and follow its procedure; do not rely on `$af-compose-solution` triggering.
In Stage Runner mode, require canonical analysis with `analysis_reviewed=true` and write exactly both `runs/design/<run-id>/proposed-artifacts/analysis-result.json` and `boundary-design.md`.
Write nowhere else; keep JSON valid, do not change approvals or stage status, and do not add an independent procedure or reference.
Removal condition: follow `docs/migration/skill-vnext-status.md`.
