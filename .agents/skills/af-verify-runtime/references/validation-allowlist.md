# Validation Allow-list

## Purpose

Current Workbench Verify의 허용 command와 각 command가 증명하는 범위를 고정한다.

## When to read

Workbench Verify command를 선택하거나 Stage Runner Verify evidence를 해석할 때 읽는다.

## Decision criteria

| Key | Server argv | Proves |
| --- | --- | --- |
| `validate_artifact_root` | `node scripts/validate-artifacts.mjs <artifact-root>` | current artifact parse/schema/gates |
| `build_web` | `npm run build --prefix packages/web` | web typecheck/build |
| `test_analyzer` | `npm run test:analyzer --prefix packages/web` | analyzer/generator test suite |

세 key 밖 command는 Workbench allow-list command로 표현하지 않는다.

가장 가벼운 충분한 command를 선택한다.

## Required evidence

- command key와 expanded argv
- repository root와 artifact root
- commit/revision과 environment
- exit code, stdout, stderr
- command start/end time
- claim과 command의 연결
- skipped stronger checks와 이유

## Artifact implications

Artifact validator pass는 web build 또는 runtime behavior를 증명하지 않는다.

Stage Runner run `completed`는 command `ok=true`를 의미하지 않는다.

## Scaffold implications

Runtime claim에는 compile/import, generated tests, local smoke를 별도로 수행한다.

## Verification

Manual equivalents:

```bash
node scripts/validate-artifacts.mjs <artifact-root>
npm run build --prefix packages/web
npm run test:analyzer --prefix packages/web
```

## Stop conditions

- key가 allow-list 밖임
- non-zero exit
- stale command output
- wrong root/revision에서 실행됨
- environment failure를 product failure 또는 pass로 오표기함
- command보다 강한 claim을 작성함

## Official sources checked

- `packages/web/server/afVerifyRunApi.ts`
- `packages/web/server/manifestValidation.ts`
- `packages/web/server/stageRunner.ts`

## Checked date

- Checked date: 2026-07-18
- Current allow-list: exactly three keys.
