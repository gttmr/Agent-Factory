# Agent Factory Workbench — 후속 작업 지시서 INDEX

> **새 세션에서 시작한다면 [`STATUS.md`](./STATUS.md) 를 먼저 본다.** 어떤 브리프가 끝났고 무엇이 남았는지, 운영 정책 결정 기록, 다음 권장 순서가 모두 거기에 있다. 이 INDEX 는 브리프 목록 자체의 카탈로그다.

이 디렉터리는 6 PR(`codex/runtime-contract-review` 브랜치, `0a69716`..`afd7c19`)로 완료한 라우터 셸 + artifact-root-first 워크벤치 마이그레이션 뒤에 남은 후속 작업을 모아둔다. 각 브리프는 **새 세션에서 그 파일 하나만 보고도 작업이 가능하도록** 자기완결적이다.

현재 사용 규칙: 이 INDEX는 브리프 카탈로그이고, live branch/commit 상태의 source of truth가 아니다. 새 작업을 시작할 때는 `git status`, active docs, 현재 코드, [`STATUS.md`](./STATUS.md)를 함께 확인한다.

브리프를 읽기 전 다음 두 파일도 함께 본다.

- `/home/ilmaswsl/.claude/plans/agent-factory-synthetic-hummingbird.md` — 마이그레이션 전체 설계 (out of scope 항목이 여기 후속 브리프로 옮겨졌다)
- `docs/workbench/follow-ups/00-doc-audit.md` — 마이그레이션 후 문서 불일치 감사 스냅샷. brief 00/07 이후 active 문서는 현재 route shell + Stage Runner 기준으로 갱신됨.

## 브리프 구현 상태

| 번호 | 파일 | 구현 상태 | 현재 판단 근거 |
|---|---|---|---|
| 00 | `00-doc-audit.md` | 완료 | active docs는 route shell + Stage Runner 기준으로 갱신됨. 이 파일은 감사 스냅샷으로 보존. |
| 01 | `01-canvas-collaboration-overlay.md` | 완료 | GraphCanvas 위 comment pin, highlight edge/node/container 강조, comment tooltip 이 구현됨. |
| 02 | `02-path-trace-panel.md` | 완료 | DesignWorkbench `경로` 탭, BFS helper, path highlight 저장 UI 가 구현됨. |
| 03 | `03-runtime-contract-review-surface.md` | 완료 | `RuntimeContractPanel.tsx`, DesignWorkbench `Runtime 계약` 탭, `runtime_contracts_approved` gate 구현됨. |
| 04 | `04-a2a-contract-review-surface.md` | 완료 | Remote A2A 편집 탭, readiness validator, runtime gate 연동이 구현됨. |
| 05 | `05-sse-streaming.md` | 완료 | `verify/run`, `runtime-stub/build`가 SSE live log 와 기존 JSON 경로를 모두 지원함. |
| 06 | `06-analyze-pipeline.md` | 완료 / 09에 흡수 | 옵션 B hook은 구현됐고 현재 UI 기본 실행은 Analyze Stage Runner. `/api/analyze-requirement`는 direct/internal primitive. |
| 07 | `07-onboarding-html-refresh.md` | 완료 | 정적 onboarding HTML과 새 screenshot asset이 route shell + Stage Runner 모델로 갱신됨. |
| 08 | `08-perf-and-bundle.md` | 완료 | GraphCanvas child lazy split과 Vite build 정량 기록이 완료됨. `_perf-notes.md` 참고. |
| 09 | `09-skill-runner-workbench.md` | 완료 | Analyze + Design Stage Runner, run evidence, diff/apply, gate 분리 구현됨. Build/Verify 확장은 brief 16에서 처리됨. |
| 10 | `10-dynamic-workflow-lowering.md` | 완료 | route/loop/dynamic 을 public `runnable` mode 안의 내부 ADK dynamic workflow builder로 lower. |
| 11 | `11-agent-consumer-channel-reads.md` | 완료(범위 재정의) | state channel은 agent instruction/connected MCP adapter만 소비. 비-connected state consumer와 agent/non-connected artifact consumer는 blocker. |
| 12 | `12-a2a-contract-policy-mapping.md` | 완료 | `adk_runtime_policy` 추가. `RemoteA2aAgent` timeout/auth interceptor만 ADK-supported source로 lower하고 retry/fallback은 handoff policy로 기록. |
| 13 | `13-scaffold-plan-warning-accuracy.md` | 완료 | runnable skeleton warning을 category/output_mode 인식형으로 정리. |
| 14 | `14-runtime-stub-runtime-ux.md` | 완료 | RunSandbox stale+명시 재시작, adapter 없는 Mock Lab panel 숨김/안내 구현. |
| 15 | `15-catalog-first-runtime-gap.md` | 코드 수정 완료(1–6) | router resume, route-map UI, runtime contract path normalization/hydration, catalog ID-first binding, Stage Runner catalog hydration, human-input 선택지 contract 최소 구현 및 ADK Web/Workbench smoke 확인. |
| 16 | `16-build-verify-stage-runner.md` | 완료 | Build/Verify Stage Runner 확장: primitive wrapping, verify report/delta proposal, cancel endpoint, UI panel. |
| 17 | `17-a2a-ui-error-surfacing.md` | 대기 | Local A2A provider import 화면 smoke 중 발견한 404 console noise, 422 detail opacity, React Flow type object warning 정리. |
| TBD | 새 브리프 필요 | 대기 | Full Remote A2A HITL resume bridge. `input-required`는 interactive task state이며 plain ADK Web text chat resume은 아직 검증되지 않음. |

