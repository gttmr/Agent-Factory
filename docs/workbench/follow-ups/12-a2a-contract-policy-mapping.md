# 12 — A2A 계약 정책 매핑 (auth / timeout / retry / fallback)

상태: **미구현(부분).** PR-B 에서 `remote_a2a` 노드는 `RemoteA2aAgent(name, description, agent_card=<승인된 계약의 agent_card_url>, use_legacy=False)` 로 생성된다. 그러나 승인된 A2A 계약의 운영 정책 필드(auth, timeout, retry, fallback 등)는 생성 코드에 반영되지 않는다.

## 왜 필요한가

`A2AContract` 는 high-friction 계약으로 `auth`, `token_handling`, `timeout`, `retry`, `fallback`, `cancellation`, `audit`, `data_policy`, `security_schemes`/`security_requirements`, `push_notification_policy` 등을 담는다(`schemas/a2a-contract.schema.json`, `analyzer/types.ts:A2AContract`). 현재 `emitRemoteA2aNode` 는 그중 `agent_card.agent_card_url` 만 사용한다. 운영-충실 번들이 되려면 계약의 auth/timeout/retry/fallback 이 실제 호출 동작에 반영돼야 한다.

ADK 의 `RemoteA2aAgent` 는 `config=A2aRemoteAgentConfig(...)` 로 converter/`request_interceptors`(`before_request`/`after_request`)·`request_metadata`·`client_call_context` 를 주입할 수 있다(adk.dev/a2a/quickstart-consuming). auth 헤더 주입, timeout, retry/fallback 정책이 여기 매핑된다.

## 무엇을 해야 하는가

1. **매핑 설계**: 계약 필드 → `A2aRemoteAgentConfig`/interceptor 매핑 표 정의. 예: `auth`/`security_requirements` → `before_request` 에서 헤더/토큰(단, **실 자격증명 금지** — `.agent-factory/runtime.env` 또는 env 참조만, 코드 하드코딩 금지), `timeout` → client call context, `retry`/`fallback` → interceptor 재시도/대체 이벤트.
2. **생성기**: `emitRemoteA2aNode` 가 계약에서 위 값을 읽어 `RemoteA2aAgent(..., config=A2aRemoteAgentConfig(...))` 를 emit. 정책이 없으면 현행처럼 기본 생성 + 명시적 TODO 주석.
3. **경계 준수**: private endpoint/credential/실데이터 금지(저장소 정책). auth 는 참조(secret 파일/env)로만, agent_card_url 은 reviewed 계약 값만.
4. **회귀 + 검증**: 계약에 auth/timeout/retry 가 있는 fixture 로 생성 → config/interceptor 코드 포함 확인(`generate-adk-source.test.mjs`) + 실 ADK import/construct. mock A2A 서버(`scenario-i/mock_remote`)로 라이브 호출 시 헤더/타임아웃 동작 스모크(가능 범위).

## 건드릴 파일

- `scripts/generate-adk-source.mjs` (`emitRemoteA2aNode`, import 추가 시 게이팅)
- `scripts/generate-adk-source.test.mjs`
- 문서: `docs/workbench/validation.md`, `CLAUDE.md`, `docs/decision-log.md`

## 검증

`node --test scripts/generate-adk-source.test.mjs`; 생성 번들 `ast.parse` + 실 `google-adk[a2a]` 2.2.0 import/construct; `scenario-i` mock 으로 라이브 round-trip(인증 헤더가 mock 에 도달하는지 로그 확인).

## 기반/주의

- PR-B 의 remote lowering(`docs/decision-log.md` 2026-06-18 항목)과 `scenario-i-remote-a2a` 가 출발점.
- ADK A2A 통합은 실험적(EXPERIMENTAL warning) — config/converter API 변경 가능성에 유의.
