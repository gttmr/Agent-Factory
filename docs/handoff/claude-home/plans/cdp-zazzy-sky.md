# CDP 페이지 추천 워크플로우 — 실데이터 기반 고도화

## Context

저장된 아티팩트 `artifacts/af/req-page-recommendation-required/` (CDP "1-1 페이지 추천(필수)" 워크플로우)는
현재 Mock Lab MCP 도구 4종이 **추상 플레이스홀더**(`PAGE_B/GROUP_B`, "적금 가입 입력", 합성 펀넬 0.42,
고객수 5634)만 반환한다. 회의에서 받은 실제 상품/페이지 샘플 데이터(3개 테이블)를 반영해
"제대로 된" 워크플로우로 고도화한다.

**핵심 제약(확인됨):** Mock Lab 도구는 입력 검증 후 고정 `successResponse`만 반환한다
(`packages/mock-lab/server/mockSpecRuntime.ts` — 입력별 동적 필터링/템플릿 없음, `no_production_business_logic`는
강제 가드레일). 따라서 "실데이터"는 **실제 값으로 채운 현실적인 고정 후보셋**을 의미하며, smoke objective
(예적금 가입 과정 이탈/전환)에 맞춰 튜닝한다.

샘플 데이터 출처(3 테이블):
- **표1 목적 분류체계**: 상품 / {IRP, ISA, 노란우산, 신용대출, 예금, 외화예금, 요구불, 적금, 청약, 펀드} / 신규
- **표2 페이지 메타** (10개): 화면ID·화면대/중분류·행동대/중분류·화면 경로·상품/이벤트 영역(0/1)·설명
- **표3 페이지×상품** (9행): 화면ID → 상품코드/상품명/상품분류(수신·여신). 이벤트 컬럼은 전부 공란.

## 확정된 설계 결정 (사용자 Q&A)

1. **범위**: mock 도구 추가/재설계 + 소소한 노드 추가(목적분류·2차 검색).
2. **목적 분류**: taxonomy 도구가 표1 카테고리를 제공 → **LLM 에이전트가 분류** → 분류 후 사람이 확인 → 검색.
3. **Page Group 제거**: `page_group_id` 개념을 워크플로우 전반에서 삭제. 대신 **다중 페이지 선택**을 도입.
4. **검색 2회**: 표2 페이지 메타 검색 + 표3 페이지×상품 검색을 **독립 병렬** 호출 후 머지.
5. **머지 노드**: 기존 1차 선택 Agent(LLM, `node-select-initial-page`)가 두 검색 결과를 받아 다중 후보 선택.
6. **하위 분석 3종**(UserFlow/시나리오/T2S): 합성 수치 유지하되 참조 `page_id`를 실데이터로 정합화, page_group 제거.
7. **적용/검증**: artifact root 수정 → runtime-stub 재생성 → validator + web build 통과(+가능 시 ADK smoke). 템플릿 seed 동기화.

## 목표 노드 토폴로지

```
input
  → [NEW] get-scenario-taxonomy (adapter_call, mock: get_scenario_taxonomy)   # 표1 카테고리 제공
  → [NEW] classify-objective (agent/LLM)                                       # objective_text → {대,중,소}분류
  → confirm-purpose (human_input)            # 사람이 분류·시나리오 확정 (기존 노드 재배치)
  → fan-out (병렬 2 검색):
       ├ search-page-candidates  (adapter_call, mock: search_page_candidates)  # 표2, page_group 제거, 전체 페이지 반환
       └ [NEW] search-page-products (adapter_call, mock: search_page_products) # 표3 페이지×상품
  → select-initial-page (agent/LLM)          # fan-in: 두 검색 머지 → 다중 page_id 후보
  → confirm-analysis-execution (human_input)
  → analysis-router (router)
       ├ run_analysis → build-analysis-input (function)
       │     → fan-out: run-userflow-analysis · run-scenario-recommendation · run-t2s-analysis (adapter_call ×3)
       │     → fan-in: synthesize-analysis (agent/LLM)
       │     → confirm-final-selection
       └ skip_analysis → confirm-final-selection
  → confirm-final-selection (human_input)     # 다중 페이지 최종 선택 (Page Group 표현 삭제)
  → call-workflow-1-2 (workflow_call placeholder)
  → output
```

