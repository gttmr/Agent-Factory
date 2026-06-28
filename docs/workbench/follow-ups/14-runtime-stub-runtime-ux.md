# 14 — 실행(RunSandbox) / Build 런타임 UX

상태: **부분 대체.** artifact-local dependency 관리 문제는 artifact-local venv를 폐기하고 공유 venv(`.agent-factory/runtime/.venv` / `AF_ADK_VENV_DIR`) + `requirements/adk-runtime.txt` 수동 준비 정책으로 대체했다. stale reload, adapter 없는 Mock Lab 패널 같은 UX 항목은 아직 별도 후속이다.

## 왜 필요한가 (관찰된 마찰)

1. **artifact-local venv 추적 폐기(대체됨)**: RunSandbox가 더 이상 `runtime-stub/.venv`를 만들지 않는다. 웹은 설치를 수행하지 않고, smoke/runnable/A2A/MCP를 포괄하는 공유 venv를 repo 기준 `requirements/adk-runtime.txt`로 수동 준비한다.
2. **`--no-reload` stale 로드**: 서버를 띄운 뒤 번들을 재생성하면 실행 중 프로세스는 옛 코드를 계속 서빙한다(스모크본 → runnable 재생성 후에도 옛것). 재생성 시 재시작 안내/자동 재시작이 없다.
3. **adapter 없는 시나리오의 Mock Lab 패널**: Build 의 "Mock Lab MCP 바인딩" 패널이 adapter 모듈이 0개인 시나리오(예: A2A 데모)에서도 노출되어 "실행 중 tool 없음"으로 혼동을 준다. adapter 가 없으면 숨기거나 N/A 로 표기.

## 무엇을 해야 하는가

1. **artifact-local deps 추적(대체됨)**: artifact별 `requirements.txt`/`.venv` 추적 대신 공유 `requirements/adk-runtime.txt`와 수동 venv 준비 정책을 사용한다.
2. **재생성 ↔ 실행 동기화**: runtime-stub 재생성 시 실행 중 api_server 가 stale 임을 UI 에 경고하고 재시작 버튼 제공(또는 재생성 후 자동 stop). RunSandbox 가 외부로 띄운 프로세스를 추적하지 못하는 점도 함께 정리.
3. **Mock Lab 패널 조건부 노출**: scaffold-plan 에 adapter 모듈이 없으면 "Mock Lab MCP 바인딩" 섹션 숨김/비활성.
4. (선택) A2A 번들 실행 가이드: remote 번들은 별도 A2A 서버가 필요하다는 안내 + `scenario-i/mock_remote` 로컬 mock 링크.

## 건드릴 파일

- `packages/web/src/routes/RunSandbox.tsx` (deps/재시작/추적)
- `packages/web/src/routes/BuildWorkbench.tsx` (Mock Lab 패널 조건부, 재생성 경고)
- 서버: `packages/web/server/afArtifactsApi.ts` (runtime-stub build / shared venv runtime launch wiring) 관련
- 문서: `docs/workbench/validation.md`, `docs/workbench/agent-factory-harness.md`

## 검증

워크벤치에서: smoke→runnable 전환 후 shared venv 준비 상태가 명확히 안내되고 앱 로드 성공; remote_a2a 번들이 `[a2a]` 포함 venv 로 기동; 재생성 후 stale 경고/재시작 동작; adapter 없는 시나리오에서 Mock Lab 패널 미노출. chrome-devtools 스크린샷.

## 규모/주의

UI/서버 양쪽. 게이트 모델(`manifest.approvals.*`)은 건드리지 않는다 — 실행(▸ 실행)은 게이트 없는 보조 화면. 수동 회피책(현재): A2A deps 가 깔린 venv 로 `adk api_server --with_ui` 를 직접 기동(테스트 세션에서 사용한 방법).
