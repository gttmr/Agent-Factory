# Design Output and Readiness

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

Compose 결과의 mode별 output과 Scaffold Readiness gate를 고정한다.

## When to read

Design output을 쓰기 직전과 `ready`를 보고하기 직전에 읽는다.

## Decision criteria

### Stage Runner mode

정확히 두 proposal을 쓴다.

```text
<run-dir>/proposed-artifacts/analysis-result.json
<run-dir>/proposed-artifacts/boundary-design.md
```

current diff builder가 한 파일만으로 진행할 수 있어도 두 파일 계약을 약화하지 않는다.

### Standalone mode

사용자가 지정한 design note path를 우선한다.

Canonical write는 explicit artifact root와 user/document gate가 있을 때만 수행한다.

### Readiness checklist

다음을 모두 확인한다.

- approved asset responsibility
- input/output and side-effect contract
- standalone 또는 reviewed Graph
- Binding, Transport, Invocation Control
- selected Runtime Pattern contracts
- required auth variable names
- closed candidate-level Missing Information
- testable success/failure scenarios
- actual review/approval state
- strict v2 artifact validation, 해당하는 경우

## Required evidence

`boundary-design.md`에 최소 다음을 기록한다.

- candidate approve/defer/reject summary
- standalone/Workflow 판단
- Graph changes와 validation findings
- Tool Invocation Control과 Binding
- Runtime Pattern selection과 contract readiness
- A2A 1:1 pairing review, 해당하는 경우
- reuse decision 또는 proposal note
- unresolved gates와 blockers
- Scaffold Readiness 결과와 근거

## Artifact implications

Stage Runner proposal은 canonical artifact, approval, stage status를 바꾸지 않는다.

Target design과 Current Implementation evidence를 분리해 설명한다.

Product gap은 `docs/migration/skill-vnext-status.md` Blocker 대상으로 보고한다.

## Scaffold implications

Ready는 scaffold authorization의 필요조건이지 approval 자체가 아니다.

승인 artifact와 scaffold plan이 없으면 code generation을 시작하지 않는다.

## Verification

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
```

두 proposal file과 validator result를 함께 확인한다.

## Stop conditions

- Stage Runner Design precondition이 없음
- proposal 두 파일 중 하나가 없음
- readiness 항목이 미충족인데 Ready로 표시됨
- approval boolean을 skill이 바꿔야 함
- strict v2 구조가 Target rationale를 보존하지 못함
- runtime source 또는 Catalog seed write가 요구됨

## Official sources checked

- `packages/web/server/stageRunner.ts`
- `docs/workbench/operating-model.md`
- `tests/skills/evidence/research/r1-stagerunner-contract.md`
- `scripts/validate-artifacts.mjs`

## Checked date

- Checked date: 2026-07-20
- Current behavior: Design proposals require both registered files; explicit apply does not approve the design.
