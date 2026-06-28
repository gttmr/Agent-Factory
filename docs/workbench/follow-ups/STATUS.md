# Follow-ups STATUS — 새 세션 진입점

이 파일 하나만 보면 어디까지 했고 무엇이 남았는지 알 수 있도록 정리한 진입점이다.
브리프 목록 자체는 `INDEX.md`, 마이그레이션 전체 설계는 `/home/ilmaswsl/.claude/plans/agent-factory-synthetic-hummingbird.md`.

마지막 갱신: 2026-06-28 (KST 기준).

2026-06-23 현재 실행 계약 메모: Stage Runner와 direct analyzer, Mock Lab draft는 더 이상 repo 코드에서 `codex exec` 또는 외부 Codex CLI 프로세스를 직접 spawn하지 않는다. 서버는 `@openai/codex-sdk` TypeScript SDK를 사용하고, 아래 과거 브리프의 Codex CLI 표현은 당시 설계/구현 기록으로만 읽는다.

## 현재 사용 규칙

- 이 파일은 follow-up backlog/status 진입점이다. live branch cleanliness나 HEAD SHA는 매번 `git status`와 `git log`로 확인한다.
- 현재 남은 브리프는 10-14다. 아래 "남은 후속" 표가 canonical backlog이고, 과거 완료 오판 문구는 제거됐다.
- detailed brief가 이 파일, `INDEX.md`, active docs, 현재 코드와 충돌하면 현재 코드와 active docs를 먼저 확인한다.

## 2026-06-23 브랜치 상태 기록

