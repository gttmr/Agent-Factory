# Raw requirement 분석 가이드

이 문서는 raw requirement를 검토 가능한 분석 artifact로 바꾸는 운영 절차를 설명한다. 자산 정의와 속성은 [Taxonomy](./taxonomy.md), Workflow 내부 실행 표현은 [Graph IR](./graph-ir.md), 작업 단계와 승인 gate는 [Operating Model](./operating-model.md)을 단일 기준으로 사용하며 여기서 다시 정의하지 않는다.

## Target Contract

분석의 목적은 requirement를 곧바로 구현안으로 바꾸는 것이 아니다. 확인된 근거, 정규화된 요구사항, 미결 정보, Agent·Workflow·Tool 후보와 비자산 경계를 분리해 개발 리더가 책임과 계약을 검토할 수 있게 만드는 것이다.

분석 결과에는 최소한 다음 정보가 남아야 한다.

- 원문 raw requirement와 requester context
- 정규화 요구사항(normalized requirement)
- 확인된 사실, 추정, 가정, 모순을 구분한 evidence
- 요구사항 수준과 후보 수준의 `missing_information`
- 자산 후보와 분류 근거
- Resource/Dependency 및 Graph 내부 Node처럼 자산이 아닌 경계
- 위험 신호와 사람 검토가 필요한 항목
- Workflow 후보가 있을 때의 Graph IR 초안과 미확정 연결

## 분석 절차

1. raw requirement와 requester context를 원형대로 캡처한다. 원문에 없는 책임, 시스템 동작, 데이터 계약을 보완해 넣지 않는다.
2. 목표, 업무 맥락, 입력, 출력, 언급된 시스템·문서·데이터, 제약, 위험 신호, 누락 정보, 모순을 정규화한다.
3. evidence를 만든다. 확인된 문장·자료·시스템 사실과 분석자의 추정·가정을 명시적으로 분리한다.
4. 아래 후보 탐색 순서를 그대로 적용한다. 익숙한 기존 이름이나 기술 연결 방식부터 분류하지 않는다.
5. 후보별 책임, 입출력 경계, 업무 맥락, Owner 단서, 재사용 단서, side effect와 위험을 기록한다. 이 속성으로 새 자산 유형이나 필수 subtype을 만들지 않는다.
6. Workflow 후보에만 Graph IR 초안을 연결한다. Agent·Tool 자산과 Function Node·Human Input Node·Join Node 같은 Graph 표현을 같은 분류축에 섞지 않는다.
7. 개발 리더가 evidence, normalized requirement, 후보 책임, missing-information gate를 확인한 뒤 분석 결과를 승인하거나 보완 요청한다.

## 후보 탐색 순서

### 1. 독립 판단 책임인가 → Agent

다음 질문으로 판단한다.

- 입력의 의미를 해석하고 상황에 따라 판단·선택·분류·요약·추천·생성하는가?
- 같은 구조의 입력이라도 맥락과 근거에 따라 결과가 달라질 수 있는가?
- Tool 사용 여부나 다른 Agent로의 위임 여부를 책임 있게 결정해야 하는가?

은행 업무 예시: 신용정보와 정책 근거를 해석해 신용평가 의견이나 등급 추천을 내는 책임은 Agent 후보다. 평가에 필요한 점수 계산 함수나 데이터 조회 기능 자체를 Agent로 분류하지 않는다.

### 2. 여러 실행 단위의 흐름 책임인가 → Workflow

다음 질문으로 판단한다.

- 둘 이상의 실행 단위를 연결하는가?
- 순서, 분기, 병렬, 반복, 사람 입력 대기, 중단·재개, 종료 조건 중 하나 이상을 소유하는가?
- 흐름의 실패·재시도·합류 경계를 독립적으로 검토해야 하는가?

