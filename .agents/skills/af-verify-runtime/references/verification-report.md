# Verification Report

## Purpose

Command, environment, scenario, result, failure, residual uncertainty를 재현 가능한 형식으로 기록한다.

## When to read

모든 Verify 작업에서 첫 command 전과 final claim 전 읽는다.

## Decision criteria

각 claim을 Level 1-5 중 하나 이상에 배치한다.

Required Level을 실행하지 못하면 `unverified`로 기록한다.

Fresh output이 없는 claim은 `pass`가 아니다.

## Required evidence

최소 record:

```text
Command
Environment
Input scenario
Selected Skill
Files read
Artifacts written
Exit code
Observed output
Failure
Residual uncertainty
Baseline comparison
```

Suggested report sections:

```markdown
# Validation Report

## Scope and Environment
## Commands
## Level 1-5 Results
## Runtime Scenarios
## Failures and Feedback
## Catalog Proposal
## Residual Uncertainty
## Final Claim
```

## Artifact implications

Stage Runner mode report는 proposal이며 explicit apply 전 canonical이 아니다.

Report는 approval state를 바꾸지 않는다.

## Scaffold implications

Generated inventory, package versions, compile/import, local smoke를 구분한다.

File existence만으로 runnable을 주장하지 않는다.

## Verification

Report의 command마다 exit code와 output summary가 있는지 확인한다.

failed/skipped command가 final claim에 반영됐는지 확인한다.

## Stop conditions

- failed command를 누락함
- skipped check를 pass로 표시함
- environment 또는 revision이 없음
- residual uncertainty가 없음
- stale evidence로 completion을 주장함
- secret/private output을 report에 복사함

## Official sources checked

- `packages/web/server/stageRunner.ts`
- `packages/web/server/afVerifyRunApi.ts`
- `docs/workbench/validation.md`

## Checked date

- Checked date: 2026-07-18
- Evidence must come from the current target and revision.