신규 노드 3개: `node-get-scenario-taxonomy`, `node-classify-objective`, `node-search-page-products`.
신규 모듈 3개: `mod-scenario-taxonomy`(adapter/retrieval, mcp), `mod-objective-classifier`(agent/specialist),
`mod-page-product-search`(adapter/retrieval, mcp).

## Mock 도구 변경 (mock-lab/mock-spec.json — 서버 `wf-page-recommendation-mock`)

신규/변경 도구 successResponse는 **표1~3 실제 값**으로 채운다.

- **NEW `get_scenario_taxonomy`**: input `objective_text`(nominal). output `categories[] = {대분류, 중분류, 소분류}` — 표1 10행 그대로(상품/IRP/신규 … 상품/펀드/신규).
- **`search_page_candidates`** (변경): output `page_candidates[]`에서 `page_group_id` 제거. 각 후보 = `{page_id(화면ID), page_name(경로 말단/설명 기반), 화면대분류명, 화면중분류명, 행동대분류, 행동중분류, page_path(화면 경로), product_event_area(0/1), description, rag_score}`. 표2의 10개 페이지 전체를 score 내림차순으로 반환(예적금 가입 퍼널 STEP01~04·상품상세 상위, 메인/혜택 하위).
- **NEW `search_page_products`**: input `objective_text`/`product_class`(nominal). output `page_products[] = {page_id, product_code, product_name, product_class(수신/여신), 화면대분류명, 화면중분류명, page_path}` — 표3 9행. (이벤트 필드는 공란이므로 스키마에 두지 않거나 빈 확장 슬롯으로만 둠.)
- **`run_userflow_analysis` / `recommend_scenario_by_behavior_type` / `analyze_page_customer_relation`** (변경): 합성 수치(dropoff/score/customer_count) 유지, 단 `page_group_id`/`selected_page_group_ids`/`related_page_group_id` 제거하고 실제 `page_id`(예: NWDID00019_004M)·실제 상품명/시나리오명으로 정합화. 입력은 `selected_page_ids`(다중)만.

각 도구 `inputSchema`/`outputSchema`도 위 변경에 맞춰 갱신하고 `successResponse`가 `outputSchema`를 통과하도록 유지
(`schemaValidation.ts`가 빌드시 검증). 가드레일 블록은 그대로.

## 데이터 흐름 / Page Group 제거 영향

- **분류 → 검색**: classify-objective 출력(중분류=상품유형)을 `product_hint`로 두 검색에 전달.
- **검색 → 선택**: 두 검색 출력이 `node-select-initial-page`(LLM)의 입력으로 fan-in. LLM이 page_id 기준으로
  페이지 메타+상품 매핑을 결합해 **다중 page_id** 후보와 근거 생성.
- **선택 → 분석/최종**: `selected_page_ids`(배열) 단일 채널로 하류 전달. `selected_page_group_ids` 채널 전부 삭제.
- 에이전트 instruction(초기 선택/종합)과 human_gate 라벨에서 "Page/Page Group" → "페이지(다중)" 문구로 교체.
- `output_schema` 라벨(`initial_page_selection.v1`, `final_page_selection.v1` 등)은 유지하되 내부 형상에서 group 필드 제거.

## 변경 파일

아티팩트(주 편집):
- `artifacts/af/req-page-recommendation-required/analysis-result.json` — 모듈 3개 추가, graph IR 노드/엣지 추가·재배선, page_group 제거, smoke_spec/synthetic_inputs 갱신.
- `.../scaffold-plan.json` — 신규 모듈 3개의 scaffold 항목(`mcp_server`, `mcp_tool_name`, `mock_binding`, `smoke_spec`, instruction 등) 추가, graph 미러 갱신, page_group 제거.
- `.../module-candidates.json`, `.../process-flow.json` — 미러 뷰 동기화.
- `.../mock-lab/mock-spec.json` — 위 도구 추가/변경.
- `.../normalized-requirement.json`, `analysis-summary.md`, `boundary-design.md`, `implementation-handoff.md` — Page Group/도구 추가 반영(문구 수준).

