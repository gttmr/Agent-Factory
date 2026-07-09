# Analysis Guide

이 문서는 사용자 요구사항을 Agent Factory 분석 산출물로 바꾸는 기본 절차다.
현재 기본 운영 모델은 skill-led DLC 흐름이다. Workbench는 Analyze/Design Stage Runner 패널로 `af-analyze-requirement`, `af-design-boundaries` 실행을 서버에 요청하고, proposed artifact를 diff/preview 후 적용한다.
첫 사용자는 개발 리더이며, v1.0의 임시 은행 도메인은 `고객`, `수신`, `여신`, `카드`, `리스크`다.

## 분석 순서

1. Raw requirement와 requester context를 캡처한다.
2. 목표, 입력, 출력, 언급된 시스템, 위험 신호, 누락 정보, 모순, 가정을 정규화한다.
3. Evidence summary를 만든다. 추정은 추정으로, 확인된 사실은 확인된 사실로 분리한다.
4. 후보 모듈을 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나로 분류한다.
5. 선택한 category에 맞는 subtype을 채운다.
6. [Workflow decision guide](./workflow-decision-guide.md)에 따라 process flow를 그린다.
7. 개발 리더가 DesignWorkbench의 모듈 검토 패널에서 후보별 책임, 계약, Graph 연결을 검토한다.
8. `needs_info` 후보는 Design Stage Runner 또는 외부 `af-design-boundaries` producer가 제안한 Resolution Draft/patch를 diff로 확인한 뒤 canonical artifact에 적용한다.
9. 개발 리더가 각 후보를 `approved`, `deferred`, `rejected`, `needs_info` 중 하나로 결정한다.
10. Catalog review에서 기존 spec 재사용 여부와 신규 등록/제외 여부를 결정한다.
11. 승인된 후보만 `scaffold-plan`으로 묶고 `af-build-runtime-stub` 또는 ADK Runtime Handoff에서 TODO/runtime wiring 경계와 structural smoke 준비 상태를 확인한다.
12. `af-verify-feedback`로 검증 결과와 catalog delta 제안을 남긴다.

## 분석 결과 화면

Workbench의 `분석 결과` 단계는 보고서 화면이 아니라 모듈 검토 착수 전의 이해 확인 화면이다.
개발 리더는 상단의 핵심 계약 5개(`목표`, `도메인`, `입력`, `출력`, `시스템`)가 요구사항과 맞는지 확인한 뒤 `모듈 검토로 이동`한다.
가정, 누락 정보, 모순, 위험 신호, 정규화 JSON은 보조 근거 drawer에 둔다.
은행 도메인 요구사항은 위험 신호가 자주 발생하므로 위험 신호는 이 단계의 통과 조건이나 경고 피로를 만드는 주 배너로 쓰지 않는다.

## Workbench import

Workbench의 분석 단계는 두 경로를 지원한다. `/af/:reqId/analyze`에서 raw requirement 텍스트를 입력해 `af-analyze-requirement` Stage Runner를 실행할 수 있고, skill-led 운영에서 외부 producer가 만든 `artifacts/af/<req-id>/analysis-result.json`과 `af-run-manifest.json`을 browser file import로 올릴 수도 있다.
Import 연결 방식은 browser file import다. Workbench가 로컬 `artifacts/af` 디렉터리를 자동 감시하거나 manifest의 `artifact_root`와 `outputs[]` 경로를 따라 host filesystem을 직접 읽지는 않는다.
Import된 artifact는 live analyzer 응답과 같은 client-side normalization을 거쳐 `AnalysisResult`, `ModuleCandidate[]`, Runtime 계약, A2A 계약, Graph IR 상태로 hydrate된다.
Import된 manifest는 DLC 현재 단계, 단계별 완료 수, 승인 수, 마지막 검증 결과를 상태 요약으로 보여준다. `requirement_id`가 현재 분석 artifact와 다르면 연결하지 않는다.
누락 정보나 모순이 남아 있으면 `분석 결과` 단계로, 그렇지 않으면 `모듈 검토` 단계로 이동해 reviewer가 검토를 계속한다.
검토 후 canonical artifact는 `artifacts/af/<req-id>/`에 그대로 남는다. Stage Runner 결과는 `runs/<stage>/<run-id>/`에 보존되고, 적용된 artifact와 manifest는 같은 root에서 파일로 확인한다.

## 산출물 의미

