# 10 — Dynamic-workflow runnable lowering (route / loop / dynamic)

상태: **미구현.** 현재 `scripts/generate-adk-source.mjs` 의 runnable 모드는 정적 DAG 그래프 `Workflow` 만 생성하고, 조건 분기·반복·동적 워크플로는 `assertRunnableGraphSupported` 에서 거부한다(smoke 전용).

## 왜 필요한가

runnable lowering 이 아직 거부하는 Graph IR 형태:

- `edge_kind: "route"` (+ `execution_semantics: "conditional"`) — 라우터 분기
- `node_kind: "router"` / `node_kind: "loop_control"`, `container_kind: "loop_region"`
- `execution_semantics: "loop_back" | "loop_exit"`
- `module_category: "workflow"` 의 `workflow_kind: "dynamic"`

ADK 2.x 기준 반복/동적 분기는 정적 그래프 `Workflow(edges=[...])` 가 아니라 **dynamic workflow**(`@node` + `ctx.run_node(...)` + 파이썬 `while`/조건 제어)로 표현한다(adk.dev/graphs/dynamic, graphs/routes). 즉 별도의 출력 형태(빌더)가 필요하다. scenario-c(rule-based routing)·scenario-d(loop)·scenario-f 가 이 영역이다.

## 무엇을 해야 하는가

1. **출력 형태 추가**: `buildAgentPy()` 의 `AGENT_PY_BUILDERS` 맵(현재 `smoke`/`runnable`)에 동적 워크플로 빌더를 추가하거나, runnable 내부에서 "정적 DAG" vs "dynamic" 을 갈라 lower 한다. PR-0(`8a8987e`)에서 node-kind/output dispatch 를 레지스트리로 정비해 둔 것이 이 작업의 발판이다.
2. **route lowering**: `router` 노드 → `Event(route=...)` 를 내는 함수 + `Workflow` edges 의 dict 분기(`(router, {"A": nodeA, "B": nodeB})`). `route_condition` 을 분기 키로 매핑.
3. **loop lowering**: `loop_control`/`loop_region`/`loop_back`/`loop_exit` → dynamic workflow(`@node` + `ctx.run_node` + `while` + 종료 조건). 상태 누적은 `ctx.state` 사용.
4. **dynamic workflow 모듈**: `workflow_kind: "dynamic"` 모듈 노드를 dynamic 빌더로 lower.
5. **가드 완화**: `assertRunnableGraphSupported` 의 `unsupportedExecSemantics`/`unsupportedEdgeKinds`/`unsupportedContainerKinds`/`unlowerableNodeKinds` 에서 해당 항목을 제거하되, **새 형태가 실제로 동적 빌더 경로로만 흐르도록** per-edge/per-node 게이팅을 추가한다(remote_a2a 게이팅 패턴 — PR-B `1a6821b`/`410b4aa` 참조).
6. **회귀**: `scripts/generate-adk-source.test.mjs` 에 route/loop positive + reject 케이스 추가. scenario-c/d 를 runnable 로 build → `ast.parse` + 실 `google-adk` 2.2.0 import/construct + 가능하면 InMemoryRunner 실행 스모크.

## 건드릴 파일

- `scripts/generate-adk-source.mjs` (빌더/lowering/가드)
- `scripts/generate-adk-source.test.mjs` (회귀)
- `templates/regression-scenarios/scenario-c-*`, `scenario-d-*` (runnable 대상으로 재검토)
- 문서: `CLAUDE.md`(build 불릿 "Loop/router stay smoke-only" 갱신), `docs/workbench/validation.md`, `docs/decision-log.md`

## 검증

`node --test scripts/generate-adk-source.test.mjs`; `node scripts/validate-artifacts.mjs`; 생성 번들 `python3 -c "import ast; ..."`; 실 ADK venv(예: `/tmp/a2a-spike/.venv` 또는 신규)로 import/construct; 비-dynamic 번들이 byte-identical 유지되는지 스냅샷 diff.

## 기반/주의

- 직전 작업에서 generator 를 dispatch 구조로 정비(PR-0)한 의도가 바로 이 개편을 "핸들러 추가"로 흡수하기 위함이다. (memory: `feedback_generator_extensible_structure.md`)
- 큰/위험 작업 → 격리 worktree + 서브에이전트/Codex 위임 + 커밋 경계마다 Codex 리뷰. (memory: `feedback_codex_usage.md`, `feedback_codex_incremental_review.md`)
