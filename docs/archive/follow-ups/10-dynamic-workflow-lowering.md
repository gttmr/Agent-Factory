# 10 — Dynamic-workflow runnable lowering (loop / dynamic)

상태: **구현 완료.**

## 구현된 결정

Public scaffold `output_mode`는 그대로 `runnable`이다. Generator가 reviewed dynamic/loop Graph IR shape를 감지하면 runnable 내부에서 ADK dynamic workflow builder를 선택한다. 별도 `output_mode`나 raw requirement 기반 dynamic codegen은 만들지 않는다.

Dynamic builder는 ADK dynamic workflow 문서의 `@node` + `ctx.run_node(...)` 패턴을 따른다. Generated source는 `@node(name="dynamic_workflow", rerun_on_resume=True)` root node를 만들고, root `Workflow`는 `edges=[(START, dynamic_workflow)]`로 연결한다.

Loop lowering은 `loop_region` 안의 정확히 하나의 `loop_control`을 요구한다. `loop_control`은 outgoing `loop_back`과 `loop_exit` edge를 모두 가져야 하며, 각 decision edge에는 reviewed `route_condition` 또는 `route_aliases`가 필요하다. `loop_exit`은 `is_default_route: true`만으로 기본 exit를 표현할 수 있다. Generator는 이 metadata만 읽고 업무 문자열을 하드코딩하지 않는다.

Generated loop state는 `ctx.state["af_dynamic_loop:<loop-control-id>"]`에 남긴다. Wiring skeleton은 `_MAX_DYNAMIC_LOOP_ITERATIONS = 3` 안전 상한을 둔다. Retry/fallback/escalation 같은 production business-loop policy는 generated runtime wrapper가 아니라 developer TODO boundary다.

`workflow_kind: "dynamic"` 모듈과 `dynamic_workflow` container는 dynamic builder 선택 신호가 될 수 있다. 다만 `dynamic_workflow` container 자체는 runtime `adk_mapping`을 선언하지 않는다.

## 아직 의도적으로 제외

- `callback_wait` runtime lowering.
- `selected_by_llm` toolset selection을 deterministic adapter call로 변환.
- Dynamic graph 안의 `route`/`conditional` edge 혼합 lowering. Static route-only graphs는 기존 static runnable builder가 처리한다.
- Production-grade retry/fallback/business loop runtime policy.

## 주요 파일

- `scripts/adk-source/agent-dynamic.mjs`
- `scripts/adk-source/graph/dynamic.mjs`
- `scripts/adk-source/agent-runnable.mjs`
- `packages/web/src/analyzer/scaffoldPlan.ts`
- `scripts/validate-artifacts.mjs`
- `templates/regression-scenarios/scenario-d-graph-workflow/analysis-result.json`

## 검증

- `node --test scripts/generate-adk-source.test.mjs`
- `node scripts/validate-artifacts.mjs templates/regression-scenarios/scenario-d-graph-workflow`
- `cd packages/web && npm run test:analyzer`
- `cd packages/web && npm run build`