- `analysis-result.json`: `normalizedRequirement`, evidence, module candidates, Graph IR, Runtime 계약, A2A 계약을 담는 canonical combined artifact다.
- `normalized-requirement.json`: 요구사항을 구조화한 split convenience artifact다.
- `analysis-summary.md`: 분류 근거, 위험, 누락 정보, 가정을 사람이 빠르게 검토할 수 있게 요약한 문서다.
- `module-candidates.json`: 검토 대상 모듈 후보.
- `resolution_draft`: 정보 필요 후보를 승인 가능한 artifact로 바꾸기 위한 후보별 LLM 초안. 자동 적용되지 않고 Design Stage Runner diff 또는 모듈 검토 패널에서 검토 후 반영한다.
- `process-flow.json`: 후보 모듈 사이의 local 또는 Remote A2A 흐름.
- `commonization-notes.json`: shared agent, adapter catalog, workflow reuse 후보 요약. 실제 등록/제외 결정은 Catalog review에서 한다.
- `scaffold-plan.json`: 승인된 workbench artifact만 입력으로 하는 ADK Runtime Handoff 계약이다. repo 안의 template/schema는 이 계약을 검증하는 fixture로도 사용한다.
- `af-run-manifest.json`: `artifacts/af/<req-id>/` 안에서 단계 상태, 출력 경로, 승인 상태, 검증 evidence를 연결하는 가벼운 manifest다.
- `runs/<stage>/<run-id>/`: Stage Runner 실행 evidence다. `request.json`, `events.jsonl`, `result-summary.json`, `diff-summary.json`, 실패 시 `diagnostics.md`를 담는다. Analyze/Design은 `proposed-artifacts/*`를 diff/apply 대상으로 쓰고, Build는 canonical `runtime-stub/` 출력 목록을 기록하며, Verify는 `validation-report.md`와 `catalog-delta.yaml` proposal을 남긴다.
- `runtime-stub/`: 승인된 `scaffold-plan.json`에서 생성한 source bundle이다. 기본 smoke 모드는 TODO source이고 runtime wiring/business logic은 후속 구현 task에서 채운다. 승인된 `output_mode: runnable` 은 `LlmAgent` + Mock Lab MCP 어댑터로 실행 가능한 ADK 2.3 `Workflow` 를 생성한다(둘 다 raw requirement가 아닌 승인 artifact에서만 생성).
- `validation-report.md`: 검증 명령과 결과, 남은 위험을 기록한다.
- `catalog-delta.yaml`: catalog 재사용/등록/수정 제안이다. 실제 `catalog/*.yaml` 반영은 Reuse Hub `등록 승인` publish 경로 또는 human PR merge 로만 처리한다.

## 분석 원칙

- 새 taxonomy 값을 만들지 않는다. 값은 [Taxonomy](./taxonomy.md)를 따른다.
- 여러 단계가 있다는 이유만으로 `remote_a2a`를 만들지 않는다.
- MCP tool, retrieval, grounding, external service는 우선 `adapter` 후보로 본다.
- Catalog entries는 mock이 아니라 reusable runtime contract로 해석한다. Mock/test double 생성은 별도 후속 기능이며 분석 산출물에 mock-only 후보를 섞지 않는다.
- 공통 Workflow가 `runtime_binding: remote_a2a`로 등록되어 있어도 `module_category`는 `workflow`로 유지한다. 독립 원격 Agent 계약 증거가 있을 때만 `module_category: remote_a2a`를 만든다.
- ADK component는 category가 아니다. 필요하면 module candidate의 ADK hint로 남긴다.
- 고객 영향, 금융정보, 거래 쓰기, 신용 판단 지원은 위험 신호로 남기고 사람 검토를 요구한다.
- Raw requirement는 직접 business logic 코드 생성으로 이어지지 않는다. ADK Runtime Handoff는 승인된 후보와 `scaffold-plan`만 사용하며, 생성물은 실제 runtime 설정과 비즈니스 로직을 TODO 경계로 남긴다.
- LLM이 만든 Resolution Draft는 승인 근거가 아니라 검토 초안이다. object schema와 smoke 계약은 개발 리더가 DesignWorkbench에서 확인하고 명시적으로 적용해야 scaffold 입력으로 쓰인다.

## Live analyzer 실행 계약

Analyze Stage Runner는 raw requirement 입력 경로에서 Codex TypeScript SDK 실행을 요청할 수 있다. Skill-led 운영에서는 외부 `af-analyze-requirement` 실행 결과를 import할 수도 있고, workbench는 후속 preview/apply, 시각화, guided edit의 보조 표면이 된다.
단, direct live analyzer primitive가 최종 `AnalysisResult` 전체를 한 번에 생성하지 않는다는 기존 계약은 유지한다.

- Codex TypeScript SDK에는 `schemas/analysis-draft.schema.json` compact draft schema를 `outputSchema` turn option으로 전달한다.
- 실행 시 `/tmp/agent-factory-codex-*/analyzer-context-index.md`를 만들어 active docs, schema, catalog 위치와 주요 section을 안내한다.
- 모델은 index를 지도처럼 사용하고, 정확한 판단이 필요하면 원본 `docs/`, `schemas/`, `catalog/` 파일을 `rg`나 bounded `sed`로 직접 확인한다.
- Compact draft에는 분류 판단, rationale, `catalog_entry_id`, Graph IR topology 같은 결정 정보를 담는다.
- 서버는 draft를 catalog와 schema 기본값으로 hydrate해 기존 `AnalysisResult` 형태로 만든 뒤 기존 Graph IR/A2A normalization과 validation을 수행한다.
- Spark 모델에서 실패해도 다른 모델로 자동 fallback하지 않는다. 실패 원인은 `max_output_tokens`, `context_window_exceeded`, `stream_incomplete`, `turn_failed`처럼 구분해 trace와 로그에 남긴다.

## ADK 문서 사용

ADK 공식 문서는 repo에 모두 복제하지 않는다.
필요한 최신 내용은 `adk-docs-mcp`에서 `https://adk.dev/llms.txt`를 출발점으로 가져온다. 현재 target은 ADK 2.3이며, ADK 2.0 문서(graph workflow, graph routes, dynamic workflow, human-input 노드, A2A)는 GA 역사와 분류 축을 확인할 때 사용한다.
이 저장소의 활성 문서는 ADK 2.3을 기본 baseline으로 작성한다. ADK Python 2.0은 2026년 5월 19일 GA로 문서화되어 있고, 현재 Runtime Handoff target은 `google-adk` 2.3.0이다.
작은 순차, 병렬, 반복, 사람 입력 흐름은 `workflow_kind`가 아니라 Graph IR node/container/edge로 표현한다.
MCP 결과와 직접 내려받은 공식 문서가 다르거나 현재 taxonomy와 충돌하면 구현을 멈추고 사용자에게 질문한다.
