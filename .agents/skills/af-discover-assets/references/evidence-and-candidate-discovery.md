# Evidence and Candidate Discovery

## Contents

- [Purpose](#purpose)
- [When to read](#when-to-read)
- [Decision criteria](#decision-criteria)
- [Required evidence](#required-evidence)
- [Artifact implications](#artifact-implications)
- [Scaffold implications](#scaffold-implications)
- [Verification](#verification)
- [Stop conditions](#stop-conditions)
- [Official sources checked](#official-sources-checked)
- [Checked date](#checked-date)

## Purpose

요구사항에서 사실을 먼저 추출하고, 다섯 판별 질문으로 Agent·Workflow·Tool 후보와 비자산 항목을 분리한다.

## When to read

모든 discovery 작업에서 후보를 작성하기 전에 읽는다.

## Decision criteria

### Evidence 분리

다음 네 묶음을 섞지 않는다.

| 묶음 | 기록 기준 |
| --- | --- |
| Evidence | 사용자 문장, 제공 파일, 현재 소스에서 직접 확인됨 |
| Assumption | Evidence를 바탕으로 한 추론이며 검토가 필요함 |
| Contradiction | 둘 이상의 근거가 서로 양립하지 않음 |
| Missing Information | 후보·계약·위험 판단에 답이 필요함 |

Evidence에는 source와 locator를 남긴다.

Assumption을 Evidence 문장으로 바꾸지 않는다.

### 다섯 판별 질문

1. 독립적인 판단 책임이 있는가? 있으면 Agent 후보를 검토한다.
2. 둘 이상의 실행 단위 흐름을 소유하는가? 있으면 Workflow 후보를 검토한다.
3. 구조화된 호출 기능인가? 있으면 Tool 후보를 검토한다.
4. 호출 기능이 아닌 데이터·문서·시스템인가? Resource 또는 Dependency로 기록한다.
5. 한 Workflow 내부의 private 결정 단계인가? Function Node 관계 Hint로만 남긴다.

### Workflow gate

단일 Agent, 단일 Tool, Agent-selected Tool, 독립 Tool 등록은 Workflow 없이 끝날 수 있다.

순서·분기·반복·합류·pause/resume의 소유 책임이 있을 때만 Workflow 후보를 만든다.

### 후보 record

각 후보에 다음을 작성한다.

- stable candidate id와 source requirement id
- Target asset type
- responsibility와 Evidence locator
- input/output와 error boundary
- side effect와 risk signals
- Domain Scope와 Owner 후보
- Reuse 후보와 비교 필요 항목
- candidate-level Missing Information
- Resource, Dependency, 다른 후보와의 관계 Hint

## Required evidence

정규화 요구에는 최소 다음을 보존한다.

- stable requirement id와 raw text
- requester/team/role, 알려진 경우에만
- business goal과 current process
- inputs, outputs, systems
- risk signals
- contradictions와 missing information
- status와 확인 날짜

Evidence summary에는 다음을 분리한다.

- requested goal
- business-domain hint
- user role
- input/output data
- systems mentioned
- decisions implied
- risks
- missing information
- contradictions
- assumptions

## Artifact implications

- requirement-level unknown은 soft gate로 남길 수 있다.
- candidate/contract-level unknown은 hard gate이며 approved 후보로 넘기지 않는다.
- top-level candidate는 Agent, Workflow, Tool뿐이다.
- Resource와 Dependency는 별도 record다.
- 관계는 Hint이며 Graph topology가 아니다.
- Runtime Pattern은 Hint이며 Compose contract가 아니다.

## Scaffold implications

이 단계는 scaffold를 만들지 않는다.

후속 Scaffold가 필요한 정보는 질문으로 남기되 endpoint, auth value, API class, callback hook, Agent Card를 추측하지 않는다.

## Verification

모든 후보가 Evidence locator, responsibility, I/O, risk, missing-information 상태를 갖는지 점검한다.

strict v2 JSON을 작성했다면 다음을 실행한다.

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

## Stop conditions

- source와 inference를 구분할 수 없음
- 책임 근거 없이 asset type을 선택해야 함
- Resource/Dependency를 Tool로 위장해야 함
- Workflow control 책임이 없음
- candidate hard gate를 assumption으로 숨겨야 함
- Runtime Pattern을 확정해야만 후보를 작성할 수 있음

## Official sources checked

- `docs/workbench/taxonomy.md`
- `docs/workbench/analysis-guide.md`
- `docs/workbench/workflow-decision-guide.md`
- `schemas/analysis-result.schema.json`

## Checked date

- Checked date: 2026-07-18
- Contract note: `assetCandidates` serializes only Agent, Workflow, and Tool classifications.
