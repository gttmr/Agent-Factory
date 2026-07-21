# Fresh-session Skill routing evidence — 2026-07-20

## Environment

- Repository: `/home/ilmaswsl/work/Agent-Factory`
- Worktree HEAD: `0cdcb829480def3c0a8ba4afdefb37913721f6d2` plus the current audited worktree
- Codex: `codex-cli 0.144.6`, fresh `codex exec --ephemeral`, read-only sandbox
- Claude Code: `2.1.215`, fresh `claude -p --no-session-persistence`, plan permission mode
- Writes by test sessions: none
- Prompt wrapper disclosed only that this was a read-only fresh-session check and requested Skill/gate/first-output reporting. It did not disclose expected Skill names for the six natural-language cases.
- Scope note: Claude Code rows below are earlier audit evidence only. Per user direction, the current completion pass is Codex-only and no additional Claude process was run.

## Natural-language matrix

| Prompt | Codex output | Claude Code output | Result |
| --- | --- | --- | --- |
| 이 요구에서 만들 Agent, Workflow, Tool 후보를 나눠줘. | `af-discover-assets`; Stop because requirement text/mode/root/output path are absent | `af-discover-assets`; same predecessor and Stop | Pass |
| 승인된 후보를 실행 Graph로 연결해줘. | `af-compose-solution`; Stop because reviewed Discover output is absent | `af-compose-solution`; same predecessor and Stop | Pass |
| 승인 설계로 ADK Runtime Scaffold를 만들어줘. | `af-scaffold-runtime`; Stop because approved Compose/readiness/contracts/mode/path are absent | `af-scaffold-runtime`; same predecessor and Stop | Pass |
| 생성된 MCP 연결과 Callback 동작을 검증해줘. | `af-verify-runtime`; Stop because target root/run/revision/environment are absent | `af-verify-runtime`; same predecessor and Stop | Pass |
| 현재 Artifact 상태를 보고 다음 단계를 진행해줘. | `af-workflow`; Stop instead of guessing a root/run | `af-workflow`; same read-only routing decision | Pass |
| README의 오탈자만 수정해줘. | no Agent Factory Skill | no Agent Factory Skill | Pass non-trigger |

All twelve processes exited `0`. No process wrote a repository file.

## Explicit invocation and loader boundary

- Codex explicit `$af-discover-assets`: exit `0`; selected the named Skill and stopped on the missing requirement/mode/output gate.
- Claude Code native `/af-discover-assets`: exit `0` but output `Unknown command: /af-discover-assets`; native `.agents/skills` slash discovery is not supported.
- Claude Code approved test-only explicit load: exit `0`; after being given only `.agents/skills/af-discover-assets/SKILL.md`, applied the correct predecessor gate and Stop condition.
- This is a documented compatibility boundary, not proof of native Claude Skill discovery. Do not claim native slash invocation support.

## Progressive disclosure observations

- Direct stage prompts selected the matching Work Skill rather than `af-workflow`.
- Codex loaded the selected canonical `SKILL.md`; no unrelated runtime-pattern card was needed for the routing decision.
- Claude Code used project guidance/manual read because `.agents/skills` is not an official loader path.
- `_shared` was not selected as a Skill. Deterministic validation exposes exactly five canonical Skills and no retired shim directories.

## Fresh-session defect found and corrected

The first Codex Verify run exposed stale text in `af-verify-runtime`: its SKILL and validation allow-list reference still listed three commands and omitted required `validate_generated_runtime`. The files were synchronized to the four-key server contract before the Claude Code Verify run. `node scripts/validate-skills.mjs` is the post-fix structural check.

## Current isolated Codex scenario reruns

| Scenario | Isolation | Routing | Evaluator commands | Full verdict |
| --- | --- | --- | ---: | --- |
| S11 Human Input / Resume | fresh ephemeral harness; only `prompt.md` and `context/` visible | `af-workflow` then `af-scaffold-runtime` | 9/9 pass | **Fail** — stable approved interrupt ID, timeout/abandoned policy, actual Tool-side at-most-once protection, direct routing, and required reference loading are incomplete |
| S16 canonical-direct | separate fresh ephemeral harness; only `prompt.md` and `context/README.md` visible | direct `af-discover-assets` | 5/5 pass | **Pass** — one Agent candidate, Resource kept non-asset, Missing Information gate, no writes |

Official evidence:

- `tests/skills/evidence/codex/S11-human-input-resume/fresh-20260720T135406Z/`
- `tests/skills/evidence/codex/S16-canonical-direct/fresh-20260720T135900Z/`
- `.evidence-reviews/codex-remaining-verification-2026-07-20.md`

## Residual uncertainty

- Claude Code evidence is non-gating for this completion pass and was not refreshed.
- The six-row matrix tests routing, Stop behavior, and non-trigger behavior. Current S11/S16 add isolated writable/no-write scenario evidence, but S11 remains failed and therefore does not restore a 16/16 current-suite claim.
