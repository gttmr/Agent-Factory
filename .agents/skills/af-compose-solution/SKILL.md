---
name: af-compose-solution
description: >-
  Composes reviewed Agent Factory asset candidates into a standalone design or Workflow execution structure with Graph IR, invocation control, bindings, runtime-pattern contracts, and scaffold-readiness evidence. It applies when a user asks “승인된 후보를 실행 구조로 조합해줘”, “Graph IR을 구성해줘”, or “MCP/A2A 연결 방식을 결정해줘”; it does not discover raw candidates or generate runtime code.
---

# AF Compose Solution

## 1. 목적

검토 가능한 Agent·Workflow·Tool 후보를 **어떻게 실행할지** 조합한다. 먼저 standalone asset으로 충분한지 판단하고, 필요한 경우에만 Workflow와 Graph IR을 만든다.

주요 Output은 다음이다.

- standalone/Workflow 결정과 Graph IR의 Node·Edge·container·channel
- Tool Invocation Control·Binding, A2A Connection/Exposure, State·Artifact channel
- Human Input/Resume, Callback/Plugin, Ambient Trigger, Runtime Policy 계약
- Missing Information과 Scaffold Readiness

이 Skill은 설계와 readiness를 보고하지만 코드를 생성하거나 approval을 변경하지 않는다.

## 2. 선행 조건

### Preconditions

다음을 모두 확인한다.

1. Discover output 또는 동등한 reviewed candidate set이 존재한다.
2. 후보의 responsibility, I/O, risk, Domain Scope, Owner를 검토할 수 있다.
3. requirement-level Missing Information은 명시되어 있다.
4. candidate-level hard gate는 해소되었거나 명시적으로 defer할 수 있다.
5. Target Contract와 Current Implementation의 차이를 확인할 수 있다.
6. Stage Runner mode라면 canonical analysis와 `analysis_reviewed=true` gate가 존재한다.

후보를 raw requirement에서 새로 발명하지 않는다.

Discover 결과가 없거나 검토 불가능하면 `af-discover-assets`로 되돌린다.

### Inputs

- reviewed discovery output와 current `analysis-result.json`, 있는 경우
- Stage Runner Design `request.json`과 run folder, 해당하는 경우
- active Taxonomy·Graph IR와 범위 내 Catalog/runtime evidence
- 사용자가 승인한 architecture constraints

### Read Set

최소 Read Set은 candidate source, active mode, [Graph IR Reference](../_shared/graph-ir.md), [Candidate and Graph Review](references/candidate-and-graph-review.md)다.

패턴 Evidence가 있을 때만 [Runtime Pattern Selection](../_shared/runtime-pattern-selection.md)을 읽는다.

현행 artifact를 쓸 때만 [Compatibility Layer](../_shared/compatibility-current-schema.md)를 읽는다.

## 3. 핵심 Workflow

### Decision Procedure

#### 1단계: mode와 write boundary를 고정한다

Stage Runner mode:

```text
<run-dir>/proposed-artifacts/analysis-result.json
<run-dir>/proposed-artifacts/boundary-design.md
```

두 파일을 모두 작성해야 한다.

Standalone mode에서는 사용자가 지정한 design output path를 먼저 사용한다.

Canonical artifact write는 사용자 승인과 active document gate가 함께 허용할 때만 수행한다.

#### 2단계: candidate decision을 명시한다

각 후보에 `approve`, `defer`, `reject` 결정을 내리고 근거를 남긴다.

- approve: responsibility, I/O, risk, owner, required contracts, hard gates가 검토됨
- defer: 필요한 정보나 계약이 아직 없음
- reject: 중복이거나 다른 책임 안으로 흡수되거나 자산 경계 근거가 없음

Skill은 readiness를 보고할 뿐 manifest approval boolean을 직접 바꾸지 않는다.

#### 3단계: standalone 여부를 먼저 판단한다

아래 A-D 중 하나를 결정한다.

