# Validation

Agent Factory review artifact는 구현 계획이나 후속 작업에 쓰기 전에 검증해야 한다.
검증 목표는 raw requirement가 바로 코드, scaffold export, 실행 logic으로 건너뛰지 않게 하는 것이다.

## module-candidates.json

- `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
- `workflow_kind`는 `orchestration`, `graph`, `dynamic`, `unknown` 중 하나다.
- `agent`는 `agent_kind`, `adapter`는 `adapter_kind`, `remote_a2a`는 `remote_contract_kind`를 포함한다.
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

## Deferred scaffold-plan fixture

`scaffold-plan.json` schema와 template은 현재 제품 단계의 export 대상이 아니다.
이 파일은 향후 구현 handoff가 다시 범위에 들어올 때 사용할 검증 fixture이며, raw requirement를 실행 가능한 business logic으로 바꾸라는 지시가 아니다.

- source는 `approved_workbench_artifact`여야 한다.
- `approved` candidate만 포함한다.
- raw requirement는 직접 코드 생성 입력이 될 수 없다.
- Catalog-bound Agent, Workflow, Adapter, Remote A2A 항목은 runtime contract로 해석하되, 실제 runtime wiring과 configuration은 reviewed TODO boundary로 남긴다.
- Mock/test double 산출물은 catalog contract를 입력으로 만드는 별도 후속 기능이며, seed catalog나 scaffold-plan fixture의 기본 의미가 아니다.
- runnable business logic은 out of scope다.

## 검증 명령

```bash
node scripts/validate-artifacts.mjs templates
node scripts/validate-artifacts.mjs templates/regression-scenarios
cd packages/web && npm run build
```

문서만 변경한 경우에는 build 대신 구조와 링크 검증을 우선한다.
TypeScript, React, analyzer, schema, validator logic을 변경한 경우에는 `cd packages/web && npm run build`를 실행한다.
scaffold-plan fixture나 ADK source generator를 직접 변경한 경우에만 `node scripts/generate-adk-source.mjs ...`와 `python3 -m compileall ...` smoke를 추가한다.

## ADK 공식 문서 확인

ADK 공식 설명은 repo에 복제하지 않고 `adk-docs-mcp`에서 확인한다.
이번 taxonomy 기준은 `https://adk.dev/llms.txt`에서 출발해 `workflows`, `graph-routes`, `dynamic`, `human-input`, `a2a` 문서를 확인한 결과에 맞춘다.
공식 문서 다운로드본과 MCP 결과가 다르거나 모호하면 사용자에게 질문한다.
