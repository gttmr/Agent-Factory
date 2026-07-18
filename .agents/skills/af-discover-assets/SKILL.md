---
name: af-discover-assets
description: >-
  Analyzes raw or imported Agent Factory requirements into evidence-backed Agent, Workflow, and Tool candidates plus resources, dependencies, risks, and unresolved information. It applies when a user asks “이 요구에서 만들 구성요소를 나눠줘”, “Agent/Tool 후보를 뽑아줘”, or requests requirement discovery before Graph composition; it does not apply to Graph assembly, runtime code generation, or verification-only work.
---

# AF Discover Assets

## 1. 목적

요구사항과 제공 자료에서 **무엇을 만들어야 하는지**를 증거 기반 후보로 도출한다.

이 Skill의 Output은 확정 Graph나 코드가 아니라 다음 discovery record다.

- Evidence, Assumptions, Contradictions, Missing Information
- Agent·Workflow·Tool 후보와 Resource·External Dependency
- Domain Scope, Owner 후보, Reuse 후보
- 입력·출력, Side Effect·Risk, 관계 Hint
- 조건부 Runtime Pattern Hint

Target 자산 유형은 Agent, Workflow, Tool뿐이다.

Resource, Dependency, protocol, callback, event loop, ambient trigger는 자산 유형이 아니다.

Runtime Pattern Hint는 다음 단계의 검토 입력일 뿐 확정 계약이 아니다.

## 2. 선행 조건

### Preconditions

작업 시작 전에 다음을 모두 확인한다.

1. 사용자 요구 원문 또는 import된 요구 자료가 존재한다.
2. 저장소 root와 artifact root를 서로 구분할 수 있다.
3. Stage Runner mode라면 정확한 Analyze run folder와 `request.json`이 존재한다.
4. Standalone mode라면 사용자가 명시한 단일 output path가 존재하거나 생성 가능하다.
5. 읽기 권한이 있는 근거와 금지된 민감 정보의 경계가 분명하다.

root, run ID, mode 중 하나라도 모호하면 추측하지 않고 중단한다.

### Inputs

허용 입력은 다음으로 제한한다.

- 사용자 제공 requirement text와 첨부 자료
- Stage Runner `request.json`과 run ledger
- 현재 artifact root의 canonical analysis artifact
- 사용자가 범위에 넣은 Catalog 사실과 저장소 파일
- 직접 검사한 schema, validator, active documentation

Archive와 private handoff 자료를 현재 근거로 사용하지 않는다.

### Read Set

최소 Read Set은 다음이다.

1. requirement 원문
2. active mode를 증명하는 root 또는 run metadata
3. [Taxonomy Reference](../_shared/taxonomy.md)
4. mode에 따라 [Analysis Result Output](references/analysis-result-output.md)

현행 JSON을 쓸 때만 [Compatibility Layer](../_shared/compatibility-current-schema.md)를 추가로 읽는다.

## 3. 핵심 Workflow

### Decision Procedure

다음 순서를 바꾸지 않는다.

#### 1단계: mode와 output path를 고정한다

- Stage Runner mode: `runs/analyze/<run-id>/proposed-artifacts/analysis-result.json`
- Standalone mode: 사용자가 지정한 `<output-path>` 또는 `<artifact-root>/analysis-result.json`

Stage Runner mode에서는 proposal 한 파일만 쓴다.

Standalone canonical write는 사용자 지시와 active document gate가 모두 허용할 때만 수행한다.

#### 2단계: Evidence를 먼저 추출한다

요구 원문에서 직접 확인되는 문장, 파일, 시스템, 입력, 출력, 책임, 위험을 위치와 함께 기록한다.

Evidence와 다음 항목을 분리한다.

- 추론은 Assumption
- 서로 맞지 않는 진술은 Contradiction
- 답이 필요한 질문은 Missing Information

자세한 추출 순서는 [Evidence and Candidate Discovery](references/evidence-and-candidate-discovery.md)를 따른다.

#### 3단계: 다섯 질문으로 후보를 판별한다

