# Validation

Agent Factory review artifact는 구현 계획이나 후속 작업에 쓰기 전에 검증해야 한다.
검증 목표는 raw requirement가 바로 코드, scaffold export, 실행 logic으로 건너뛰지 않게 하는 것이다.
Skill-led DLC 실행은 `artifacts/af/<req-id>/`를 기본 artifact root로 쓰고 `af-run-manifest.json`으로 단계를 연결한다.
Workbench는 Vite 미들웨어(`/api/af/*`, `/api/af-collab/*`, `/api/catalog`)를 통해 artifact root 디렉터리를 직접 읽고 쓰며, `manifest.approvals.*`를 게이트 UI의 단일 진실로 사용한다.
초기 분석 결과는 Analyze Stage Runner 또는 Landing/단계 import 버튼으로 `analysis-result.json`을 artifact root에 적재한다. Stage Runner 결과는 먼저 `runs/<stage>/<run-id>/proposed-artifacts/`에 저장되고, 사용자가 diff/preview 후 적용할 때 canonical artifact가 갱신된다.
현재 manifest는 lightweight contract이며 formal JSON Schema는 없다. Workbench parser는 core fields(`requirement_id`, `artifact_root`, `current_stage`, `stages`, `approvals`, `validation`)와 optional `stage_runs`를 tolerant하게 읽는다.
`scripts/validate-artifacts.mjs`는 `af-run-manifest.json`이 있을 때 core fields, stage/status enum, approval boolean, validation command/result, POSIX-style output path, optional `stage_runs` run id/status/output path를 검증한다. 더 깊은 artifact 존재 추적은 하지 않으며, 최종 artifact 검증은 여전히 `analysis-result.json`, split artifacts, `scaffold-plan.json` schema와 validator 명령을 기준으로 한다.

## module-candidates.json

