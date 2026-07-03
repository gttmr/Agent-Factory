# 07 — `docs/onboarding/*.html` 새 흐름으로 재작성

상태: 완료. Stage Runner 구현 이후 정적 온보딩 본문과 스크린샷을 현재 route 모델로 갱신했다.

## 왜 필요한가

`docs/onboarding/` 의 HTML 가이드는 원래 9-step flow(intake → analysis → modules → ... → export) 를 가정했다. PR6 후 워크벤치는 5-route 모델 (`/`, `/af/:id/{analyze,design,build,verify}`, `/catalog`) 이고, brief 09 후 Analyze/Design은 Stage Runner 패널을 먼저 보여준다.

`00-doc-audit.md` 에서 화면과 문서가 어긋난 위치를 확인했다. 이 브리프는 그 중 onboarding HTML 만 별도로 묶어 처리한다 (스크린샷 + 캡션이 무거워서 분리할 가치가 있다).

## 현재 상태

갱신 대상:
- `index.html`
- `01-concepts.html`
- `02-workbench-tour.html` (가장 큰 작업 — route별 화면 투어)
- `03-taxonomy.html`
- `04-workflow-decision.html`
- `05-process-flow.html`
- `06-review-board.html`
- `07-runtime-contracts.html`
- `08-validation-handoff.html`
- `09-glossary.html` (Codex CLI 항목 등)
- `assets/` (스크린샷, css 추정)

확인된 화면 불일치는 현재 작업에서 Stage Runner 기준으로 정리했다.

- `02-workbench-tour.html` — Landing, Analyze Skill Runner, Design Skill Runner, Build, Verify, Reuse Hub 흐름으로 재작성.
- `09-glossary.html` — Codex CLI, Stage Runner, `stage_runs`, proposed artifacts, BuildWorkbench, VerifyWorkbench, Reuse Hub 용어 추가.
- 03~08 챕터는 schema/taxonomy/contract 자체 설명은 보존하고 route/surface 표현만 갱신.

## 작업 결과

1. `02-workbench-tour.html` 를 새 5-route 흐름으로 다시 썼다.
   - Landing → artifact root 생성 → analysis-result.json import → /af/:id/analyze → ...
   - 스크린샷은 `/tmp/af-screens/onboarding-*.png` 에 캡처하고 `docs/onboarding/assets/onboarding-*.png` 로 복사했다.
2. `09-glossary.html` 의 용어를 새 surface 와 정합했다. 삭제된 surface 용어는 fixture/history로만 남기고 현재 UI 기본 경로와 섞지 않는다.
3. 03~08 챕터의 본문에서 surface 표현이 어긋난 부분만 보정했다. 스키마 본문은 유지했다.
4. `index.html` 과 navigation title을 Stage Runner / Build / Verify 흐름에 맞췄다.

## 파일 / 디렉터리

- 수정
  - `docs/onboarding/index.html`
  - `docs/onboarding/02-workbench-tour.html` (가장 큰 작업)
  - `docs/onboarding/09-glossary.html`
  - 03~08: grep 결과에 따라 부분 수정
- 신규 (스크린샷)
  - `docs/onboarding/assets/onboarding-landing.png`
  - `docs/onboarding/assets/onboarding-analyze.png`
  - `docs/onboarding/assets/onboarding-design.png`
  - `docs/onboarding/assets/onboarding-build.png`
  - `docs/onboarding/assets/onboarding-verify.png`
  - `docs/onboarding/assets/onboarding-catalog.png`

## 적용 절차 기록

1. 고정 포트 `5173`에서 이미 떠 있는 dev server를 `curl -I http://127.0.0.1:5173/` 로 확인했다.
2. 기존 `artifacts/af/req-001`, `artifacts/af/req-002` root를 화면 샘플로 사용했다.
3. Chrome DevTools MCP gate가 열려 있지 않아 WSL headless Chrome으로 큰 viewport screenshot을 캡처했다.
4. HTML 본문 갱신 — `<figure>` 캡션과 step 번호를 5-route 기반으로 재작성했다.

## 검증

- 브라우저로 `docs/onboarding/index.html` 열어 클릭 흐름 확인. (서버 불필요, 정적 HTML)
- 본 브리프 작업 후 active onboarding 문서가 Stage Runner/route 모델을 기준으로 설명되는지 다시 grep.

## Out of scope

- onboarding HTML 을 markdown 으로 마이그레이션 — 별 가치 없음, 유지.
- 스크린샷 자동 생성 (CI) — 1차에서는 수동.

## 위험 / 메모

- HTML / CSS 클래스를 함부로 바꾸면 다른 챕터의 레이아웃이 깨질 수 있음. 챕터 별로 분리 변경 권장.
- 스크린샷 크기를 줄이려면 PNG → WebP. 단 archive 호환성 위해 PNG 유지가 안전.
- assets 디렉터리 크기가 너무 커지면 PR 리뷰 부담. 캡처 해상도를 1280×800 정도로 제한.
