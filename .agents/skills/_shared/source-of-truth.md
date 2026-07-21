# Source of Truth

## Purpose

Use a single evidence hierarchy when Agent Factory Target concepts, current product contracts, ADK documentation, and installed runtime behavior differ. Keep every conclusion labeled as Target Contract, Current Implementation, or Blocker.

## When to read

Read this reference before any other shared reference when a task:

- writes or reviews Agent Factory artifacts;
- selects an ADK runtime pattern;
- finds disagreement between docs, schemas, validators, generated code, or installed APIs;
- must decide whether an observation is a product gap or a skill-authoring error.

## Decision criteria

Use this order, scoped to the question being answered:

1. Active Agent Factory vNext docs own Target concepts and operating rules.
2. Current repository source, schema, validator, and tests own Current Implementation behavior.
3. Official ADK documentation owns documented framework semantics.
4. Installed `google-adk` source and execution own version-specific availability and signatures.
5. Local Google Agents CLI skills are structural and workflow examples, not Agent Factory authority.
6. Retired or pre-vNext Agent Factory skills are salvage sources only; the canonical five-skill tree is active procedure.
7. Archive and handoff material are historical evidence, never active authority.

Do not use the order to force a false agreement. For example, official docs may describe a feature that is absent or different in the installed package. In that case, preserve the documented intent, block unsupported scaffold code, and record the implementation gap.

## Required evidence

Record enough evidence for another coding agent to reproduce the decision:

- authority class: Target, Current, or Blocker;
- repository path and stable symbol or schema key for product behavior;
- official URL and checked date for framework behavior;
- installed package version and import/signature probe for emitted Python;
- validator, build, test, or runtime command used;
- unresolved disagreement and its affected artifact or scaffold surface.

Do not present inference as verification. A handbook locator is a navigation aid; reopen its current source before relying on it.

## Artifact implications

- Standalone design notes outside validators may use Target vocabulary.
- New Stage Runner proposals and canonical artifacts write only strict Target v2 fields from [target-contract-v2.md](target-contract-v2.md).
- Reject pre-v2 artifact shapes; there is no read fallback or projection path.
- Record unrepresentable or ambiguous Target data as a Blocker; do not invent an enum or selector.

## Scaffold implications

- Generate runtime code only from reviewed and approved artifacts.
- Treat the installed package as a hard availability gate for exact imports and signatures.
- Do not freehand unsupported APIs from official examples or memory.
- Keep generator expansion and runtime deployment outside a skill-only change unless separately authorized.

## Verification

For each material claim, verify the applicable layer:

```bash
node scripts/validate-artifacts.mjs <artifact-root-or-proposed-dir>
```

For Python surface claims, use `.agent-factory/runtime/.venv/bin/python` and inspect the installed source or `inspect.signature`. For documentation-only reference edits, run `git diff --check` and relative-link checks.

## Stop conditions

Stop and report a Blocker when:

- the artifact target or operating mode is ambiguous;
- current source and schema disagree on a load-bearing field;
- an exact ADK symbol or signature was not verified in the installed package;
- a Target concept cannot be represented without loss in the strict v2 contract;
- approval, private data, credentials, or deployment authority would need to be invented.

## Official sources checked

- [Agent Factory Taxonomy](../../../docs/workbench/taxonomy.md)
- [Agent Factory Graph IR](../../../docs/workbench/graph-ir.md)
- [Agent Factory Operating Model](../../../docs/workbench/operating-model.md)
- [Google ADK documentation](https://adk.dev/)
- Installed-package evidence: [r1-adk-package-check.md](../../../tests/skills/evidence/research/r1-adk-package-check.md)

## Checked date

- Checked date: 2026-07-20
- Official sources: Agent Factory active docs and `https://adk.dev/`
- Installed package version: `google-adk 2.3.0`
- Contract note: Canonical skills read and write strict Target Contract v2 only.
