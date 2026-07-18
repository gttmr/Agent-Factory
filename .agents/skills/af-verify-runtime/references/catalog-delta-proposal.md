# Catalog Delta Proposal

## Purpose

검증에서 발견한 reuse feedback을 proposal로 기록하고 Catalog publication과 분리한다.

## When to read

실제 reusable contract, synthetic mock candidate, registry gap이 발견된 경우에만 읽는다.

## Decision criteria

허용 proposal themes:

- reusable runtime contract candidate
- deterministic synthetic `runtime_mock`
- registration gap
- Reuse Hub reviewer note

비슷한 이름만으로 reuse를 제안하지 않는다.

responsibility, I/O, side effect, owner, version, security, runtime contract가 비교되어야 한다.

## Required evidence

- candidate와 existing Catalog identifiers
- responsibility/schema comparison
- owner/version compatibility
- auth/data/side-effect/timeout/retry/audit compatibility
- reuse, publish proposal, project-only, excluded, unresolved decision
- divergence와 follow-up
- synthetic mock provenance

## Artifact implications

Stage Runner mode:

```text
<run-dir>/proposed-artifacts/catalog-delta.yaml
```

Standalone mode:

```text
<explicit-report-output>/catalog-delta.yaml
```

`catalog/*.yaml`을 직접 수정하지 않는다.

Proposal 존재나 apply는 publication이 아니다.

## Scaffold implications

미래 Catalog ID가 이미 published된 것처럼 scaffold에 binding하지 않는다.

## Verification

```bash
git diff --name-only -- catalog
```

출력은 비어 있어야 한다.

Proposal에서 secret, private endpoint, customer data, deploy, production logic을 검사한다.

## Stop conditions

- reuse compatibility가 증명되지 않음
- publication approval이 필요함
- direct Catalog edit가 필요함
- proposal에 sensitive/private/production content가 있음

## Official sources checked

- `docs/workbench/taxonomy.md`
- `docs/workbench/operating-model.md`
- `packages/web/server/stageRunner.ts`
- Current publish boundary: `POST /api/catalog/publish`

## Checked date

- Checked date: 2026-07-18
- Catalog delta is proposal-only feedback.
