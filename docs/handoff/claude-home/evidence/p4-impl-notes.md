# P4 generator-neutrality implementation notes

## Scope and approved decisions

- Worktree: `/home/ilmaswsl/work/af-wt-p4`
- Source of truth read in full: `.p4-design.md` (APPROVED 2026-07-12) and `.evidence-c5-generator.md`.
- Approved decisions: derive wrapper keys from reviewed `object` and `array` outputs; reuse `adk_skeleton_contract.implementation_template`; preserve the safe no-provider fallback; leave global template enumeration out of scope.
- Hard boundaries: no commits, no ADK servers, no `.agents/**` edits, no scenario vocabulary in generator source, no unrelated refactors, Korean UI copy untouched.

## Documentation impact

- Active generator/runtime handoff policy changes, so `docs/workbench/agent-factory-harness.md` and `docs/decision-log.md` require updates in this change set.
- `CLAUDE.md` will be inspected for its generator/AGENTS-derived guidance and updated only if the neutrality guard belongs in that active summary.
- No UI contract or visible copy changes are planned.

## Progress log

- 2026-07-12: Read the approved design, original evidence, root and nearest child `AGENTS.md` files, Agent Factory harness, and relevant implementation/review skill instructions.
- 2026-07-12: Started current-worktree inventory before adding behavioral regressions and production changes.
- 2026-07-12: Added generated-Python AST execution support (`AF_TEST_PYTHON` or shared runtime venv), `py_compile`, and behavior-first V1/V2 checks. Added alternate route-agent-name regression for V3.
- 2026-07-12: Implemented reviewed `object`/`array` wrapper derivation with dedupe + code-unit sort + `toPyStr`, passed `modules` through static and dynamic runtime-helper lowering, and replaced the route-guidance role literal with the reviewed module name.
- 2026-07-12: Migrated the registry fixture so the Graph IR node and scaffold module carry the same reviewed `remote_a2a_registry_projection_stub` selector and compatible local-function bindings; added the selector-omitted variant.
- 2026-07-12: Implemented selector-only registry dispatch, analyzer selector preservation, and Graph IR/scaffold-module compatibility validation for category, output mode, bindings, stub-function lowering, and deterministic generation mode.
- 2026-07-12: Replaced the old fixed-token/source+bundle checks with the structural generator-neutrality scan. Curated the initial immutable allowlist entry-by-entry with schema/protocol/runtime provenance; product labels were removed from generator source instead of allowlisted.
- 2026-07-12: Updated the active harness, decision log, and `CLAUDE.md` with reviewed selector ownership and neutrality-guard policy.

## Verification log

- Focused structural gate: `node scripts/adk-source-test/generator-neutrality.test.mjs` — PASS (5/5).
- Initial nested-process test attempts were blocked by sandbox-local `spawnSync ... EPERM`; this is recorded as environment evidence, not a code verdict. Required gates will still be rerun and recorded below.
- Direct generated-Python V1 check — PASS: `py_compile`; reviewed object lookup=`object-ok`; reviewed array lookup=`array-ok`; scalar wrapper lookup=`null`.
- Direct generated-Python V2 check — PASS: provider-present=`configured`; provider-absent=`unconnected`; selector-absent with the same output/state names=`unconnected`.
- Direct validator compatibility matrix — PASS: compatible Graph IR + scaffold module accepted; wrong category, wrong runtime binding, wrong invoke binding, connected MCP lowering, manual generation mode, and smoke output mode all rejected with the expected invariant.
- `node scripts/validate-artifacts.test.mjs` — PASS, 25/25.
- `node scripts/generate-adk-source.test.mjs` — PASS, 63/63 (includes V1 static+dynamic generated-Python behavior, V2 provider cases, V3 alternate name, and structural neutrality guard).
- `node scripts/validate-artifacts.mjs` — PASS (`Artifact validation OK`).
- `cd packages/web && npm run test:analyzer` — PASS; final combined Node suites reported 88/88 and all preceding analyzer/server test commands exited successfully.
- `cd packages/web && npm run build` — `tsc --noEmit` passed, then Vite hit the known symlinked `node_modules/.vite-temp` `EROFS` sandbox artifact.
- `cd packages/web && npm run build -- --configLoader runner` — PASS; `tsc --noEmit`, 686 transformed modules, production bundle emitted.
- `git diff --check` — PASS, no whitespace errors.
- Fixture boundary check — PASS: no tracked diff under `templates/regression-scenarios/wf-page-recommendation-required/**`; the three reviewed fixture files remain present and unchanged.
- Generator-source campaign-token search — PASS: no `analysis_input_bundle`, `agent_registry_snapshot`, or `Super Agent` in `scripts/generate-adk-source.mjs` or `scripts/adk-source/**`.
- Real-ADK runtime gate intentionally not run; per task, the main session runs it afterwards. No ADK server was started.
