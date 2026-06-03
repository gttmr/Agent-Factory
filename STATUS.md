# STATUS — Workbench UI 재설계 (StageShell)

브랜치: `feat/port-mock-lab-design-system` · 범위: `48458ff..HEAD` (packages/web + docs)

## 목표

CLI 스킬 4단계를 1:1 라우트로 옮긴 워크벤치가 한 화면에 실행+검토+승인(+Build은 라이브 챗까지)을 쌓아 "지금 뭘 해야 하는지" 알기 어려웠다. 단계를 더 잘게 나누고, 한 화면을 간결하지만 필요한 정보는 다 있도록 재구성했다.

## 한 일 (PR1–PR7, commit-per-PR)

| 커밋 | 내용 |
|---|---|
| `5341f3d` | 공용 `StageShell`(좌측 스텝 레일 1실행·2검토·3승인 + 요약 strip + "다음에 할 일" 가이드 + next-action CTA) + `useStageStep`(`?step=`) + 게이트 없는 `실행` 보조 nav/route 스캐폴드 |
| `8c95b28` | Analyze → StageShell 3스텝 + 활성 스텝 강조(accent 테두리/바/index) + 비활성 CTA dim |
| `bb5454f` | Design → StageShell (검토 스텝에 기존 3-pane Graph IR, 승인 스텝에 게이트 2개) |
| `cc1e3e4` | 실행/Run 화면(RunSandbox): ADK 런타임 연결 제어 + ADK 공식 dev UI(`web_url`) 링크 버튼 |
| `59620ad` | Build → StageShell, ADK 연결/챗 패널을 실행 화면으로 분리(AF 간이 챗 제거) |
| `df71ec3` | Verify → StageShell 2스텝(실행·기록, 게이트 없음) |
| `fc521db` | Codex 리뷰 findings 반영(아래) |
| `8e88e3e` | 문서 동기화(design-system / harness / CLAUDE / validation) |

### 핵심 설계 결정 (사용자 합의)
- 구조 = 하이브리드: 상단 4스테이지 유지 + 스테이지 내부 좌측 스텝 레일. URL은 얕은 `?step=`.
- '실행'은 5번째 **게이트 없는** 보조 nav. `afRunStageIds`(=manifest 스키마/게이트 칩)는 **불변**.
- ADK가 `adk api_server --with_ui`로 완성도 높은 dev UI를 이미 제공 → AF 자체 간이 챗 제거, **링크 버튼**으로 대체(iframe 임베드 아님).
- 강한 가이드 + 기본 화면엔 "현재 할 일 + 실행 버튼"과 "핵심 산출물 요약"만, 나머지는 접기/탭.

## 검증한 것
- `cd packages/web && npm run build` (tsc --noEmit + vite): ✅ clean
- `node scripts/validate-artifacts.mjs templates` (repo 루트): ✅ Artifact validation OK
- chrome-devtools 스크린샷(`/tmp/af-screens/redesign/`): 6개 화면 전 스텝, 콘솔 에러 0(기존 React Router v7 future-flag 경고만)
- 비활성 next-stage CTA가 `<button disabled>`로 렌더(키보드 우회 차단) — DOM 확인
- Codex read-only 리뷰(`48458ff..HEAD`): 게이트 무결성 확인(afRunStageIds 미변경, 토글은 useApprovalGate 경유, StageRunner 자동 토글 없음)

### Codex findings 반영 (`fc521db`)
- 비활성 CTA 키보드 우회 → enabled일 때만 `<Link>`, 아니면 `<button disabled>`
- RunSandbox stale "running" 링크 → `useRuntimeChatStatus`에 `refetchInterval 5s` + `refetchOnWindowFocus`
- dead AF-챗 client hook(`useCreateRuntimeChatSession`/`useSendRuntimeChatMessage`+타입) 제거, dead `.af-runtime-chat-*`/`.af-chat-message*` CSS 제거
- NIT: `.af-run-shell` gap 토큰화

