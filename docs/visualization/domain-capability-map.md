# Domain Capability Map

Domain x Capability Map은 domain별 capability 강도를 비교하는 화면이다.
v1.0에서는 은행 도메인을 임시 이름으로 사용하지만 taxonomy와 schema는 도메인 이름에 의존하지 않는다.
이 문서는 현재 `DomainCapabilityMap.tsx`가 보여주는 판단 표면을 설명한다.

## 화면이 보여주는 것

화면은 capability를 행으로, domain을 열로 배치한다.
각 행은 capability, module category, subtype, domain별 intensity를 보여준다.
개발 리더는 어떤 capability가 특정 domain에 강하게 묶이는지 또는 여러 domain에 반복되는지 확인한다.
이 정보는 공통화 후보와 domain owner 검토를 지원한다.

## 임시 domain

v1.0의 임시 domain 이름은 다음과 같다.

- `고객`
- `수신`
- `여신`
- `카드`
- `리스크`

이 이름은 v1.0 분석 워크벤치의 임시 placeholder다.
실제 domain 이름이 확정되면 표시 이름은 교체될 수 있다.
하지만 `module_category`, subtype, schema 구조는 domain 이름에 의존하지 않는다.

## Cell intensity

각 cell의 intensity 값은 정확히 다음 세 값 중 하나다.

- `낮음`
- `중간`
- `높음`

`낮음`은 해당 domain과 capability의 연결 강도가 낮음을 뜻한다.
`중간`은 재사용 또는 관련성이 있으나 강한 소유 경계가 아직 확정되지 않았음을 뜻한다.
`높음`은 해당 domain에서 capability 영향이나 재사용 압력이 강함을 뜻한다.

## 주요 필드

- `capability`
- `module_category`
- `subtype`
- `domains`

`domains`는 domain 이름을 key로 하고 `낮음`, `중간`, `높음` 중 하나를 value로 갖는다.
`module_category`는 capability의 최상위 책임 경계를 보여준다.
`subtype`은 agent, workflow, adapter, remote contract의 세부 유형을 보여준다.

## 지원하는 결정

이 화면은 공통 capability와 domain-specific capability를 구분하게 한다.
특정 domain에 위험 또는 소유권 검토가 집중되는지 확인하게 한다.
Reuse Heatmap에서 드러난 후보가 실제 여러 domain에 걸치는지 검토하게 한다.
Domain 이름은 임시 표시값이므로 taxonomy 판단의 근거로 사용하지 않는다.
