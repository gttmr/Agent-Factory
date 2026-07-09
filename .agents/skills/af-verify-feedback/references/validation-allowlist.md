# Validation Allow-List

Workbench Verify exposes exactly three command keys.

## Allow-List

| Key | Server command |
| --- | --- |
| `validate_artifact_root` | `node scripts/validate-artifacts.mjs <artifact-root>` |
| `build_web` | `npm run build --prefix packages/web` |
| `test_analyzer` | `npm run test:analyzer --prefix packages/web` |

The server appends the artifact root only for `validate_artifact_root`.

## Manual Equivalents

Run from repo root:

```bash
node scripts/validate-artifacts.mjs <artifact-root>
npm run build --prefix packages/web
npm run test:analyzer --prefix packages/web
```

Choose the lightest command that proves the claim. Do not run build/analyzer tests just to make artifact-only claims.

## Stop Conditions

- command key outside the allow-list
- non-zero exit code
- stale command output
- sandbox/network/auth failure reported as product failure without separating environment cause

## Grounding

- `packages/web/server/afVerifyRunApi.ts`
- `packages/web/server/manifestValidation.ts`
- `docs/workbench/agent-factory-harness.md`
