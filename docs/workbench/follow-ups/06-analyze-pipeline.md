# 06 — Analyze pipeline 결정

상태: 완료 후 brief 09로 흡수, 이후 direct endpoint 제거. 옵션 B의 `/api/analyze-requirement` SSE 호출 hook은 구현됐지만 현재 기본 UI는 Analyze Skill Runner(`/api/af/:reqId/stages/analyze/run`)가 담당한다. `/api/analyze-requirement`와 `useAnalyze`는 더 이상 지원 경로가 아니다.

## 왜 필요한가

PR6 에서 `/legacy` 가 제거되며 워크벤치 UI 안에서 분석을 직접 실행할 수단이 사라졌다. 이 브리프는 당시 외부 `af-analyze-requirement` import만 유지할지, `/af/:reqId/analyze`에서 분석 실행 버튼을 복원할지 결정하기 위한 기록이다. 현재 구현은 후속 brief 09의 Stage Runner SDK 경로가 담당한다.

PR2 의 AnalyzeWorkbench 코드에 남아있는 `handleRerun` 함수는 현재 안내 메시지만 출력한다.

## 현재 상태

- 서버: `packages/web/server/codexAnalyzer.ts` 와 `POST /api/analyze-requirement` SSE endpoint 는 제거됐다. `validateAnalysisResult`는 `packages/web/server/validators.ts`에 독립 구현으로 남았다.
- 클라이언트 hook: `packages/web/src/state/useAnalyze.ts` 는 제거됐다. Analyze 화면은 `StageRunnerPanel`/`useStageRunner`를 사용한다.
- 현재 기본 UI: `packages/web/src/routes/AnalyzeWorkbench.tsx` 는 `StageRunnerPanel`을 사용해 `/api/af/:reqId/stages/analyze/run`을 호출한다. direct analyze hook은 제거됐고 기본 화면 동선은 brief 09 Stage Runner가 담당한다.
- 운영 모델: 외부 `af-analyze-requirement` skill import 경로도 유지한다.

## 원래 결정지

A. **외부 import 만 유지.** 당시 선택지. `codexAnalyzer.ts` 및 `/api/analyze-requirement` endpoint 삭제 가능성이 포함됐다.
B. **재분석 버튼을 워크벤치에 복원.** 당시 선택지. AnalyzeWorkbench 의 "재분석" 버튼이 서버 실행을 호출하고 결과를 PUT.
C. **외부 import + skill 트리거.** 당시 선택지. UI 가 직접 Codex 를 호출하지는 않지만 "af-analyze-requirement skill 실행" 안내 / spawn 만 한다.

선택은 B로 진행됐고, 이후 brief 09에서 Stage Runner 실행 모델로 흡수됐다. 이후 direct endpoint는 제거되어 Stage Runner SDK 경로로 통일됐다.

## 작업 정의 (선택지별 Done means)

### 후속 완료 상태
1. `packages/web/server/codexAnalyzer.ts` 와 `vite.config.ts` 의 `/api/analyze-requirement` 등록은 제거됐다.
2. `schemas/analysis-draft.schema.json` compact transport schema는 제거됐다.
3. Analyze 실행은 Stage Runner SDK 경로 또는 외부 producer artifact import로 통일됐다.

과거 B/C 선택지의 direct hook 또는 명령 복사 방식은 현재 지원 경로가 아니다.

## 최종 방향

사용 경험은 B의 "워크벤치 안에서 실행"을 따르되, 구현은 brief 09의 공통 Stage Runner SDK 계약으로 통일한다. Analyze 화면은 `/api/af/:reqId/stages/analyze/run`을 호출하고, Codex SDK thread가 proposed artifact를 만든다. canonical artifact 변경은 사용자의 제안 적용 이후에만 일어난다.

## 파일 / 디렉터리

- 제거됨
  - `packages/web/src/state/useAnalyze.ts`
  - `packages/web/server/codexAnalyzer.ts`
  - `schemas/analysis-draft.schema.json`
- 현재 사용
  - `packages/web/src/components/StageRunnerPanel.tsx`
  - `packages/web/src/state/useStageRunner.ts`
  - `packages/web/server/stageRunner.ts`
  - `packages/web/server/validators.ts`

## 검증

```bash
cd packages/web && npm run build && npm run test:analyzer
```

Stage Runner 스모크:
1. req-pr-analyze 새 root + raw_text 입력.
2. Analyze Stage Runner 실행 → SDK progress event가 화면에 흐름 → proposed `analysis-result.json` 생성.
3. 사용자가 제안 적용 전에는 canonical `analysis-result.json`이 바뀌지 않는지 확인.

## Out of scope

- Codex SDK 자체의 성능 / 모델 선택 정책.
- analyzer provider 다중화.

## 위험 / 메모

- 분석은 수십초~수분 걸린다. SSE progress 가 보이지 않으면 UX 가 깨진다.
- raw_text 에 PII / 비밀이 들어가면 그대로 Codex 에 전송됨. 운영 정책상 분석 입력의 sensitivity 가이드를 docs 에 명시.
- 활성 root 의 raw_text 가 깡통일 때 (외부 import 후 정규화 누락) "원문 입력 없음" 안내가 필요.
- Codex SDK 실행은 서버 사이드 Node 환경과 Codex 인증 상태에 의존한다. 실패 시 Stage Runner diagnostics에 남긴다.
