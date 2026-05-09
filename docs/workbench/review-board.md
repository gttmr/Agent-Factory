# Module Review Board

Module Review Board는 개발 리더가 분석 결과를 승인 가능한 설계 artifact로 바꾸는 결정 표면이다.
이 화면의 결정이 Process Flow와 Catalog review의 기준이 된다.

## 행 단위 의미

각 행은 하나의 `ModuleCandidate`다.
개발 리더는 candidate의 책임 경계, subtype, 입력/출력 계약, 상태를 검토한다.
Analyzer가 제안한 값은 초안이며, 불명확한 경우 새 값을 만들지 말고 `needs_info`로 둔다.

Module Review Board는 두 작업면으로 나뉜다.

- 신규 모듈 검토: `catalog_entry_id`가 없는 후보를 승인, 보류, 반려하거나 입력/출력 계약을 수정한다.
- 카탈로그 계약 연결: `catalog_entry_id`가 있는 후보를 기존 runtime contract로 보고, 이번 분석의 입력/출력 override와 Graph IR 연결만 검토한다.

카탈로그에서 온 항목은 기본적으로 수정 대상이 아니다.
카탈로그 원본을 바꾸려면 Catalog review에서 별도로 처리하고, Module Review에서는 현재 분석 artifact 안의 override와 edge 연결만 저장한다.

## 주요 필드

- `name`
- `catalog_entry_id`
- `module_category`
- subtype: `agent_kind` | `workflow_kind` | `adapter_kind` | `remote_contract_kind`
- `status`
- `inputs`
- `outputs`
- `missing_information`
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
- 불완전한 연결은 Graph IR validation warning/error로 드러내고, 모델이 임의로 보정하지 않는다.

## 검토 질문

- 이 후보는 reasoning owner인가, control flow인가, callable capability인가, Remote A2A 계약인가?
- subtype이 category와 맞는가?
- Process Flow에서 실행 순서와 boundary가 설명되는가?
- Catalog-bound contract의 입력과 출력이 Graph IR edge로 설명되는가?
- Adapter로 충분한데 Remote A2A로 과분류하지 않았는가?
- ADK component hint가 category로 잘못 승격되지 않았는가?
- `approved`로 올리기 전에 필요한 owner, auth, audit, data policy 정보가 있는가?
