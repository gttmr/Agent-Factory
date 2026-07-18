---
name: af-scaffold-runtime
description: >-
  Generates a reviewable ADK Runtime Handoff or local scaffold from approved Agent Factory composition artifacts, verified runtime contracts, and an explicit output mode. It applies when a user asks “이 승인 설계로 ADK 프로젝트를 만들어줘”, “runtime-stub을 재생성해줘”, or requests contract-backed MCP, callback, event-loop, ambient, or A2A seams; it stops when approval artifacts are absent and never turns a raw requirement directly into code.
---

# AF Scaffold Runtime

## 1. 목적

승인된 실행 구조를 ADK project 또는 Runtime Handoff bundle로 낮춘다.

핵심 원칙은 하나다.

```text
Approved Contract -> Scaffold
Raw Requirement -> Code 금지
```

Scaffold는 local review와 후속 구현을 위한 경계다.

Production deployment, private integration, credential provisioning, 업무 로직 완성을 의미하지 않는다.

## 2. 선행 조건

### Preconditions

다음을 모두 확인한다.

1. approved Compose result가 존재한다.
2. Scaffold Readiness가 `ready`이며 근거가 있다.
3. `scaffold-plan.json` 또는 동등한 approved scaffold plan이 존재한다.
4. required runtime contracts와 A2A contracts가 approved다.
5. candidate-level Missing Information이 비어 있다.
6. output mode와 exact output path가 명시됐다.
7. required dependency와 installed package를 검사할 수 있다.

승인 산출물이 없으면 즉시 STOP한다.

요구 원문만으로 TODO scaffold도 만들지 않는다.

### Inputs

- approved `analysis-result.json`과 derived artifacts
- approved `boundary-design.md`와 `scaffold-plan.json`
- manifest approval evidence, manifest가 있는 경우
- selected Runtime Pattern contracts
- explicit output mode와 output root
- synthetic mock contract와 environment-variable names

### Read Set

항상 [Artifact Sync and Generation](references/artifact-sync-and-generation.md)과 [Output Modes and Handoff](references/output-modes-and-handoff.md)를 읽는다.

current artifact 입력을 쓰거나 보정할 때만 [Compatibility Layer](../_shared/compatibility-current-schema.md)를 읽는다.

선택된 pattern이 있을 때 [Runtime Pattern Selection](../_shared/runtime-pattern-selection.md)에서 해당 card만 연다.

## 3. 핵심 Workflow

### Decision Procedure

#### 1단계: operating mode를 고정한다

Stage Runner mode의 current Build는 server primitive다.

- skill-authored proposal allow-list는 빈 집합이다.
- 이 Skill은 run의 `proposed-artifacts/`나 canonical root에 직접 쓰지 않는다.
- server primitive가 canonical `runtime-stub/`을 생성하며 apply는 제공하지 않는다.
- run completion을 approval로 해석하지 않는다.

Standalone mode에서는 사용자가 지정한 `<output-root>`만 쓴다.

Workbench artifact-sync를 실행하는 경우 canonical write는 server-owned flow와 사용자·문서 gate를 따른다.

#### 2단계: approved contract gate를 다시 검증한다

- approved candidates와 source analysis의 ID가 일치하는지 확인한다.
- Graph 또는 no-Graph decision이 review됐는지 확인한다.
- Binding, Invocation Control, auth variable name, failure policy를 확인한다.
- required runtime/A2A contracts의 status를 확인한다.
- `raw_requirement_to_code=false`를 확인한다.

하나라도 실패하면 generation을 시작하지 않는다.

#### 3단계: Output Mode를 선택한다

개념과 Current Implementation을 분리한다.

| Conceptual mode | 의미 | Current Product mapping |
| --- | --- | --- |
| Skeleton | structure, interface, TODO boundary | 독립 current value 없음; 필요 시 `smoke`의 명시적 TODO 범위 |
| Smoke | synthetic data와 local mock으로 실행 가능 | `smoke` (`legacy` Current Implementation) |
| Runnable Prototype | 승인 구조의 local runtime wiring | `runnable` (`legacy` Current Implementation) |
| Production | production endpoint와 운영 정책 | 지원하지 않음 |

