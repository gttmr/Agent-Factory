# ADK 2.3 Baseline

Agent Factory targets the installed ADK runtime, not old badge text.

## Truth Order

1. installed runtime source or execution under `.agent-factory/runtime/.venv`
2. adk.dev official docs (`https://adk.dev/graphs/`, `/graphs/routes/`, `/graphs/data-handling/`, `/graphs/human-input/`, `/graphs/dynamic/`, `/a2a/`)
3. current repo generator/validator code
4. repo docs

The installed runtime checked for this refresh is `google-adk 2.3.0`. Do not write version-attributed claims such as "added in 2.3" unless the installed runtime source or a verified release source proves it.

## Minimum-Badge Note

Some adk.dev pages say "Supported in ADK Python v2.0.0". Treat that as minimum-support/history context, not the current Agent Factory baseline.

## Use In Skills

ADK API knowledge is allowed only for:

- reviewing generated Runtime Handoff output
- mapping Graph IR concepts to generated ADK workflow concepts
- verifying that generator output uses real installed runtime symbols

Do not teach freehand ADK runtime implementation from raw requirements.

## Verification

```bash
test -d .agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk
```

Stop if the installed runtime source is unavailable and remove exact Python signature claims.

## Grounding

- `docs/workbench/skill-refresh-evidence-2026-07.md`
- `.agent-factory/runtime/.venv/lib/python3.13/site-packages/google/adk/version.py`
