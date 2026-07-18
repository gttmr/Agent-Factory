---
name: af-verify-feedback
description: Legacy compatibility path for explicit legacy invocations only (the Stage Runner now calls the canonical skill directly); immediately hands off to af-verify-runtime.
---

# Legacy Compatibility Shim

This ID is a legacy compatibility path only.
Immediately read `.agents/skills/af-verify-runtime/SKILL.md` and follow its procedure; do not rely on `$af-verify-runtime` triggering.
In Stage Runner mode, write exactly `runs/verify/<run-id>/proposed-artifacts/validation-report.md` and `catalog-delta.yaml`; current Verify command execution remains server-owned.
Write nowhere else; do not change approvals, stage status, or `catalog/*.yaml`, and do not add an independent procedure or reference.
Removal condition: follow `docs/migration/skill-vnext-status.md`.
