# Validation

Agent Factory review artifact는 구현 계획이나 후속 작업에 쓰기 전에 검증해야 한다.
검증 목표는 raw requirement가 바로 코드, scaffold export, 실행 logic으로 건너뛰지 않게 하는 것이다.

## module-candidates.json

- `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
- `workflow_kind`는 `orchestration`, `graph`, `dynamic`, `unknown` 중 하나다.
- `agent`는 `agent_kind`, `adapter`는 `adapter_kind`, `remote_a2a`는 `remote_contract_kind`를 포함한다.
- `catalog_entry_id`가 있으면 이 후보는 catalog-bound runtime contract에서 온 항목이다. Module Review는 원본 catalog entry를 직접 수정하지 않고 현재 분석 artifact의 입력/출력 override와 Graph 연결만 저장한다.
- `status`는 `approved`, `deferred`, `rejected`, `needs_info` 중 하나다.
- `missing_information`은 후보별로 승인 전 필요한 정보를 담는 문자열 배열이다.
- `legacy_recommended_type`은 migration metadata로만 사용한다.

## process-flow.json

`process-flow.json`과 `analysis-result.json:processFlow`는 native Graph IR이어야 한다.

- root에는 `requirement_id`, `graph_id`, `root_workflow_module_id`, `nodes`, `edges`, `containers`, `lanes`, `validation`이 있어야 한다.
- node는 `node_kind`를 사용한다. legacy `type`과 `subtype`은 새 artifact에서 금지된다.
- edge는 `edge_kind`, `execution_semantics`, `data_label`을 사용한다. legacy `edge_type`, `data`, `data_channel`은 새 artifact에서 금지된다.
- `parallel_region`은 두 개 이상의 entry node와 join 경로가 있어야 한다.
- `loop_region`은 `loop_back`과 `loop_exit` edge가 있어야 한다.
- `human_input` node는 downstream edge가 있어야 한다.
- `remote_a2a` edge는 remote boundary crossing과 A2A contract id를 요구한다.
- 최종 Graph IR id는 canonical 형식이어야 한다. edge는 `edge-001` 같은 `edge-[0-9]+`, container는 `container-root` 같은 `container-[a-z0-9-]+`를 사용한다.
- Module Review 저장 후 재생성된 Graph IR은 analyzer 재실행 결과가 아니라 사용자가 검토한 module candidate와 입력/출력 연결을 기준으로 만든 artifact다.

## Live analyzer draft schema

`schemas/analysis-draft.schema.json`은 live Codex CLI의 내부 반환 계약이다.
이 schema는 저장/export artifact가 아니며, CLI 출력량을 줄이기 위한 compact transport shape다.

- Draft는 `normalizedRequirement`, `evidence`, `moduleCandidates`, `processFlow`의 결정 정보를 담는다.
- Catalog reuse 후보는 반복되는 inputs/outputs/runtime metadata 대신 `catalog_entry_id`와 필요한 override만 담을 수 있다.
- Draft Graph IR은 node/edge 중심의 compact shape를 허용하고, 서버가 containers, lanes, nullable/default fields를 hydrate한다.
- Draft prompt와 schema는 canonical edge/container id 예시를 제공한다. 그래도 runtime은 `e-001`, `c-root` 같은 축약 id를 final artifact 저장/검증 전에 보정하는 방어선을 둔다.
- Graph IR soft validation은 load/migration/client backstop에서 반복 실행될 수 있으므로 structural error를 누적 append하지 않고 현재 정규화 결과 기준으로 다시 계산한다.
- Codex `--output-schema` response format 제약 때문에 draft schema의 모든 object는 `properties`의 모든 key를 `required`에 포함하고, 값이 없을 수 있는 필드는 nullable로 표현한다.
- Hydrated 결과는 기존 `AnalysisResult` shape와 validator 기준을 통과해야 한다.
- Draft schema 변경은 analyzer/server contract 변경이므로 `cd packages/web && npm run build` 검증 대상이다.

## Scaffold-plan and ADK Runtime Handoff

`scaffold-plan.json` schema와 template은 현재 ADK Runtime Handoff의 검토 게이트 계약이다.
이 파일은 raw requirement를 실행 가능한 business logic으로 바꾸라는 지시가 아니라, 승인된 module candidate만 source handoff에 포함되는지 검증하는 계약이다.

- source는 `approved_workbench_artifact`여야 한다.
- `approved` candidate만 포함한다.
- raw requirement는 직접 코드 생성 입력이 될 수 없다.
- Catalog-bound Agent, Workflow, Adapter, Remote A2A 항목은 runtime contract로 해석하되, 실제 runtime wiring과 configuration은 reviewed TODO boundary로 남긴다.
- Mock/test double 산출물은 catalog contract를 입력으로 만드는 별도 후속 기능이며, seed catalog나 scaffold-plan의 기본 의미가 아니다.
- runnable business logic은 out of scope다.

ADK Runtime Handoff 화면은 생성된 source bundle을 대상으로 다음 개발용 smoke를 제공한다.

- generated output directory에 `scaffold-plan.json`과 ADK source bundle을 쓴다.
- local `.venv`를 만들고 `requirements.txt` 기준으로 ADK dependency를 설치할 수 있다.
- `compileall`과 `pytest`로 generated source의 구조 검증을 실행한다.
- `adk web`을 시작하고 선택된 app URL을 workbench 안에 iframe으로 임베딩한다.
- ADK API server의 session 생성 endpoint와 `/run` endpoint를 호출해 같은 app에 대한 채팅 smoke를 실행한다.

이 임베딩/채팅 smoke는 개발 검증용이다. ADK Web은 공식 문서상 production deployment용 UI가 아니며, 배포 UI나 운영 인증 흐름으로 간주하지 않는다.

## Missing-information 2계층 게이트

분석 후 발생하는 누락 정보는 요구사항 수준과 후보 수준에서 다르게 다룬다.

- **Requirement-level (`evidence.missing_information`) — soft gate.** AnalysisResult 화면에서 항목별 "수용" 토글이 제공된다. 토글은 `acceptedMissing` 배열을 갱신하며 reviewer attestation으로만 사용한다. scaffold-plan 생성은 차단하지 않는다. 저장 record와 ADK Runtime Handoff 화면(`요구사항 누락 수용 N건` chip)으로 흐름이 보존된다.
- **Candidate-level (`ModuleCandidate.missing_information`, `status === "needs_info"`) — hard gate.** 누락 항목이 남아 있거나 상태가 `needs_info`인 후보는 status select로 `approved`를 고를 수 없다. Module Review 인스펙터에서 후보별 `missing_information_resolution`을 입력한 뒤 `해결하고 승인`을 실행해야 한다.
- **Resolved review state.** `해결하고 승인`은 기존 누락 항목을 `resolved_missing_information`에 보존하고, `missing_information`을 비우며, 후보 상태를 `approved`로 바꾼다. 카탈로그 계약 후보도 같은 review state만 수정하며 카탈로그 원본 contract는 잠긴 상태로 유지된다.
- **Scaffold-plan blocker.** `status === "needs_info"`이거나 `missing_information.length > 0`인 후보가 있으면 `scaffold-plan.validation.blockers`는 "정보 필요 후보 N개를 모듈 검토에서 해결하고 승인하세요." 메시지를 emit한다. unresolved 후보 개수는 `validation.warnings`에 "정보 필요 후보 N개 — 모듈 검토에서 해결 메모 필요"로 누적된다.

ADK Runtime Handoff 화면은 `scaffoldPlan.validation.can_generate_source` 또는 Graph IR error로 준비되지 않은 경우 상단에 empty-state 패널과 "모듈 검토로 이동" 버튼을 노출한다. 이는 사유 안내와 한 번에 모듈 검토로 돌아가는 deep link 역할을 한다.

## 저장된 분석 record와 landing step

`SavedAnalysisRecord`는 다음 필드를 포함한다.

- `catalogEntries`: 저장 시점 세션의 활성 catalog entry snapshot(`provenance !== "session_deleted"`). 시드 catalog 진화에 따른 silent drift를 차단한다.
- `activeStep`: 저장 시점 wizard step. 마이그레이션 안전망 역할.
- `scaffoldReady`: 저장 시점 `buildScaffoldPlan(...).validation.can_generate_source && processFlow.validation.errors.length === 0`.

`loadSavedAnalysis`는 다음 규칙으로 landing step을 선택한다.

- `scaffoldReady === true` → `export`로 진입.
- 모든 후보가 `needs_info`가 아니지만 `can_generate_source`가 false → `modules`.
- 그 외 → `analysis`.

Catalog는 시드가 아니라 record snapshot으로 교체된다. backfill은 구버전 record에 안전한 기본값을 채우며 candidate status는 절대 자동 승격하지 않는다.

### 저장 분석 fixture

`templates/saved-analysis-fixtures/`는 localStorage 주입용 `SavedAnalysisRecord` fixture를 보관한다.

- `catalog-needs-info.json`: 요구사항 수준 누락은 `acceptedMissing`으로 수용할 수 있지만 후보 수준 `ModuleCandidate.missing_information`은 승인과 source generation을 막는지 검증한다.
- `catalog-scaffold-ready.json`: 승인된 catalog-bound 후보가 `scaffoldReady=true`로 저장되고 ADK Runtime Handoff 화면에 바로 진입할 수 있는지 검증한다.

fixture는 `moduleCandidates`를 top-level record와 `analysis.moduleCandidates` 양쪽에 같은 id/order로 저장해야 한다. 저장된 record loader는 top-level `moduleCandidates`를 화면의 검토 상태로 사용하므로 둘이 다르면 visual smoke가 실제 저장 흐름과 달라진다.

## Catalog contract registry

`catalog/contracts/`는 catalog entry를 mock 목록으로 바꾸지 않고, test double을 만들 수 있는 runtime contract 본문을 보관한다.

- `catalog/contracts/mcp/*.json`: `mcp_schema_ref`가 가리키는 MCP tool contract다. 각 파일은 `inputSchema`, `outputSchema`, `success_examples`, `error_examples`, `mock_response.structuredContent`를 포함한다.
- `catalog/contracts/a2a/*.json`: `runtime_binding: remote_a2a` 또는 Remote A2A 검토에 쓰는 A2A contract 본문이다. Agent Card, interface, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy와 synthetic task examples를 포함한다.

MCP/A2A fixture data는 synthetic sample만 사용한다. private endpoint, credential, deployment script, 실제 고객/은행 데이터는 catalog contract registry에 넣지 않는다.

## Smoke 일괄 실행 매크로

ADK Runtime Handoff 화면은 `generate → install → start-web → check-web → chat-smoke` 순서를 자동으로 실행하는 "Smoke 일괄 실행" 매크로를 제공한다. 각 단계의 진행 상태(`pending/running/ok/fail`)를 step list pill로 노출하고 실패 시 후속 단계를 차단한다. 단계별 버튼도 계속 사용 가능하며 디버그 용도다.

runtime mode가 `stub`이거나 chat-smoke 응답 이벤트에 `"stubbed_runtime_contract"` 표식이 포함되면 임베드 패널 상단에 노란 stub 배너가 표시된다: "스텁 런타임 — graph 구조만 검증합니다. 실제 모델/어댑터 호출은 발생하지 않습니다." 이는 stub 출력이 실제 비즈니스 로직이 아님을 reviewer에게 명시한다.

## 검증 명령

```bash
node scripts/validate-artifacts.mjs templates
node scripts/validate-artifacts.mjs templates/regression-scenarios
node scripts/validate-artifacts.mjs templates/saved-analysis-fixtures
node scripts/validate-artifacts.mjs catalog/contracts
cd packages/web && npm run build
```

문서만 변경한 경우에는 build 대신 구조와 링크 검증을 우선한다.
TypeScript, React, analyzer, schema, validator logic을 변경한 경우에는 `cd packages/web && npm run build`를 실행한다.
scaffold-plan 또는 ADK source generator를 직접 변경한 경우에는 `node scripts/generate-adk-source.mjs ...`와 `python3 -m compileall ...` smoke를 추가한다.

## ADK 공식 문서 확인

ADK 공식 설명은 repo에 복제하지 않고 `adk-docs-mcp`에서 확인한다.
이번 taxonomy 기준은 `https://adk.dev/llms.txt`에서 출발해 `workflows`, `graph-routes`, `dynamic`, `human-input`, `a2a` 문서를 확인한 결과에 맞춘다.
공식 문서 다운로드본과 MCP 결과가 다르거나 모호하면 사용자에게 질문한다.
