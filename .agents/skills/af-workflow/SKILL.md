---
name: af-workflow
description: >-
  Routes Agent Factory lifecycle requests by inspecting repository and artifact state, checking predecessor gates, and selecting the correct canonical work skill without creating stage artifacts. It applies when a user says “Agent Factory로 에이전트를 만들고 싶다”, “어디까지 했고 다음 단계는?”, “요구부터 스캐폴딩까지 진행해줘”, or “중단한 AF 작업을 이어서”; specific discovery, Graph composition, scaffold, or verification requests should trigger the matching work skill directly.
---

# AF Workflow

## 1. 목적

현재 저장소와 artifact 상태를 판단하고 네 Work Skill 중 정확한 다음 단계를 선택한다.

이 Skill은 Agent Factory lifecycle의 entrypoint다.

상태 확인, gate 확인, complexity scaling, session continuity, handoff만 수행한다.

후보 도출, Graph 작성, code generation, validation report 작성, approval 변경은 수행하지 않는다.

### Trigger

다음 요청에서 사용한다.

- “Agent Factory로 Agent 또는 Workflow를 만들고 싶다.”
- “요구사항부터 스캐폴딩까지 진행하고 싶다.”
- “현재 Artifact 상태에서 다음 단계가 뭐야?”
- “Agent Factory Skill을 이용해 작업해줘.”
- “중단한 Agent Factory 작업을 이어서 진행해줘.”

### Not Trigger

다음은 해당 Work Skill을 직접 사용한다.

- 구성요소·후보 도출 -> `af-discover-assets`
- standalone/Graph 조합과 runtime contract -> `af-compose-solution`
- approved design의 ADK scaffold -> `af-scaffold-runtime`
- artifact/runtime/eval 검증 -> `af-verify-runtime`

일반 repository 질문, README 수정, unrelated coding request에는 사용하지 않는다.

## 2. 선행 조건

### Preconditions

최소 하나가 있어야 한다.

- Agent Factory lifecycle 목표
- artifact root 또는 requirement ID
- Stage Runner run context
- 중단 지점과 이전 output

아무 정보도 없으면 repository root와 사용자의 현재 목적만 확인한 뒤 첫 Work Skill을 선택한다.

### Inputs

- 사용자 goal과 current task
- repository root와 active docs
- artifact root, manifest, run ledger, 있는 경우
- existing discovery/design/scaffold/verification output
- approval, Missing Information, validation status

### Read Set

1. [Source of Truth](../_shared/source-of-truth.md)
2. [Lifecycle Invariants](../_shared/lifecycle-invariants.md)
3. Stage Runner context가 있으면 [Artifact Root and Stage Runner](../_shared/artifact-root-and-stage-runner.md)
4. open gate가 있으면 [Missing Information](../_shared/missing-information.md)

필요한 Work Skill은 실행 직전에 별도로 다시 읽는다.

## 3. 핵심 Workflow

### Decision Procedure

다음 8단계를 순서대로 수행한다.

#### 0. 현재 저장소와 artifact root 확인

- repository root를 확인한다.
- artifact root, requirement ID, run ID를 서로 구분한다.
- Stage Runner mode와 Standalone mode를 혼합하지 않는다.
- newest run을 추측으로 선택하지 않는다.

#### 1. 활성 문서와 Handbook 확인

- `docs/README.md`
- `docs/handbook/README.md`
- task에 해당하는 canonical Taxonomy, Graph IR, Operating Model

Target Contract와 Current Implementation을 분리한다.

#### 2. 기존 산출물 단계 확인

다음 존재와 상태를 확인한다.

- raw/imported requirement
- discovery/analysis output
- reviewed composition/design output
- scaffold plan과 runtime output
- verification report와 fresh command evidence

파일 존재를 approval이나 pass로 해석하지 않는다.

#### 3. 사용자 요청의 현재 목적 확인

요청이 lifecycle 전체인지, 현재 상태 질문인지, 특정 단계 실행인지 식별한다.

특정 단계 요청이면 해당 Work Skill로 즉시 handoff하고 이 Skill에서 끝내지 않는다.

#### 4. 필요한 Work Skill 선택

| 현재 목적/상태 | 선택할 Skill |
| --- | --- |
| requirement에서 후보·Evidence 도출 | `af-discover-assets` |
| reviewed 후보의 standalone/Graph/runtime contract 조합 | `af-compose-solution` |
| approved contract에서 Runtime Handoff 생성 | `af-scaffold-runtime` |
| artifact/code/runtime/behavior 검증 | `af-verify-runtime` |

이미 승인된 predecessor output이 있으면 그 다음 단계에서 시작할 수 있다.

승인되지 않은 단계를 건너뛰지 않는다.

#### 5. 해당 Work Skill을 다시 읽고 실행

선택한 Skill의 현재 `SKILL.md`를 즉시 다시 읽는다.

이 entrypoint의 기억이나 이전 session context로 Work Skill 절차를 대체하지 않는다.

Work Skill의 Preconditions, Allowed Writes, Stop Conditions, Verification을 그대로 적용한다.

#### 6. 결과 Gate 확인

Work Skill이 완료되면 다음을 확인한다.

