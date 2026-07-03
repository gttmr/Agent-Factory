# 11 — Agent / non-connected consumer 의 명명 채널 읽기

상태: **완료(범위 재정의).** 현재 per-edge 내부 state 채널은 producer 쓰기, connected MCP adapter consumer 읽기, agent consumer instruction 안내까지 지원한다. 비-connected state consumer와 agent/non-connected artifact consumer는 runnable generation blocker로 남긴다.

## 원래 문제

PR-A 직후에는 명명 채널 소비가 `_collect_tool_inputs` 의 `channel_keys`/`extra_payloads` 경로로만 이뤄졌고, 이 함수는 **connected MCP adapter** 노드만 호출했다. 그래서 agent consumer와 stub/workflow consumer 모두 non-connected consumer로 남아 있었다.

## 현재 결론

현재 generator는 incoming state 채널을 agent instruction에 reviewed state key 안내로 주입한다. connected MCP adapter는 계속 `_collect_tool_inputs` 명명 채널에서 읽고, 비-connected state consumer는 runnable generation blocker로 거부한다.

artifact 채널은 function producer `save_artifact` + connected consumer `load_artifact`까지만 lower한다. agent가 artifact를 만들거나 agent/non-connected node가 artifact를 소비하는 경우는 계속 blocker다.

## 완료된 작업

1. agent consumer state 채널은 instruction 안내로 지원한다.
2. 비-connected state consumer는 명시 blocker로 유지한다.
3. agent/non-connected artifact producer/consumer는 명시 blocker로 유지한다.
4. 회귀는 state channel lowering/guard test와 active validation docs에 반영됐다.

## 건드릴 파일

- `scripts/generate-adk-source.mjs` (`emitAgentNode` instruction 주입, `_collect_tool_inputs` connected adapter 유지, unsupported consumer guards)
- `scripts/generate-adk-source.test.mjs`
- 문서: `CLAUDE.md` build 불릿, `docs/workbench/validation.md`, `docs/decision-log.md`

## 검증

`node --test scripts/generate-adk-source.test.mjs`; 채널 fixture 로 생성 → `ast.parse` + 실 ADK InMemoryRunner 로 producer→agent-consumer 데이터 흐름 관찰; 비-채널 번들 동작 불변.

## 기반/주의

- 모델은 PR-A 의 "명시 매핑 우선 + `{id}_output` 컨벤션 fallback". (`docs/decision-log.md` 2026-06-17 항목)
- 다중-producer 같은-키 거부 가드와 일관되게, agent 측 다중/충돌 입력 규칙을 먼저 정한다.
