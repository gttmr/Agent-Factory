---
name: af-verify-runtime
description: >-
  Verifies Agent Factory skills, artifacts, generated code, runtime connections, and behavioral outcomes through five evidence layers, then records failures, residual uncertainty, and feedback proposals. It applies when a user asks “생성된 MCP 연결과 callback을 검증해줘”, “validation report를 작성해줘”, or requests fresh proof for a Runtime Handoff; it does not scaffold code, discover candidates, or claim success from stale output.
---

# AF Verify Runtime

## 1. 목적

파일 존재가 아니라 **주장한 동작이 fresh evidence로 확인됐는지** 검증한다. 구조, artifact contract, code correctness, runtime smoke, behavior evaluation의 다섯 계층을 분리하고 실패 원인, 재실행 결과, residual uncertainty를 durable report로 남긴다.

Verify는 prior-stage artifact나 approval을 새로 만들지 않는다.

## 2. 선행 조건

### Preconditions

다음을 확인한다.

1. 검증 대상과 claim이 구체적이다.
2. exact artifact root, output root, 또는 Stage Runner run을 식별했다.
3. 검증할 revision/commit과 environment를 기록할 수 있다.
4. 필요한 dependency와 local mock의 상태를 확인했다.
5. 허용 command와 write boundary를 식별했다.

대상, claim, environment 중 하나라도 모호하면 실행 전에 질문하거나 중단한다.

### Inputs

- canonical/proposed artifacts와 generated `runtime-stub/` 또는 explicit output root
- Stage Runner run ledger/result, 해당하는 경우
- approved design/scaffold handoff와 selected Runtime Pattern scenarios
- baseline evidence, 비교가 필요한 경우

### Read Set

항상 [Testing Contract](../_shared/testing-contract.md)과 [Verification Report](references/verification-report.md)를 읽는다.

Workbench command를 실행할 때 [Validation Allow-list](references/validation-allowlist.md)를 읽는다.

runtime output이 있을 때만 [Runtime Validation Checks](references/runtime-validation-checks.md)를 읽는다.

Catalog feedback이 필요할 때만 [Catalog Delta Proposal](references/catalog-delta-proposal.md)을 읽는다.

current `legacy` artifact의 의미를 판정해야 할 때 [Compatibility Layer](../_shared/compatibility-current-schema.md)를 읽는다.

## 3. 핵심 Workflow

### Decision Procedure

#### 1단계: operating mode와 output path를 고정한다

Stage Runner mode에서 허용되는 proposal은 정확히 다음 두 파일이다.

```text
<run-dir>/proposed-artifacts/validation-report.md
<run-dir>/proposed-artifacts/catalog-delta.yaml
```

Current Verify execution은 server allow-list primitive가 소유하며, run status가 `completed`여도 `validation.ok=false`이면 passing이 아니다.

Standalone mode에서는 사용자가 지정한 report directory 또는 artifact root만 쓴다. Canonical report write는 사용자와 active document gate가 허용할 때만 수행한다.

#### 2단계: claim을 검증 계층에 매핑한다

### Level 1: Skill 구조

- frontmatter `name`과 `description`
- folder-name 일치와 line/description limits
- relative links와 reference depth
- trigger boundary와 duplicate canonical definition
- UTF-8/BOM, shim constraints, openai metadata

### Level 2: Artifact Contract

- JSON/YAML parse와 schema
- gate와 Missing Information
- Target 판단과 current Compatibility Output의 분리
- allowed writes와 proposal inventory
- approvals, A2A/runtime contract pairing

### Level 3: Code Correctness

- import와 compile
- typecheck/lint/build
- deterministic unit/contract tests
- exact Tool I/O와 callback/event assertions
- generated-source/artifact agreement

### Level 4: Runtime Smoke

- Agent load와 Workflow route
- Tool call과 MCP mock
- Callback Continue/Override
- State/Artifact commit
- Human Input/resume
- A2A mock와 Ambient trigger
- timeout, unavailable dependency, duplicate side effect

### Level 5: Behavior Evaluation

- 사용자 목표 달성
- Tool 선택과 route 품질
- 불필요 Tool 호출
- safety와 grounding
- failure/retry/fallback
- multi-turn 또는 event-driven scenario

낮은 계층 통과가 높은 계층 통과를 의미하지 않는다.

#### 3단계: deterministic test와 behavior eval을 구분한다

Deterministic test로 검증할 항목:

- parse, schema, import, compile, type/lint
- exact Tool input/output
- Callback Continue/Override
- Event action/state delta와 HTTP status
- retry count, idempotency, Graph reachability

Behavior eval로 검증할 항목:

- response와 explanation quality
- Tool/Agent 판단 품질
- 목표 완수와 자연어 적합성
- 복수의 유효 답이 있는 scenario

LLM 응답 문자열을 exact golden assertion으로 고정하지 않는다.

test agent에게 expected answer, suspected defect, intended fix, rubric을 노출하지 않는다.

#### 4단계: 최소 충분한 command를 선택한다

Workbench current allow-list는 다음 세 key뿐이다.

- `validate_artifact_root`
- `build_web`
- `test_analyzer`

[Validation Allow-list](references/validation-allowlist.md)에서 exact argv와 증명 범위를 확인한다.

