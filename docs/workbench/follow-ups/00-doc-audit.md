# 00 — Doc audit (router-shell migration 후 잔존 stale 참조)

## 왜 필요한가

PR1–PR6 은 코드 측면에서 라우터 셸 + artifact-root-first 흐름으로 전면 전환했지만, 문서 일부가 여전히 9-step wizard / `useWorkbenchState` / `AdkRuntimeWorkbench` / `예시 불러오기` 등 사라진 surface 를 전제로 작성돼 있다. 새 onboarding 사용자가 docs 만 보고 워크벤치를 켜면 화면과 설명이 어긋나서 신뢰가 깎인다.

이 브리프는 코드 변경 없이 **문서만 정리**하는 단발성 작업이다.

## 현재 상태 — 의심 지점 (코드 검증 끝낸 항목)

코드 grep 결과를 기준으로 명시. 실제 작업 시 한 번 더 검증한다.

### 확인된 stale 위치

- `docs/onboarding/02-workbench-tour.html`
  - L52: "Codex CLI가 raw requirement를 정규화한다… 화면 상단의 핵심 계약 5개" — 현재 `AnalysisResult` 컴포넌트의 metric panel 은 동일하지만 진입점이 wizard intake → analysis 가 아니라 Landing import → `/af/:id/analyze`.
  - L150: "intake 단계에서 예시 불러오기를 누른다" — intake 단계와 예시 불러오기 버튼 모두 PR6 에서 제거됨.
  - 전체적으로 wizard 9 step (intake → analysis → modules → graph → contracts → catalog → saved → export) 흐름으로 서술되어 있다.
- `docs/onboarding/09-glossary.html`
  - L97-98: "Codex CLI… `/api/analyze-requirement` SSE endpoint를 통해 호출되고" — 엔드포인트는 남아있지만 워크벤치 UI 에서 호출하지 않는다. 용어 정의로는 유지하되 "현재 워크벤치 UI 에서는 직접 호출하지 않으며 af-analyze-requirement skill 이 호출한다" 한 줄 추가 필요.
  - 다른 항목들도 `예시 불러오기`, `Module Review` UI, `SavedAnalysisRecord` 같은 wizard 전용 단어가 정의되어 있으면 갱신 또는 deprecate 표기.
- `docs/onboarding/index.html` 및 03~08 챕터 — wizard 시나리오 기반 가능성 높음. 페이지 별로 한 번씩 brain check.
- `docs/workbench/validation.md`
  - L38: "schemas/analysis-draft.schema.json은 live Codex CLI의 내부 반환 계약" — 사실이지만, "워크벤치 UI 는 이 endpoint 를 호출하지 않는다 — 검증은 import 시 `validateAnalysisResult` 가 담당" 같은 정합화 필요.
- `docs/workbench/review-board.md`, `docs/workbench/process-flow.md`, `docs/workbench/taxonomy.md`, `docs/workbench/analysis-guide.md`, `docs/workbench/workflow-decision-guide.md`
  - wizard 화면이 아니라 schema / taxonomy 자체를 기술하는 문서. 빠르게 한 번 훑고 `AdkRuntimeWorkbench` / `useWorkbenchState` / `예시 불러오기` 등 surface 단어가 있는지만 확인.
- `docs/README.md` (docs 디렉터리 소개)
  - 워크벤치 흐름 그림이 있으면 4-route 모델로 재작성.
- `AGENTS.md`
  - 현재는 grep 상 wizard/`useWorkbenchState` 직접 언급 없음. 단 "현재 라우트 / surface 가 어디 정의됨" 같은 navigation 안내가 있다면 PR6 이후 경로로 정렬.
- `README.md` (repo 최상단)
  - 현재 grep 상 wizard 단어 없음. 단 워크벤치 화면 설명/스크린샷이 있다면 PR2-PR6 결과로 교체 또는 삭제.

### 명시적 정상 / 의도된 잔존

- `docs/archive/**` 는 archived. 손대지 않는다.
- `packages/web/server/codexAnalyzer.ts` 와 `/api/analyze-requirement` SSE endpoint 자체는 유지 (해체 결정은 06-analyze-pipeline.md 에서 다룸). 따라서 문서에서 "이 endpoint 가 존재한다" 는 서술은 사실 그대로 둔다.

## 작업 정의 (Done means)

1. `docs/workbench/follow-ups/INDEX.md` 의 "마이그레이션 후 변경된 사실" 섹션과 100% 정합한 상태로 위 의심 위치들을 갱신.
2. 의도된 잔존 (Codex SSE endpoint 존재 사실, archive 디렉터리) 은 그대로 두되, 필요한 곳에 "워크벤치 UI 에서 직접 호출하지 않음" 한 줄을 추가.
3. `docs/onboarding/*.html` 가 새 흐름 (Landing → import → `/af/:id/analyze` → … → `/af/:id/verify` → Reuse Hub) 를 따라가도록 본문/스크린샷/캡션 갱신. 스크린샷이 옛 화면이라면 적어도 placeholder 텍스트로 교체하고 별도 브리프(07) 에서 새 스크린샷 확보.
4. 갱신 자체로 schema/code 가 함께 바뀔 일은 없어야 한다. 코드가 바뀌어야 하는 점이 발견되면 그 항목은 적절한 다른 브리프(03–08)로 옮긴다.

## 작업 절차 (권장)

```bash
cd /home/ilmaswsl/work/Agent-Factory
# 1. 본 브리프의 의심 위치 목록을 다시 grep 으로 확인
grep -rn "wizard\|useWorkbenchState\|LegacyWizard\|exampleRequirement\|예시 불러오기\|AdkRuntimeWorkbench\|SavedAnalyses\|/legacy" docs/ AGENTS.md README.md CLAUDE.md
# 2. 각 파일을 열어 PR6 후 실제 코드와 어긋난 표현만 골라 수정
# 3. 변경 후 docs 만 변경이므로 빌드는 불필요. 단 onboarding html 스크린샷을 추가하면 chrome-devtools MCP 로 다시 캡처
```

## 검증

- `grep -rn "wizard\|useWorkbenchState\|LegacyWizard\|exampleRequirement\|예시 불러오기\|AdkRuntimeWorkbench" docs/ CLAUDE.md AGENTS.md README.md` 결과가 archive 외 0건 (또는 의도된 잔존만 남음).
- `cd packages/web && npm run build` 통과 (TS 파일은 만지지 않으므로 사실상 무영향이지만 안전망).

## Out of scope

- 새 onboarding 스크린샷 캡처 → `07-onboarding-html-refresh.md` 로 분리.
- Codex CLI endpoint 자체를 제거할지 결정 → `06-analyze-pipeline.md` 로 분리.

## 위험 / 메모

- onboarding HTML 은 사람-읽기용 문서다. 본문 내 코드 블록의 변수 이름이 옛 컴포넌트 (예: `useWorkbenchState`, `acceptedMissing`) 를 직접 참조하면 모두 갱신해야 한다.
- `acceptedMissing` 은 PR6 후 router shell 의 `AnalyzeWorkbench` 내부 state 로 살아있다. 단어 자체가 잔존하지만 위치만 달라졌다 — 문서에 위치를 명시할 때는 "현재는 `AnalyzeWorkbench` 컴포넌트 in-memory state" 로 적는다.