질문 1. 독립적인 판단 책임이 있는가?

- 있으면 Agent 후보를 검토한다.
- 단순 호출이나 deterministic transform이면 Agent로 만들지 않는다.

질문 2. 둘 이상의 실행 단위 흐름을 소유하는가?

- 순서, 분기, 반복, 합류, pause/resume 책임이 있으면 Workflow 후보를 검토한다.
- 구성요소 수가 둘 이상이라는 사실만으로 Workflow를 만들지 않는다.

질문 3. 구조화된 호출 기능인가?

- 독립 input/output/error/side-effect 계약이 있으면 Tool 후보를 검토한다.
- Workflow-private helper라면 독립 Tool이 아니라 Function Node 관계 Hint로 남긴다.

질문 4. 호출 기능이 아닌 데이터·문서·시스템인가?

- Resource 또는 External Dependency로 기록한다.
- schema에 맞추기 위해 억지로 Tool 후보로 승격하지 않는다.

질문 5. 한 Workflow 내부의 private 결정 단계인가?

- 독립 자산으로 만들지 않는다.
- Function Node 후보라는 관계 Hint만 남긴다.

#### 4단계: Workflow 필요성을 과장하지 않는다

다음은 Workflow 없이 끝날 수 있다.

- 단일 Agent
- 단일 Tool
- Agent와 Agent-selected Tool
- 독립 Tool Catalog 등록 후보

실행 순서와 제어 책임의 Evidence가 있을 때만 Workflow 후보를 만든다.

#### 5단계: 후보별 review surface를 채운다

각 후보마다 다음을 기록한다.

- responsibility와 근거
- input/output
- side effect와 error boundary
- Domain Scope와 Owner 후보
- Reuse 후보와 비교 근거
- risk와 security/audit 필요성
- candidate-level Missing Information
- 다른 후보·Resource·Dependency와의 관계 Hint

Domain Scope, Owner, Reuse는 서로 독립된 판단으로 유지한다.

#### 6단계: Runtime Pattern Hint만 남긴다

| 발견한 Evidence | 남길 Hint | 이 단계에서 금지되는 확정 |
| --- | --- | --- |
| 외부 이벤트가 실행을 시작함 | Ambient Trigger 후보 | endpoint·retry 계약 확정 |
| 독립 Agent 서비스 경계 | A2A 후보 | Agent Card·API 생성 |
| 실행 전후 정책 개입 | Callback 또는 Plugin 후보 | hook 위치 추측 |
| state/artifact commit timing 중요 | Event Loop 검토 | Event Loop Node 생성 |
| 외부 Tool server | MCP Binding 후보 | endpoint·Tool 이름 추측 |
| 사람 승인 뒤 재개 | Human Input / Resume 후보 | response schema 확정 |

Hint마다 Evidence와 더 단순한 대안을 함께 기록한다.

#### 7단계: mode별 artifact를 작성한다

Stage Runner mode에서는 proposed `analysis-result.json`만 쓴다.

현행 schema를 쓰는 Stage Runner 또는 canonical write에서는:

1. Target 판단을 먼저 기록한다.
2. Compatibility Layer의 문서화된 `legacy` 직렬화만 적용한다.
3. Target rationale를 `rationale` 또는 notes에 보존한다.
4. 매핑 불가 또는 materially lossy mapping은 중단한다.
5. 그 영향 영역을 `docs/migration/skill-vnext-status.md`의 Blocker로 기록하도록 보고한다.

Standalone 비검증 design note는 Target 어휘를 사용할 수 있다.

#### 8단계: 출력 검증을 수행한다

다음을 전부 확인한다.

- 모든 후보에 Evidence가 있다.
- Evidence, Assumption, Contradiction, Missing Information이 분리됐다.
- top-level 후보는 Agent, Workflow, Tool뿐이다.
- Resource와 Dependency가 Tool로 오인되지 않았다.
- Missing Information이 승인 사실처럼 쓰이지 않았다.
- 관계 Hint가 확정 실행 순서나 Graph topology로 변하지 않았다.
- Runtime Pattern Hint가 확정 runtime contract로 변하지 않았다.

