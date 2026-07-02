# 15 — Catalog-first workflow rebuild runtime gaps

Status: 코드 수정 완료 (1–6), ADK Web static asset NIT 남음
Created: 2026-06-29

## Context

`req-page-recommendation-required`를 catalog-first 재생성 시나리오로 다시 통과시켰다.

- Backup: `artifacts/af/_backups/req-page-recommendation-required-20260629T165743+0900/af-root`
- Active artifact: `artifacts/af/req-page-recommendation-required`
- Catalog seed was reduced to the modules used by this workflow only.
- Stage Runner analyze run: `20260629T080208Z-analyze-675e3a`
- Stage Runner design run: `20260629T080711Z-design-47df49`
- Runtime Handoff regenerated in runnable mode.
- Manual QA used ADK 2.3.0 Web UI at `http://127.0.0.1:8765/dev-ui/?app=req_page_recommendation_required_adk` with Mock Lab on `http://127.0.0.1:5176/`.

The artifact can run through ADK Web to the final Workflow 1-2 placeholder, but the run exposed repo-level gaps that should be fixed before treating this as the happy path.

## Verified Evidence

2026-06-29 code-level follow-up verification:

- `cd packages/web && npm run test:analyzer` passed.
- `cd packages/web && npm run build` passed.
- `node scripts/validate-artifacts.mjs artifacts/af/req-page-recommendation-required` passed.
- `node scripts/validate-artifacts.mjs catalog/contracts` passed.
- Regenerated `artifacts/af/req-page-recommendation-required/runtime-stub`; generated bundle checks passed:
  - `python -m compileall req_page_recommendation_required_adk`
  - `python -m pytest -q` -> `4 passed, 4 warnings`
- Direct generated router assertions passed for both `{"response": 2}` and `{"response": "skip_analysis"}`.
- ADK Web 8765 + Mock Lab 5176 smoke:
  - API resume with numeric `2` routed to `skip_analysis`, did not execute analysis adapters, and reached `사용자 최종 Page(다중) 선택`.
  - UI smoke accepted numeric `2` in the analysis route `RequestInput` and advanced to `사용자 최종 Page(다중) 선택`.
- Workbench route map screenshots:
  - `.playwright-cli/page-2026-06-29T09-48-46-874Z.png` — router node route map visible.
  - `.playwright-cli/page-2026-06-29T09-49-02-546Z.png` — selected router inspector route map visible.
  - `.playwright-cli/page-2026-06-29T09-51-22-639Z.png` — ADK Web UI after numeric `2` reached final selection prompt.

Original scenario evidence:

- `node scripts/validate-artifacts.mjs artifacts/af/req-page-recommendation-required` passed.
- `node scripts/validate-artifacts.mjs catalog/contracts` passed.
- Runtime generation succeeded via `POST /api/af/req-page-recommendation-required/artifact-sync/run` with `outputMode=runnable`.
- Generated bundle checks passed:
  - `python -m compileall req_page_recommendation_required_adk`
  - `python -m pytest -q` -> `4 passed, 4 warnings`
- Mock Lab discovery returned connected tools: `get_scenario_taxonomy`, `search_page_candidates`, `search_page_products`, `run_userflow_analysis`, `recommend_scenario_by_behavior_type`, `analyze_page_customer_relation`.
- ADK Web UI accepted chat input, rendered human-input gates, called Mock Lab MCP tools, and reached `Workflow 1-2 전달 Placeholder`.
- Playwright screenshots:
  - `.playwright-cli/page-2026-06-29T08-21-40-155Z.png` — analysis route prompt visible
  - `.playwright-cli/page-2026-06-29T08-23-03-884Z.png` — final placeholder output visible

## Blocking / Should-fix Findings

### 1. `skip_analysis` still executes the analysis branch

Severity: BLOCKER

Repro:

1. Start ADK Web from `artifacts/af/req-page-recommendation-required/runtime-stub`.
2. Start Mock Lab server `wf-page-recommendation-mock`.
3. In ADK Web chat, send `꿀머니 이탈률 분석 대상 Page 추천 시작`.
4. Respond to `목적/시나리오 분류 확인` with `꿀머니 이탈률 분석할래`.
5. Respond to the analysis route prompt with `skip_analysis`.

Expected: route goes directly to final page selection.

Actual: `UserFlow 분석 Adapter`, `행동유형 기반 시나리오 추천 Adapter`, `T2S 분석 Adapter`, and `분석 결과 종합 Agent` still run.

Root cause observed in generated code:

- `scripts/adk-source/emitters/router.mjs:18` casts the whole `node_input` object to text.
- Human input nodes emit `{ prompt, previous, response }` from `scripts/adk-source/emitters/hitl.mjs:12`.
- The prompt contains `run_analysis`, so `scripts/adk-source/emitters/router.mjs:13` matches `run_analysis` before it reaches the `skip_analysis` response.
- Generated example: `artifacts/af/req-page-recommendation-required/runtime-stub/req_page_recommendation_required_adk/agent.py:2293`.

Needed code change:

