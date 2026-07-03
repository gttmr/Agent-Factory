# 04 — A2A Contract Review surface

상태: 완료. `a2aContracts` 정규화와 GraphInspector의 Remote A2A 계약 안내에 더해, DesignWorkbench의 `Remote A2A` 탭에서 후보별 매칭 계약, 편집 form, readiness issue, runtime gate 연동을 다룬다.

## 왜 필요한가

Remote A2A 는 high-friction boundary 이고 contract 가 굉장히 길다 (`owner`, `agent_card`, `auth`, `task_lifecycle`, `timeout`, `retry`, `fallback`, `audit`, `data_policy` 등). PR6 에서 legacy `A2AContractReview` 가 제거되며 새 셸에서는 이 contract 들을 다룰 UI 가 없다. `a2a-contracts.json` 파일 PUT 만 가능한 상태.

## 현재 상태

- 스키마: `schemas/a2a-contract.schema.json`, type 은 `packages/web/src/analyzer/types.ts` 의 `A2AContract`.
- `analysis-result.json.a2aContracts` 또는 별도 파일 `artifacts/af/<id>/a2a-contracts.json` 양쪽에 저장 가능. 서버는 두 경로 모두 PUT 화이트리스트.
- legacy 컴포넌트 (삭제됨): `components/A2AContractReview.tsx` + `components/a2aContractReview/{A2AContractDetail,A2AContractList,A2AFieldControls,helpers}.tsx`. 디자인 참고로만 git history 에서 확인 가능 (`git show 676b140^:packages/web/src/components/A2AContractReview.tsx`).
- DesignWorkbench: 사이드바에 `Remote A2A` 탭이 추가됐고, remote_a2a 후보별 contract 매칭/issue count 를 보여준다.
- inspector/editor: Agent Card, message contract, lifecycle, task capability, auth/retry/fallback/audit/data policy 를 편집하고 `analysis-result.json.a2aContracts` 로 저장한다.
- gate: `a2aContractsGateReady` 가 `runtime_contracts_approved` 토글 조건에 포함된다. 즉 Build 단계 진입은 Runtime 계약과 Remote A2A 계약이 모두 ready 일 때만 열린다.

## 구현 결과

1. DesignWorkbench 사이드바에 `Remote A2A` 탭이 있다.
2. 각 Remote A2A 후보 module + 매칭되는 A2AContract 가 표 형태로 표시된다.
3. `agent_card`, `message_contract`, `task_lifecycle`, `task_capability`, `auth`, `retry`, `fallback`, `audit`, `data_policy` 필드 편집이 가능하다.
4. `a2aContractReadinessIssues` 가 필드 누락 issue 를 표시하고, approved 저장 시 readiness issue 가 있으면 막는다.
5. 모든 Remote A2A 후보가 매칭 contract 를 가지고 `contract_status=approved` 인 경우에만 `runtime_contracts_approved` gate 를 켤 수 있다.

## 파일 / 디렉터리

- 신규
  - `packages/web/src/design/A2AContractPanel.tsx`
  - `packages/web/src/design/a2aContractValidator.ts`
  - `packages/web/src/design/a2aContractValidator.test.ts`
  - `packages/web/src/styles/router/a2a-contract.css`
- 수정
  - `packages/web/src/routes/DesignWorkbench.tsx` — 탭 추가, A2A contract 저장, runtime gate 조건에 A2A readiness 포함.
  - `packages/web/src/styles-router.css` — A2A style partial import.

## 검증

```bash
cd packages/web && npm run build && npm run test:analyzer
node scripts/validate-artifacts.mjs templates/regression-scenarios/scenario-e-true-remote-a2a
```

MCP 스모크 (scenario-e 가 필수):
1. scenario-e import → req-pr-a2a.
2. `/af/req-pr-a2a/design` → Remote A2A 탭.
3. legacy 컴포넌트 (git history) 의 필드 목록과 비교해 누락 없는지 확인.
4. 필드 입력 후 `contract_status=approved` 로 변경.
5. `boundaries_approved` + `runtime_contracts_approved` 모두 true 일 때 Build 진행 가능.

## Out of scope

- A2A contract 를 `a2a-contracts.json` 분리 파일로 저장하는 흐름 — 1차에서는 `analysis-result.json` 안의 `a2aContracts` 만 다뤄도 충분.
- Catalog 에 Remote A2A contract 가 0건 (PR5 audit 결과). catalog 확장은 별도 작업.

## 위험 / 메모

- legacy `A2AContractDetail.tsx` 는 18KB 정도였다. 새 surface 는 필드 form 만 깔끔하게 — 700 줄 이내 권장.
- A2A field 가 매우 많아 한 화면 표 vs 카드 vs accordion 중 선택해야 한다. UX 측면에서 module candidate 단위로 카드 + 내부 form 권장.
- `scaffoldPlan.collectBlockers` 는 아직 runtime contract blocker 만 직접 수집한다. A2A readiness 는 Build 진입 전 `runtime_contracts_approved` gate 에서 막는 구조다.
