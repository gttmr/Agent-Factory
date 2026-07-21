# Agent Factory vNext 통합 산출물 후속 작업 인계 — 2026-07-21

> 결론: 통합 감사에서 새로 연 Blocker `AFV2-031`, `AFV2-032`, `AFV2-033`은 모두 닫혔고 **open Blocker는 0건**이다. 즉시 이어서 처리할 감사 잔여는 `AFV2-014` Moderate partial 한 건이다. Callback·Ambient·Event Loop·dynamic loop 지원과 production hardening은 현재 결함 수정이 아니라 별도 제품·운영 작업이다. 사용자 지시에 따라 Claude Code 재검증은 완료 조건이 아니며 Codex evidence만 사용한다.

## 1. 현재 인계 기준

- Audit baseline: `0cdcb829480def3c0a8ba4afdefb37913721f6d2`
- 게시 브랜치: `agent/vnext-integrated-audit-closure`
- 통합 판정: [vNext 통합 점검 완료 보고](./2026-07-20-vnext-audit.md)
- Blocker 근거: [2026-07-21 Blocker closure](../../.evidence-reviews/vnext-blocker-closure-2026-07-21.md)
- Migration 상태: [Skills vNext](../migration/skill-vnext-status.md), [Taxonomy vNext](../migration/taxonomy-vnext-status.md)
- 현재 지원 범위: local/synthetic runtime과 localhost MCP/A2A peer에서 review-ready. Production readiness 또는 전체 Skills behavior campaign 완료를 뜻하지 않는다.

이 통합 변경은 strict Target Contract v2 전환, canonical five-skill tree, schema·analyzer·Workbench·Catalog·generator 정합화, runtime 검증과 세 Blocker 수정을 한 게시 단위로 묶는다. 다음 작업은 이 PR에 섞지 않고 별도 브랜치와 PR에서 진행한다. PR이 merge되기 전에 후속 작업을 시작해야 하면 이 게시 브랜치를 기준으로 분기하고, merge 뒤에는 최신 `main`으로 rebase하거나 새로 분기한다.

## 2. 완료되어 다시 열 필요가 없는 항목

| 항목 | 현재 판정 | 다시 검증할 조건 |
| --- | --- | --- |
| `AFV2-031` Human Input stable async resume | Fixed | resume contract, generated Runner seam, session-state idempotency 구현을 변경할 때 |
| `AFV2-032` MCP exact allow-list | Fixed | MCP Tool ownership, `McpToolset`, Tool filter 또는 connection lowering을 변경할 때 |
| `AFV2-033` Remote A2A fail-closed | Fixed | A2A event/task terminal 처리, input/auth-required 처리 또는 fallback semantics를 변경할 때 |
| Claude Code forward run | Non-gating | 사용자가 다시 cross-agent compatibility를 범위에 넣을 때만 |

세 Blocker의 closure는 installed Google ADK 2.3.0, generated bundle, 실제 localhost protocol seam과 Codex S11 evidence로 확인했다. 관련 코드를 건드리지 않는 다음 작업에서 전체 runtime probe를 관성적으로 반복할 필요는 없고, 영향받는 경계만 재검증한다.

## 3. 다음 작업 1순위 — `AFV2-014` 닫기

### 남아 있는 반례

Fresh isolated S11 실행은 Product/runtime evaluator 11/11을 통과했지만 agent execution discipline에서 실패했다.

1. 명시적 scaffold 요청인데 `af-scaffold-runtime`보다 `af-workflow`를 먼저 읽었다.
2. agent run이 승인된 `SCENARIO_OUTPUT_ROOT` 밖의 `/tmp/s11_runtime_probe.py`를 transient 파일로 생성했다.
3. `af-scaffold-runtime`이 요구하는 모든 mandatory reference를 끝까지 읽었다는 증거가 보존된 `selected-skills.md`와 command stream에 충분히 남지 않았다.
4. 이 때문에 current S01–S16 전체 campaign의 완료 주장을 복원할 수 없다.

### 권장 구현 순서

1. 현재 S11을 fresh isolated harness에서 그대로 재현하고, skill 선택 순서·reference read·agent write inventory와 evaluator write를 분리해 기록한다.
2. direct stage 요청이 matching Work Skill로 바로 routing되도록 trigger 경계를 좁힌다. `af-workflow`는 lifecycle 전체 또는 현재 단계 판단 요청에만 사용하고 explicit scaffold 요청의 선행 Skill로 로드하지 않는다.
3. agent process의 임시 파일 경로까지 승인 output root 안으로 제한한다. Agent가 만드는 source·probe·cache와 임시 실행 파일은 `SCENARIO_OUTPUT_ROOT` 밖에 남지 않아야 한다. Run 종료 뒤 evaluator가 공식 `tests/skills/evidence/**`에 evidence를 기록하는 작업은 agent write inventory와 구분한다.
4. 선택한 `SKILL.md` 전문과 그 Skill이 필수로 지시한 reference read를 보존된 evidence에서 확인할 수 있게 한다. 단순 최종 답변의 자기 보고만으로 통과시키지 않는다.
5. S11을 먼저 통과시킨 뒤 경계 회귀 가능성이 큰 S07, S16을 재실행한다.
6. 마지막으로 hidden evaluator를 실행 전까지 노출하지 않은 fresh Codex session으로 S01–S16 전체를 실행하고 current campaign 결과를 새 evidence로 기록한다.

