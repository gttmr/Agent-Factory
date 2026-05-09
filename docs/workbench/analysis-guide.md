# Analysis Guide

이 문서는 사용자 요구사항을 Agent Factory 분석 워크벤치 산출물로 바꾸는 기본 절차다.
첫 사용자는 개발 리더이며, v1.0의 임시 은행 도메인은 `고객`, `수신`, `여신`, `카드`, `리스크`다.

## 분석 순서

1. Raw requirement와 requester context를 캡처한다.
2. 목표, 입력, 출력, 언급된 시스템, 위험 신호, 누락 정보, 모순, 가정을 정규화한다.
3. Evidence summary를 만든다. 추정은 추정으로, 확인된 사실은 확인된 사실로 분리한다.
4. 후보 모듈을 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나로 분류한다.
5. 선택한 category에 맞는 subtype을 채운다.
6. [Workflow decision guide](./workflow-decision-guide.md)에 따라 process flow를 그린다.
7. 개발 리더가 Module Review Board에서 `approved`, `deferred`, `rejected`, `needs_info` 중 하나로 결정한다.
8. Catalog review에서 기존 spec 재사용 여부와 신규 등록/제외 여부를 결정한다.
9. 승인된 후보만 `scaffold-plan`으로 묶고 ADK Runtime Handoff에서 TODO/runtime wiring 경계를 확인한다.

## 산출물 의미

- `normalized-requirement.json`: 요구사항을 구조화한 원본 분석 결과.
- `evidence-summary.json`: 분류 근거, 위험, 누락 정보, 가정.
- `module-candidates.json`: 검토 대상 모듈 후보.
- `process-flow.json`: 후보 모듈 사이의 local 또는 Remote A2A 흐름.
- `classification.json`: 선택한 category와 subtype의 근거.
- `commonization-notes.json`: shared agent, adapter catalog, workflow reuse 후보 요약. 실제 등록/제외 결정은 Catalog review에서 한다.
- `catalog-changes.yaml`: Catalog review에서 결정한 신규 등록, 수정, 삭제 예정 변경안.
- `scaffold-plan.json`: 승인된 workbench artifact만 입력으로 하는 ADK Runtime Handoff 계약이다. repo 안의 template/schema는 이 계약을 검증하는 fixture로도 사용한다.

## 분석 원칙

- 새 taxonomy 값을 만들지 않는다. 값은 [Taxonomy](./taxonomy.md)를 따른다.
- 여러 단계가 있다는 이유만으로 `remote_a2a`를 만들지 않는다.
- MCP tool, retrieval, grounding, external service는 우선 `adapter` 후보로 본다.
- Catalog entries는 mock이 아니라 reusable runtime contract로 해석한다. Mock/test double 생성은 별도 후속 기능이며 분석 산출물에 mock-only 후보를 섞지 않는다.
- 공통 Workflow가 `runtime_binding: remote_a2a`로 등록되어 있어도 `module_category`는 `workflow`로 유지한다. 독립 원격 Agent 계약 증거가 있을 때만 `module_category: remote_a2a`를 만든다.
- ADK component는 category가 아니다. 필요하면 module candidate의 ADK hint로 남긴다.
- 고객 영향, 금융정보, 거래 쓰기, 신용 판단 지원은 위험 신호로 남기고 사람 검토를 요구한다.
- Raw requirement는 직접 business logic 코드 생성으로 이어지지 않는다. ADK Runtime Handoff는 승인된 후보와 `scaffold-plan`만 사용하며, 생성물은 실제 runtime 설정과 비즈니스 로직을 TODO 경계로 남긴다.

## Live analyzer 실행 계약

Live analyzer는 Codex CLI가 필요한 repo 문맥을 직접 확인할 수 있게 shell 접근을 유지한다.
단, CLI가 최종 `AnalysisResult` 전체를 한 번에 생성하지 않는다.

- CLI에는 `schemas/analysis-draft.schema.json` compact draft schema를 `--output-schema`로 전달한다.
- 실행 시 `/tmp/agent-factory-codex-*/analyzer-context-index.md`를 만들어 active docs, schema, catalog 위치와 주요 section을 안내한다.
- 모델은 index를 지도처럼 사용하고, 정확한 판단이 필요하면 원본 `docs/`, `schemas/`, `catalog/` 파일을 `rg`나 bounded `sed`로 직접 확인한다.
- Compact draft에는 분류 판단, rationale, `catalog_entry_id`, Graph IR topology 같은 결정 정보를 담는다.
- 서버는 draft를 catalog와 schema 기본값으로 hydrate해 기존 `AnalysisResult` 형태로 만든 뒤 기존 Graph IR/A2A normalization과 validation을 수행한다.
- Spark 모델에서 실패해도 다른 모델로 자동 fallback하지 않는다. 실패 원인은 `max_output_tokens`, `context_window_exceeded`, `stream_incomplete`, `turn_failed`처럼 구분해 trace와 로그에 남긴다.

## ADK 문서 사용

ADK 공식 문서는 repo에 모두 복제하지 않는다.
필요한 최신 내용은 `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 가져온다. 2.0 (Beta) 섹션(graph workflow, graph routes, dynamic workflow, human-input 노드, A2A)을 우선 조회한다.
이 저장소의 활성 문서는 ADK 2.0 (Beta)을 기본 baseline으로 작성한다.
작은 순차, 병렬, 반복, 사람 입력 흐름은 `workflow_kind`가 아니라 Graph IR node/container/edge로 표현한다.
MCP 결과와 직접 내려받은 공식 문서가 다르거나 현재 taxonomy와 충돌하면 구현을 멈추고 사용자에게 질문한다.
