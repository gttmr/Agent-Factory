# Runtime Validation Checks

## Purpose

Generated Runtime Handoff와 선택된 pattern의 deterministic smoke/negative scenarios를 선택한다.

## When to read

`runtime-stub/` 또는 explicit runtime output이 있고 Level 3-4 검증이 필요한 경우에만 읽는다.

## Decision criteria

기본 구조:

```bash
python3 -m compileall <runtime-output-root>
```

Dependencies가 있으면 generated tests를 실행한다.

```bash
cd <runtime-output-root>
python3 -m pytest -q
```

Network install은 사용자 승인 없이 수행하지 않는다.

## Required evidence

패턴별 applicable scenario를 선택한다.

| Pattern | Required checks |
| --- | --- |
| Function/MCP Tool | schema, allow-list, invalid input, timeout, unavailable server, cleanup |
| A2A | discovery, task lifecycle, auth failure, timeout, fallback, 1:1 contract |
| Callback/Plugin | baseline, Continue, Override, order, exception, duplicate side effect |
| Event Loop | yield, final commit, partial no-commit, failure before commit, resume |
| Ambient | normalization, malformed event, duplicate, retry/DLQ, concurrency, output sink |
| Human Input | pause, stable ID, valid/invalid response, duplicate, at-least-once Tool |
| State/Artifact | scope, commit, version, missing value, producer conflict |

## Artifact implications

Selected scenarios는 approved design과 scaffold handoff에서 추적 가능해야 한다.

Unselected pattern을 검증하기 위해 새 scaffold를 만들지 않는다.

## Scaffold implications

Smoke는 local synthetic mock만 사용한다.

Production endpoint, real credential, private payload를 사용하지 않는다.

## Verification

각 scenario에 input, expected deterministic invariant, actual output, exit code를 기록한다.

Behavior quality는 별도 eval로 기록하고 exact natural-language golden을 사용하지 않는다.

## Stop conditions

- runtime output이 없음
- dependencies가 없는데 pass를 요구함
- approved contract와 test fixture가 다름
- negative scenario가 실패함
- production system 접근이 필요함
- duplicate side-effect safety가 없음

## Official sources checked

- `../../_shared/runtime-pattern-selection.md`
- `../../_shared/testing-contract.md`
- `scripts/adk-source/`

## Checked date

- Checked date: 2026-07-18
- Runtime evidence is local and synthetic unless a separate production test authority exists.