- requested output이 실제 경로에 존재함
- allowed write inventory와 일치함
- required command의 fresh exit/output이 있음
- open hard gate와 residual uncertainty가 기록됨
- approval은 authorized reviewer가 실제 artifact에 반영함

run completion, proposal presence, validation report presence만으로 다음 gate를 열지 않는다.

#### 7. 다음 Skill 제안 또는 실행

현재 Work Skill의 Next Handoff 조건이 충족된 경우에만 다음 Skill을 제안하거나, 사용자 요청 범위가 lifecycle 전체이면 계속 실행한다.

조건이 충족되지 않으면 blocker와 재개 조건을 보고한다.

### Complexity Scaling

단순 요구 예:

```text
single Agent
one Function Tool
no human input
no remote connection
```

단순 요구에서는 짧은 확인, 최소 후보·artifact, 직접적인 test scenario만 요구한다.

복잡 요구 예:

```text
multiple Agents
MCP or A2A
Callback or Ambient Trigger
long-running or human input
state, artifact, retry, failure policy
```

복잡 요구에서는 다음을 명시적으로 요구한다.

- Missing Information
- Runtime Pattern decision과 simpler alternative
- failure, retry, timeout, cancellation
- auth, data, audit policy
- success/negative verification scenarios
- 복잡도 축소 대안

복잡성은 requirement Evidence가 있을 때만 추가한다.

### Session Continuity

각 단계 진입 직전에 다음 파일을 다시 읽는다.

```text
Discover 전 -> ../af-discover-assets/SKILL.md
Compose 전  -> ../af-compose-solution/SKILL.md
Scaffold 전 -> ../af-scaffold-runtime/SKILL.md
Verify 전   -> ../af-verify-runtime/SKILL.md
```

context compaction 이후 이전 Skill 내용이 남아 있다고 가정하지 않는다.

## 4. Reference 선택표

| 조건 | 읽을 Reference | 결과 |
| --- | --- | --- |
| 모든 routing | [Source of Truth](../_shared/source-of-truth.md) | Target/Current/Blocker 구분 |
| 모든 lifecycle | [Lifecycle Invariants](../_shared/lifecycle-invariants.md) | stage 순서와 approval 불변 |
| Stage Runner context | [Artifact Root and Stage Runner](../_shared/artifact-root-and-stage-runner.md) | run/root/mode와 proposal 계약 |
| open unknown/gate | [Missing Information](../_shared/missing-information.md) | soft/hard gate와 stop 판정 |

Reference는 상태 판정에만 사용하고 stage artifact를 작성하는 절차로 확장하지 않는다.

## 5. 허용 Write

### Allowed Writes

없음.

이 Skill은 read-only routing entrypoint다.

선택한 Work Skill이 별도 Allowed Writes 계약에 따라 write한다.

### Forbidden Writes

- discovery/analysis artifact
- composition/design artifact와 Graph IR
- scaffold plan과 runtime source
- validation report와 Catalog proposal
- canonical artifact 또는 Stage Runner proposal
- approval boolean, stage status, Catalog seed
- credential, endpoint, deploy, production logic

### Outputs

현재 phase, selected Work Skill, predecessor gate, blocker, next action을 포함한 routing decision만 Output이다.

## 6. Stop Conditions

- repository root 또는 artifact root가 모호함
- requirement/run ID를 추측해야 함
- Stage Runner와 Standalone mode가 충돌함
- predecessor artifact 또는 required approval이 없음
- candidate-level Missing Information이 열려 있음
- current phase를 판정할 evidence가 없음
- 사용자가 특정 Work Skill 없이 lifecycle artifact 생성을 이 entrypoint에 요구함
- approval 변경 또는 phase skip이 필요함
- Target/current 불일치를 숨겨야 진행 가능함

중단 시 missing evidence, 영향 단계, 안전한 재개 조건을 명시한다.

## 7. 검증 명령

### Observable Verification

Routing에 사용한 경로를 직접 확인한다.

```bash
test -d <repository-root>
test -d <artifact-root>
test -f <selected-skill-path>/SKILL.md
```

Stage Runner context가 있으면 다음을 확인한다.

```bash
test -f <run-dir>/request.json
test -f <artifact-root>/af-run-manifest.json
```

검증 record에는 inspected roots, current phase evidence, selected Skill, predecessor gates, unresolved blockers를 남긴다.

artifact 또는 runtime success를 이 routing check로 주장하지 않는다.

## 8. 다음 Skill Handoff

### Next Handoff

선택한 Work Skill 하나로 handoff한다.

- `af-discover-assets`: raw requirement 또는 candidate discovery가 필요함
- `af-compose-solution`: reviewed candidates가 있고 execution design이 필요함
- `af-scaffold-runtime`: approved design과 Design approval gate가 있고 Workbench artifact-sync로 plan을 파생하거나, Standalone용 approved scaffold plan이 있으며 code handoff가 필요함
- `af-verify-runtime`: 검증 대상과 claim이 구체적임

handoff에는 repository/artifact/run paths, mode, current evidence, approvals, Missing Information, user goal, expected output을 포함한다.

handoff 직전에 대상 Skill의 `SKILL.md`를 다시 읽는다.