현행 Product에는 `smoke`와 `runnable`만 유효하다.

새 output-mode literal을 발명하지 않는다.

#### 4단계: artifact-sync를 먼저 수행한다

Workbench primary path는 approved canonical `analysis-result.json`에서 derived artifacts를 동기화한 뒤 generator를 실행한다.

[Artifact Sync and Generation](references/artifact-sync-and-generation.md)의 순서를 따른다.

drift, invalid analysis, missing scaffold plan, blocker가 있으면 중단한다.

Standalone direct generation은 approved `scaffold-plan.json`이 이미 있을 때만 허용한다.

#### 5단계: 공식 API를 7단계로 확인한다

패턴별 code emission 전에 순서대로 수행한다.

1. 공식 ADK 문서를 연다.
2. 설치된 package 이름과 version을 확인한다.
3. 실제 import path와 `inspect.signature`를 확인한다.
4. 공식 sample 또는 temporary reference scaffold와 비교한다.
5. approved contract에 필요한 최소 코드만 생성한다.
6. compile/import test를 실행한다.
7. synthetic local smoke를 실행한다.

기억으로 A2A, MCP, Callback, Event, Trigger, Resume API를 작성하지 않는다.

설치판에 symbol이 없거나 official/current behavior가 다르면 code를 만들지 않고 handoff TODO 또는 Blocker로 남긴다.

#### 6단계: 기본 scaffold 경계를 생성한다

요구된 범위에서만 다음을 생성한다.

- Agent/Workflow definitions
- Tool contracts와 Function Tool wiring
- Function Node implementation boundary
- selected pattern connection seams
- Session/State/Artifact wiring
- Human Input/resume boundary, 승인된 경우
- local synthetic mock
- unit/contract tests와 runtime smoke scenario
- behavior eval skeleton
- environment variable template
- implementation handoff

요구에 없는 빈 파일을 “future use” 목적으로 만들지 않는다.

#### 7단계: MCP seam을 만든다

MCP가 승인됐을 때만 [Function and MCP Tools](../_shared/adk/function-and-mcp-tools.md)를 읽는다.

Scaffold에는 binding config, env var name, server/tool reference, I/O schema, Tool allow-list, timeout/error boundary, cleanup, mock replacement point, handoff TODO를 남긴다.

실제 credential, private endpoint, 운영 server 자동 연결, 승인되지 않은 discovery, 무제한 Tool 노출은 금지한다.

#### 8단계: Callback과 Event Loop를 낮춘다

Callback이 승인됐을 때 [Callbacks and Plugins](../_shared/adk/callbacks.md)를 읽는다.

- 필요한 hook만 생성한다.
- Continue와 Override를 모두 test한다.
- Runner-wide guardrail은 Plugin을 우선 검토한다.
- state write, side effect, error, ordering을 명시한다.

commit timing이 중요하면 [Event Loop](../_shared/adk/event-loop.md)를 읽는다.

- Runner가 Event를 처리하기 전 persistence를 가정하지 않는다.
- `partial=True` action을 committed state로 보지 않는다.
- final non-partial Event의 commit과 resume 후 state를 test한다.
- Session 내부 직접 mutation으로 persistence를 우회하지 않는다.

#### 9단계: Ambient scaffold를 낮춘다

Ambient Trigger가 승인됐을 때 [Ambient Agents](../_shared/adk/ambient-agents.md)를 읽는다.

- approved `/run` 또는 supported trigger endpoint만 생성한다.
- event normalization, session policy, idempotency seam을 둔다.
- concurrency, retry, DLQ, timeout, output sink 책임을 구분한다.
- local curl/event fixture를 제공한다.
- human response 대기를 ambient request에 숨기지 않는다.

설치 package의 실제 route와 option을 다시 확인한다.

#### 10단계: A2A scaffold를 낮춘다

A2A가 승인됐을 때 [A2A](../_shared/adk/a2a.md)를 읽는다.

