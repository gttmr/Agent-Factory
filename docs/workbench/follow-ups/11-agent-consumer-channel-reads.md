# 11 — Agent / non-connected consumer 의 명명 채널 읽기

상태: **미구현(부분).** PR-A 에서 per-edge 내부 데이터 채널(session/temp/user/app state + artifact)의 **producer 쓰기**와 **connected MCP adapter consumer 읽기**는 구현됐다. 그러나 consumer 가 connected adapter 가 아닌 경우(agent·stub adapter·workflow stub)는 명명 채널을 자동으로 읽지 않는다.

## 왜 필요한가

`scripts/generate-adk-source.mjs` 에서 명명 채널 소비는 `_collect_tool_inputs` 의 `channel_keys`/`extra_payloads` 경로로만 이뤄지고, 이 함수는 **connected MCP adapter** 노드만 호출한다. 따라서:

- **agent consumer**: 엣지에서 `session_state`/artifact 채널을 골라도, downstream agent 는 그 키를 instruction 으로 읽지 않는다(현재는 ADK 기본 node-input + 일반 instruction 에 의존).
- **stub adapter / workflow stub consumer**: 입력을 읽지 않고 mock 만 반환한다.

producer 측은 정상 동작(상태 키 기록 / artifact 저장)하므로 데이터는 state/artifact 스토어에 있으나, "이 엣지로 Y가 데이터를 받는다"는 의도가 비-connected Y 에서는 완성되지 않는다.

## 무엇을 해야 하는가

1. **agent consumer (state 채널)**: incoming state 채널 키 `K` 를 agent instruction 에 `{K}` (또는 `{K?}`) 템플릿으로 주입하거나(ADK instruction templating), `inject_session_state` 유틸 사용. 다중 incoming 채널 처리 규칙 정의.
2. **agent / 함수 consumer (artifact 채널)**: agent 는 코드가 없어 `load_artifact` 를 선언적으로 못 한다. 옵션 — (a) artifact 를 읽는 작은 function 노드를 앞단에 삽입, (b) agent consumer artifact 는 명시적으로 거부(현 remote/충돌 거부와 같은 톤), (c) stub 함수 consumer 에도 `load_artifact` + 입력 병합 추가.
3. **정책 일관성**: state 와 artifact 의 비-connected consumer 동작을 동일 규칙으로(읽기 구현 / 또는 거부 / 또는 문서화된 fallback) 맞춘다. 현재는 "connected adapter 만 자동 읽기"로 문서화돼 있다(`validation.md`, `CLAUDE.md`).
4. **회귀**: agent-consumer 채널 읽기 positive 테스트(`generate-adk-source.test.mjs`), 생성 instruction 에 `{K}` 포함 확인 + ADK import/construct.

## 건드릴 파일

- `scripts/generate-adk-source.mjs` (`emitAgentNode` instruction 주입, `_collect_tool_inputs` 호출 노드 확대 또는 함수 consumer 읽기)
- `scripts/generate-adk-source.test.mjs`
- 문서: `CLAUDE.md`(build 불릿 "agent-consumer named reads remain a follow-up" 갱신), `docs/workbench/validation.md`, `docs/decision-log.md`

## 검증

`node --test scripts/generate-adk-source.test.mjs`; 채널 fixture 로 생성 → `ast.parse` + 실 ADK InMemoryRunner 로 producer→agent-consumer 데이터 흐름 관찰; 비-채널 번들 동작 불변.

## 기반/주의

- 모델은 PR-A 의 "명시 매핑 우선 + `{id}_output` 컨벤션 fallback". (`docs/decision-log.md` 2026-06-17 항목)
- 다중-producer 같은-키 거부 가드와 일관되게, agent 측 다중/충돌 입력 규칙을 먼저 정한다.