### 완료 기준

- Explicit S11 scaffold prompt의 첫 canonical Work Skill이 `af-scaffold-runtime`이며 `af-workflow`를 선행 로드하지 않는다.
- Agent write inventory가 승인된 scenario output root 안에만 존재하고 repo source, source fixture, 일반 `/tmp`에 write가 없다.
- 필수 Skill/reference read가 `selected-skills.md`와 실행 로그에서 검토 가능하다.
- S11의 11개 verification command와 actual ADK runtime probe가 계속 통과한다.
- S07, S11, S16을 포함한 current S01–S16 Codex campaign이 모두 통과한다.
- 각 run은 `environment.md`, `prompt.md`, `selected-skills.md`, `commands.log`, `artifact-tree.txt`, `validation.txt`, `result-summary.md` 일곱 파일을 남긴다.
- `node scripts/validate-skills.mjs`, artifact validator, 영향받은 generator/analyzer test와 build가 통과한다.
- 결과를 `docs/migration/skill-vnext-status.md`, 통합 감사 보고와 새 evidence ledger에 반영한 뒤에만 `AFV2-014`와 current 16-scenario claim을 닫는다.

## 4. 다음 작업 2순위 — production 검증과 hardening

아래는 open audit Blocker가 아니라 production 사용을 주장하려면 새 범위로 정의해야 하는 작업이다. 한 PR로 묶지 말고 운영 경계별로 나눈다.

1. Human Input durable state
   - process-independent session·interrupt·idempotency store
   - process crash, concurrent worker, storage failure와 replay recovery
   - expiry·cancel·conflict의 transaction boundary
2. External MCP/A2A connection
   - 승인된 실제 peer와 production identity
   - secret injection, credential rotation, TLS/mTLS와 network policy
   - timeout, retry budget, peer degradation과 audit logging
3. Deployment and operations
   - deployment target, rollback, quota·cost guard
   - structured observability, trace correlation, alert와 retention
   - production payload privacy와 redaction verification

이 작업은 localhost proof를 production proof로 확대 표기하지 않고, 각각 별도 threat model·failure case·fresh runtime evidence를 가져야 한다.

## 5. 별도 제품 결정이 필요한 unsupported 범위

현재 다음 항목은 의도적으로 design-only 또는 fail-closed다.

- Callback / Plugin runnable lowering
- Ambient runtime
- Event Loop와 dynamic loop
- 명시적 callback/retry/fallback/error/resume/cancel/timeout Graph control Edge
- Remote A2A input/auth-required의 자동 remote resume 또는 자동 fallback 실행

이를 구현하려면 먼저 Target Contract, Graph semantics, ownership, approval, side-effect와 Verify evidence를 별도 설계로 승인해야 한다. 현재 closure PR의 후속 버그 수정으로 간주해 generator에 직접 lowering을 추가하지 않는다.

## 6. 다음 작업의 권장 PR 순서

1. `AFV2-014` harness·routing·write-boundary 보완
2. Codex-only S01–S16 current campaign과 migration status 갱신
3. 선택한 production hardening 항목을 운영 경계별 PR로 분리
4. 제품 우선순위가 승인된 unsupported runtime pattern만 별도 design→implementation PR로 진행

각 PR은 기존 closure evidence를 출발점으로 삼되, 변경한 계약과 runtime seam에 대해서는 fresh evidence를 다시 남긴다. private endpoint, credential value, 실제 고객 데이터는 fixture·로그·evidence·PR 본문에 포함하지 않는다.

## 7. 다음 세션 시작 체크리스트

- [ ] 이 통합 closure PR의 merge 여부와 기준 commit 확인
- [ ] 새 작업 브랜치가 closure 변경을 포함하는지 확인
- [ ] `AFV2-014` 반례를 patch 전에 fresh S11로 재현
- [ ] 수정 파일과 output/write boundary를 먼저 선언
- [ ] S11 → S07/S16 → S01–S16 순서로 검증
- [ ] current evidence와 migration status를 같은 변경 세트에서 갱신
- [ ] unsupported 또는 production 미검증 범위를 완료로 오표기하지 않음
