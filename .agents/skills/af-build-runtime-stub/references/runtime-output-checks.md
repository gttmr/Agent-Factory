# Runtime Output Checks

Verify generated files before claiming a handoff bundle is usable.

## Always Run

```bash
python3 -m compileall <artifact-root>/runtime-stub
```

If Python is missing or the stub directory does not exist, record that as unverified.

## Run When Dependencies Exist

From the generated runtime root:

```bash
cd <artifact-root>/runtime-stub
python3 -m pytest -q
```

Do not install packages or use the network unless the user explicitly permits it.

## Review Generated Files

Check:

- smoke mode keeps synthetic TODO/runtime wiring explicit
- runnable mode uses reviewed Graph IR and synthetic Mock Lab/Remote A2A bindings only
- `.env.example` contains only placeholder env names
- no private endpoints, credentials, customer data, deployment scripts, or production business logic

## Stop Conditions

- compile fails
- generated test fails
- output contains private or production implementation details
- generated code diverges from approved artifacts

## Grounding

- `scripts/adk-source/file-builder.mjs`
- `scripts/adk-source/agent-smoke.mjs`
- `scripts/adk-source/agent-runnable.mjs`
- `scripts/validate-artifacts.mjs`
