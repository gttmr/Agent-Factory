# 06 — Analyze pipeline 결정

상태: 완료 후 brief 09로 흡수. 옵션 B의 `/api/analyze-requirement` SSE 호출 hook은 구현됐고, 현재 기본 UI는 Analyze Skill Runner(`/api/af/:reqId/stages/analyze/run`)가 담당한다. `/api/analyze-requirement`는 direct/internal analyzer primitive로 보존한다.

## 왜 필요한가

PR6 에서 `/legacy` 가 제거되며 워크벤치 UI 안에서 분석을 직접 실행할 수단이 사라졌다. 현재는 외부 `af-analyze-requirement` skill 이 `analysis-result.json` 을 생성하고 사용자가 import 해야 한다. 이게 의도된 운영 모델인지, 아니면 `/af/:reqId/analyze` 에서 "분석 실행" 버튼 한 번으로 Codex CLI 를 호출하는 게 맞는지 사용자가 결정해야 한다.

PR2 의 AnalyzeWorkbench 코드에 남아있는 `handleRerun` 함수는 현재 안내 메시지만 출력한다.

## 현재 상태

- 서버: `packages/web/server/codexAnalyzer.ts` 가 그대로 `POST /api/analyze-requirement` SSE endpoint 를 제공. validateAnalysisResult 도 동일.
- 클라이언트 hook: `packages/web/src/state/useAnalyze.ts` 가 옵션 B 형태로 구현되어 `/api/analyze-requirement` SSE 호출을 지원한다.
- 현재 기본 UI: `packages/web/src/routes/AnalyzeWorkbench.tsx` 는 `StageRunnerPanel`을 사용해 `/api/af/:reqId/stages/analyze/run`을 호출한다. direct analyze hook은 보존되어 있지만 기본 화면 동선은 brief 09 Stage Runner가 담당한다.
- 운영 모델: 외부 `af-analyze-requirement` skill import 경로도 유지한다.

## 원래 결정지

A. **외부 import 만 유지.** 현재 상태 그대로. `codexAnalyzer.ts` 및 `/api/analyze-requirement` endpoint 도 삭제 가능.
B. **재분석 버튼을 워크벤치에 복원.** AnalyzeWorkbench 의 "재분석" 버튼이 실제로 Codex CLI 를 호출하고 결과를 PUT.
C. **외부 import + skill 트리거.** UI 가 직접 Codex 를 호출하지는 않지만 "af-analyze-requirement skill 실행" 안내 / spawn 만 한다.

선택은 B로 진행됐고, 이후 brief 09에서 Stage Runner 실행 모델로 흡수됐다. `/api/analyze-requirement`는 삭제하지 않고 direct/internal primitive로 보존한다.

## 작업 정의 (선택지별 Done means)

### A 선택 시
1. `packages/web/server/codexAnalyzer.ts` 와 `vite.config.ts` 의 `/api/analyze-requirement` 등록 제거.
2. 관련 docs 정리 (`docs/workbench/validation.md` L38 의 `analysis-draft.schema.json` 언급 등 — A 라면 그 schema 도 의미가 줄어든다).
3. `AnalyzeWorkbench` 의 `handleRerun` 와 onRerun prop 제거 — `AnalysisResult` 컴포넌트의 onRerun 시그니처도 변경 가능.

### B 선택 시
1. 새 hook `packages/web/src/state/useAnalyze.ts` — `/api/analyze-requirement` SSE 호출, progress event 수집.
2. AnalyzeWorkbench 에 "Codex CLI 로 재분석" 버튼 (활성 root 의 normalizedRequirement.raw_text + domain 을 입력으로 보냄).
3. SSE progress UI: 진행 단계, tool 호출, 종료 시 result 를 분석 결과로 PUT.
4. raw_text 가 없는 root (예: import 만 받은 root) 인 경우 안내 EmptyState.
5. catalog 를 함께 보내야 분석 품질이 유지됨 — `/api/catalog` 합본 데이터를 sanitize 후 payload 에 추가.

### C 선택 시
1. Landing 또는 AnalyzeWorkbench 에 "af-analyze-requirement skill 실행 명령" 을 alert / clipboard copy 로 노출.
2. 코드 변경 최소.

## 권장

(B) 가 사용 경험상 가장 자연스럽다. (A) 는 안전하지만 분석을 위해 매번 별도 도구를 켜야 한다. (C) 는 어중간하다. 사용자에게 한 번 확인 후 선택.

## 파일 / 디렉터리 (B 기준)

- 신규
  - `packages/web/src/state/useAnalyze.ts`
  - `packages/web/src/routes/AnalyzeWorkbench.tsx` 내 작은 progress panel (또는 분리 컴포넌트)
- 수정
  - `packages/web/src/routes/AnalyzeWorkbench.tsx` — 재분석 버튼 + progress 표시 + 결과 PUT
- 미수정 (재사용)
  - `packages/web/server/codexAnalyzer.ts` — 이미 SSE 동작.

## 검증

```bash
cd packages/web && npm run build && npm run test:analyzer
```

MCP 스모크 (B 기준):
1. req-pr-analyze 새 root + raw_text 있는 minimal analysis-result import (또는 빈 root 에서 안내 EmptyState 가 뜨는지).
2. "재분석" 클릭 → progress SSE event 가 화면에 흐름 → 결과 PUT → analysis-result.json 갱신.
3. 갱신 후 분석 모듈/처리흐름이 새 결과로 교체되는지 확인.

## Out of scope

- Codex CLI 자체의 성능 / 모델 선택 — 기존 `codexAnalyzer.ts` 가 이미 가진 옵션 활용.
- analyzer provider 다중화 (OpenAI 직접 호출 등) — 1차 (B) 에서는 Codex CLI 만.

## 위험 / 메모

- 분석은 수십초~수분 걸린다. SSE progress 가 보이지 않으면 UX 가 깨진다.
- raw_text 에 PII / 비밀이 들어가면 그대로 Codex 에 전송됨. 운영 정책상 분석 입력의 sensitivity 가이드를 docs 에 명시.
- 활성 root 의 raw_text 가 깡통일 때 (외부 import 후 정규화 누락) "원문 입력 없음" 안내가 필요.
- Codex CLI 가 사용자 환경에 설치되어 있어야 한다. README / harness 에 이미 명시되어 있는지 확인.
