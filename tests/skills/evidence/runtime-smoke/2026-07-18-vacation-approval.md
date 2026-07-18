# Runtime smoke — req-vacation-approval (2026-07-18)

- 대상: 승인 완료 루트 `artifacts/af/req-vacation-approval` (4 gate true)
- 재생성: `node scripts/generate-adk-source.mjs artifacts/af/req-vacation-approval <scratch-out>` → 성공
- `python -m compileall` (venv google-adk 2.3.0): **PASS** (문법)
- `import req_vacation_approval_adk.agent` / 생성 pytest: **FAIL** — ADK `Workflow` 구성 시
  `Duplicate edge found: from=node_decision_router, to=휴가_승인_결과_기록_HR_API_Adapter`
- 기존 runtime-stub도 동일 실패 — **본 스킬 작업 이전부터 존재한 Current Implementation 결함**을 smoke가 최초 관찰.

## 근본 원인 (Claude af-verify-runtime run이 read-only로 추적 — tests/skills/evidence/claude-code 참조)
- `edge-013`(approved)·`edge-014`(rejected)는 `node-decision-router → node-record-hr-result`로 수렴하는 **두 route 분기** — 검토·승인된 합법적 Graph IR 형태.
- 생성기 route lowering(`scripts/adk-source/graph/routes.mjs` `routeCasesFor` + `scripts/adk-source/graph/lowering.mjs` `workflowEdgeLiteral`)이 route 값별 dict 항목 2개를 같은 대상 노드로 방출.
- ADK 2.3.0 `Workflow._validate_duplicate_edges`(`google/adk/workflow/_graph.py:485-495`)는 route key를 무시하고 (from,to) 쌍으로만 중복 판정 → ValidationError.
- `scripts/adk-source-test/`에 "한 router의 복수 분기가 같은 downstream으로 수렴"하는 케이스의 테스트가 없어 미검출. schema-only validator와 compileall로는 잡히지 않음(Level 2/3 vs Level 4의 차이 실증).

## 처리
- Product code(생성기)·artifact는 이번 스킬 단계 범위 밖 → 무수정. `docs/migration/skill-vnext-status.md` Remaining Gap에 기록(다음 코드 단계 입력).
- 신규 `af-verify-runtime`의 Level 4 runtime smoke가 이 계층 결함을 잡도록 설계된 것이 실증됨.

## 해결 (2026-07-18 같은 날 코드 단계)
- 생성기 수정: `scripts/adk-source/graph/routes.mjs`(+37) · `graph/lowering.mjs`(±12) · `emitters/router.mjs`(±43) — 같은 대상 노드로 수렴하는 검토된 route 분기들을 대상별 단일 dispatch 항목으로 병합, 병합된 검토 값·aliases는 생성 router 함수가 canonical key로 매핑.
- RED→GREEN: 신규 회귀 `scripts/adk-source-test/route-convergence.test.mjs` + `templates/regression-scenarios/scenario-l-route-convergence/` (RED에서 duplicate 2건 관측 → GREEN 1/1).
- 검증: 전체 generator 스위트 107/107, byte-identity 2/2(무관 fixture 무변화), 중립성 12/12(allowlist 무변경), `npm run test:analyzer` 141/141, `npm run build` 통과.
- 실증: req-vacation-approval 재생성 → `IMPORT-OK`, 번들 pytest 5 passed. canonical runtime-stub도 재생성되어 `CANONICAL-STUB-IMPORT-OK`.
- Dynamic mode는 구조상 비영향(route-map을 만들지 않음 — 확인 기록).
