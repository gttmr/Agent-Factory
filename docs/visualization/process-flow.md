# Process Flow View

Process Flow view는 검토된 requirement가 어떤 흐름으로 처리되는지 보여준다.
이 화면은 module candidate 사이의 실행 순서와 경계가 로컬인지 원격 A2A인지 확인하는 데 쓰인다.
새 UI 처방이 아니라 현재 `ProcessFlowView.tsx`가 표현하는 의미를 문서화한다.

## 화면이 보여주는 것

화면은 `ProcessFlow`의 node와 edge를 단계별 흐름으로 보여준다.
입력 context, adapter call 후보, local review, output 산출 경계를 분리해 확인한다.
각 node는 label, type, subtype을 통해 어떤 역할인지 표시된다.
각 edge는 연결 방향과 전달되는 data를 표시한다.

## Node type

`FlowNodeType`으로 허용되는 값은 다음과 같다.

- `input`
- `output`
- `agent`
- `workflow`
- `adapter`
- `remote_a2a`

`input`은 원문 요구사항과 입력 context를 나타낸다.
`output`은 최종 산출물 또는 보존할 artifact 경계를 나타낸다.
`agent`, `workflow`, `adapter`, `remote_a2a`는 `module_category`와 맞춰진 node type이다.

## Edge type

`edge_type` 값은 process-flow schema 기준으로 두 개다.

- `local`
- `remote_a2a`

`local`은 같은 workbench 설계 경계 안의 연결이다.
`remote_a2a`는 독립 원격 에이전트 계약을 통과하는 연결이다.
Remote A2A edge는 화면에서 visually distinct해야 하며, 일반 local handoff와 섞어 해석하지 않는다.

## Subtype labeling

Adapter node의 subtype label은 `adapter_kind`를 사용한다.
예를 들어 검색 capability는 `retrieval`로, 규칙 레지스트리는 `rule_registry`로 표시된다.
Subtype은 node의 세부 책임을 보여주지만 최상위 경계를 대체하지 않는다.

## 지원하는 결정

이 화면은 흐름이 로컬 workflow와 adapter 조합으로 충분한지 확인하게 한다.
Remote A2A가 실제 원격 계약 edge인지 확인하게 한다.
분기, 병합, 사람 검토, output 보존 위치가 artifact로 설명 가능한지 검토하게 한다.
Scaffolding 전에는 이 흐름이 승인된 artifact와 일치해야 한다.