- 아래 항목은 2026-06-23 당시 기록이며 live checkout 상태가 아니다.
- 당시 로컬 `main` = `origin/main` (`8ed9f42`). 2026-06 엣지 데이터 전달 / A2A 작업(PR #30–#33)이 모두 머지·동기화됨.
- 당시 작업 트리 clean (단, 현재는 historical report snapshots를 `docs/archive/reports/` 아래로 보관).
- 머지된 PR:
  - #30 — runnable human-in-the-loop(`RequestInput`) + `scenario-g`
  - #31 (PR-A) — 엣지별 "데이터 전달 방식" 피커 + 제너레이터 node/output dispatch 구조화 + session/temp/user/app **state 채널** + **artifact 채널** lowering + `scenario-h` + Codex 리뷰 반영
  - #32 (PR-B) — **remote_a2a → RemoteA2aAgent** runnable lowering + `scenario-i` + 로컬 mock A2A 서버 + Codex 리뷰 반영(mislabeled remote 엣지 거부)
  - #33 — `.ui-button:disabled` 스타일 수정(게이트 버튼이 비활성인데 클릭 가능처럼 보이던 버그)

새 세션 시작 시 첫 명령:

```bash
cd /home/ilmaswsl/work/Agent-Factory
git fetch origin && git status
git log --oneline -8
```

## 2026-06 — 엣지 데이터 전달 / A2A 작업 요약

`scripts/generate-adk-source.mjs` runnable 모드가 그래프 엣지의 "데이터 전달 방식" 선택을 실제 ADK 2.x 코드로 lower 한다. 상세 결정은 `docs/decision-log.md` 2026-06-17 / 2026-06-18 항목, 동작 명세는 `CLAUDE.md` build 불릿 + `docs/workbench/validation.md`.

- **완료(내부 채널)**: `session/temp/user/app_state`(scope prefix 자동, bare 키 정본) + `artifact`(function `save_artifact` / connected consumer `load_artifact`). producer 쓰기 + connected MCP adapter consumer 읽기. agent 단일 채널 → `output_key`. 다중-producer 같은-키 / agent-artifact 거부.
- **완료(원격)**: `remote_a2a` 노드 → `RemoteA2aAgent(agent_card=<승인 계약 url>, use_legacy=False)`. 게이트 완화는 remote 엣지에 한정. `[a2a]` extra·import 는 remote 노드 있을 때만.
- **완료(구조)**: `NODE_LOWERING` 레지스트리 + `AGENT_PY_BUILDERS` — 장차 dynamic 개편이 "핸들러 추가"로 끝나게.
- **검증 자산**: 시나리오 `scenario-g`(human-input)·`scenario-h`(state 채널)·`scenario-i`(remote a2a + `mock_remote/serve_app.py`). generator 회귀 `scripts/generate-adk-source.test.mjs`(12 tests). 실 `google-adk[a2a]` 2.2.0 로 라이브 A2A round-trip 확인(`scenario-i` mock, `MOCK_REMOTE_OK`).
  - A2A 테스트용 venv(`google-adk[a2a]` + `a2a-sdk[http-server]` + `uvicorn`)는 `/tmp/a2a-spike/.venv` 에 만들어 두었음(세션 휘발 가능 — 없으면 `python3 -m venv` 후 동일 패키지 설치). mock 기동: `cd templates/regression-scenarios/scenario-i-remote-a2a/mock_remote && uvicorn serve_app:a2a_app --host localhost --port 8001`.

### 남은 후속 (브리프 10–14, 미구현)

| 번호 | 요약 | 규모 |
|---|---|---|
| 10 | dynamic-workflow lowering (route/loop/dynamic) — generator 대규모 개편 | 大 |
| 11 | agent/비-connected consumer 의 명명 채널 읽기 | 中 |
| 12 | A2A 계약 정책(auth/timeout/retry/fallback) → `RemoteA2aAgent` config 매핑 | 中 |
| 13 | scaffold-plan 워닝 문구 카테고리/모드 인식화 | 小 |
| 14 | 실행(RunSandbox)/Build 런타임 UX(shared venv 안내·stale 로드·adapter 없는 Mock Lab 패널) | 中 |

권장 순서: **13(작고 빠름) → 14 → 11 → 12 → 10(가장 큼).** 13/11 은 PR-A 연장, 12 는 PR-B 연장, 10(dynamic)은 독립 큰 작업.

## 운영 정책 결정 기록

브리프 진행 중 사용자가 명시한 운영 정책. 다음 세션에서 다시 묻지 않는다.

- **brief 06 — Analyze pipeline**: 옵션 B 채택 기록은 유효하지만 UI 표면은 brief 09에서 Stage Runner로 흡수됐다. 현재 기본 Analyze 실행 경로는 `/api/af/:reqId/stages/analyze/run`이고, `/api/analyze-requirement` SSE endpoint 와 `packages/web/server/codexAnalyzer.ts` 는 direct/internal analyzer primitive로 보존한다. 외부 `af-analyze-requirement` skill import 경로도 계속 살아있다.
- **brief 09 — Skill Runner Workbench 상위 브리프**: Analyze + Design 을 1차 범위로 한다. 웹 화면은 공통 Stage Runner API와 SSE로 서버 실행을 요청하고, 서버는 stage별 prompt + `SKILL.md` 기반 Codex SDK 실행을 담당한다. 스킬 결과는 `runs/<stage>/<run-id>/`에 먼저 저장하고 diff/preview 후 사용자가 적용한다. approval gate는 스킬이 자동 토글하지 않는다. 같은 `reqId`는 root 단위 lock으로 동시 실행을 막는다. `manifest.stage_runs`는 optional 요약 필드로만 추가한다. 실제 Codex smoke 실패는 API/UI/fake runner 결과와 host-verified 환경 원인을 분리 보고한다.
- **commit 정책**: 한 브리프 = 한 commit. push 는 사용자 명시 없이 금지. (memory: `feedback_commit_per_pr.md`)

## 브리프 구현 상태 요약

| 번호 | 상태 | 현재 판단 |
|---|---|---|
| 00 | 완료 | 문서 불일치 감사는 해결됨. 파일은 당시 감사 스냅샷으로 보존. |
| 01 | 완료 | GraphCanvas 노드/엣지 comment pin, highlight ring/edge/container 강조, comment tooltip 이 구현됨. |
| 02 | 완료 | DesignWorkbench `경로` 탭, BFS 기반 path 후보, highlight 저장 UI 가 구현됨. |
| 03 | 완료 | DesignWorkbench Runtime 계약 탭과 `runtime_contracts_approved` gate 구현됨. |
| 04 | 완료 | Remote A2A 계약 편집 탭/readiness UI 와 runtime gate 연동이 구현됨. |
| 05 | 완료 | Verify/runtime-stub 실행이 SSE live log 를 지원하고 기존 JSON 경로를 유지함. |
| 06 | 완료 / 09에 흡수 | direct analyze hook은 구현됐고 기본 UI는 Analyze Stage Runner로 전환됨. |
| 07 | 완료 | onboarding HTML과 screenshot asset이 현재 route/Stage Runner 흐름으로 갱신됨. |
| 08 | 완료 | GraphCanvas child lazy split, Vite build 정량 기록, `_perf-notes.md` 작성이 완료됨. |
| 09 | 완료 | Analyze + Design Stage Runner 구현 완료. Build/Verify runner는 후속 제외 범위. |

## 완료한 브리프

### brief 09 — Skill Runner Workbench (commit d547aca)

Analyze + Design 화면을 공통 Stage Runner 모델로 연결했다.

- 신규 `packages/web/server/stageRunner.ts` — stage별 Codex SDK 실행, fake 실행 모드, root 단위 lock, run artifact 기록, diff/apply, diagnostics 보존
- `/api/af/:reqId/stages/:stage/*` — `run`, `cancel`(501 후속), `runs`, `run detail`, `apply`
- `af-run-manifest.json` — optional `stage_runs` 실행 요약을 tolerant하게 읽고 검증
- `AnalyzeWorkbench` / `DesignWorkbench` — 첫 Panel에 Skill Runner UI, 최근 run, event log, proposed artifact diff/preview, 명시적 apply
- approval gate는 자동 토글하지 않음. `manifest.stage_runs`는 실행 상태이고 `manifest.approvals.*`가 계속 gate source of truth.
- 실제 Codex Design smoke는 HTTP client timeout 뒤 서버 child가 완료했으며, run artifact 기준 `completed` / validation ok / approval gate 미변경을 확인했다.

검증: `cd packages/web && npm run test:analyzer`, `cd packages/web && npm run build`, `node scripts/validate-artifacts.mjs templates`, `node scripts/validate-artifacts.mjs artifacts/af/req-001`, fixed-port browser screenshot.

### brief 07 — Onboarding HTML refresh (current docs refresh)

Stage Runner 구현 후 정적 온보딩 문서를 현재 route 모델에 맞췄다.

- `docs/onboarding/index.html`, `02-workbench-tour.html`, `03-taxonomy.html`, `05-process-flow.html`, `06-review-board.html`, `07-runtime-contracts.html`, `08-validation-handoff.html`, `09-glossary.html` 갱신
- `docs/onboarding/assets/app.js` chapter title 갱신
- `docs/onboarding/assets/styles.css` 에 screenshot figure/grid 스타일 추가
- 신규 screenshot asset: `docs/onboarding/assets/onboarding-{landing,analyze,design,build,verify,catalog}.png`
- 원본 캡처 위치: `/tmp/af-screens/onboarding-{landing,analyze,design,build,verify,catalog}.png`

검증: fixed-port dev server `http://127.0.0.1:5173/` HTTP 200, WSL headless Chrome 1600x1000 screenshot, `view_image` 직접 확인, `npm run build`, `npm run test:analyzer`, `node scripts/validate-artifacts.mjs templates`, `git diff --check`.

### brief 00 — Doc audit (commit a3ed7df)

PR1~PR6 라우터 셸 마이그레이션 후 잔존한 stale 표현 정리. 코드/스키마 변경 없음.

- `docs/workbench/validation.md`, `docs/workbench/agent-factory-harness.md`:
  - Module Review Inspector / SavedAnalysisRecord landing 흐름 / Smoke 일괄 실행 매크로 섹션을 BuildWorkbench + VerifyWorkbench 분리로 다시 씀
  - Resolution Draft 적용 책임을 `af-design-boundaries` skill 로 이전 명시
  - Codex CLI draft-schema 절은 이후 brief 06/09에서 “Stage Runner 기본 경로 + direct/internal primitive” 모델로 재정렬됨
- `docs/onboarding/*.html`: 09-glossary 항목 갱신 + 챕터 02/03/05/06/07/08/index 상단 deprecation 배너
- `README.md`, `docs/README.md`: artifact-root-first 흐름으로 갱신

검증: `cd packages/web && npm run build` 통과.

### brief 03 — Runtime contract review surface (commit 69edb6c)

`runtime_contracts_approved` 게이트를 토글할 UI 추가.

- 신규 `packages/web/src/design/RuntimeContractPanel.tsx` —
  `RuntimeContractSidebar`, `RuntimeContractInspector`, `runtimeContractsGateReady` 헬퍼
- `packages/web/src/routes/DesignWorkbench.tsx` — 사이드바에 “Runtime 계약” 탭 추가, contract 선택 시 inspector pane 교체, `useSaveAnalysisArtifact` 로 analysis 전체 PUT, 게이트 패널에 `runtime_contracts_approved` 토글 추가
- `packages/web/src/styles-router.css` — `.af-runtime-*` 클래스
- 서버 mirror (`PATCH /api/af/:id/manifest/approvals`) 가 이미 boundaries + runtime 모두 true 일 때 `stages.design.status="complete"` 로 설정

검증: `cd packages/web && npm run build && npm run test:analyzer`,
`node scripts/validate-artifacts.mjs templates/regression-scenarios/scenario-d-graph-workflow`,
MCP 스모크 (req-pr-runtime 에 contract 2개 craft → readiness 7→0 → 저장 → 토글 활성 → manifest mirror 확인).

### brief 06 — Analyze pipeline 결정 + 구현 (commit e1e2c1f)

운영 정책 옵션 B 채택. 이후 brief 09에서 직접 재분석 패널은 Stage Runner UI로 흡수됐다.

- 신규 `packages/web/src/state/useAnalyze.ts` — 당시 `/api/analyze-requirement` SSE 호출, `AnalyzerProgressEvent[]` 누적, `completed` 시 `normalizeAnalysisResultForWorkbench` 후 analysis-result.json PUT, AbortController 지원. 현재 기본 UI 경로는 `useStageRunner`.
- `packages/web/src/routes/AnalyzeWorkbench.tsx` — 당시 “Codex CLI 재분석” 패널. 현재는 Analyze Skill Runner 패널이 그 역할을 담당한다.
- `packages/web/src/styles-router.css` — `.af-analyze-progress*` 클래스
- `useCatalog` 평탄화 헬퍼 `flattenCatalogForAnalyzer` 로 catalog payload 동봉

검증: `npm run build && npm run test:analyzer`,
MCP 스모크 (req-pr-analyze 에 scenario-a 임포트 → 재분석 클릭 → STARTED + CLI_EVENT 3건 progress 흐름 → 중단 → status `aborted`).

## 이번 작업에서 완료된 브리프

### brief 01 — Canvas collaboration overlay

- `GraphCanvas` 가 `comments` / `highlights` 를 받아 노드/엣지 comment count pin 과 highlight state 를 렌더링한다.
- `path`, `node_group`, `edge_group`, `container_focus` highlight 가 각각 path edge, node ring, edge 강조, container overlay 강조로 표시된다.
- comment pin tooltip 은 작성자, 생성 시간, 본문 앞부분을 보여준다. 핀/라벨 클릭은 기존 selection owner 를 유지해 inspector comment thread 와 연결된다.

### brief 02 — PathTracePanel

- DesignWorkbench 사이드바에 `경로` 탭이 추가됐다.
- `pathSearch.ts` 는 DAG/loop graph 모두에서 simple BFS path 후보를 최대 5개까지 계산한다.
- 선택한 path 는 `useCreateHighlight` 로 `kind: "path"` highlight 로 저장되고, brief 01 canvas 강조에 즉시 반영된다.

### brief 04 — A2A Contract Review surface

- DesignWorkbench `Remote A2A` 탭에서 remote_a2a 후보와 매칭 A2A contract 를 표로 확인한다.
- inspector/editor 는 Agent Card, message contract, lifecycle, task capability, auth/retry/fallback/audit/data policy 를 편집한다.
- `a2aContractReadinessIssues` / `a2aContractsGateReady` 가 `runtime_contracts_approved` gate 조건에 포함된다.

### brief 05 — SSE streaming

- `POST /api/af/:id/runtime-stub/build` 와 `POST /api/af/:id/verify/run` 이 `Accept: text/event-stream` 또는 `streamProgress: true` 요청에서 `start/stdout/stderr/done/error` 이벤트를 전송한다.
- 기존 JSON 응답 경로는 유지된다.
- BuildWorkbench / VerifyWorkbench 는 fetch `ReadableStream` 기반 live log 를 표시하고 기존 query invalidation 을 유지한다.

### brief 08 — Bundle & runtime perf 정리

- DesignWorkbench 가 `GraphCanvas` 를 child-level `React.lazy` chunk 로 분리한다.
- 최신 `npm run build` 결과: `DesignWorkbench-*.js` 48.83 kB / gzip 13.40 kB, `GraphCanvas-*.js` 261.38 kB / gzip 87.27 kB, `index-*.js` 269.04 kB / gzip 85.47 kB.
- 정량 기록은 `docs/workbench/follow-ups/_perf-notes.md` 에 남겼다.

## 미구현 브리프

현재 `docs/workbench/follow-ups` 에 남은 미구현/부분 구현 브리프는 10-14다.

| 번호 | 상태 | 현재 판단 |
|---|---|---|
| 10 | 미구현 | dynamic-workflow lowering(route/loop/dynamic). generator 대규모 개편. |
| 11 | 미구현(부분) | agent/비-connected consumer 의 명명 state/artifact 채널 읽기. 현재 connected MCP adapter consumer 중심. |
| 12 | 미구현(부분) | A2A 계약 auth/timeout/retry/fallback 을 `RemoteA2aAgent` config/interceptor로 매핑. |
| 13 | 미구현 | scaffold-plan warning 문구를 category/output_mode 인식형으로 정리. |
| 14 | 미구현(부분 대체) | RunSandbox/Build runtime UX: shared venv/manual runtime prep 안내, 재생성 후 stale 로드, adapter 없는 시나리오 Mock Lab 패널 숨김. |

## 남은 잔무 (브리프 외)

브리프 작업 도중 발견됐지만 별도 브리프로 분리하기엔 작은 것들. 해당 브리프 작업 시 같이 정리.

- **brief 03 의 Runtime 계약 UI 가 빈 contract 배열일 때**: 시나리오 fixture 가 비어 있으면 사이드바에 안내 문구만 노출되고 토글은 “비어있음 → 통과” 로 enable 된다 (`runtimeContractsGateReady` 가 빈 배열에 true 반환). brief 04 의 A2A surface 와 일관성 맞출 때 정책 재확인.
- **`docs/superpowers/plans/2026-05-09-analysis-result-review-brief-implementation.md`**: archive 성격 plan 문서에 “existing React wizard” 단어 잔존. brief 00 범위에서 제외했음. plan archive 일괄 정리 작업이 생기면 함께 처리.

## 공통 작업 자세 (반복)

- 검증 명령 (모든 브리프 공통):

  ```bash
  cd packages/web && npm run build && npm run test:analyzer
  node scripts/validate-artifacts.mjs templates
  ```

  추가로 시나리오별 검증이 필요하면 `node scripts/validate-artifacts.mjs templates/regression-scenarios/<scenario>`.

- MCP 스모크 패턴:
  1. `lsof -iTCP:5173 -sTCP:LISTEN` 확인 후 `cd packages/web && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort` (백그라운드 실행 + `until grep -q "Local:" log; do sleep 0.5; done` 로 대기)
  2. fixture 를 hydrate 해서 PUT 하는 헬퍼 노드 스크립트 (brief 03/06 에서 사용한 패턴 그대로). `normalizeAnalysisResultForWorkbench` 를 거쳐야 runtime/a2a contract 가 hydrate 됨
  3. chrome-devtools MCP 로 페이지 열고 검증
  4. 끝나면 `rm -rf artifacts/af/<req-id>/`, dev server 종료 (TaskStop), tmp 헬퍼 파일 삭제

- 커밋 정책: 한 브리프 = 한 commit. 메시지는 `feat:` 또는 `docs:` prefix + brief 번호 명시. 사용자가 명시적으로 요청하기 전까지 push 안 함. (memory: `feedback_commit_per_pr.md`)

- 서브에이전트 사용: 사용자가 별도 지시하지 않으면 가볍게 쓰고, 이번 작업처럼 명시한 경우 `model: "gpt-5.5"`, reasoning effort `xhigh`로 실행한다.

- Codex 우선 활용: 비-사소한 초안은 codex skill 에 위임 가능. (memory: `feedback_codex_usage.md`, `feedback_codex_retry_loop.md`)

## 핵심 코드 진입점 빠른 참조

- 라우트: `packages/web/src/routes/router.tsx`
- 상태 훅: `packages/web/src/state/{useArtifactRoot,useAnalysisArtifact,useApprovalGate,useCollaboration,useCatalog,useScaffoldPlan,useStreamingProcess,useTextArtifact,useVerify,useRecentRoots,useStageRunner}.ts`
- 분석 도메인: `packages/web/src/analyzer/{types,a2aNormalize,afRunManifest,analysisArtifactExport,analysisArtifactImport,analysisResultNormalization,classificationRules,commonization,graphMigration,moduleReviewGraph,runtimeContracts,scaffoldPlan}.ts`
- 서버: `packages/web/server/{afArtifactsApi,artifactRootStore,stageRunner,codexAnalyzer,collaborationApi,catalogApi,verifyRunner,runtimeStubBuilder,validators}.ts`
- 디자인 컴포넌트: `packages/web/src/components/{AnalysisResult,CategoryBadge,GraphCanvas,GraphInspector}.tsx`, `packages/web/src/design/{A2AContractPanel,CommentThread,PathTracePanel,RuntimeContractPanel}.tsx`
- 스타일: `packages/web/src/styles.css` (전역 토큰), `packages/web/src/styles-router.css` (라우트별)