| 판단 | 질문 | 결과 |
| --- | --- | --- |
| A | 독립 Agent 또는 Tool 하나로 충분한가 | standalone, Graph 없음 |
| B | 명시적 순서·분기·합류·반복 소유자가 필요한가 | Workflow와 Graph 검토 |
| C | Agent delegation으로 충분한가 | Agent 관계, 불필요한 Graph 없음 |
| D | deterministic Graph와 Agent delegation이 모두 필요한가 | 혼합 구조와 control 경계 |

Workflow가 불필요하면 no-Graph 결정을 명시한다.

#### 4단계: Graph가 필요한 경우에만 조합한다

사용 가능한 Target Node 책임은 Input, Agent, Tool, Function, Human Input, Subworkflow, Join, Output이다.

정확한 정의와 current mapping은 [Graph IR Reference](../_shared/graph-ir.md)를 따른다.

Function Node는 Workflow 내부 private deterministic transform·validate·route·merge이며 부모 Workflow의 Domain과 Owner를 상속하고 독립 Catalog Tool 계약을 만들지 않는다.

Tool Node는 독립 Tool 계약과 Owner를 가지며 Workflow가 명시적으로 호출하고 Binding은 Tool 자산 계약에서 읽는다.

Agent-selected Tool은 main fixed-control Graph의 Tool Node로 강제하지 않고 Agent와 Tool의 capability relation으로 기록하며 Invocation Control은 Agent다.

Workflow가 고정 호출하는 Tool의 Invocation Control은 Workflow다.

Model, LLM, Human, System을 Invocation Control owner로 추가하지 않는다.

#### 5단계: Graph completeness를 검토한다

- start에서 모든 active node가 reachable인지 확인한다.
- 각 path가 Output, approved pause, 또는 explicit failure에 도달하는지 확인한다.
- route condition, default, invalid result를 기록한다.
- fan-out과 fan-in, Join 조건을 기록한다.
- loop에는 bound, back edge, exit edge, timeout을 둔다.
- state/artifact channel에는 producer, consumer, key, scope를 둔다.
- Human Input에는 pause, response mapping, resume, idempotency를 둔다.
- A2A boundary에는 독립 owner와 lifecycle 근거를 둔다.

상세 review는 [Candidate and Graph Review](references/candidate-and-graph-review.md)를 따른다.

#### 6단계: Runtime Pattern을 조건부 선택한다

Evidence가 있는 row만 [Runtime Pattern Selection](../_shared/runtime-pattern-selection.md)에서 해당 card를 연다.

모든 card를 한꺼번에 읽거나 “future-proof”를 이유로 적용하지 않는다.

각 선택에 problem, Evidence, simpler alternative, owner, lifecycle, failure, verification을 기록한다.

#### 7단계: 선택한 Pattern의 최소 계약을 작성한다

MCP:

- Tool ID, server reference, Tool name/discovery policy
- Transport, auth source, Tool filter
- timeout, error mapping, local mock
- Invocation Control

A2A:

- Agent reference, Exposing 또는 Consuming
- independent Owner/lifecycle, Agent Card/discovery, auth
- input/output/task semantics, timeout, retry/fallback
- artifact, audit/data policy, local Agent 대안

Callback 또는 Plugin:

- hook point, scope, 목적, Continue/Override
- state read/write, side effect, order, error policy
- audit/privacy, Plugin 우선 여부

Ambient Trigger:

- source, `/run` 또는 trigger endpoint, event schema/normalization
- session policy, idempotency/deduplication, concurrency
- retry/backoff, DLQ, timeout, output sink, auth, observability

Event Loop:

- Event producer, state/artifact action, commit point
- partial/final semantics, pause/resume, session/invocation scope
- failure event, callback/Tool event relation

이 계약을 구현 코드나 endpoint 값으로 바꾸지 않는다.

#### 8단계: Scaffold Readiness를 판정한다

다음이 모두 충족될 때만 Ready다.

- asset responsibility와 I/O
- standalone 또는 Graph 구조
- Binding과 Invocation Control
- 선택한 Runtime Pattern 계약
- required auth variable 이름
- candidate-level Missing Information closure
- testable scenario
- review/approval state

[Design Output and Readiness](references/design-output-and-readiness.md)의 checklist와 일치시킨다.