재생성:
- `scripts/generate-adk-source.mjs artifacts/af/req-page-recommendation-required <stub>` 로 `runtime-stub/` 재생성.

템플릿 seed 동기화(회귀 기준):
- `templates/regression-scenarios/wf-page-recommendation-required/{analysis-result.json, scaffold-plan.json, mock-lab/mock-spec.json}`.

**범위 밖(편집 금지):** `catalog/*.yaml`은 직접 편집 금지(publish 게이트 전용) — mock 데이터는 아티팩트
`mock-lab/mock-spec.json`에 자족적으로 존재하므로 카탈로그 변경 불필요. ADK 런타임/생성기 코어, 글로벌 스키마,
analyzer 로직은 변경하지 않는다(이번 작업은 단일 아티팩트 데이터/토폴로지 변경).

## 재사용할 기존 패턴/유틸

- Mock 서빙: `packages/mock-lab/server/mockSpecRuntime.ts`(고정 successResponse), 스키마 `packages/mock-lab/schemas/mock-spec.schema.json`.
- 생성기 디스패치: `scripts/generate-adk-source.mjs` `NODE_LOWERING`(agent / connected_adapter / human_input / router …) — 신규 노드는 기존 핸들러로 그대로 lowering, 새 핸들러 불필요.
- fan-out/fan-in: 기존 분석 구간(build-analysis-input → 3 adapter → synthesize) 패턴을 검색 구간(2 검색 병렬 → 선택 agent)에 동일 적용.
- 검증기: `scripts/validate-artifacts.mjs`(taxonomy·subtype·mock_binding·Stage Runner 메타).

## Verification

1. `node scripts/validate-artifacts.mjs artifacts/af/req-page-recommendation-required` → 통과.
2. `node scripts/generate-adk-source.mjs artifacts/af/req-page-recommendation-required artifacts/af/req-page-recommendation-required/runtime-stub` → 신규 노드/도구가 stub에 생성됨 확인(adapters.py에 `_fn_mod_scenario_taxonomy`, `_fn_mod_page_product_search`; agents.py에 classify 에이전트).
3. `cd packages/web && npm run build` (tsc --noEmit && vite build) → 통과.
4. 공유 ADK venv로 `python -m compileall` + 가능 시 `adk api_server --with_ui`(8765)로 `/run` smoke: 분류 → 사람확인 → 병렬 2검색 → 다중선택 → (분석) → 최종선택 → WF1-2 placeholder까지 진행, 이벤트 트레이스에 실제 화면ID/상품명 노출 확인.
5. `node scripts/validate-artifacts.mjs templates/regression-scenarios/wf-page-recommendation-required` → 템플릿 seed 동기화 검증.
6. `grep -rn page_group` 로 잔존 참조 0 확인.

## 가정 / 리스크 (구현 중 검증)

- **이벤트 차원**: 샘플 이벤트 컬럼이 전부 공란 → 이번엔 상품(수신/여신) 중심으로 모델링, 이벤트는 빈 확장 슬롯으로만 둔다. (추후 데이터 제공 시 확장)
- **고정 응답 한계**: search는 입력과 무관하게 동일 후보셋 반환. smoke objective(예적금 가입 이탈/전환)에 맞춰 현실적으로 튜닝. 입력별 분기가 꼭 필요해지면 별도 과제(플랫폼/생성기 변경).
- **fan-out 출발 노드**: 두 검색을 human_input 게이트에서 직접 fan-out할 때 생성기 lowering이 정상인지 build/generate로 검증. 문제 시 게이트 직후 소형 function 노드(`build-search-input`)를 fan-out origin으로 삽입(기존 build-analysis-input 패턴 재사용).
- **다중 채널 정합**: `selected_page_ids` 단일 다중 채널 사용. edge `state_key` 충돌(한 producer가 상충 키 출력) 금지 규칙(CLAUDE.md) 준수.
- **decision-log/docs**: 단일 아티팩트의 데이터/토폴로지 변경이라 글로벌 계약(스키마/게이트/UX) 변화 없음 → decision-log 항목 불필요로 판단. 구현 중 글로벌 계약을 건드리게 되면 `docs/decision-log.md` 추가.
