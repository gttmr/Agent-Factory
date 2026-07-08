# Runtime Stub Checks

Use this only when a generated `runtime-stub/` exists.

## Structural Check

```bash
python3 -m compileall <artifact-root>/runtime-stub
```

If the directory is absent, record "runtime-stub absent" instead of forcing the check.

## Generated Test Check

Run only when Python test dependencies exist:

```bash
cd <artifact-root>/runtime-stub
python3 -m pytest -q
```

Do not install dependencies or use network access without explicit approval.

## Review Checklist

- generated source matches approved artifacts
- smoke mode remains TODO/synthetic
- runnable mode remains reviewed synthetic ADK wiring
- `implementation-handoff.md` states non-goals and unverified pieces
- no private endpoints, credentials, customer data, deployment scripts, or production business logic

## Stop Conditions

- compile failure
- generated test failure
- dependency absence not recorded
- production behavior claim based only on generated smoke output

## Grounding

- `scripts/adk-source/file-builder.mjs`
- `scripts/adk-source/agent-smoke.mjs`
- `scripts/adk-source/agent-runnable.mjs`