## 4. Reference 선택표

| 조건 | 읽을 Reference | 사용 결과 |
| --- | --- | --- |
| 모든 discovery 작업 | [Taxonomy Reference](../_shared/taxonomy.md) | 자산·비자산·Domain·Owner·Reuse 경계 |
| 모든 evidence 추출과 후보 판별 | [Evidence and Candidate Discovery](references/evidence-and-candidate-discovery.md) | 증거 분리와 후보 record |
| Stage Runner 또는 `analysis-result.json` 작성 | [Analysis Result Output](references/analysis-result-output.md) | mode별 경로와 현행 shape |
| 현행 canonical/proposed JSON 작성 | [Compatibility Layer](../_shared/compatibility-current-schema.md) | Target 판단의 current serialization |

표에 없는 Reference를 관성적으로 읽지 않는다.

선택한 Reference는 SKILL.md에서 직접 연 1-hop 문서만 사용한다.

## 5. 허용 Write

### Allowed Writes

Stage Runner mode:

```text
<run-dir>/proposed-artifacts/analysis-result.json
```

Standalone mode:

```text
<explicit-output-path>
```

또는 사용자와 active document gate가 허용한 경우에만:

```text
<artifact-root>/analysis-result.json
```

### Forbidden Writes

- canonical artifact from Stage Runner mode
- `normalized-requirement.json`, `module-candidates.json`, `process-flow.json` proposal 분할 파일
- `boundary-design.md`
- `scaffold-plan.json`
- `runtime-stub/`
- `validation-report.md`
- `catalog-delta.yaml`
- `catalog/*.yaml`
- `manifest.approvals.*`와 stage status
- runtime source, Agent Card, endpoint, credential, deploy file
- production business logic 또는 real customer data

### Outputs

완료 Output은 discovery record와 mode에 맞는 단일 analysis artifact다.

Graph, approval 변경, runtime code는 Output이 아니다.

## 6. Stop Conditions

다음 중 하나면 즉시 중단하고 필요한 정보·영향 영역·재개 조건을 보고한다.

- artifact root, run ID, mode, output path가 모호함
- 사실과 가정을 분리할 수 없음
- candidate responsibility 또는 I/O 근거가 없음
- Resource/Dependency를 자산으로 가장해야 current schema에 맞음
- Workflow 책임 없이 Workflow 후보를 강제해야 함
- candidate-level Missing Information이 남았는데 approved 상태가 요구됨
- A2A/MCP/Callback/Ambient/Event Loop 계약을 이 단계에서 확정해야 함
- Target 판단을 현행 schema에 안전하게 매핑할 수 없음
- `analysis-result.json` parse 또는 validation 실패
- private endpoint, credential, customer data가 필요함
- 승인 toggle, Catalog write, Graph 확정, 코드 생성이 필요함

## 7. 검증 명령

### Observable Verification

작성 직후 JSON parse를 실행한다.

```bash
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' <analysis-result-path>
```

현행 proposed/canonical artifact라면 validator를 실행한다.

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Stage Runner mode의 write inventory를 확인한다.

```bash
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
```

inventory는 `analysis-result.json` 하나여야 한다.

검증 기록에는 command, environment, input, files read, files written, exit code, observed output, failure, residual uncertainty를 남긴다.

## 8. 다음 Skill Handoff

### Next Handoff

다음 조건이 충족되면 `af-compose-solution`으로 handoff한다.

- 후보 책임과 I/O가 검토 가능함
- Evidence와 Assumption이 분리됨
- Required Missing Information이 명시됨
- Resource와 Dependency 경계가 유지됨
- Runtime Pattern은 Hint로만 기록됨
- current artifact를 썼다면 validation이 성공함

handoff에는 output path, mode, candidate 요약, unresolved questions, contradictions, selected hints, validation command와 exit code를 포함한다.

후보 도출이 끝나지 않았거나 hard-gate 정보가 없으면 Compose를 실행하지 않는다.
