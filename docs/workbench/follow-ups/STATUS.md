# Follow-ups STATUS — 새 세션 진입점

마지막 갱신: 2026-07-03 (KST 기준).

이 파일은 follow-up backlog/status 의 단일 live queue 다. 현재 코드와 active docs가 과거 브리프보다 우선한다. 완료된 brief 00-16 과 `_perf-notes.md` 는 역사 기록으로 `docs/archive/follow-ups/`에 보관한다.

## 현재 사용 규칙

- live branch cleanliness나 HEAD SHA는 매번 `git status --short`, `git rev-parse --abbrev-ref HEAD`, `git rev-parse --short HEAD`로 확인한다.
- detailed brief, archived brief, active docs, 현재 코드가 충돌하면 현재 코드와 active docs를 먼저 확인한다.
- 새 후속 작업은 `INDEX.md`에 새 번호로 추가하고, 이 파일에는 open queue만 유지한다.
- 마이그레이션 전체 설계는 repo 외부 계획 파일이 아니라 active docs와 archived briefs를 보조 자료로 확인한다.

## Open Queue

| 번호 | 상태 | 요약 | 크기 | 근거 |
|---|---|---|---|---|
| 17 | 대기 | A2A UI error surfacing cleanup | S | Local A2A provider import 화면 smoke 중 발견한 404 console noise, 422 detail opacity, React Flow type object warning 정리. |
| TBD | 대기 | Remote A2A HITL resume bridge | M | Workbench `/runtime-a2a/resume` bridge는 지원 이벤트에서 검증됐지만, ADK Web 일반 text chat으로 같은 remote `input-required` task에 `functionResponse`를 이어 보내는 경로는 아직 검증되지 않음. |

## Open Item Details

### brief 17 — A2A UI error surfacing cleanup

- 신규 artifact root가 아직 `analysis-result.json`을 갖지 않은 정상 상태와 실제 fetch 실패를 구분해 console noise를 줄인다.
- artifact import/save 실패는 validator detail을 화면 message에 노출한다.
- React Flow `nodeTypes`/`edgeTypes` object는 안정 참조로 유지한다.
- 검증은 fixed-port Workbench(`http://127.0.0.1:5173/`)에서 새 root 생성, import 실패 fixture, local A2A provider import flow를 다시 확인한다.

### TBD — Remote A2A HITL resume bridge

- A2A `input-required`는 최종 답변이 아니라 remote agent가 사람 입력을 기다리는 interactive task state다.
- Workbench resume is the verified bridge for supported `input-required` events: it requires task/context/interrupt/function metadata and sends a function_response DataPart through `/api/af/:reqId/runtime-a2a/resume`.
- Plain ADK Web text chat은 동일 remote task를 `functionResponse`로 이어 보내는 검증된 remote HITL resume bridge가 아니다.
- Runtime task id, context id, interrupt id are runtime-state only. They may appear in runtime events, local runtime registries, API transcripts, and QA evidence; they must not be persisted into catalog rows, design artifacts, scaffold plans, or generated source.

## Current Baseline Notes

- Stage Runner와 direct analyzer, Mock Lab draft는 repo 코드에서 외부 Codex CLI 프로세스를 직접 spawn하지 않는다. 서버는 `@openai/codex-sdk` TypeScript SDK를 사용한다.
- Agent Factory taxonomy and runnable handoff target the ADK 2.3 baseline. Historical smoke-version notes are archived with the briefs that produced them.
- Workflow catalog reuse remains local. Reuse Hub는 A2A 변환 액션을 제공하지 않으며, A2A를 Agent의 Binding/Exposure로 모델링한다.
- A2A publication은 strict Target v2 Agent entry만 받는다. 이전 Workflow 기반 입력이나 별도 원격 자산 category는 읽거나 변환하지 않는다.
- Agent Card `HTTP 200`은 provider process/card health일 뿐이며 chat-ready로 보지 않는다. semantic `message/send` probe가 별도 readiness source다.
- local Mock Lab prerequisite가 빠져 있으면 `server.status: running` 뒤에 숨기지 않고 prerequisite/blocked 상태와 시작 action으로 노출한다.

## Archived History

Completed briefs 00-16 and the old perf notes are archived under `docs/archive/follow-ups/`. They are historical implementation records, not the active backlog:

- `docs/archive/follow-ups/00-doc-audit.md`
- `docs/archive/follow-ups/01-canvas-collaboration-overlay.md`
- `docs/archive/follow-ups/02-path-trace-panel.md`
- `docs/archive/follow-ups/03-runtime-contract-review-surface.md`
- `docs/archive/follow-ups/04-a2a-contract-review-surface.md`
- `docs/archive/follow-ups/05-sse-streaming.md`
- `docs/archive/follow-ups/06-analyze-pipeline.md`
- `docs/archive/follow-ups/07-onboarding-html-refresh.md`
- `docs/archive/follow-ups/08-perf-and-bundle.md`
- `docs/archive/follow-ups/09-skill-runner-workbench.md`
- `docs/archive/follow-ups/10-dynamic-workflow-lowering.md`
- `docs/archive/follow-ups/11-agent-consumer-channel-reads.md`
- `docs/archive/follow-ups/12-a2a-contract-policy-mapping.md`
- `docs/archive/follow-ups/13-scaffold-plan-warning-accuracy.md`
- `docs/archive/follow-ups/14-runtime-stub-runtime-ux.md`
- `docs/archive/follow-ups/15-catalog-first-runtime-gap.md`
- `docs/archive/follow-ups/16-build-verify-stage-runner.md`
- `docs/archive/follow-ups/_perf-notes.md`

## Verification Entry Points

- Docs-only residue cleanup: `git diff --check` and `node scripts/validate-artifacts.mjs`.
- UI follow-up implementation: fixed-port Workbench at `http://127.0.0.1:5173/`, plus `cd packages/web && npm run build` and targeted analyzer/runtime checks as the changed surface requires.
