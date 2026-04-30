# Module Review Board

Module Review Board는 개발 리더가 분석 결과를 승인 가능한 설계 artifact로 바꾸는 결정 표면이다.
이 화면의 결정이 Process Flow, Reuse Heatmap, Domain Capability Map, export artifact의 기준이 된다.

## 행 단위 의미

각 행은 하나의 `ModuleCandidate`다.
개발 리더는 candidate의 책임 경계, subtype, 위험, 재사용 가능성, 상태를 검토한다.
Analyzer가 제안한 값은 초안이며, 불명확한 경우 새 값을 만들지 말고 `needs_info`로 둔다.

## 주요 필드

- `name`
- `module_category`
- subtype: `agent_kind` | `workflow_kind` | `adapter_kind` | `remote_contract_kind`
- `confidence`
- `reuse_candidate`
- `risk_level`
- `risk_signals`
- `status`
- `missing_information`
- `rationale`

Subtype은 `module_category`에 맞는 한 필드만 의미를 갖는다.

## status

허용 값은 네 개뿐이다.

- `approved`: downstream export에 포함할 수 있다.
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

## 검토 질문

- 이 후보는 reasoning owner인가, control flow인가, callable capability인가, Remote A2A 계약인가?
- subtype이 category와 맞는가?
- Process Flow에서 실행 순서와 boundary가 설명되는가?
- Adapter로 충분한데 Remote A2A로 과분류하지 않았는가?
- ADK component hint가 category로 잘못 승격되지 않았는가?
- `approved`로 올리기 전에 필요한 owner, auth, audit, data policy 정보가 있는가?