Exposing과 Consuming을 별도 파일·계약·test surface로 구분한다.

Exposing은 Agent Card, auth, task lifecycle, artifact support, local server smoke를 갖는다.

Consuming은 verified remote component, discovery, timeout, auth interceptor, fallback handoff, mock remote server를 갖는다.

설치된 package의 import와 signature를 확인하지 못하면 생성하지 않는다.

#### 11단계: current compatibility와 output을 검토한다

current canonical artifact를 수정해야 한다면 Compatibility Layer를 적용한다.

Target rationale를 지우는 매핑이나 지원되지 않는 field가 필요하면 중단하고 `docs/migration/skill-vnext-status.md` Blocker로 기록하도록 보고한다.

generated code가 approved artifact와 다른 책임·Graph·contract를 추가하지 않았는지 확인한다.

## 4. Reference 선택표

| 조건 | 읽을 Reference | 결과 |
| --- | --- | --- |
| 모든 scaffold | [Artifact Sync and Generation](references/artifact-sync-and-generation.md) | sync/generator 순서 |
| output mode와 handoff | [Output Modes and Handoff](references/output-modes-and-handoff.md) | current mode와 non-goals |
| pattern이 선택됨 | [Runtime Pattern Selection](../_shared/runtime-pattern-selection.md) | 해당 ADK card 선택 |
| current artifact write | [Compatibility Layer](../_shared/compatibility-current-schema.md) | compatibility output |
| 생성 뒤 검증 | [Generated Output Checks](references/generated-output-checks.md) | compile/test/safety evidence |

pattern card는 본문의 direct link에서 필요한 것만 읽는다.

## 5. 허용 Write

### Allowed Writes

Stage Runner mode: skill-authored write 없음.

Standalone mode:

```text
<explicit-output-root>/
```

Workbench artifact-sync는 authorized server flow를 통해서만 canonical derived artifacts와 `runtime-stub/`을 쓴다.

### Forbidden Writes

- raw requirement에서 생성한 source
- Stage Runner `proposed-artifacts/`
- manual approval/stage-status changes
- `catalog/*.yaml`
- production endpoint, credential, secret default
- deployment automation과 organization-specific business logic
- real customer/private data
- 승인되지 않은 dependency, pattern, Tool discovery

### Outputs

approved artifact와 일치하는 scaffold, synthetic tests, handoff, fresh verification evidence가 Output이다.

## 6. Stop Conditions

- approved Compose result 또는 scaffold plan이 없음
- `raw_requirement_to_code=false`가 아님
- candidate Missing Information 또는 required approval이 열려 있음
- current artifact validation이나 artifact-sync가 실패함
- output mode가 current `smoke`/`runnable`이 아님
- exact output path가 없음
- selected pattern contract가 불완전함
- package/version/import/signature를 확인할 수 없음
- unsupported Graph/pattern lowering이 필요함
- compatibility mapping이 불가능함
- credential, private endpoint, production logic, deploy 권한이 필요함
- compile, generated test, local smoke가 실패함

## 7. 검증 명령

### Observable Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root>
node scripts/generate-adk-source.mjs <artifact-root> <explicit-output-root>
python3 -m compileall <explicit-output-root>
```

dependency가 존재할 때만 generated tests를 실행한다.

```bash
cd <explicit-output-root>
python3 -m pytest -q
```

pattern-specific smoke와 prohibited-output check는 [Generated Output Checks](references/generated-output-checks.md)를 따른다.

fresh output 없이 “runnable”, “fixed”, “ready”를 주장하지 않는다.

## 8. 다음 Skill Handoff

### Next Handoff

compile/import, selected pattern contract test, synthetic smoke가 통과하면 `af-verify-runtime`으로 handoff한다.

handoff에는 artifact root, output root, mode, generated inventory, package versions, selected cards, commands/exit codes, TODOs, non-goals, residual uncertainty를 포함한다.

실패한 check 또는 unverified dependency가 있으면 usable/ready로 표시하지 않는다.