은행 업무 예시: 대출 서류 접수, OCR 호출, 검토 판단, 보완 요청, 승인 입력을 연결하고 그 순서와 종료 조건을 소유하는 대출 서류 검토 흐름은 Workflow 후보다. 한 Agent가 여러 Tool을 사용할 수 있다는 사실만으로 Workflow가 되지는 않는다.

### 3. 구조화된 호출 기능인가 → Tool

다음 질문으로 판단한다.

- 명확한 입력 계약을 받아 한정된 기능을 수행하는가?
- 결과와 오류를 호출자가 처리할 수 있는 구조로 반환하는가?
- 판단 책임보다 기능 계약, 권한, 버전, 감사 경계를 독립적으로 검토·재사용할 필요가 있는가?

은행 업무 예시: 고객 식별자를 받아 허용된 고객정보 필드를 조회하고 결과 또는 오류를 반환하는 고객정보 조회 기능은 Tool 후보다. 조회 대상 고객 시스템이나 데이터 자체는 Tool이 아니라 Resource/Dependency다.

### 4. 데이터·문서·시스템 그 자체인가 → Resource/Dependency

다음 질문으로 판단한다.

- 호출 가능한 기능이 아니라 읽고 쓰는 데이터, 지식 내용, 문서 집합 또는 외부 시스템 자체인가?
- 독립적인 판단이나 구조화된 기능 계약 없이 다른 자산이 접근하는 대상인가?
- API endpoint를 기능 자산과 동일시하고 있지는 않은가?

은행 업무 예시: 여신 심사 규정집은 Knowledge Resource다. 규정집을 검색하는 기능은 Tool 후보이고, 검색 결과를 적용할지 판단하는 책임은 Agent 후보다. Resource/Dependency는 Agent Factory의 Agent·Workflow·Tool 자산이 아니다.

### 5. Workflow 내부 private 단계인가 → Function Node

다음 질문으로 판단한다.

- 하나의 Workflow 안에서만 의미가 있고 Graph가 도달하면 결정적으로 실행되는가?
- 독립 Catalog 계약, 별도 Owner, 재사용 버전 없이 부모 Workflow의 맥락을 상속하는가?
- 독립 입출력 경계, 실패 추적, 분기·Join 기준점, 중단·재개, 감사 또는 업무 설명상 Node로 드러낼 이유가 있는가?

