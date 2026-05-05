# Validation

Agent Factory export artifact는 구현 계획이나 후속 작업에 쓰기 전에 검증해야 한다.
검증 목표는 raw requirement가 바로 코드나 실행 logic으로 건너뛰지 않게 하는 것이다.

## module-candidates.json

- `module_category`는 `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
- `agent`는 `agent_kind`를 포함한다.
- `workflow`는 `workflow_kind`를 포함한다.
- `adapter`는 `adapter_kind`를 포함한다.
- `remote_a2a`는 `remote_contract_kind`를 포함한다.
- `status`는 `approved`, `deferred`, `rejected`, `needs_info` 중 하나다.
- `missing_information`은 후보별로 승인 전 필요한 정보를 담는 문자열 배열이다.
- `legacy_recommended_type`은 migration metadata로만 사용한다.
- risk signal은 analyzer enum과 `catalog/risk-gates.yaml`의 의도에 맞아야 한다.

## process-flow.json

- node `type`은 `input`, `output`, `agent`, `workflow`, `adapter`, `remote_a2a` 중 하나다.
- candidate node의 `type`은 해당 candidate의 `module_category`와 맞아야 한다.
- `edge_type`은 `local` 또는 `remote_a2a`만 사용한다.
- `remote_a2a` edge는 독립 Remote A2A node와 연결될 때만 사용한다.
- `data_channel`을 쓰는 경우 `event_output`, `event_message`, `session_state`, `temp_state`, `user_state`, `app_state`, `artifact`, `route`, `control`, `unknown` 중 하나다.
- `state_key`, `artifact_key`, `schema_ref`, `route_condition`은 비어 있지 않은 문자열 또는 `null`이다.
- `parallel`, `loop`, `human_review` 흐름은 edge data와 candidate rationale에서 설명되어야 한다.
- 종료 조건 없는 loop, merge 없는 parallel branch, 승인 없는 high-risk action은 `needs_info`로 남긴다.

## scaffold-plan.json

`scaffold-plan.json`은 승인된 workbench export artifact다.
이 파일은 향후 구현 계획의 입력일 수 있지만, raw requirement를 실행 가능한 business logic으로 바꾸라는 지시가 아니다.

- source는 승인된 workbench artifact여야 한다.
- `approved` candidate만 포함한다.
- raw requirement는 직접 코드 생성 입력이 될 수 없다.
- Agent, Workflow, Adapter, Remote A2A 항목은 계약과 placeholder 수준으로만 해석한다.
- runnable business logic은 out of scope다.

## 문서 구조

- 활성 워크벤치 문서는 `docs/workbench/` 아래에 둔다.
- ADK 공식 설명은 repo에 복제하지 않고 `adk-docs-mcp`에서 확인한다 (ADK 2.0 Beta 섹션 우선; 1.14는 legacy compat).
- ADK component와 Agent Factory taxonomy의 연결 규칙은 `docs/workbench/workflow-decision-guide.md`에 둔다.
- 스캐폴딩 노트, 과거 계획, 리뷰 기록, 스킬 노트, 유지보수 프롬프트는 `docs/archive/` 아래에 둔다.
- `docs/README.md`가 기본 프롬프트 경로를 설명해야 한다.

## Lightweight Validator

Export artifact smoke test:

```bash
node scripts/validate-artifacts.mjs
```

Export directory validation:

```bash
node scripts/validate-artifacts.mjs path/to/exported-artifacts
```

문서만 변경한 경우에는 build 대신 구조와 링크 검증을 우선한다.
TypeScript, React, analyzer, export logic을 변경한 경우에는 `cd packages/web && npm run build`를 실행한다.

## ADK Source Smoke Test

ADK source generator는 `normalized-requirement.json`, `module-candidates.json`, `process-flow.json`을 입력으로 받아 실행 가능한 ADK 2.0 graph workflow source를 만든다.
Generator는 `process-flow.json`을 바로 `Workflow(edges=[...])`로 쓰지 않고 Graph IR로 정규화한 뒤 ADK source를 만든다.

Graph IR 검증 기준:

- 같은 source node에서 같은 route value가 여러 목적지로 연결되면 오류다.
- `JoinNode`는 loop re-entry나 human gate가 아니라 진짜 fan-in merge에만 만든다.
- loop re-entry는 별도 loop edge로 보존한다.
- `remote_a2a`, `rejected`, `deferred` node는 기본 local runtime graph에서 제외한다.
- runtime mode는 `stub`, `llm`, `adapter`로 구분한다. 기본 `stub` mode는 API key 없이 graph 구조만 검증한다.

```bash
node scripts/generate-adk-source.mjs templates generated/adk-source
cd generated/adk-source
python3 -m venv .venv
source .venv/bin/activate
pip install --pre google-adk pytest
python -m compileall req_001_adk tests
python -m pytest -q
adk run --jsonl --in_memory --timeout 10s req_001_adk "sample complaint for workflow smoke"
adk web --port 8010 --host 127.0.0.1
```

ADK Web에서는 `req_001_adk` app을 선택하고 `Agent Structure`에서 `Workflow`, `Function`, `Join`, route label, `START`/`END`가 보이는지 확인한다.

Workbench runtime console은 `/api/adk-runtime`을 사용해 다음 action을 제공한다.

- `generate`: ADK source bundle을 `generated/adk-source` 같은 output directory에 쓴다.
- `verify`: `compileall`과 `pytest`를 실행한다.
- `run`: `adk run --jsonl --in_memory`를 실행하고 event log를 반환한다.
- `start-web`: `adk web`을 로컬 포트에 띄운다.
- `check-web`: ADK Web HTML, `/list-apps`, selected app URL, structure token을 자동 확인한다.