- Router lowering must extract a route decision from a structured human-input output first, e.g. `node_input["response"]`, `node_input["choice"]`, `node_input["value"]`, or a configured field path, before falling back to full text.
- Add generator regression covering a `RequestInput -> router` flow where the prompt mentions both aliases and the user response is `skip_analysis`.

### 2. Original router branch visibility finding (resolved)

Severity: SHOULD-FIX

This was the original finding. Current `RouterNode` renders outgoing route value, target, default marker, and aliases; keep this section as QA history rather than active work.

The original edge inspector had raw fields (`route_condition`, `route_aliases`, `is_default_route`), but that was not enough for a user to understand, from the router area itself, which input drove which branch.

Original code change:

- Add a router route map surface in `GraphCanvas`/`RouterNode`: outgoing route value, aliases, default marker, and target node.
- Add route prompt preview that combines the upstream `human_input_contract.message` with outgoing route aliases.
- Keep `GraphInspector` raw fields, but add a human-readable route table for the selected router.

### 3. Runtime contract readiness fields are easy for Codex Design to write incorrectly

Severity: SHOULD-FIX

Design Stage produced approved runtime contracts whose `required_review_fields` were human labels such as `mock_server_id`, `tool_name`, and `data_policy`. The readiness checker expects object paths and reads them through `runtimeContractReadinessIssues()` at `packages/web/src/analyzer/runtimeContracts.ts:132`.

Manual artifact fix was required:

- Session state fields were rewritten to paths like `graph_ir_annotations.human_input_contract_message` and `policies.audit_summary_policy`.
- MCP fields were rewritten to paths like `graph_ir_annotations.mock_server_id` and `policies.timeout_policy`.
- Session state `runtime_support.idempotency_required` had to be set to true because human approval was true.

Needed code change:

- Stage Runner design prompt/postprocessor should produce path-qualified `required_review_fields`, or normalize known labels into paths before artifact apply.
- Runtime Contract UI should make the reviewed value location explicit.
- Contract generation should hydrate Mock Lab MCP fields from `mock_binding` / catalog contract metadata where possible.

### 4. Catalog binding is name-based instead of ID-first

Severity: SHOULD-FIX

`packages/web/src/analyzer/scaffoldPlan.ts:463` finds a catalog binding by matching module category and normalized display name. The rebuilt artifact explicitly stores `catalog_entry_id`, but scaffold binding can still drift if names change or if duplicate names exist.

Needed code change:

- Prefer `candidate.catalog_entry_id` when present.
- Fall back to name/category only for legacy artifacts.
- Add a regression where display names differ but `catalog_entry_id` is correct.

### 5. Stage Runner catalog payload is caller-dependent

Severity: SHOULD-FIX

The manual Analyze Stage run request had an empty catalog array unless the caller supplied catalog entries. The Design Stage run used an explicit flattened catalog payload. For the catalog-first best-case scenario, server-side Stage Runner should either hydrate the active catalog by default or record a clear diagnostic that catalog context was omitted.

Needed code change:

- Server-side stage runner should load active catalog entries when `catalog` is omitted.
- Run artifacts should record whether catalog context came from the request, server default hydration, or was absent.
- UI should surface catalog context count in the run summary.

### 6. Final human-input prompt lacks selectable output guidance

Severity: SHOULD-FIX

The final gate prompt is only `사용자 최종 Page(다중) 선택`. In ADK Web this appears after a long synthesized recommendation, but it does not tell the user accepted values, format, or whether `확인` means accept all recommended pages.

Needed code change:

- Human input contracts should support `choice_options`, `accepted_aliases`, and `default_choice`.
- Runtime prompt lowering should render those options in ADK Web.
- Graph editor should show the same options near the human-input node and any downstream router.

### 7. ADK Web static asset warning

Severity: NIT

ADK Web logs a 404 for `/dev-ui/prism-dark.css`. It did not block workflow execution. This appears to be ADK Web packaging/static asset behavior rather than Agent Factory generated code, but it should be tracked if UI styling or screenshots depend on it.

## Manual Artifact Edits Used To Keep The Scenario Moving

- Rewrote `analysis-result.json` to catalog-backed wording and added `catalog_entry_id` / `reuse_candidate` values.
- Rewrote Graph IR route labels, `human_input_contract.message`, route aliases, and default route marker for `run_analysis` / `skip_analysis`.
- Rewrote runtime contract `required_review_fields` into checker-readable object paths and filled synthetic policy/annotation values.
- Regenerated `normalized-requirement.json`, `module-candidates.json`, `process-flow.json`, `scaffold-plan.json`, and `runtime-stub` through artifact sync.

These manual edits should become product behavior in the next large code change rather than remaining one-off artifact surgery.

## Suggested Next Work Package

1. Fix generated router input extraction and add regression.
2. Add router route-map UI in Workbench graph node/inspector.
3. Normalize/hydrate runtime contract review fields in Stage Runner apply or design artifact postprocessing.
4. Make catalog binding ID-first.
5. Add server-side catalog hydration diagnostics for Stage Runner.
6. Extend human-input contract with selectable options/defaults and render them in ADK Web prompts and Workbench graph editing.
