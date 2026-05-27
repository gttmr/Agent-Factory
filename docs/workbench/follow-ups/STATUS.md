# Follow-ups STATUS — 새 세션 진입점

이 파일 하나만 보면 어디까지 했고 무엇이 남았는지 알 수 있도록 정리한 진입점이다.
브리프 목록 자체는 `INDEX.md`, 마이그레이션 전체 설계는 `/home/ilmaswsl/.claude/plans/agent-factory-synthetic-hummingbird.md`.

마지막 갱신: 2026-05-27 (KST 기준).

## 현재 브랜치 상태

- 브랜치: `codex/runtime-contract-review`
- origin 대비 3 commit ahead (아직 push 하지 않음)
- 마지막 commit: `e1e2c1f`

```text
e1e2c1f feat: brief 06 — restore in-workbench Codex CLI rerun on /analyze
69edb6c feat: brief 03 — Runtime contract review surface in DesignWorkbench
a3ed7df docs: brief 00 — align stale surface references after PR6 router-shell migration
4c1a109 docs: post-migration follow-up briefs + stale-reference cleanup  ← origin/codex/runtime-contract-review 도 여기
```

새 세션 시작 시 첫 명령:

```bash
cd /home/ilmaswsl/work/Agent-Factory
git fetch origin
git status
git log --oneline origin/codex/runtime-contract-review..HEAD
```

## 운영 정책 결정 기록

브리프 진행 중 사용자가 명시한 운영 정책. 다음 세션에서 다시 묻지 않는다.

- **brief 06 — Analyze pipeline**: 옵션 B 채택. 워크벤치 안의 “Codex CLI 재분석” 흐름을 유지한다. 외부 `af-analyze-requirement` skill 도 그대로 import 경로로 살아있다. `/api/analyze-requirement` SSE endpoint 와 `packages/web/server/codexAnalyzer.ts` 는 보존.
- **commit 정책**: 한 브리프 = 한 commit. push 는 사용자 명시 없이 금지. (memory: `feedback_commit_per_pr.md`)

## 완료한 브리프

### brief 00 — Doc audit (commit a3ed7df)

PR1~PR6 라우터 셸 마이그레이션 후 잔존한 stale 표현 정리. 코드/스키마 변경 없음.

- `docs/workbench/validation.md`, `docs/workbench/agent-factory-harness.md`:
  - Module Review Inspector / SavedAnalysisRecord landing 흐름 / Smoke 일괄 실행 매크로 섹션을 BuildWorkbench + VerifyWorkbench 분리로 다시 씀
  - Resolution Draft 적용 책임을 `af-design-boundaries` skill 로 이전 명시
  - Codex CLI draft-schema 절에 “워크벤치 UI 에서 직접 호출하지 않음” 한 줄 추가 (※ brief 06 옵션 B 채택으로 부분적으로 다시 깨졌음. 후속 정리는 “남은 잔무” 절 참고)
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

운영 정책 옵션 B 채택. 워크벤치 안에서 Codex CLI 재분석 가능.

- 신규 `packages/web/src/state/useAnalyze.ts` — `/api/analyze-requirement` SSE 호출, `AnalyzerProgressEvent[]` 누적, `completed` 시 `normalizeAnalysisResultForWorkbench` 후 analysis-result.json PUT, AbortController 지원
- `packages/web/src/routes/AnalyzeWorkbench.tsx` — “Codex CLI 재분석” 패널 (모델 select + 재분석 + 중단 버튼), progress event 목록, raw_text 없는 root 가드
- `packages/web/src/styles-router.css` — `.af-analyze-progress*` 클래스
- `useCatalog` 평탄화 헬퍼 `flattenCatalogForAnalyzer` 로 catalog payload 동봉

검증: `npm run build && npm run test:analyzer`,
MCP 스모크 (req-pr-analyze 에 scenario-a 임포트 → 재분석 클릭 → STARTED + CLI_EVENT 3건 progress 흐름 → 중단 → status `aborted`).

## 남은 브리프

`INDEX.md` 의 우선도 + 새로 발견된 사실을 합쳐 정리한다. 각 브리프의 상세 작업 정의는 같은 디렉터리의 해당 파일에 있다.

