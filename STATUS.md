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
- **서버 dead-code**: `/api/af/:id/runtime-chat/{session,message}` 엔드포인트 + `runtimeChat.ts`의 createSession/sendMessage는 UI 미사용이나 잔존(테스트 영향 검토 후 별도 정리). 위치: `server/afArtifactsApi.ts`, `server/runtimeChat.ts`.
- **onboarding HTML**(`docs/onboarding/*.html`): "DO NOT EDIT" 생성물이라 미수정 — 구 플로우(02-workbench-tour 등) 재생성 필요.
- **CSS NIT**: StageShell의 구조적 px(레일 220px, 860px 브레이크포인트)는 토큰 없음 — 기존 design.css 관례(260/320px)와 일치시켜 유지.
- 라이브 Gemini 스모크(runnable 모드 실제 실행)는 사용자 키/비용 필요 — 미검증.
- 미병합/미푸시: 브랜치에 커밋만 됨(merge/push는 사용자 요청 대기).

## 불변식 (재설계 내내 지킴)
- `manifest.approvals.*` 단일 진실원, 후보 status에서 재계산 안 함, StageRunner 성공이 게이트 자동 토글 안 함.
- 한국어 UI 라벨 보존, 디자인 토큰/`CategoryBadge` 사용, raw 카테고리 `<span>` 금지.
- `raw_requirement_to_code: false`, private endpoint/credential/실데이터 미포함.
