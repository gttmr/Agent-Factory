# Module Review / Design Review

Module Review는 개발 리더가 분석 결과를 승인 가능한 설계 artifact로 바꾸는 결정 표면이다.
현재 UI에서는 DesignWorkbench(`/af/:reqId/design`)의 모듈 검토 패널과 Design Stage Runner가 이 책임을 나눠 가진다.
이 화면의 결정이 Process Flow와 Catalog review의 기준이 된다.

## 행 단위 의미

각 행은 하나의 `ModuleCandidate`다.
개발 리더는 candidate의 책임 경계, subtype, 입력/출력 계약, 상태, 후보별 정보 필요 항목을 검토한다.
Analyzer가 제안한 값은 초안이며, 불명확한 경우 새 값을 만들지 말고 `needs_info`로 둔다.

DesignWorkbench의 모듈 검토 패널은 두 작업면으로 나뉜다.

- 신규 모듈 검토: `catalog_entry_id`가 없는 후보를 승인, 보류, 반려하거나 입력/출력 계약을 수정한다.
- 카탈로그 계약 연결: `catalog_entry_id`가 있는 후보를 기존 runtime contract로 보고, 이번 분석의 입력/출력 override와 Graph IR 연결만 검토한다.

카탈로그에서 온 항목은 기본적으로 수정 대상이 아니다.
카탈로그 원본을 바꾸려면 Catalog review에서 별도로 처리하고, Module Review에서는 현재 분석 artifact 안의 override와 edge 연결만 저장한다.

## Resolution Draft와 Stage Runner patch

`needs_info` 후보는 메모만으로 승인하지 않는다.
현재 워크벤치에는 구 Inspector의 `해결 초안 생성` 버튼이 없다.
개발 리더는 Design Stage Runner(`af-design-boundaries`) 또는 동일 schema를 emit하는 외부 producer가 제안한 Resolution Draft/patch를 보고, 다음 항목을 검토한다.

- 누락 항목별 답변과 근거
- 입력/출력 object schema의 펼침 구조
- 현재 분석 artifact에 반영될 patch preview
- structural/runtime smoke에 사용할 `smoke_spec`

Resolution Draft는 자동 적용되지 않는다.
Stage Runner run은 proposed artifact와 diff summary를 먼저 남기며, 사용자가 `제안 적용`을 누를 때만 현재 분석의 `moduleCandidates`에 반영된다.
이때 기존 `missing_information`은 `resolved_missing_information`으로 보존되고, `resolution_applied_at`, `schema_review_state: applied`, `smoke_spec`이 기록된다.
그 뒤 `검토 승인` 또는 status select로 `approved` 상태를 선택한다.

카탈로그 계약 후보도 같은 review state만 수정한다.
카탈로그 원본 contract, registry, MCP/A2A binding은 Module Review에서 직접 변경하지 않는다.

## Remote A2A 계약 검토

DesignWorkbench의 `Remote A2A` 탭은 `module_category === "remote_a2a"` 후보와 `analysis-result.json.a2aContracts`의 1:1 매칭을 표로 보여준다.
개발 리더는 후보별 계약을 선택해 Agent Card, message contract, task lifecycle, task capability, auth, retry, fallback, audit, data policy와 `contract_status`를 현재 분석 artifact 안에서 검토/저장한다.
Readiness issue가 남거나 매칭 계약이 없으면 `runtime_contracts_approved` 게이트를 새로 켤 수 없다.
게이트는 자동으로 켜지지 않으며, Runtime 계약과 Remote A2A 계약이 모두 준비된 뒤 사용자가 직접 토글한다.

## 주요 필드

- `name`
- `catalog_entry_id`
- `module_category`
- subtype: `agent_kind` | `workflow_kind` | `adapter_kind` | `remote_contract_kind`
- `status`
- `inputs`
- `outputs`
- `missing_information`
- `resolution_draft`
- `resolution_applied_at`
- `schema_review_state`
- `smoke_spec`
- `rationale`

Subtype은 `module_category`에 맞는 한 필드만 의미를 갖는다.
`confidence`, `risk_level`, `risk_signals`, `reuse_candidate`는 analyzer evidence 또는 legacy/derived 신호로 남을 수 있지만 메인 검토 컬럼으로 쓰지 않는다.
위험 신호는 승인 전 blocker, 감사, 사람 승인, 데이터 정책 검토를 보조하는 정보다.

## status

허용 값은 네 개뿐이다.

- `approved`: Graph/Catalog review의 기준 후보로 포함할 수 있다.
- `deferred`: 판단은 유효하지만 이번 범위에서 보류한다.
- `rejected`: 후보로 쓰지 않는다.
- `needs_info`: 승인 전 추가 정보가 필요하다.

`needs_info` 후보는 `missing_information`에 승인 전 필요한 후보별 정보를 적어야 한다.
요구사항 전체의 부족 정보와 달리, 이 필드는 특정 module candidate를 승인하지 못하는 직접 이유다.
`approved`로 전환하려면 누락 항목이 비워져야 하며, 정보 필요 상태였던 후보는 Resolution Draft가 적용되어 object schema와 smoke 계약이 검토된 상태여야 한다.

## 위험 신호

`risk_signals`는 catalog와 analyzer enum에 맞춘다.

- `personal_data`
- `financial_data`
- `credit_decision_support`
- `customer_impact`
- `external_message`
- `transaction_write`
- `human_approval_required`
- `audit_required`

위험 신호는 자동 반려 조건이 아니다.
다만 사람 검토, 감사, 데이터 보존, 고객 영향, 거래 쓰기 같은 downstream 결정을 드러내야 한다.

## Graph IR 재생성

Module Review에서 저장하면 사용자가 수정한 `moduleCandidates`와 카탈로그 계약 연결을 기준으로 Graph IR을 다시 생성한다.
이 재생성은 analyzer 재실행이 아니라 deterministic client-side rebuild다.

- 신규 모듈의 입력/출력 수정은 해당 module node의 ports와 schema refs로 반영된다.
- 카탈로그 계약 연결 편집은 Graph edge의 `from`, `to`, `edge_kind`, `data_label`, `schema_ref`, state/artifact/A2A metadata로 반영된다.
- `rejected` 후보는 regenerated Graph IR에서 제외된다.
- 기존 Graph IR에 일부 edge만 남아 있으면 저장 시 유효한 edge metadata를 보존하고, 연결이 빠진 후보는 모듈 검토 순서의 fallback edge로 보강한다. 보강 뒤에도 module-bound node에 incoming/outgoing edge가 없으면 Graph IR validation error로 처리한다.

## 검토 질문

- 이 후보는 reasoning owner인가, control flow인가, callable capability인가, Remote A2A 계약인가?
- subtype이 category와 맞는가?
- Process Flow에서 실행 순서와 boundary가 설명되는가?
- Catalog-bound contract의 입력과 출력이 Graph IR edge로 설명되는가?
- object 타입 입력/출력은 Schema Tree에서 하위 필드까지 확인되었는가?
- `smoke_spec`이 synthetic input, sample message, expected output shape를 갖는가?
- Adapter로 충분한데 Remote A2A로 과분류하지 않았는가?
- ADK component hint가 category로 잘못 승격되지 않았는가?
- `approved`로 올리기 전에 필요한 owner, auth, audit, data policy 정보가 있는가?