| 번호 | 파일 | 우선도 | 한 줄 요약 | 시작 전 추가로 봐야 할 것 |
|---|---|---|---|---|
| 01 | `01-canvas-collaboration-overlay.md` | 중 | Graph IR canvas 위에 코멘트 핀 / highlight overlay 렌더링 (현재는 persistence/CRUD 만 있음) | `packages/web/src/components/GraphCanvas.tsx`, `packages/web/src/design/CommentThread.tsx`, `useCollaboration` 훅 |
| 02 | `02-path-trace-panel.md` | 낮음 (01 이후) | 두 노드 선택 → DAG BFS → 경로 highlight 저장 | brief 01 결과 |
| 04 | `04-a2a-contract-review-surface.md` | 중 | Remote A2A contract 편집 화면 (PR6 에서 제거된 surface 재구성). brief 03 의 패턴 그대로 적용하면 빠르다 | brief 03 의 `RuntimeContractPanel.tsx` 패턴, `packages/web/src/analyzer/a2aNormalize.ts`, `packages/web/src/analyzer/types.ts` 의 `A2AContract` |
| 05 | `05-sse-streaming.md` | 중 | `verify/run`, `runtime-stub/build` 응답을 SSE 스트림으로 전환 | brief 06 의 `useAnalyze.ts` 가 SSE 클라이언트 참고 예시 |
| 07 | `07-onboarding-html-refresh.md` | 중 | `docs/onboarding/*.html` 의 wizard 시나리오 → router shell 모델로 재작성 + 새 스크린샷 (brief 00 에서 deprecation 배너만 달아둔 상태) | brief 00 에서 배너 단 챕터들, `docs/visualization/design-system.md` |
| 08 | `08-perf-and-bundle.md` | 낮음 | DesignWorkbench / GraphCanvas 청크 분할, lazy import 정교화, lighthouse 측정 | 현재 번들 사이즈: `DesignWorkbench-*.js 283 kB` (brief 03 후 +8 kB), `BuildWorkbench-*.js 74 kB`, `AnalyzeWorkbench-*.js 16 kB` (brief 06 후 +5 kB) |

추천 진행 순서:

1. **04** (A2A contract review surface) — brief 03 패턴 그대로 재사용 가능, 가장 효율적
2. **07** (Onboarding HTML refresh) — brief 00 에서 배너만 달고 본문은 미뤘으니 한 번에 정리
3. **01** → **02** (canvas overlay → path trace) — 의존 관계
4. **05** (SSE streaming) — brief 06 의 hook 패턴 일반화
5. **08** (perf & bundle) — 마지막

## 남은 잔무 (브리프 외)

브리프 작업 도중 발견됐지만 별도 브리프로 분리하기엔 작은 것들. 해당 브리프 작업 시 같이 정리.

- **brief 00 vs brief 06 정합화**: brief 00 에서 `docs/onboarding/09-glossary.html` 의 “Codex CLI” 항목과 `docs/workbench/validation.md` Live analyzer draft schema 절에 “워크벤치 UI 는 이 endpoint 를 직접 호출하지 않는다” 라고 적었다. brief 06 으로 워크벤치가 다시 호출하게 됐으므로 두 문서를 “외부 skill 과 워크벤치 재분석 두 경로 모두 가능” 으로 갱신해야 한다. brief 07 작업 시 함께 처리 권장.
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

- 서브에이전트 사용: `model: "opus"` 명시. (memory: `feedback_subagent_opus_xhigh.md`)

- Codex 우선 활용: 비-사소한 초안은 codex skill 에 위임 가능. (memory: `feedback_codex_usage.md`, `feedback_codex_retry_loop.md`)

## 핵심 코드 진입점 빠른 참조

- 라우트: `packages/web/src/routes/router.tsx`
- 상태 훅: `packages/web/src/state/{useArtifactRoot,useAnalysisArtifact,useApprovalGate,useCollaboration,useCatalog,useScaffoldPlan,useTextArtifact,useVerify,useRecentRoots,useAnalyze}.ts`
- 분석 도메인: `packages/web/src/analyzer/{types,a2aNormalize,afRunManifest,analysisArtifactExport,analysisArtifactImport,analysisResultNormalization,classificationRules,commonization,graphMigration,moduleReviewGraph,runtimeContracts,scaffoldPlan}.ts`
- 서버: `packages/web/server/{afArtifactsApi,artifactRootStore,codexAnalyzer,collaborationApi,catalogApi,verifyRunner,runtimeStubBuilder,validators}.ts`
- 디자인 컴포넌트: `packages/web/src/components/{AnalysisResult,CategoryBadge,GraphCanvas,GraphInspector}.tsx`, `packages/web/src/design/{CommentThread,RuntimeContractPanel}.tsx`
- 스타일: `packages/web/src/styles.css` (전역 토큰), `packages/web/src/styles-router.css` (라우트별)