#### 9단계: mode별 output을 작성하고 검증한다

현행 proposed/canonical artifact에는 Compatibility Layer를 적용한다.

Target rationale를 `rationale`, review notes, 또는 `boundary-design.md`에 보존한다.

매핑 불가 사례는 current enum으로 숨기지 않고 `docs/migration/skill-vnext-status.md` Blocker로 기록하도록 보고한다.

Standalone validator 비대상 design note는 Target 어휘를 사용할 수 있다.

## 4. Reference 선택표

| 조건 | 읽을 Reference | 결과 |
| --- | --- | --- |
| 모든 composition | [Graph IR Reference](../_shared/graph-ir.md) | Target Graph와 Invocation Control |
| 후보 결정 또는 Graph review | [Candidate and Graph Review](references/candidate-and-graph-review.md) | approve/defer/reject와 Graph findings |
| pattern Evidence 존재 | [Runtime Pattern Selection](../_shared/runtime-pattern-selection.md) | 필요한 ADK card만 조건부 로드 |
| Stage Runner/current artifact write | [Compatibility Layer](../_shared/compatibility-current-schema.md) | current `legacy` serialization |
| output/readiness 작성 | [Design Output and Readiness](references/design-output-and-readiness.md) | mode별 files와 Scaffold gate |

선택하지 않은 pattern card는 읽지 않는다.

## 5. 허용 Write

### Allowed Writes

Stage Runner mode:

```text
<run-dir>/proposed-artifacts/analysis-result.json
<run-dir>/proposed-artifacts/boundary-design.md
```

Standalone mode:

```text
<explicit-design-output-path>
```

사용자·문서 gate가 허용한 경우에만 `<artifact-root>/analysis-result.json`과 `<artifact-root>/boundary-design.md`를 갱신한다.

### Forbidden Writes

- Stage Runner mode의 canonical artifact
- `runtime-stub/` 또는 Python/TypeScript runtime source
- `scaffold-plan.json` 직접 생성
- `catalog/*.yaml`
- approval booleans와 stage status
- endpoint, credential, deploy file, production logic
- Pattern API를 기억으로 작성한 코드

### Outputs

검토 가능한 design, 두 mode에 맞는 artifact, readiness 결과, blockers가 Output이다.

## 6. Stop Conditions

다음이면 중단한다.

- reviewed Discover output이 없음
- Stage Runner Design에서 canonical analysis 또는 `analysis_reviewed=true`가 없음
- candidate responsibility, I/O, risk, owner가 불충분함
- candidate-level Missing Information이 남음
- standalone/Workflow 선택 근거가 없음
- Graph reachability, route, Join, loop, channel, resume 계약이 불완전함
- required Runtime Pattern 계약이 draft 또는 `needs_info`임
- A2A Agent와 embedded contract의 1:1 pairing이 없음
- Target design을 current schema에 안전하게 매핑할 수 없음
- Design proposal 두 파일 중 하나라도 없음
- schema/validator가 실패함
- 코드 생성이나 approval 변경 없이는 진행할 수 없음

## 7. 검증 명령

### Observable Verification

Current artifact validation:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Stage Runner proposal inventory:

```bash
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
```

inventory에는 `analysis-result.json`과 `boundary-design.md`가 모두 있어야 한다.

Standalone Markdown output:

```bash
test -f <explicit-design-output-path>
```

검증 기록에는 command, environment, input, selected references, writes, exit code, observed output, failure, residual uncertainty를 남긴다.

## 8. 다음 Skill Handoff

### Next Handoff

Scaffold Readiness가 모두 충족되고 review/approval이 실제 artifact에 반영되면 `af-scaffold-runtime`으로 handoff한다.

handoff에는 다음을 포함한다.

- exact artifact root와 mode
- standalone/Workflow 결정
- approved assets와 Graph summary
- Binding과 Invocation Control
- selected Runtime Pattern contracts
- auth variable names와 local mock plan
- test scenarios
- approvals와 remaining blockers
- validation command와 fresh exit code

Ready가 아니면 Scaffold를 호출하지 않고 `af-discover-assets` 또는 Compose review로 되돌린다.
