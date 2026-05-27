# 03 — Runtime Contract Review surface

상태: 완료 (`69edb6c feat: brief 03 — Runtime contract review surface in DesignWorkbench`). 현재 구현은 `packages/web/src/design/RuntimeContractPanel.tsx`, `DesignWorkbench`의 `Runtime 계약` 탭, `runtime_contracts_approved` gate 토글로 유지된다.

## 왜 필요한가

`af-run-manifest.json.approvals.runtime_contracts_approved` 게이트는 PR2 시점부터 manifest 스키마에 있지만, **router 셸에는 이 게이트를 토글할 UI 가 없다.** PR3 의 DesignWorkbench 에서 boundaries_approved 만 다루고 runtime 계약은 manifest 직접 PATCH 또는 외부 도구로 처리해야 한다.

레거시에 있던 `RuntimeContractReview` 컴포넌트는 PR6 에서 제거됐다. 동일 surface 를 새 셸 흐름으로 다시 만든다.

## 현재 상태

- 데이터: `analysis-result.json.runtimeContracts: RuntimeContract[]` (스키마는 `packages/web/src/analyzer/types.ts`).
- 검토 boundary: MCP/EAI/Legacy adapter, Context Manager, Callback Broker, ADK callback, async resume — 자세한 정의는 `.agents/skills/_shared/runtime-support-rules.md`.
- 검증 함수: `runtimeContractReadinessIssues` (`packages/web/src/analyzer/runtimeContracts.ts`) — 이미 export 됨, 재사용.
- 서버: 별도 endpoint 불필요. `PUT /api/af/:id/analysis-result.json` 로 전체 갱신, `PATCH /api/af/:id/manifest/approvals` 로 게이트 토글.
- 게이트 조건 (현재 server 측 mirror):
  - `runtime_contracts_approved` → `manifest.stages.design.status` 가 boundaries 와 함께 `"complete"` 가 되는 조건의 일부.

## 작업 정의 (Done means)

1. DesignWorkbench (또는 별도 sub-route `/af/:id/design#runtime`) 에 Runtime Contract Review 패널 추가.
2. 각 contract 의 readiness issue 가 표로 보이고, 사용자가 필드를 채워 `contract_status` 를 `approved` 로 올릴 수 있다.
3. 모든 required runtime contract 가 `approved` 인 경우에만 `runtime_contracts_approved` 토글이 활성화된다.
4. 저장 시 `analysis-result.json` 의 `runtimeContracts` 가 갱신되고 react-query invalidation 으로 다른 화면에 즉시 반영.

## 파일 / 디렉터리

- 신규
  - `packages/web/src/design/RuntimeContractPanel.tsx` (legacy `RuntimeContractReview.tsx` 의 정수만 가져옴 — `runtimeContractReadinessIssues` 호출, 필드 form, save mutation)
- 수정
  - `packages/web/src/routes/DesignWorkbench.tsx` — 사이드바에 "Runtime 계약" 탭 추가 또는 하단 drawer 로 마운트. 새 탭 추가 시 sidebar tab 배열 갱신.
  - `packages/web/src/styles-router.css` — `.af-runtime-*` 클래스.
- 선택적
  - `packages/web/src/state/useRuntimeContracts.ts` 헬퍼 hook — 사실 `useAnalysisArtifact` 로 충분하므로 새 hook 없이도 가능.

## 검증

```bash
cd packages/web && npm run build && npm run test:analyzer
node scripts/validate-artifacts.mjs templates/regression-scenarios/scenario-d-graph-workflow
```

MCP 스모크:
1. scenario-d 또는 `templates/regression-scenarios/scenario-e-true-remote-a2a/` 를 req-pr-runtime 로 import (scenario-e 가 runtime 계약을 더 많이 요구).
2. `/af/req-pr-runtime/design` → Runtime 계약 패널.
3. 각 contract 의 readiness issue 가 표시되는지 확인.
4. 필요한 필드 입력 후 `approved` 로 변경.
5. 모든 contract 가 approved 가 되면 `runtime_contracts_approved` 토글 활성, 클릭 → manifest.approvals.runtime_contracts_approved=true, `stages.design.status="complete"` (boundaries 도 approved 라면).

## Out of scope

- Remote A2A contract editing (별도 surface — `04-a2a-contract-review-surface.md`).
- Runtime contract 의 reuse-from-catalog 흐름 — 현재 catalog 에 runtime contract 가 없음. 후속.

## 위험 / 메모

- legacy `RuntimeContractReview.tsx` 가 1000+ 줄로 컸지만 그 대부분은 wizard rail 통합 코드. 새 surface 는 read 패널 + 필드 form + readiness 표시 ≤ 400 줄로 가능.
- contract 의 `contract_status` 값 enum: `draft|needs_info|approved|rejected`. `validateAnalysisResult` 가 이를 강제하므로 enum 변경 금지.
- `boundaries_approved` 와 `runtime_contracts_approved` 가 모두 true 일 때 `stages.design.status="complete"` 가 되도록 서버에서 이미 mirror 함 — 클라이언트는 추가 처리 불필요.
