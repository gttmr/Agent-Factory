# 07 — `docs/onboarding/*.html` 새 흐름으로 재작성

## 왜 필요한가

`docs/onboarding/` 의 HTML 가이드는 9-step wizard 시나리오 (intake → analysis → modules → … → export) 를 가정하고 있다. PR6 후 워크벤치는 5-route 모델 (`/`, `/af/:id/{analyze,design,build,verify}`, `/catalog`) 이므로 onboarding 사용자가 docs 만 보고 화면을 못 따라간다.

`00-doc-audit.md` 에서 stale 부분 목록을 확인했다. 이 브리프는 그 중 onboarding HTML 만 별도로 묶어 처리한다 (스크린샷 + 캡션이 무거워서 분리할 가치가 있다).

## 현재 상태

`docs/onboarding/`:
- `index.html`
- `01-concepts.html`
- `02-workbench-tour.html` (가장 stale — wizard step 별 설명)
- `03-taxonomy.html`
- `04-workflow-decision.html`
- `05-process-flow.html`
- `06-review-board.html`
- `07-runtime-contracts.html`
- `08-validation-handoff.html`
- `09-glossary.html` (Codex CLI 항목 등)
- `assets/` (스크린샷, css 추정)

확인된 명시적 stale:
- `02-workbench-tour.html` L52 (Codex CLI raw requirement 정규화) — surface 위치 갱신.
- `02-workbench-tour.html` L150 (intake 단계 예시 불러오기) — `/af/:id/analyze` 의 "분석 결과 import" 로 변경.
- `09-glossary.html` L97-98 (Codex CLI) — "현재 워크벤치 UI 에서는 직접 호출하지 않으며 af-analyze-requirement skill 이 호출한다" 추가.
- 03~08 챕터는 schema/taxonomy/contract 자체 설명이므로 페이지별로 wizard 단어만 grep + 갱신.

## 작업 정의 (Done means)

1. `02-workbench-tour.html` 를 새 5-route 흐름으로 다시 쓴다.
   - Landing → artifact root 생성 → analysis-result.json import → /af/:id/analyze → ...
   - 스크린샷: `/tmp/af-screens/pr2-...`, `/tmp/af-screens/pr3-...`, `/tmp/af-screens/pr4-...`, `/tmp/af-screens/pr5-...`, `/tmp/af-screens/pr6-...` 가 이미 있으나 onboarding 용으로는 다시 정리하여 `docs/onboarding/assets/` 아래 png 로 저장.
2. `09-glossary.html` 의 용어를 새 surface 와 정합 — `wizard step`, `useWorkbenchState`, `AdkRuntimeWorkbench`, `예시 불러오기` 같은 삭제된 단어는 deprecated 표기 또는 제거.
3. 03~08 챕터의 본문에서 surface 표현이 어긋난 부분만 보정. 스키마 본문은 그대로.
4. `index.html` 의 챕터 목차에 빠진 새 화면 (Reuse Hub, collaboration layer) 이 있으면 추가.

## 파일 / 디렉터리

- 수정
  - `docs/onboarding/index.html`
  - `docs/onboarding/02-workbench-tour.html` (가장 큰 작업)
  - `docs/onboarding/09-glossary.html`
  - 03~08: grep 결과에 따라 부분 수정
- 신규 (스크린샷)
  - `docs/onboarding/assets/landing.png`
  - `docs/onboarding/assets/analyze.png`
  - `docs/onboarding/assets/design.png`
  - `docs/onboarding/assets/build.png`
  - `docs/onboarding/assets/verify.png`
  - `docs/onboarding/assets/reuse-hub.png`

## 작업 절차

1. `cd packages/web && npm run dev -- --host 0.0.0.0 --port 5173 --strictPort &` 로 dev server 띄움.
2. scenario-a 또는 d 를 req-001 로 import (시연 시 보기 좋은 모듈 분포).
3. chrome-devtools MCP 로 각 화면을 캡처해 `docs/onboarding/assets/` 에 저장.
4. HTML 본문 갱신 — `<figure>` 캡션과 step 번호를 5-route 기반으로 재작성.
5. dev server 정지, smoke artifact root 삭제, 캡쳐 화일 git add.

## 검증

- 브라우저로 `docs/onboarding/index.html` 열어 클릭 흐름 확인. (서버 불필요, 정적 HTML)
- 본 브리프 작업 후 `00-doc-audit.md` 의 onboarding 항목이 모두 해소됐는지 다시 grep.

## Out of scope

- onboarding HTML 을 markdown 으로 마이그레이션 — 별 가치 없음, 유지.
- 스크린샷 자동 생성 (CI) — 1차에서는 수동.

## 위험 / 메모

- HTML / CSS 클래스를 함부로 바꾸면 다른 챕터의 레이아웃이 깨질 수 있음. 챕터 별로 분리 변경 권장.
- 스크린샷 크기를 줄이려면 PNG → WebP. 단 archive 호환성 위해 PNG 유지가 안전.
- assets 디렉터리 크기가 너무 커지면 PR 리뷰 부담. 캡처 해상도를 1280×800 정도로 제한.