## 남은 것 / 후속
- ~~서버 dead-code (runtime-chat session/message)~~ → **정리 완료**: `/runtime-chat/{session,message}` 라우트, `RuntimeChatManager.createSession/sendMessage`, `RuntimeChatSessionResult`/`RuntimeChatMessageResult`, `createSessionId`/`cleanId`/`DEFAULT_USER_ID` 제거. status/install/start/stop만 유지. `extractFinalTextFromAdkEvents`는 테스트되는 순수 유틸이라 유지. 전체 `test:analyzer` 스위트 통과.
- ~~onboarding HTML 미수정~~ → **갱신 완료**: onboarding HTML은 (생성물이 아니라) 수작업 파일이었음. `02-workbench-tour`(라우트/스텝레일/실행 화면), `08-validation-handoff`(런타임 실행 섹션 + 퀴즈 Q2 정답 교정), `09-glossary`(chat-smoke 항목 + 실행/StageShell 신규 항목), `06-review-board`(smoke_spec 소비처)를 새 플로우로 수정하고 `file://`로 렌더·퀴즈 동작 확인. index.html의 고차원 파이프라인 서술(analyze→…→verify)은 그대로 유지(실행은 게이트 밖 보조 도구).
- **CSS NIT**: StageShell의 구조적 px(레일 220px, 860px 브레이크포인트)는 토큰 없음 — 기존 design.css 관례(260/320px)와 일치시켜 유지.
- 라이브 Gemini 스모크(runnable 모드 실제 실행)는 사용자 키/비용 필요 — 미검증.
- **푸시 완료**: `48458ff..09ce0e7`을 `origin/feat/port-mock-lab-design-system`에 푸시. 기존 **PR #21**(base=main)에 합쳐 Phase-1 + 재설계 = 28커밋, 제목/본문 갱신. **리뷰·머지 대기**(아직 미머지).

## 후속 개선 (리뷰 중, origin 미푸시 로컬 커밋)
- `4b8dcd2` — 설계 검토 캔버스 확장: 우측 Inspector를 `INSPECTOR_ENABLED=false`로 비활성(코드 보존), `GraphCanvas` `hideInspector` 시 `.graph-canvas-root--no-inspector` 1열 → React Flow가 전체 폭 사용(927→1295px). 휴면 기능: Runtime/A2A 계약 편집 인스펙터·앵커 코멘트 작성.
- `6a1ee10` — 생성기: 생성 테스트를 `<pkg>/tests/`(패키지 내부)로 이동 → `adk api_server`가 번들 루트에서 패키지만 앱으로 스캔(이전엔 형제 `tests/`를 앱으로 보고 "No root_agent found for 'tests'" 에러). compileall은 `<pkg>`만. 샘플 `req-loan-precheck-smoke`를 runnable로 재생성 → ADK dev UI에 다중 노드 Workflow(LlmAgent+어댑터+JoinNode) 표시 확인.
- 문서 감사: 위 변경에 맞춰 design-system / harness / CLAUDE / validation / onboarding(02·07) 의 "3-pane·Inspector·Runtime 계약 편집·tests 레이아웃" 서술을 현행화.
- 어댑터 5개는 Mock Lab MCP 미바인딩(unconnected TODO 스텁) — 실제 어댑터 호출엔 Mock Lab MCP 서버 연결 필요. runnable 채팅엔 `runtime-stub/.env`의 `GOOGLE_API_KEY` 필요.

## 불변식 (재설계 내내 지킴)
- `manifest.approvals.*` 단일 진실원, 후보 status에서 재계산 안 함, StageRunner 성공이 게이트 자동 토글 안 함.
- 한국어 UI 라벨 보존, 디자인 토큰/`CategoryBadge` 사용, raw 카테고리 `<span>` 금지.
- `raw_requirement_to_code: false`, private endpoint/credential/실데이터 미포함.
