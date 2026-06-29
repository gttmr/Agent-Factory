# Brief 16 — Build/Verify Stage Runner extension

## Status

완료. Build/Verify는 기존 primitive를 재사용하는 Stage Runner stage로 확장됐다.

## Scope

- `build` stage는 기존 `runtime-stub/build` 생성 primitive를 감싼다.
- `verify` stage는 기존 allowlist verify command primitive를 감싼다.
- Verify 결과는 `validation-report.md`와 `catalog-delta.yaml` proposal template으로 남긴다.
- Catalog delta는 자동 추론하지 않는다. reviewer가 수동으로 채운다.
- `cancel`은 active stage run AbortController에만 적용한다. ADK runtime process 중지는 RunSandbox 책임이다.

## UX contract

- Build 화면은 기존 compound build/manual controls를 유지하고 Stage Runner run history panel을 추가한다.
- Verify 화면은 기존 allowlist command cards를 유지하고 Stage Runner report/delta proposal path를 추가한다.
- Build stage는 canonical `runtime-stub/` side effect를 만들기 때문에 apply 버튼을 노출하지 않는다.
- Verify stage proposal은 apply로 canonical `validation-report.md`와 `catalog-delta.yaml`에 반영할 수 있다.

## Validation

- `packages/web/server/stageRunner.test.ts` covers build, verify, and canceled stage runs.
- Full verification bundle is tracked in the finish report for the implementing session.
