# Evidence Report

`validation-report.md` is the durable verification record.

## Required Sections

Include:

- artifact root or run id
- command list
- exact command output summary
- pass/fail result per command
- skipped checks with reason
- environment limitations
- remaining uncertainty
- next separate follow-up, if any

## Evidence Rules

- Fresh command output is required before claiming pass/fixed/complete.
- A generated file existing is not proof that it compiles.
- A validator pass is not proof that web build passes.
- Sandbox failures must be labeled as sandbox observations unless host verification was performed.

## Suggested Minimal Shape

```markdown
# Validation Report

## Commands

| Command | Result | Evidence |
| --- | --- | --- |

## Runtime Stub

## Catalog Feedback

## Remaining Risk
```

## Stop Conditions

- report omits failed command output
- report claims completion while checks were skipped
- report hides uncertainty behind assumptions

## Grounding

- `packages/web/server/afVerifyRunApi.ts`
- `packages/web/server/stageRunner.ts`
- `docs/workbench/agent-factory-harness.md`
