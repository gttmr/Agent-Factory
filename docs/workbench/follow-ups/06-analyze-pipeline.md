# 06 — Analyze pipeline 결정

## 왜 필요한가

PR6 에서 `/legacy` 가 제거되며 워크벤치 UI 안에서 분석을 직접 실행할 수단이 사라졌다. 현재는 외부 `af-analyze-requirement` skill 이 `analysis-result.json` 을 생성하고 사용자가 import 해야 한다. 이게 의도된 운영 모델인지, 아니면 `/af/:reqId/analyze` 에서 "분석 실행" 버튼 한 번으로 Codex CLI 를 호출하는 게 맞는지 사용자가 결정해야 한다.

PR2 의 AnalyzeWorkbench 코드에 남아있는 `handleRerun` 함수는 현재 안내 메시지만 출력한다.

## 현재 상태

- 서버: `packages/web/server/codexAnalyzer.ts` 가 그대로 `POST /api/analyze-requirement` SSE endpoint 를 제공. validateAnalysisResult 도 동일.
- 클라이언트 hook: `AnalyzerProvider` / `OpenAICompatibleAnalyzerProvider` / `defaultAnalyzerProvider` 는 PR6 에서 삭제. 즉 호출 측 코드가 사라짐.
- 사용자 발언: PR6 진입 직전 "레거시는 없어도 된다" (분석을 외부에서 import 하는 모델 수용 시사). 단 명시적으로 "재분석 버튼이 없어도 좋다" 라고는 안 했다.

## 결정해야 할 것

A. **외부 import 만 유지.** 현재 상태 그대로. `codexAnalyzer.ts` 및 `/api/analyze-requirement` endpoint 도 삭제 가능.
B. **재분석 버튼을 워크벤치에 복원.** AnalyzeWorkbench 의 "재분석" 버튼이 실제로 Codex CLI 를 호출하고 결과를 PUT.
C. **외부 import + skill 트리거.** UI 가 직접 Codex 를 호출하지는 않지만 "af-analyze-requirement skill 실행" 안내 / spawn 만 한다.

`/home/ilmaswsl/.claude/plans/agent-factory-synthetic-hummingbird.md` §1 라우트 표 의 `/af/:reqId/analyze` 행은 "`POST analyze` (Codex CLI 재실행)" 을 명시하므로 원래 계획은 (B) 였다. PR2 도입 시 복잡도 줄이려고 미뤄둔 항목.

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
