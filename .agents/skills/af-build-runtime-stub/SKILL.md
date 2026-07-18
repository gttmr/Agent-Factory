---
name: af-build-runtime-stub
description: Legacy compatibility path for explicit legacy invocations only (the Stage Runner now calls the canonical skill directly); immediately hands off to af-scaffold-runtime.
---

# Legacy Compatibility Shim

This ID is a legacy compatibility path only.
Immediately read `.agents/skills/af-scaffold-runtime/SKILL.md` and follow its procedure; do not rely on `$af-scaffold-runtime` triggering.
In Stage Runner mode, write no proposed artifact: current Build is a server primitive that owns canonical `runtime-stub/`; preserve the canonical Skill's no-write contract.
Write nowhere else; do not change approvals or stage status and do not add an independent procedure or reference.
Removal condition: follow `docs/migration/skill-vnext-status.md`.