- `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
- `workflow_kind`는 `orchestration`, `graph`, `dynamic`, `unknown` 중 하나다.
- `agent`는 `agent_kind`, `adapter`는 `adapter_kind`, `remote_a2a`는 `remote_contract_kind`를 포함한다.
- `catalog_entry_id`가 있으면 이 후보는 catalog-bound runtime contract에서 온 항목이다. DesignWorkbench(`/af/:reqId/design`)의 모듈 검토 패널은 원본 catalog entry를 직접 수정하지 않고 현재 분석 artifact의 입력/출력 override와 Graph 연결만 저장한다.
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
- module-bound node는 incoming edge와 outgoing edge를 각각 최소 1개 가져야 한다. 화면에 노드가 렌더링되더라도 고립 후보는 scaffold source가 될 수 없다.
- `remote_a2a` edge는 remote boundary crossing과 A2A contract id를 요구한다.
- 최종 Graph IR id는 canonical 형식이어야 한다. edge는 `edge-001` 같은 `edge-[0-9]+`, container는 `container-root` 같은 `container-[a-z0-9-]+`를 사용한다.
- DesignWorkbench의 모듈 검토 저장 후 재생성된 Graph IR은 analyzer 재실행 결과가 아니라 사용자가 검토한 module candidate와 입력/출력 연결을 기준으로 만든 artifact다. 기존 Graph IR에 일부 edge만 남아 있으면 유효한 edge metadata는 보존하되, 누락된 후보 연결은 모듈 검토 순서의 fallback edge로 보강해 고립 노드를 만들지 않는다.

## Live analyzer draft schema

`schemas/analysis-draft.schema.json`은 live Codex CLI의 내부 반환 계약이다.
이 schema는 저장/export artifact가 아니며, CLI 출력량을 줄이기 위한 compact transport shape다.
워크벤치 UI의 기본 Analyze 경로는 Stage Runner API(`/api/af/:reqId/stages/analyze/run`)다. Stage Runner가 내부적으로 Codex CLI 또는 skill 실행을 수행하고 proposed `analysis-result.json`을 만든 뒤, apply 시점에 `validateAnalysisResult`가 최종 artifact 형태를 검증한다. `/api/analyze-requirement` SSE compact-draft endpoint는 direct analyzer primitive로 유지되며, 외부 `af-analyze-requirement` producer가 만든 결과를 Landing/단계 import 버튼으로 적재하는 경로도 유지한다.

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
- Catalog 항목에 `runtime_mock`이 있으면 ADK Runtime Handoff는 해당 synthetic payload를 generated source의 deterministic stub output으로 포함할 수 있다.
- `runtime_mock`은 local smoke용 test double이며 synthetic data만 허용한다. private endpoint, credential, 실제 고객/은행 데이터, 운영 배포 logic을 담지 않는다.
- `runtime_contracts`는 MCP/EAI/Legacy Adapter, Context Manager, Callback Broker, ADK callback, async resume 계약의 reviewed handoff다. 필수 Runtime 계약이 `approved`가 아니거나 `needs_info` 정책을 남기면 source generation blocker가 된다.
- `a2aContracts`는 Remote A2A 후보의 reviewed handoff다. DesignWorkbench의 `Remote A2A` 탭에서 모든 Remote A2A 후보가 매칭 계약을 갖고 `contract_status: approved`이며 readiness issue가 없어야 `runtime_contracts_approved` 게이트를 새로 켤 수 있다.
- `output_mode`는 `smoke`(기본, 부재 시 smoke로 간주) 또는 `runnable`이다. validator는 `smoke`에서 모든 module이 `no_runnable_business_logic: true`와 category별 shell/stub `scaffold_output`을 갖도록, `runnable`에서는 `no_runnable_business_logic: false`와 `scaffold_output: "runnable"`을 갖도록 강제한다.
- `source: approved_workbench_artifact`와 `raw_requirement_to_code: false`는 두 mode 모두에서 불변이다. runnable mode도 raw requirement가 아니라 승인된 artifact에서만 source를 생성한다.
- adapter의 MCP 바인딩(`access_protocol: "mcp"` + `mcp_server` + `mcp_tool_name`)은 완전해야 하며 부분 바인딩은 validator가 거부한다. 바인딩이 없는 adapter는 unconnected로 표시되어 synthetic stub으로 생성된다.
- `af-build-runtime-stub` output은 기본적으로 `artifacts/af/<req-id>/runtime-stub/`에 생성한다. smoke는 synthetic TODO handoff를, runnable은 reviewed synthetic wiring(`LlmAgent` + Mock Lab MCP)을 emit하되 두 mode 모두 private endpoint, credential, 실데이터를 담지 않는다.

현재 ADK Runtime Handoff는 두 단계로 나뉘어 있다.

- `/af/:reqId/build` (BuildWorkbench)는 분석 + seed catalog를 입력으로 client-side에서 `scaffold-plan.json`을 도출해 artifact root에 PUT하고, `POST /api/af/:id/runtime-stub/build`로 `scripts/generate-adk-source.mjs`를 spawn해 `runtime-stub/`을 채운다. Scaffold plan 패널의 `smoke` / `runnable` 토글이 `output_mode`를 결정한다. `runnable`에서는 어댑터의 MCP 연결 상태(connected/unconnected)를 함께 표시하고, 실행에는 `runtime-stub/.env`의 `GOOGLE_API_KEY`가 필요하다. 생성된 파일 목록과 텍스트 미리보기(< 500KB)를 노출하고 `implementation-handoff.md`를 inline 편집한다. BuildWorkbench는 `StageShell`로 1실행(scaffold·stub 생성)·2검토(stub 파일·handoff)·3승인(`stub_ready_for_followup`)으로 나뉜다. ADK 런타임 연결은 BuildWorkbench가 아니라 게이트 없는 `실행` 화면에 있다(아래 `/af/:reqId/run` 참고).
- `/af/:reqId/run` (RunSandbox, 승인 게이트 없음)은 `runtime-stub/`이 존재하면 `runtime-stub/.venv`에 ADK dependency를 설치하고, 로컬 `adk api_server --with_ui`를 별도 포트(`8765`)로 시작/중지하며 상태를 폴링하고, ADK 공식 dev UI(`web_url`)를 새 탭으로 연다. AF 자체 간이 챗은 제거했다(ADK가 `--with_ui`로 완성도 높은 chat/trace UI를 이미 제공). `adk api_server`는 `runtime-stub/.env`를 자동 로드하므로 키가 spawn argv에 노출되지 않는다.
- `/af/:reqId/verify` (VerifyWorkbench)는 고정 allow-list(`validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web`) 세 명령만 child_process로 실행하고 stdout/stderr를 캡처해 `manifest.validation.{commands,last_result}`에 기록한다. `validation-report.md`와 `catalog-delta.yaml`을 inline 편집한다.

PR6 마이그레이션 전에 제공하던 `Smoke 일괄 실행` 매크로와 in-iframe `adk web` 임베딩은 워크벤치에 다시 추가하지 않는다. 현재는 게이트 없는 `실행` 화면(`/af/:reqId/run`)이 ADK 런타임 연결을 관리하고 ADK 공식 dev UI로 **링크**만 한다(iframe 임베드 아님, AF 자체 챗 아님). smoke 번들은 승인된 handoff의 synthetic `runtime_mock` payload와 TODO boundary만 노출하고, runnable 번들은 reviewed synthetic ADK `Workflow` wiring(Gemini `LlmAgent` + 연결된 Mock Lab MCP adapter)을 실행한다. 두 mode 모두 private endpoint, credential, 실제 고객/은행 데이터, 운영 배포 logic을 포함하지 않는다. VerifyWorkbench allow-list는 그대로 유지된다.

## Missing-information 2계층 게이트

분석 후 발생하는 누락 정보는 요구사항 수준과 후보 수준에서 다르게 다룬다.

- **Requirement-level (`evidence.missing_information`) — soft gate.** `/af/:reqId/analyze` (AnalyzeWorkbench)에서 항목별 "수용" 토글이 제공된다. 토글은 컴포넌트 내부 `acceptedMissing` state를 갱신하며 reviewer attestation으로만 사용하고 scaffold-plan 생성은 차단하지 않는다. `analysis_reviewed` 게이트는 모든 항목이 수용된 뒤에야 활성화된다.
- **Candidate-level (`ModuleCandidate.missing_information`, unresolved `status === "needs_info"`) — hard gate.** 누락 항목이 남아 있거나 Resolution Draft가 적용되지 않은 후보는 `approved`로 전환할 수 없다. Resolution Draft 적용은 Design Stage Runner(`af-design-boundaries`) 또는 동일 형태를 emit하는 외부 producer가 먼저 `runs/design/<run-id>/proposed-artifacts/`에 제안하고, reviewer가 diff/preview 후 apply할 때 canonical `analysis-result.json`에 반영한다.
- **Resolved review state.** 채워진 후보 record는 기존 누락 항목을 `resolved_missing_information`에 보존하고 `missing_information`을 비운다. 카탈로그 계약 후보도 동일 review state만 수정하며 카탈로그 원본 contract는 잠긴 상태로 유지된다.
- **Scaffold-plan blocker.** `missing_information.length > 0`이거나 `status === "needs_info"`인 후보가 남아 있으면 `scaffoldPlan.collectBlockers`는 "정보 필요 후보 N개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요." blocker와 동일 개수의 "정보 필요 후보 N개 — 모듈 검토에서 Resolution Draft 반영 필요" warning을 emit한다. BuildWorkbench는 이 blocker가 남아 있으면 `runtime-stub/build` POST를 차단한다.

## Artifact root 저장소

PR6 마이그레이션 이후 워크벤치는 in-browser save record(`SavedAnalysisRecord`)를 운용하지 않는다. `artifacts/af/<req-id>/`가 단일 저장소이며 다음 파일을 보관한다.

- `af-run-manifest.json` — stage status, approval gate, 마지막 validation 결과.
- `runs/<stage>/<run-id>/` — Stage Runner request, event stream, result summary, diff summary, proposed artifacts, diagnostics.
- `analysis-result.json` 및 분할 산출물(`commonization-notes.json`, `boundary-design.md`, `a2a-contracts.json`).
- `scaffold-plan.json`, `runtime-stub/`, `implementation-handoff.md`.
- `validation-report.md`, `catalog-delta.yaml`.
- `collaboration/{comments,highlights}.json`.

워크벤치는 위 경로를 `/api/af/*`, `/api/af-collab/*`로 직접 읽고 쓴다. `localStorage`는 최근 artifact root 캐시(`agent-factory:recent-artifact-roots`)와 댓글 composer 작성자 식별(`agent-factory:author-{name,role}`)만 보관한다.

### Saved-analysis fixture

`templates/saved-analysis-fixtures/`는 더 이상 UI 주입용이 아니다. 현재는 `scripts/validate-artifacts.mjs`가 `SavedAnalysisRecord` shape를 regression smoke로 검증하기 위한 fixture로만 쓴다.

- `catalog-needs-info.json`: 요구사항 수준 누락은 reviewer attestation으로 수용 가능하지만, 후보 수준 `ModuleCandidate.missing_information`은 승인과 source generation을 막는지 검증한다.
- `catalog-scaffold-ready.json`: 승인된 catalog-bound 후보가 `scaffoldReady=true`로 저장돼 source 생성 게이트를 통과하는지 검증한다.

fixture는 `moduleCandidates`를 top-level record와 `analysis.moduleCandidates` 양쪽에 같은 id/order로 저장해야 한다. validator는 두 위치를 함께 검증한다.

## Catalog contract registry

`catalog/contracts/`는 catalog entry를 mock 목록으로 바꾸지 않고, test double을 만들 수 있는 runtime contract 본문을 보관한다.

- `catalog/contracts/mcp/*.json`: `mcp_schema_ref`가 가리키는 MCP tool contract다. 각 파일은 `inputSchema`, `outputSchema`, `success_examples`, `error_examples`, `mock_response.structuredContent`를 포함한다.
- `catalog/contracts/a2a/*.json`: `runtime_binding: remote_a2a` 또는 Remote A2A 검토에 쓰는 A2A contract 본문이다. Agent Card, interface, message/task/artifact contract, auth, timeout, retry, fallback, audit, data policy와 synthetic task examples를 포함한다.

MCP/A2A fixture data는 synthetic sample만 사용한다. private endpoint, credential, deployment script, 실제 고객/은행 데이터는 catalog contract registry에 넣지 않는다.

## 검증 명령

```bash
node scripts/validate-artifacts.mjs templates
node scripts/validate-artifacts.mjs templates/regression-scenarios
node scripts/validate-artifacts.mjs templates/saved-analysis-fixtures
node scripts/validate-artifacts.mjs catalog/contracts
node scripts/validate-artifacts.mjs artifacts/af/<req-id>
node scripts/generate-adk-source.mjs artifacts/af/<req-id> artifacts/af/<req-id>/runtime-stub
cd artifacts/af/<req-id>/runtime-stub && python3 -B -m pytest -q -p no:cacheprovider
cd packages/web && npm run test:analyzer
cd packages/web && npm run build
```

문서만 변경한 경우에는 build 대신 구조와 링크 검증을 우선한다.
TypeScript, React, analyzer, schema, validator logic을 변경한 경우에는 `cd packages/web && npm run test:analyzer`와 `cd packages/web && npm run build`를 실행한다.
scaffold-plan 또는 ADK source generator를 직접 변경한 경우에는 `node scripts/generate-adk-source.mjs ...`, `python3 -m compileall ...`, generated stub `pytest` smoke를 추가한다. Runtime chat bridge를 검증할 때는 generated stub directory에서 `adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .`를 실행한 뒤 `runtime-chat-smoke.json`을 `/run`에 전송한다.

## ADK 공식 문서 확인

ADK 공식 설명은 repo에 복제하지 않고 `adk-docs-mcp`에서 확인한다.
이번 taxonomy 기준은 `https://adk.dev/llms.txt`에서 출발해 `2.0`, `graphs`, `workflows`, `dynamic`, `human-input`, `a2a` 문서를 확인한 결과에 맞춘다.
공식 문서 다운로드본과 MCP 결과가 다르거나 모호하면 사용자에게 질문한다.
