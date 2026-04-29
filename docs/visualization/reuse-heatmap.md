# Reuse Heatmap

Reuse Heatmap은 여러 유스케이스에서 반복되는 capability를 드러내는 화면이다.
목적은 shared agent 후보나 catalog adapter 후보를 검토하기 쉽게 만드는 것이다.
재사용 승격은 자동 결정이 아니라 Module Review Board의 결정이다.

## 화면이 보여주는 것

화면은 재사용 후보로 표시된 module candidate를 capability 단위로 정렬해 보여준다.
각 행은 capability 이름, 분류, subtype, reuse score, 관련 domain, 상태, 판단 근거를 포함한다.
점수가 높을수록 공통화 압력이 큰 후보로 볼 수 있다.
하지만 점수는 검토 우선순위이지 승인 판정이 아니다.

## 주요 필드

- `capability`
- `module_category`
- `subtype`
- `reuse_score`
- `domains`
- `candidate_status`
- `rationale`

`module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
`subtype`은 후보의 세부 유형을 나타내며 값이 없을 수 있다.
`reuse_score`는 capability의 재사용 검토 강도를 나타낸다.
`domains`는 관련된 임시 도메인 목록이다.
`candidate_status`는 원본 후보의 `status`를 반영한다.

## 상태 값

`candidate_status`는 다음 값 중 하나다.

- `approved`
- `deferred`
- `rejected`
- `needs_info`

`approved` 후보만 downstream export artifact에 들어갈 수 있다.
`deferred`, `rejected`, `needs_info` 후보는 재사용 압력이 보여도 별도 승인 없이 승격하지 않는다.

## 지원하는 결정

이 화면은 반복되는 capability를 shared agent로 볼지 검토하게 한다.
반복되는 callable capability를 catalog adapter로 볼지 검토하게 한다.
여러 domain에 걸친 공통 책임과 특정 domain 전용 책임을 구분하게 한다.
공통화 후보를 Module Review Board에서 다시 승인할지 판단하게 한다.
