# 12 — A2A 계약 정책 매핑 (auth / timeout / retry / fallback)

상태: **완료.** `A2AContract.adk_runtime_policy`가 schema/type/UI/validator/generator에 추가됐다. Generator는 ADK가 직접 지원하는 범위만 lower한다: `RemoteA2aAgent(timeout=...)`와 `A2aRemoteAgentConfig(request_interceptors=[...])` 기반 env-backed auth 주입. `retry_handoff`와 `fallback_handoff`는 `workflow_manifest.json`, README, `implementation-handoff.md`에 handoff policy로 남기며 generated retry/fallback runtime wrapper는 만들지 않는다.

## 왜 필요한가

`A2AContract` 는 high-friction 계약으로 `auth`, `token_handling`, `timeout`, `retry`, `fallback`, `cancellation`, `audit`, `data_policy`, `security_schemes`/`security_requirements`, `push_notification_policy` 등을 담는다(`schemas/a2a-contract.schema.json`, `analyzer/types.ts:A2AContract`). 현재 `emitRemoteA2aNode` 는 그중 `agent_card.agent_card_url` 만 사용한다. 운영-충실 번들이 되려면 계약의 auth/timeout/retry/fallback 이 실제 호출 동작에 반영돼야 한다.

ADK 의 `RemoteA2aAgent` 는 `timeout`과 `config=A2aRemoteAgentConfig(...)`의 `request_interceptors`를 지원한다. 이번 구현은 이 두 표면만 생성 코드로 사용한다. 재시도와 fallback 동작은 ADK 문서/소스에서 안정적인 wrapper contract를 확인하지 못했으므로 명시적 handoff policy로만 기록한다.

## 무엇을 해야 하는가

1. **완료 — 구조화 필드**: `adk_runtime_policy.timeout_seconds`, `auth.{mode,env_var,metadata_key}`, `retry_handoff`, `fallback_handoff`를 `A2AContract`에 추가했다.
2. **완료 — 생성기**: `emitRemoteA2aNode`가 timeout과 env-backed auth interceptor만 Python source로 emit한다.
3. **완료 — 경계 준수**: auth는 `AF_A2A_*` env var 이름만 artifact/source에 남기고 secret 값은 생성하지 않는다.
4. **완료 — 회귀 + 검증**: generator regression이 source import/interceptor/manifest/env/readme/handoff 출력을 확인한다.

## 건드릴 파일

- `scripts/adk-source/remote-a2a.mjs`, `scripts/adk-source/agent-runnable.mjs`, `scripts/adk-source/support/*`
- `schemas/a2a-contract.schema.json`, `schemas/analysis-result.schema.json`
- `packages/web/src/analyzer/a2aNormalize.ts`, `packages/web/src/analyzer/types.ts`
- `packages/web/src/design/A2AContractPanel.tsx`, `packages/web/src/design/a2aContractValidator.ts`
- `scripts/generate-adk-source.test.mjs`
- 문서: `docs/workbench/validation.md`, `CLAUDE.md`, `docs/decision-log.md`, follow-up status/index

## 검증

완료 시점 검증:

- `node --experimental-strip-types --loader ./scripts/ts-extension-loader.mjs src/analyzer/a2aNormalize.test.ts`
- `node --experimental-strip-types --loader ./scripts/ts-extension-loader.mjs src/design/a2aContractValidator.test.ts`
- `node --test scripts/generate-adk-source.test.mjs`
- `node scripts/validate-artifacts.mjs templates/regression-scenarios/scenario-i-remote-a2a`

## 기반/주의

- PR-B 의 remote lowering(`docs/decision-log.md` 2026-06-18 항목)과 `scenario-i-remote-a2a` 가 출발점이다.
- ADK A2A 통합은 실험적(EXPERIMENTAL warning)이다. retry/fallback wrapper는 ADK-supported contract가 다시 확인될 때 별도 작업으로 다룬다.