`09-skill-runner-workbench.md` 는 Skill Runner 상위 브리프이자 brief 09 구현 기록이다. Analyze + Design Stage Runner는 구현됐고, Build/Verify runner는 여전히 별도 후속 범위다. 기존 05의 `verify/run` / `runtime-stub/build` SSE 전환은 완료되어 BuildWorkbench/VerifyWorkbench live log 로 제공된다.

브리프 10–14 는 2026-06 엣지 데이터 전달 / A2A 작업(PR #30–#33)에서 도출된 후속이다. 브리프 15 는 2026-06-29 `req-page-recommendation-required` catalog-first 재생성/ADK Web QA에서 도출됐다. 브리프 16은 Build/Verify Stage Runner 확장이다. 브리프 17은 Local A2A provider import 화면 smoke에서 분리한 UI error-surfacing cleanup이다. Remote A2A `input-required` task를 plain ADK Web text chat으로 resume하는 bridge는 아직 검증되지 않았으므로 새 브리프로 분리한다. 마지막 backlog 순서였던 12와 10은 모두 완료됐다. 자세한 배경·완료 작업은 `STATUS.md` 의 해당 섹션 참고. 새 후속 작업은 이 디렉터리에 새 번호로 추가한다.

## 공통 작업 자세

- 브랜치: 새 브리프 시작 시 `git fetch origin && git status` 로 현재 checkout과 base를 확인한다. 아래 브리프가 적힌 당시 branch/commit 표현은 역사적 맥락으로만 읽는다.
- 검증 명령: 각 브리프에 명시. 공통적으로 `cd packages/web && npm run build && npm run test:analyzer` 와 `node scripts/validate-artifacts.mjs templates` 를 통과시킨다.
- MCP 스모크: 시나리오마다 `templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json` 을 `req-001` 로 import 한 뒤 4 stage 를 돌리는 패턴을 재사용. 스모크 후 `artifacts/af/<id>/` 는 반드시 삭제.
- 커밋 정책: `/home/ilmaswsl/.claude/projects/-home-ilmaswsl-work-Agent-Factory/memory/feedback_commit_per_pr.md` 를 따른다 — PR 단위로 커밋, 사용자 명시 없이 push 금지.

## 마이그레이션 후 현재 기준

- 라우트: `/`, `/af/:reqId/{analyze,design,build,verify,run}`, `/catalog`, `/mock-lab`. `/legacy` 는 제거됨. `run`과 `mock-lab`은 gate chip의 `afRunStageIds`가 아니라 보조 nav다.
- 서버 미들웨어: `/api/af/:reqId/stages/:stage/*` (Analyze/Design Stage Runner), `/api/analyze-requirement` (direct/internal primitive), `/api/af`, `/api/af-collab`, `/api/catalog`, `/api/mock-lab/*`.
- 삭제된 컴포넌트: `RequirementIntake`, `AnalysisTracePanel`, `SavedAnalyses`, `CatalogManager`, legacy `ModuleReview`(+ Inspector), legacy `RuntimeContractReview`, `A2AContractReview`(+ subdir), `AdkRuntimeWorkbench`, `WorkbenchShell`, `ui/review.tsx`. 현재 DesignWorkbench에는 새 Runtime 계약 검토 탭이 있다.
- 삭제된 analyzer 파일: `exampleRequirement.ts`, `providers.ts`, `savedAnalyses.ts`, `adkSource.ts`, `adkGraph.ts`.
- 삭제된 서버 미들웨어 파일: `adkRuntime.ts`, `moduleResolution.ts`.
- 남은 핵심 자산: `components/{AnalysisResult,CategoryBadge,GraphCanvas,GraphInspector}.tsx`, `design/{A2AContractPanel,CommentThread,PathTracePanel,RuntimeContractPanel}.tsx`, `analyzer/{a2aNormalize,afRunManifest,analysisArtifactExport,analysisArtifactImport,analysisResultNormalization,classificationRules,commonization,graphMigration,moduleReviewGraph,runtimeContracts,scaffoldPlan,types}.ts`, 모든 `src/{state,layout,design,build,verify,catalog-hub,routes}` 디렉터리.

위 사실이 깨지면 브리프 작성 시점과 실제 코드가 어긋난 것이므로 코드부터 다시 확인한다.
