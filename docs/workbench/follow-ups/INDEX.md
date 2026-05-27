# Agent Factory Workbench — 후속 작업 지시서 INDEX

> **새 세션에서 시작한다면 [`STATUS.md`](./STATUS.md) 를 먼저 본다.** 어떤 브리프가 끝났고 무엇이 남았는지, 운영 정책 결정 기록, 다음 권장 순서가 모두 거기에 있다. 이 INDEX 는 브리프 목록 자체의 카탈로그다.

이 디렉터리는 6 PR(`codex/runtime-contract-review` 브랜치, `0a69716`..`afd7c19`)로 완료한 라우터 셸 + artifact-root-first 워크벤치 마이그레이션 뒤에 남은 후속 작업을 모아둔다. 각 브리프는 **새 세션에서 그 파일 하나만 보고도 작업이 가능하도록** 자기완결적이다.

브리프를 읽기 전 다음 두 파일도 함께 본다.

- `/home/ilmaswsl/.claude/plans/agent-factory-synthetic-hummingbird.md` — 마이그레이션 전체 설계 (out of scope 항목이 여기 후속 브리프로 옮겨졌다)
- `docs/workbench/follow-ups/00-doc-audit.md` — 마이그레이션 후 잔존 stale 문서 목록. 코드 작업과 별도로 한 번에 정리 권장.

## 브리프 목록

| 번호 | 파일 | 무엇을 하는가 | 우선도 (체감) |
|---|---|---|---|
| 00 | `00-doc-audit.md` | 마이그레이션 후 잔존하는 stale 문서 일괄 정리 | 높음 — 새 시점 stage 1 |
| 01 | `01-canvas-collaboration-overlay.md` | Graph IR canvas 위에 코멘트 핀과 highlight overlay 렌더링 | 중 |
| 02 | `02-path-trace-panel.md` | 두 노드 선택 → DAG BFS → 경로 highlight 저장 | 낮음 (01 이후) |
| 03 | `03-runtime-contract-review-surface.md` | `runtime_contracts_approved` 토글을 위한 Runtime 계약 검토 화면 | 높음 — 현재 manifest 직접 PATCH 만 가능 |
| 04 | `04-a2a-contract-review-surface.md` | Remote A2A contract 편집 화면 (legacy 에 있었으나 PR6 에서 제거) | 중 |
| 05 | `05-sse-streaming.md` | `verify/run` 과 `runtime-stub/build` 응답을 SSE 스트림으로 전환 | 중 |
| 06 | `06-analyze-pipeline.md` | `/af/:reqId/analyze` 에서 분석을 직접 실행할지, skill 만으로 둘지 결정 | 높음 — 운영 정책 결정 필요 |
| 07 | `07-onboarding-html-refresh.md` | `docs/onboarding/*.html` 의 wizard 시나리오 → router shell 로 재작성 | 중 |
| 08 | `08-perf-and-bundle.md` | DesignWorkbench / GraphCanvas 청크 분할, lazy import 정교화, lighthouse 측정 | 낮음 |

## 공통 작업 자세

- 브랜치: `codex/runtime-contract-review` 가 main 으로 머지될지 별도 브랜치를 새로 칠지는 사용자가 결정. 새 브리프 시작 시 `git fetch origin && git status` 로 base 부터 확인한다.
- 검증 명령: 각 브리프에 명시. 공통적으로 `cd packages/web && npm run build && npm run test:analyzer` 와 `node scripts/validate-artifacts.mjs templates` 를 통과시킨다.
- MCP 스모크: 시나리오마다 `templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json` 을 `req-001` 로 import 한 뒤 4 stage 를 돌리는 패턴을 재사용. 스모크 후 `artifacts/af/<id>/` 는 반드시 삭제.
- 커밋 정책: `/home/ilmaswsl/.claude/projects/-home-ilmaswsl-work-Agent-Factory/memory/feedback_commit_per_pr.md` 를 따른다 — PR 단위로 커밋, 사용자 명시 없이 push 금지.

## 마이그레이션 후 변경된 사실 (브리프 작성 시 가정)

- 라우트: `/`, `/af/:reqId/{analyze,design,build,verify}`, `/catalog` 5개. `/legacy` 는 제거됨.
- 서버 미들웨어: `/api/analyze-requirement` (Codex CLI SSE, **현재 UI 에서 호출하지 않음**), `/api/af`, `/api/af-collab`, `/api/catalog`.
- 삭제된 컴포넌트: `RequirementIntake`, `AnalysisTracePanel`, `SavedAnalyses`, `CatalogManager`, `ModuleReview`(+ Inspector), `RuntimeContractReview`, `A2AContractReview`(+ subdir), `AdkRuntimeWorkbench`, `WorkbenchShell`, `ui/review.tsx`.
- 삭제된 analyzer 파일: `exampleRequirement.ts`, `providers.ts`, `savedAnalyses.ts`, `adkSource.ts`, `adkGraph.ts`.
- 삭제된 서버 미들웨어 파일: `adkRuntime.ts`, `moduleResolution.ts`.
- 남은 핵심 자산: `components/{AnalysisResult,CategoryBadge,GraphCanvas,GraphInspector}.tsx`, `analyzer/{a2aNormalize,afRunManifest,analysisArtifactExport,analysisArtifactImport,analysisResultNormalization,classificationRules,commonization,graphMigration,moduleReviewGraph,runtimeContracts,scaffoldPlan,types}.ts`, 모든 `src/{state,layout,design,build,verify,catalog-hub,routes}` 디렉터리.

위 사실이 깨지면 브리프 작성 시점과 실제 코드가 어긋난 것이므로 코드부터 다시 확인한다.
