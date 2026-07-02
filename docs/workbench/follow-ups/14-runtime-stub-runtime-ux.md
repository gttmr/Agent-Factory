# 14 — 실행(RunSandbox) / Build 런타임 UX

상태: **완료.** artifact-local dependency 관리는 공유 venv(`.agent-factory/runtime/.venv` / `AF_ADK_VENV_DIR`) + `requirements/adk-runtime.txt` 수동 준비 정책으로 대체했다. RunSandbox는 runtime-stub 변경 fingerprint 기반 stale 경고와 명시 재시작을 제공하고, Build 화면은 adapter 없는 runnable plan에서 Mock Lab binding panel을 숨기거나 대상 없음으로 안내한다.

## 왜 필요한가 (관찰된 마찰)

1. **artifact-local venv 추적 폐기(대체됨)**: RunSandbox가 더 이상 `runtime-stub/.venv`를 만들지 않는다. 웹은 설치를 수행하지 않고, smoke/runnable/A2A/MCP를 포괄하는 공유 venv를 repo 기준 `requirements/adk-runtime.txt`로 수동 준비한다.
2. **`--no-reload` stale 로드**: 서버를 띄운 뒤 번들을 재생성하면 실행 중 프로세스는 옛 코드를 계속 서빙한다(스모크본 → runnable 재생성 후에도 옛것). 재생성 시 재시작 안내/자동 재시작이 없다.
3. **adapter 없는 시나리오의 Mock Lab 패널**: Build 의 "Mock Lab MCP 바인딩" 패널이 adapter 모듈이 0개인 시나리오(예: A2A 데모)에서도 노출되어 "실행 중 tool 없음"으로 혼동을 준다. adapter 가 없으면 숨기거나 N/A 로 표기.

## 무엇을 해야 하는가

1. **artifact-local deps 추적(완료)**: artifact별 `requirements.txt`/`.venv` 추적 대신 공유 `requirements/adk-runtime.txt`와 수동 venv 준비 정책을 사용한다.
2. **재생성 ↔ 실행 동기화(완료)**: runtime-stub 재생성 시 실행 중 api_server 가 stale 임을 UI 에 경고하고, 사용자가 명시적으로 누르는 재시작 버튼으로 stop/start를 수행한다.
3. **Mock Lab 패널 조건부 노출(완료)**: scaffold-plan 에 adapter 모듈이 없으면 "Mock Lab MCP 바인딩" 섹션을 숨기고 대상 없음 안내만 표시한다.
4. **A2A 번들 실행 가이드(완료)**: remote 번들은 provider/Mock Lab prerequisite와 Agent Card readiness를 분리해서 안내한다. full remote HITL same-task text-chat resume은 새 TBD 브리프로 남긴다.

## 건드릴 파일

- `packages/web/src/routes/RunSandbox.tsx` (deps/재시작/추적)
- `packages/web/src/routes/BuildWorkbench.tsx` (Mock Lab 패널 조건부, 재생성 경고)
- 서버: `packages/web/server/afArtifactsApi.ts` (runtime-stub build / shared venv runtime launch wiring) 관련
- 문서: `docs/workbench/validation.md`, `docs/workbench/agent-factory-harness.md`

## 검증

워크벤치에서 검증된 기준: smoke→runnable 전환 후 shared venv 준비 상태 안내, remote_a2a provider prerequisite/card readiness 분리, 재생성 후 stale 경고/재시작 동작, adapter 없는 시나리오에서 Mock Lab 패널 미노출. local A2A provider/import smoke와 ADK Web/Workbench smoke 증거는 `STATUS.md`의 `local A2A provider/import` 섹션을 우선한다.

## 규모/주의

UI/서버 양쪽. 게이트 모델(`manifest.approvals.*`)은 건드리지 않는다 — 실행(▸ 실행)은 게이트 없는 보조 화면. 이 brief는 완료 기록으로 보존하고, Remote A2A `input-required` task를 plain ADK Web text chat으로 resume하는 검증은 새 TBD 브리프에서 다룬다.