artifact-only claim에 불필요한 web build를 실행하지 않는다.

runtime claim에는 artifact validator만으로 충분하다고 주장하지 않는다.

#### 5단계: fresh command를 실행하고 evidence를 capture한다

각 command에 다음을 기록한다.

- Command와 environment
- Input scenario와 selected Skill
- Files read와 artifacts written
- Exit code와 observed stdout/stderr summary
- Failure와 residual uncertainty
- Baseline comparison

dependency absence, sandbox failure, skipped check는 pass가 아니라 `unverified`다.

#### 6단계: selected Runtime Pattern을 검증한다

[Runtime Validation Checks](references/runtime-validation-checks.md)에서 적용되는 success와 negative scenario만 실행한다.

MCP, A2A, Callback, Event Loop, Ambient, resume 각각에 대해 승인 contract와 실제 behavior를 비교한다.

production endpoint나 real credential로 smoke하지 않는다.

#### 7단계: Feedback Loop를 수행한다

```text
Run
-> Capture evidence
-> Classify failure
-> Fix Skill / Reference / Scaffold
-> Re-run
-> Compare
```

실패를 threshold 완화, assertion 삭제, skipped check로 숨기지 않는다.

이 Skill의 authorized scope에 fix가 포함되지 않으면 원인과 separate follow-up만 보고한다.

#### 8단계: report와 proposal을 작성한다

[Verification Report](references/verification-report.md)의 형식으로 Level별 결과를 기록한다.

Catalog reusable feedback이 실제로 있으면 [Catalog Delta Proposal](references/catalog-delta-proposal.md)을 따른다.

`catalog/*.yaml`은 직접 수정하지 않는다.

current artifact의 Target/current 해석 불일치나 매핑 불가를 발견하면 `docs/migration/skill-vnext-status.md` Blocker로 기록하도록 보고한다.

#### 9단계: completion claim을 판정한다

모든 required command에 current revision의 fresh output이 있어야 한다.

non-zero exit, stale evidence, wrong environment, skipped required check, hidden uncertainty가 있으면 passing/fixed/complete를 주장하지 않는다.

## 4. Reference 선택표

| 조건 | 읽을 Reference | 결과 |
| --- | --- | --- |
| 모든 verification | [Testing Contract](../_shared/testing-contract.md) | deterministic/eval evidence 경계 |
| Workbench command | [Validation Allow-list](references/validation-allowlist.md) | exact command와 claim strength |
| generated/runtime output | [Runtime Validation Checks](references/runtime-validation-checks.md) | pattern별 smoke/negative tests |
| report 작성 | [Verification Report](references/verification-report.md) | durable evidence format |
| reuse feedback 존재 | [Catalog Delta Proposal](references/catalog-delta-proposal.md) | proposal-only Catalog feedback |
| current schema 해석 | [Compatibility Layer](../_shared/compatibility-current-schema.md) | Target/current 분리와 Blocker |

## 5. 허용 Write

### Allowed Writes

Stage Runner mode:

```text
<run-dir>/proposed-artifacts/validation-report.md
<run-dir>/proposed-artifacts/catalog-delta.yaml
```

Standalone mode:

```text
<explicit-report-output>/validation-report.md
<explicit-report-output>/catalog-delta.yaml
```

Catalog delta는 feedback이 있을 때만 작성한다.

### Forbidden Writes

- `catalog/*.yaml`
- prior-stage analysis/design/scaffold artifact 수정
- approval boolean 또는 stage status
- runtime source generation
- private endpoint, credential, real customer data
- deploy file와 production business logic
- expected-answer leak가 있는 eval evidence

### Outputs

fresh evidence, Level별 result, failure classification, residual uncertainty, optional catalog proposal이 Output이다.

## 6. Stop Conditions

- 대상 root/run/revision/claim이 모호함
- required command를 실행할 수 없음
- Stage Runner proposal path 밖 write가 필요함
- command key가 allow-list 밖임
- non-zero exit 또는 required scenario failure
- fresh output이 없음
- dependency absence나 sandbox issue를 pass로 바꿔야 함
- test agent가 expected outcome을 봄
- current mapping이 Target 판단을 오해하게 만듦
- private data, credential, production endpoint가 필요함
- report가 failure 또는 residual uncertainty를 누락함

## 7. 검증 명령

### Observable Verification

Artifact contract:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Web build 또는 analyzer test는 claim이 요구할 때만 실행한다.

```bash
npm run build --prefix packages/web
npm run test:analyzer --prefix packages/web
```

Generated Python:

```bash
python3 -m compileall <runtime-output-root>
```

Stage Runner proposal inventory:

```bash
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
```

각 command의 exit code와 observed output을 report에 저장한다.

## 8. 다음 Skill Handoff

### Next Handoff

모든 required Level이 fresh evidence로 통과하면 검증 결과를 사용자 또는 `af-workflow`에 handoff한다.

실패가 design 문제면 `af-compose-solution`, scaffold/generator 문제면 `af-scaffold-runtime`, discovery 경계 문제면 `af-discover-assets`로 되돌린다.

handoff에는 root/run/revision, claims, commands, Level별 result, artifacts written, failure class, residual uncertainty, next owner를 포함한다.

Verify는 approval이나 Catalog publication을 수행하지 않는다.
