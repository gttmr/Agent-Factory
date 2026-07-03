# Agent Factory Workbench — follow-up INDEX

> 새 세션에서 시작한다면 [`STATUS.md`](./STATUS.md)를 먼저 본다.

이 디렉터리는 live follow-up queue만 유지한다. 완료된 historical briefs 00-16과 `_perf-notes.md`는 `docs/archive/follow-ups/`에 보관한다.

현재 사용 규칙:

- `STATUS.md`가 live backlog의 단일 source of truth다.
- 이 INDEX는 active queue와 archive 위치를 찾기 위한 카탈로그다.
- live branch/commit 상태는 이 파일에 기록하지 않는다. 새 작업을 시작할 때는 `git status`, active docs, 현재 코드, `STATUS.md`를 함께 확인한다.

## Active Queue

| 번호 | 파일 | 구현 상태 | 현재 판단 근거 |
|---|---|---|---|
| 17 | [`17-a2a-ui-error-surfacing.md`](./17-a2a-ui-error-surfacing.md) | 대기 | Local A2A provider import 화면 smoke 중 발견한 404 console noise, 422 detail opacity, React Flow type object warning 정리. |
| TBD | 새 brief 필요 | 대기 | Workbench `/runtime-a2a/resume` bridge는 지원 이벤트에서 검증됐지만, Remote A2A `input-required` task를 ADK Web 일반 text chat으로 resume하는 bridge는 아직 검증되지 않았음. |

## Archived Briefs

완료된 brief 00-16은 active backlog가 아니다. 필요하면 `docs/archive/follow-ups/`에서 historical implementation record로 확인한다.

| 범위 | 위치 | 비고 |
|---|---|---|
| 00-16 | `docs/archive/follow-ups/` | 완료된 follow-up briefs. 현재 코드와 active docs가 우선한다. |
| perf notes | `docs/archive/follow-ups/_perf-notes.md` | brief 08 당시 hardcoded bundle-size snapshot. 현재 성능 기준으로 사용하지 않는다. |

## Current Baseline

- 라우트: `/`, `/af/:reqId/{analyze,design,build,verify,run}`, `/catalog`, `/mock-lab`.
- 서버 미들웨어: `/api/af/:reqId/stages/:stage/*`, `/api/analyze-requirement`, `/api/af`, `/api/af-collab`, `/api/catalog`, `/api/mock-lab/*`.
- Stage Runner와 direct analyzer는 `@openai/codex-sdk` TypeScript SDK 경로를 사용한다.
- ADK Runtime Handoff는 ADK 2.3 baseline을 따른다.

위 사실이 깨지면 brief 작성 시점과 실제 코드가 어긋난 것이므로 코드부터 다시 확인한다.
