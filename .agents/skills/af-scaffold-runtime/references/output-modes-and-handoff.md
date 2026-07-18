# Output Modes and Handoff

## Purpose

Conceptual scaffold levels와 current Product output values를 구분하고 Runtime Handoff non-goals를 고정한다.

## When to read

Output mode를 선택할 때와 implementation handoff를 작성할 때 읽는다.

## Decision criteria

| Concept | Allowed content | Current mapping |
| --- | --- | --- |
| Skeleton | file structure, interfaces, TODO boundaries | 별도 value 없음 |
| Smoke | synthetic mock, deterministic local smoke, explicit TODO | `smoke` |
| Runnable Prototype | reviewed local ADK wiring, contract-backed mocks | `runnable` |
| Production | production integration/deployment | 지원하지 않음 |

Current Product field에는 `smoke` 또는 `runnable`만 쓴다.

Skeleton intent가 필요하면 `smoke` output 안에서 TODO/non-goal로 명시한다.

## Required evidence

`implementation-handoff.md`에 다음을 기록한다.

- output mode와 exact output root
- source artifact IDs와 approval evidence
- generated file inventory
- installed package versions와 verified API surfaces
- local mocks와 synthetic fixture
- completed checks와 exit codes
- TODOs와 manual completion boundary
- unsupported feature와 residual uncertainty
- `raw_requirement_to_code=false`

## Artifact implications

Handoff는 canonical Target implementation 또는 production approval이 아니다.

Current mode value를 Target lifecycle 단계로 재해석하지 않는다.

## Scaffold implications

Smoke는 business behavior를 구현했다고 주장하지 않는다.

Runnable은 approved local wiring만 포함하며 production endpoint, credential, deploy, real data를 포함하지 않는다.

## Verification

- `.env.example`에 variable name과 placeholder만 있는지 확인한다.
- generated tree에 deploy files, secrets, private hosts, customer payload가 없는지 확인한다.
- handoff의 generated inventory와 실제 tree를 비교한다.

## Stop conditions

- Product field에 새 mode literal이 필요함
- production-ready claim이 요구됨
- handoff가 unverified dependency를 숨김
- private/deployment/business output이 포함됨
- source approval evidence가 없음

## Official sources checked

- `packages/web/server/artifactSyncRunApi.ts`
- `packages/web/server/artifactSync.ts`
- `scripts/adk-source/file-builder.mjs`
- `docs/workbench/operating-model.md`

## Checked date

- Checked date: 2026-07-18
- Current Product note: `smoke` and `runnable` are the only serialized output modes.
