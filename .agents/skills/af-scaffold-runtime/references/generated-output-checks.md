# Generated Output Checks

## Purpose

Generated Runtime Handoff가 approved artifacts와 일치하고 local 검증을 통과했는지 증명한다.

## When to read

Generation 직후와 Verify handoff 직전에 읽는다.

## Decision criteria

Always run structural checks.

Dependencies가 설치된 경우에만 import/runtime tests를 실행한다.

Network install이나 package upgrade는 사용자 승인 없이 수행하지 않는다.

## Required evidence

- artifact root, output root, output mode
- generated file inventory
- Python/runtime version과 installed package versions
- exact commands, exit codes, bounded stdout/stderr
- selected pattern success/failure scenarios
- skipped checks와 이유
- prohibited-output scan result
- residual uncertainty

## Artifact implications

Generated file 존재는 compile 또는 runtime success의 증거가 아니다.

Current artifact validation은 behavior quality의 증거가 아니다.

## Scaffold implications

기본 check:

```bash
python3 -m compileall <output-root>
```

Dependencies가 있으면:

```bash
cd <output-root>
python3 -m pytest -q
```

선택한 pattern마다 success, invalid input, unavailable dependency, timeout, retry, duplicate side effect, resume/commit timing 중 applicable scenario를 실행한다.

## Verification

다음을 review한다.

- generated source와 approved Graph/contracts의 일치
- smoke TODO와 runnable local wiring의 구분
- environment placeholders only
- local synthetic mocks only
- no deployment, secret, private endpoint, real data, production logic
- handoff TODO와 unverified dependency의 일치

## Stop conditions

- compile/import 실패
- generated test 또는 local smoke 실패
- selected pattern negative scenario 실패
- dependency 부재를 pass로 기록함
- generated output이 approved design과 다름
- prohibited output이 발견됨

## Official sources checked

- `scripts/generate-adk-source.mjs`
- `scripts/adk-source/file-builder.mjs`
- `scripts/validate-artifacts.mjs`
- `../../_shared/testing-contract.md`

## Checked date

- Checked date: 2026-07-18
- Evidence rule: no passing or runnable claim without fresh output from the current generated tree.
