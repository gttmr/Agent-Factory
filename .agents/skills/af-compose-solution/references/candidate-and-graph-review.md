# Candidate and Graph Review

## Contents

- [Purpose](#purpose)
- [When to read](#when-to-read)
- [Decision criteria](#decision-criteria)
- [Required evidence](#required-evidence)
- [Artifact implications](#artifact-implications)
- [Scaffold implications](#scaffold-implications)
- [Verification](#verification)
- [Stop conditions](#stop-conditions)
- [Official sources checked](#official-sources-checked)
- [Checked date](#checked-date)

## Purpose

후보의 approve/defer/reject 결정을 내리고 standalone 또는 Graph 실행 구조를 review한다.

## When to read

모든 Compose 작업에서 candidate decision 전과 Graph 완료 판정 전에 읽는다.

## Decision criteria

### Candidate decision

| Decision | Required state |
| --- | --- |
| approve | responsibility, I/O, risk, owner, contract, missing-information gate가 검토됨 |
| defer | 정보·계약·승인이 부족하지만 후보를 보존할 이유가 있음 |
| reject | 중복, 잘못된 자산 경계, 다른 책임에 흡수됨 |

Target 자산 유형은 Agent, Workflow, Tool만 사용한다.

Current `legacy` category는 Compatibility Output일 뿐 Target decision이 아니다.

### Standalone decision

먼저 A-D를 판정한다.

- A: independent Agent/Tool만 필요
- B: explicit Workflow 필요
- C: Agent delegation으로 충분
- D: Graph와 Agent delegation 혼합

No-Workflow 결정도 검토 가능한 설계 결과다.

### Graph review

Node마다 responsibility, asset reference 또는 synthetic/control 역할, input/output port, container/lane, review status를 확인한다.

Edge마다 source/target, data/control 의미, schema/channel key, route condition, remote boundary를 확인한다.

Function Node, Tool Node, Agent-selected Tool을 서로 바꾸지 않는다.

## Required evidence

- root Workflow 또는 no-Workflow 근거
- 모든 active node의 reachability
- terminal, failure, pause path
- route values, aliases, default, invalid behavior
- fan-out/fan-in과 Join
- loop bound, back/exit, timeout/cancel
- state/artifact producer, consumer, key, scope
- Human Input payload, response mapping, resume, idempotency
- A2A owner, lifecycle, discovery, task contract
- Tool Binding, Transport, Invocation Control
- candidate와 contract approvals

## Artifact implications

- Candidate decision은 rationale와 evidence locator를 보존한다.
- Graph Node가 Catalog asset을 새로 만들지 않는다.
- Agent-selected Tool은 fixed Tool Node로 강제하지 않는다.
- Callback, Event Loop, Ambient Trigger는 asset이나 Graph Node가 아니다.
- Current output은 Compatibility Layer를 사용한다.

## Scaffold implications

Ready Graph만 lowering에 넘긴다.

Unsupported node/edge, open hard gate, unapproved contract, ambiguous route/loop/resume는 scaffold blocker다.

## Verification

다음을 직접 점검한다.

- reachability와 terminal path
- route completeness와 Join
- loop exit와 bound
- channel keys와 producer conflicts
- approved asset/contract references

Current artifact는 다음을 실행한다.

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

## Stop conditions

- candidate decision 근거가 없음
- no-Workflow 대안을 검토하지 않음
- Graph validation error가 있음
- static cycle 또는 unbounded loop가 있음
- unresolved route, channel, Human Input, A2A contract가 있음
- design edit가 approval을 자동 변경함

## Official sources checked

- `docs/workbench/taxonomy.md`
- `docs/workbench/graph-ir.md`
- `scripts/validate-artifacts.mjs`
- `scripts/adk-source/graph/lowering.mjs`
- `scripts/adk-source/graph/dynamic.mjs`

## Checked date

- Checked date: 2026-07-18
- Current note: current Graph enums remain `legacy` serialization and do not redefine Target Graph IR.
