# Analysis Result Output

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

Discovery 결과의 mode별 write path와 current `analysis-result.json`의 load-bearing shape를 정의한다.

## When to read

Stage Runner Analyze proposal 또는 standalone current artifact를 쓰기 직전에 읽는다.

## Decision criteria

먼저 mode를 하나만 선택한다.

| Mode | Output |
| --- | --- |
| Stage Runner | `<run-dir>/proposed-artifacts/analysis-result.json` 한 파일 |
| Standalone explicit note | 사용자가 지정한 단일 output path |
| Standalone canonical | 문서·사용자 gate가 허용한 `<artifact-root>/analysis-result.json` |

Stage Runner proposal은 canonical artifact와 approvals를 바꾸지 않는다.

Standalone canonical write는 명시적 root가 없으면 금지한다.

## Required evidence

Current `analysis-result.json`의 required top-level keys는 다음이다.

```text
normalizedRequirement
evidence
moduleCandidates
a2aContracts
runtimeContracts
processFlow
```

`a2aContracts`와 `runtimeContracts`는 비어 있어도 배열로 존재한다.

각 candidate는 current schema가 요구하는 identity, category/subtype, confidence, rationale, I/O, reuse, risk, status, missing-information, side-effect, auth/audit/data-policy 필드를 보존한다.

정확한 required/nullable/conditional shape는 작성 시점의 다음 소스에서 다시 확인한다.

- `schemas/analysis-result.schema.json`
- `packages/web/src/analyzer/types.ts`
- `packages/web/server/validators.ts`
- `scripts/validate-artifacts.mjs`

Remote boundary를 current output에 기록할 때 candidate와 `a2aContracts[]`의 1:1 연결이 필요하다.

표준 split `a2a-contracts.json`을 만들지 않는다.

## Artifact implications

Stage Runner mode에서는 다음만 허용한다.

```text
<run-dir>/proposed-artifacts/analysis-result.json
```

다음을 proposal에 추가하지 않는다.

- `normalized-requirement.json`
- `module-candidates.json`
- `process-flow.json`
- `scaffold-plan.json`
- `boundary-design.md`

Target 판단은 Compatibility Layer를 거쳐 current `legacy` payload로 직렬화하되 rationale/notes에 보존한다.

매핑 불가 사례는 current enum을 발명하지 말고 `docs/migration/skill-vnext-status.md` Blocker 대상으로 보고한다.

## Scaffold implications

Discovery output은 scaffold authorization이 아니다.

승인, candidate hard-gate closure, Compose design, scaffold plan이 없으면 generator input으로 사용하지 않는다.

## Verification

JSON parse:

```bash
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' <analysis-result-path>
```

Current artifact validation:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

Proposal inventory:

```bash
find <run-dir>/proposed-artifacts -maxdepth 1 -type f -print
```

## Stop conditions

- mode 또는 output path가 모호함
- required top-level key가 없음
- candidate conditional field가 current schema와 맞지 않음
- A2A candidate와 embedded contract가 1:1이 아님
- Target decision을 오해 없이 current payload에 표현할 수 없음
- parse 또는 validator 실패
- proposal 밖 write가 필요함

## Official sources checked

- `packages/web/server/stageRunner.ts`
- `schemas/analysis-result.schema.json`
- `scripts/validate-artifacts.mjs`
- `.skills-work/r1-stagerunner-contract.md`

## Checked date

- Checked date: 2026-07-18
- Current behavior: Analyze requires one proposed `analysis-result.json` and validates it before diff/apply.
