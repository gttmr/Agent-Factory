# Module Review Board

Module Review Board는 Agent Factory v1.0에서 개발 리더의 primary decision surface다.
분석기가 제안한 module candidate를 검토하고 각 후보의 분류, 위험, 재사용 여부, 상태를 결정한다.
이 화면의 결정이 이후 Process Flow, Reuse Heatmap, export artifact의 기준이 된다.

## 화면이 보여주는 것

화면은 후보 모듈을 행 단위로 보여준다.
각 행은 하나의 `ModuleCandidate`를 나타낸다.
개발 리더는 분류와 subtype을 확인하고 필요한 경우 수정한다.
Remote A2A 후보는 높은 검토 마찰을 갖는 별도 후보로 취급된다.

## 주요 필드

- `name`
- `module_category`
- subtype: `agent_kind` | `workflow_kind` | `adapter_kind` | `remote_contract_kind`
- `confidence`
- `reuse_candidate`
- `risk_level`
- `risk_signals`
- `status`
- `rationale`

Subtype 표시는 `module_category`에 따라 달라진다.
`agent`는 `agent_kind`, `workflow`는 `workflow_kind`, `adapter`는 `adapter_kind`, `remote_a2a`는 `remote_contract_kind`를 사용한다.

## 상태 값

`status` 값은 다음 네 문자열만 사용한다.

- `approved`
- `deferred`
- `rejected`
- `needs_info`

이 값은 downstream artifact 포함, 보류, 제외, 추가 정보 요청의 검토 결정을 나타낸다.

## 위험 필드

`risk_level`은 `low`, `medium`, `high` 중 하나다.
`risk_signals`는 다음 문자열만 사용한다.

- `personal_data`
- `financial_data`
- `credit_decision_support`
- `customer_impact`
- `external_message`
- `transaction_write`
- `human_approval_required`
- `audit_required`

위험 신호는 승인 여부를 자동으로 결정하지 않지만 사람 승인, 감사, 고객 영향, 거래 쓰기 같은 후속 검토 항목을 선명하게 만든다.

## 지원하는 결정

이 화면은 후보의 모듈 경계, 재사용 승격 가능성, Remote A2A 계약 여부, 최종 검토 상태를 결정하게 한다.
