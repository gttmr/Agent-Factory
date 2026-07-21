# Raw requirement 분석 가이드

이 문서는 raw requirement를 strict Target Contract v2의 검토 가능한 분석 artifact로 만드는 절차를 설명한다. 자산 정의는 [Taxonomy](./taxonomy.md), 실행 구조는 [Graph IR](./graph-ir.md), stage와 approval은 [Operating Model](./operating-model.md)이 소유한다.

## Target Contract

분석 결과는 다음을 분리해 기록한다.

- raw requirement의 직접 evidence
- `normalizedRequirement`
- assumption, contradiction, missing information
- Agent·Workflow·Tool `assetCandidates`
- Resource·Dependency·Interface 메모
- strict `graph`
- 필요한 runtime/A2A contracts
- risk와 검토 상태

`analysis-result.json`은 `contract_version: "2.0"`만 허용하며 embedded `assetCandidates`와 `graph`를 포함한다.

## 분석 절차

1. 요구사항 원문과 출처를 보존한다.
2. 사용자, business goal, current process, input, output, system, risk signal을 evidence로 추출한다.
3. 모순과 누락 정보를 별도 목록으로 만든다.
4. `normalizedRequirement`을 작성하되 원문에 없는 행동·계약을 사실처럼 추가하지 않는다.
5. 책임 경계로 Agent, Workflow, Tool 후보와 비자산을 구분한다.
6. 후보마다 Domain Scope, business domains, Owner, reuse status, Binding, 입출력, risk, missing information을 기록한다.
7. standalone 여부와 실행 관계를 strict Graph IR로 표현한다.
8. A2A가 필요하면 Agent Binding/Exposure와 연결 계약을 함께 제안한다.
9. strict v2 schema·ref·Graph validation을 통과시킨다.
10. 개발 리더가 evidence, 후보 책임, Graph, missing-information gate를 검토한 뒤 승인하거나 보완 요청한다.

## 후보 탐색 순서

### 1. 독립 판단 책임인가 → Agent

분류·요약·추천·생성·의사결정 지원처럼 입력을 해석하고 상황에 따라 선택하는 독립 책임이 있는지 확인한다.

확인 항목:

- 판단 입력과 출력
- Tool 사용 또는 Agent 위임 기준
- 실패·불확실성 처리
- Owner와 risk

역할명이나 “AI를 쓴다”는 사실만으로 Agent를 만들지 않는다.

### 2. 여러 실행 단위의 흐름 책임인가 → Workflow

둘 이상의 실행 단위를 연결하고 순서·분기·병렬·반복·Human Input·중단과 재개·종료를 소유하는지 확인한다.

Workflow 후보라면 `workflow_profile`의 representation과 coordination을 각각 판단한다. 상세 질문은 [Workflow 판단 가이드](./workflow-decision-guide.md)를 따른다.

### 3. 구조화된 호출 기능인가 → Tool

명확한 입력을 받아 특정 기능을 수행하고 구조화된 결과 또는 오류를 반환하는지 확인한다.

확인 항목:

- input/output schema
- side effect와 auth
- Binding과 Transport
- Backend/Dependency
- timeout, retry, audit

검색·계산·조회·변환은 필요할 때 `capability_tags`로 남기며 subtype을 만들지 않는다.

### 4. 데이터·문서·시스템 그 자체인가 → Resource/Dependency

데이터셋, 규정 문서, 외부 시스템, endpoint 자체는 실행 자산이 아니다. 그것을 검색·호출·변환하는 기능이 독립 계약을 가질 때 Tool 후보를 별도로 만든다.

### 5. Workflow 내부 private 단계인가 → Function Node

하나의 Workflow에서만 의미가 있고 Graph 도달 시 결정적으로 실행되는 단계는 Function Node 후보다. 독립 재사용·Owner·버전·권한 경계가 필요하면 Tool 자산 가능성을 다시 검토한다.

은행 업무 예시: OCR 결과를 다음 단계 입력 shape로 바꾸고 실패를 독립 추적해야 하는 단계는 `role: transform` Function Node 후보다. 단순 trim은 내부 helper로 남길 수 있다.

### 6. 정보가 부족한가 → `needs_info` + `missing_information`

새 category나 임의 기본값으로 불확실성을 숨기지 않는다. 질문은 어떤 artifact field와 승인 gate를 막는지까지 구체적으로 기록한다.

## Tool subtype을 추측하지 않는 규칙

- 이름에 API, Adapter, Search가 들어가도 자동으로 Tool이 아니다.
- endpoint 자체와 endpoint를 호출하는 Tool을 구분한다.
- MCP는 Tool category가 아니라 Binding이다.
- A2A는 Agent category가 아니라 Binding/Exposure다.
- 단순 helper를 재사용 Tool로 과장하지 않는다.

## Missing-information gate

Requirement 수준 누락은 `evidence.missing_information`, 검토자가 위험을 이해하고 수용한 항목은 `evidence.accepted_missing_information`에 둔다. 자산 후보 수준 누락은 `AssetCandidate.missing_information`과 `status: needs_info`로 관리한다.

후보의 unresolved item이 해소되지 않으면 `approved`로 바꾸지 않는다. 수용과 해결은 다르며, 보안·권한·입출력·side effect처럼 scaffold 안전성에 필요한 정보는 단순 수용으로 우회하지 않는다.

## Evidence와 normalized requirement

Evidence는 원문에서 확인한 사실이고 normalized requirement는 검토 가능한 구조다.

- 원문에 없는 시스템 접근권한을 추정하지 않는다.
- 제안된 architecture를 사용자 요구 사실처럼 쓰지 않는다.
- contradiction은 한쪽을 임의 선택하지 않고 둘 다 남긴다.
- assumption에는 근거, 영향, 확인 주체를 적는다.
- `normalizedRequirement.raw_text`로 원문 provenance를 유지한다.

## Current Product contract

Analyze Stage Runner는 `af-discover-assets`를 직접 사용하고 `runs/analyze/<run-id>/proposed-artifacts/analysis-result.json` 하나만 제안한다. proposal은 `validateAnalysisResult`를 통과해야 하며 명시적 apply 후 canonical `analysis-result.json`이 바뀐다. run 성공은 `analysis_reviewed`를 자동 승인하지 않는다.

canonical analysis에는 embedded `assetCandidates`와 `graph`가 모두 존재한다. artifact sync가 이를 `asset-candidates.json`, `graph-ir.json`으로 그대로 분리하고 `scaffold-plan.json`을 파생한다. 이전 filename이나 field를 읽어 변환하는 backward path는 없다.

### Source locators

2026-07-19 현재 working tree에서 다음을 재확인했다.

| 행동 | Path | Stable symbol |
| --- | --- | --- |
| strict analysis shape | `packages/web/src/analyzer/types.ts` | `AnalysisResult`, `AssetCandidate`, `GraphIR` |
| strict assertion | `packages/web/src/analyzer/targetContract.ts` | `validateTargetAnalysisResult`, `assertTargetAnalysisResult` |
| import boundary | `packages/web/src/analyzer/analysisArtifactImport.ts` | `parseAnalysisResultArtifact` |
| strict workbench read | `packages/web/src/analyzer/targetAnalysisResult.ts` | `parseTargetAnalysisResult` |
| Analyze Stage Runner 정의 | `packages/web/server/stageRunner.ts` | `STAGE_DEFINITIONS.analyze` |
| canonical split 파생 | `packages/web/server/artifactSync.ts` | `syncArtifactRoot`, `serializeDerivedArtifacts` |
| analysis JSON Schema | `schemas/analysis-result.schema.json` | root schema |