은행 업무 예시: OCR 결과 필드를 대출 서류 검토 Workflow의 다음 단계 입력 형식으로 정규화하는 private 단계는 Function Node 후보다. 단순 trim 같은 작은 helper는 독립 Node가 아니라 내부 코드로 남길 수 있다. Function Node는 자산이 아니며, Function binding을 가진 Tool과도 다르다. 자세한 구분은 [Graph IR의 Function Node, Tool Node, Function Tool](./graph-ir.md#function-node-tool-node-function-tool-구분)을 따른다.

### 6. 정보가 부족한가 → `needs_info` + `missing_information`

다음 질문으로 판단한다.

- 판단 책임과 기능 호출 중 무엇을 요구하는지 근거가 충분한가?
- 둘 이상의 실행 단위와 흐름 소유 책임이 실제로 확인되는가?
- 데이터·문서·시스템 자체와 이를 다루는 기능이 구분되어 있는가?
- 입출력, Owner, 권한, side effect, 실패 처리처럼 승인에 필요한 계약이 빠져 있지 않은가?

정보가 부족하면 `unknown` 같은 정상 유형을 만들거나 가장 가까운 subtype을 추측하지 않는다. 후보 상태를 `needs_info`로 두고 `missing_information`에 필요한 질문, 현재 evidence, 답변이 어떤 판단을 막는지를 기록한다.

## Tool subtype을 추측하지 않는 규칙

계산·검색·조회·변환이라는 기능 속성은 필수 Tool subtype이 아니다. 이 단어가 requirement에 있다는 이유로 별도 유형을 만들거나 기존 legacy subtype에 자동 대응시키지 않는다.

발견성이 필요하면 선택적 다중 값 `capability_tags`에 `calculation`, `search`, `lookup`, `transform` 같은 검색 단서를 기록할 수 있다. `capability_tags`는 자산 유형, 코드 생성 분기, Owner, 업무 범위, 보안 정책, 재사용 상태를 결정하지 않는다.

특히 검색 요구는 지식 내용 자체와 검색 기능을 나눠 본다. 규정 문서는 Knowledge Resource이고, 규정 검색 계약은 Tool 후보다. 같은 방식으로 고객 데이터는 Data Resource이고, 허용된 입력으로 고객정보를 조회하는 계약은 Tool 후보다.

## Missing-information gate

missing information은 두 층으로 검토한다. 요구사항 수준의 미결 정보는 분석 검토를 위한 soft gate이고, 자산 후보의 책임·계약·Graph 연결에 남은 `status: needs_info`는 후보 승인과 Runtime Handoff를 막는 hard gate다.

분석자는 답을 꾸며 gate를 닫지 않는다. 수용·해결 주체와 승인 조건을 포함한 전체 규칙은 [Operating Model의 승인 게이트 모델](./operating-model.md#3-승인-게이트-모델)을 따른다.

## Evidence와 normalized requirement

Evidence는 분류 결론보다 먼저 남긴다. 각 항목은 출처가 있는 확인 사실, 분석자가 도출한 추정, 확인이 필요한 가정, 서로 충돌하는 진술 중 무엇인지 표시한다. 근거가 바뀌면 후보 판단을 다시 검토할 수 있어야 한다.

Normalized requirement는 원문을 대체하는 요약이 아니라 검토를 위한 구조화 표현이다. 최소한 목표, 업무 맥락, 입력, 출력, Resource/Dependency, 제약, 위험, 누락 정보, 모순을 원문 evidence와 추적 가능하게 연결한다.

개발 리더는 첫 확인에서 다음 사항을 본다.

1. 목표, 업무 맥락, 입력, 출력, 언급된 시스템·문서·데이터가 원문과 맞는가?
2. 확인 사실과 추정·가정이 분리되어 있는가?
3. Agent·Workflow·Tool 후보의 책임이 서로 겹치거나 빠지지 않았는가?
4. Resource/Dependency와 Function Node가 재사용 자산으로 잘못 승격되지 않았는가?
5. soft/hard missing-information과 위험 신호가 승인 전에 보이는가?

## Current Implementation(`legacy`)

현재 분석 파이프라인은 Target Contract의 새 직렬화를 구현한 상태가 아니다. Workbench의 Analyze Stage Runner와 `af-analyze-requirement` skill은 proposal과 분석 artifact를 만들고, 검토·apply된 결과를 canonical `analysis-result.json`에 반영하는 현행 운영 경로다. Stage Runner의 단계 의미와 artifact apply 규칙은 [Operating Model의 Current Implementation](./operating-model.md#current-implementationlegacy)을 따른다.

현재 분석 artifact와 schema는 legacy `module_category`와 legacy `adapter_kind` 어휘로 후보를 직렬화한다. 따라서 현행 값을 그대로 Target 자산 유형이나 Tool subtype으로 읽지 말고, evidence와 책임 경계를 기준으로 Agent·Workflow·Tool·Resource/Dependency·Function Node 중 무엇인지 다시 해석한다.

`analysis-result.json`의 normalized requirement, evidence, module candidates, process flow와 Stage Runner run evidence는 현재 검토·추적을 위한 artifact다. 이 파일명과 현행 필드가 존재한다는 사실은 Target Taxonomy와 Graph IR 직렬화가 구현되었다는 뜻이 아니다.

legacy 필드별 목표 해석, 영향 영역, 위험, 후속 필요 여부는 [Taxonomy vNext Migration Status](../migration/taxonomy-vnext-status.md)에서 확인한다.
