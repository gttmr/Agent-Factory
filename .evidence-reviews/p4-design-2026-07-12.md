# Agent Factory generator-neutrality contract design

> Status: **APPROVED 2026-07-12 (main session)** — all four §7 decisions resolved to the recommended options:
> ① V1 derived wrapper keys = reviewed `object` **and** `array` outputs; ② V2 reuses `adk_skeleton_contract.implementation_template` (`remote_a2a_registry_projection_stub`), no new field; ③ no-provider fallback stays the safe unconnected placeholder; ④ enum-closing `implementation_template` is out of scope for this PR.
> Scoping note: T2 converts exactly the tests this change breaks (basic-bundle wrapper pin, cdp-a2a-registry-provider body regex); route/dynamic/terminal exact-string tests already behind `evaluateGeneratedRoute` stay as-is (plan-4e rationale honored).

> Original status: design complete. This is the only file produced by this design task; no production source or fixture is modified.

## Evidence posture

- Requested primary evidence `.evidence-reviews/c5-generator.md` is absent from this worktree and the nearby primary checkout as of 2026-07-12.
- Its preserved C5 review summary identifies the same three neutrality leaks (`analysis_input_bundle`, `agent_registry_snapshot`, `Super Agent`) and exact-string test brittleness. Every design decision below was re-grounded in the current checkout.

## 1. V1 design + judged alternatives

### Decision

Remove `"analysis_input_bundle"` from the generator-authored tuple in `scripts/adk-source/emitters/runtime-tool-inputs.mjs:25-38`. Build the generated Python `PAYLOAD_WRAPPER_KEYS` from:

1. the existing fixed, generator-neutral base keys, in their current order:
   `previous`, `arguments`, `structured_content`, `structuredContent`, `result`, `output`, `input`, `payload`, `data`, `response`, `runtime_mock`; then
2. reviewed JSON-container output names from `scaffold-plan.json.modules[].outputs[]`, where normalized `type` is exactly `object` or `array`.

Use every such output from the approved scaffold-plan module list, including optional outputs. Do **not** restrict the set to graph-reachable/downstream-consumed outputs. The resolver is a generic recursive decoder, and an optional or currently terminal output can become an envelope at runtime without changing its reviewed output contract.

Include `array` as well as `object`: `_payload_value` already recursively descends lists (`runtime-tool-inputs.mjs:103-107`), but it cannot reach a list stored under a scenario-owned outer key unless that key is admitted as a wrapper. Primitive outputs (`string`, `number`, `boolean`, and custom scalar names) are not wrappers.

Generation algorithm (JavaScript side):

```text
derived = scaffoldPlan.modules
  .flatMap(module => module.outputs ?? [])
  .filter(output => lower(trim(output.type)) in {"object", "array"})
  .map(output => trim(output.name))
  .filter(non-empty)
  .dedupe()
  .exclude(keys already in generic base)
  .sort(by raw UTF-16 code unit order; do not use localeCompare)

PAYLOAD_WRAPPER_KEYS in generated Python = generic base, followed by derived
```

Render each derived key with the existing Python string-literal helper (`toPyStr`) rather than interpolation. A `Set` plus default `.sort()` gives module-order-independent, locale-independent output, so equivalent approved plans produce byte-stable wrapper tuples. Base-key order remains unchanged for compatibility.

### Why `outputs[].name + type` is the reviewed source

- `modules[].outputs[]` states that a module returns an envelope with that reviewed field name and whether its value is a JSON container. The current scenario already has `outputs: [{"name":"analysis_input_bundle","type":"object","required":true}]` in both `templates/regression-scenarios/wf-page-recommendation-required/analysis-result.json:405-410` and `scaffold-plan.json:230-235`.
- `input_mapping` maps a consumer input name to a source lookup key (`_collect_tool_inputs`, `runtime-tool-inputs.mjs:179-203`). It is not an inventory of producer envelope names and may contain state/path syntax such as `$state.broad_handoff_payload` (`wf-page-recommendation-required/scaffold-plan.json:766-770`).
- `output_mapping` maps a declared output to a result destination/path. It describes projection, not recursive unwrapping, and is not currently consumed by `_payload_value`.
- Edge `state_key` values are session-state slots. `_collect_tool_inputs` checks those slots directly before recursive payload traversal (`runtime-tool-inputs.mjs:184-203`), so adding them to wrapper keys conflates storage location with envelope shape.
- Edge `data_label`/`schema_ref` may restate vocabulary but are less authoritative than module output contracts and would create graph-reachability/order coupling.

### Judged alternatives

| Alternative | Judgment |
| --- | --- |
| All reviewed `object`/`array` outputs | **Chosen.** Correct semantic layer, handles fan-out and optional envelopes, and has a simple deterministic set rule. |
| Only producer outputs consumed downstream | Rejected. It requires graph reachability to configure a generic decoder, misses terminal/temporarily disconnected reviewed outputs, and is fragile for reused module nodes. |
| `input_mapping` values | Rejected. Values are consumer lookup paths/keys and can contain `$state.*`/`$result`, not producer wrapper names. |
| `output_mapping` keys or values | Rejected. Keys duplicate declared outputs incompletely; values describe destinations/result paths and may not be valid wrapper names. |
| Outgoing/incoming state channel keys | Rejected. They are `ctx.state` slots already read directly, not nested payload envelopes. |
| Every output name regardless of type | Rejected. It would treat scalar leaves as recursive envelopes and widen lookup ambiguity unnecessarily. |

### Implementation touch list

- `scripts/adk-source/emitters/runtime-tool-inputs.mjs`: delete the scenario literal; accept/render the derived sorted wrapper list.
- `scripts/adk-source/emitters/runtime-helpers.mjs`: accept the approved `modules` (or precomputed derived keys) and pass them to `buildRuntimeToolInputsSection`.
- `scripts/adk-source/agent-runnable.mjs` and `scripts/adk-source/agent-dynamic.mjs`: pass `modules` into `buildRuntimeHelperSection` in both lowering paths. Do not implement the rule in only one path.
- Prefer a small pure helper colocated in `runtime-tool-inputs.mjs` (for example `reviewedPayloadWrapperKeys(modules)`) so the same deterministic rule is directly unit-testable. No schema/type/validator field addition is needed for V1.

## 2. V2 design: existing-field-first judgment + touch list

### Existing-field-first judgment

An existing reviewed field fits; do **not** add a new module-candidate field or runtime-contract kind.

Use `adk_skeleton_contract.implementation_template` with the exact protocol-neutral selector:

```json
{
  "scaffold_level": "mock_testable_skeleton",
  "target_runtime": "adk_python_2_x",
  "generation_mode": "deterministic_template",
  "implementation_template": "remote_a2a_registry_projection_stub",
  "manual_completion_required": true,
  "developer_todos": ["review Remote A2A provider projection"]
}
```

Ownership and flow:

```text
analysis-result.json.processFlow.nodes[].adk_skeleton_contract
  -> packages/web/src/analyzer/scaffoldPlan.ts
  -> scaffold-plan.json.modules[].adk_skeleton_contract
  -> scripts/adk-source/emitters/function-node.mjs
```

The selector lives on the reviewed Graph IR node and its derived scaffold-plan module, not on `ModuleCandidate` and not in `runtimeContracts[]`. `AdkSkeletonContract.implementation_template` already names the deterministic implementation template (`packages/web/src/analyzer/types.ts:223-230`); the process-flow and scaffold-plan schemas already admit it (`schemas/process-flow.schema.json:245-257`, `schemas/scaffold-plan.schema.json:650-662`). The generator already includes this contract in `COMPONENT_CONTRACTS` (`scripts/adk-source/agent-contracts.mjs:34-37`).

Other existing fields do not fit:

- `runtime_binding` / `invoke_binding`: invocation transport/mechanism (`local_function`, `mcp_tool`, `remote_a2a`), not the selected function body.
- `scaffold_output`: smoke/runnable handoff level, not behavior.
- `side_effect`, `call_control`, `policy`: effect, ownership/control, and governance constraints; none says what payload to project.
- `input_mapping` / `output_mapping`: data binding only.
- `runtimeContracts[]`: reserved for the current legacy/callback/context/async-resume contract kinds; registry projection is neither an external callback nor a new runtime boundary.

### Generator behavior

Replace `emitsRegistrySnapshot()` and its checks of output/channel literal names (`function-node.mjs:68-75`) with an exact selector check against `module.adk_skeleton_contract?.implementation_template`.

The selected behavior remains generic Remote A2A protocol behavior:

- with one or more approved provider rows, emit the current provider projection payload;
- with zero approved provider rows, retain the current safe generic/unconnected placeholder path rather than claiming configured providers;
- continue writing the payload to the normal module output state and every reviewed outgoing state/artifact channel via `emitOutgoingStateChannelWrites` / `emitOutgoingArtifactChannelWrites`; the generator must never name the scenario channel itself.

The selector authorizes the projection template; provider rows still come only from approved `analysis-result.json.a2aContracts[]` and matching Remote A2A modules through `remoteA2aRegistrySnapshotRows`.

### Compatibility validation

Add a scaffold validation invariant for `implementation_template === "remote_a2a_registry_projection_stub"`:

- `output_mode` must be `runnable`;
- module category must be `adapter`;
- `runtime_binding` must be `local_function`;
- `invoke_binding` must be `local_function` or `local_python`;
- the module must lower through the stub-function path (it must not be an MCP-connected adapter);
- `adk_skeleton_contract.generation_mode`, when present, must be `deterministic_template`.

Do not require a non-empty provider set: the no-provider fixture is a deliberate fail-safe behavior. Do not require any particular output name or state key.

### Full touch list

- `scripts/adk-source/emitters/function-node.mjs`: selector-only dispatch; remove both `agent_registry_snapshot` comparisons; distinguish “selector absent” from “selector present but provider rows empty.”
- `packages/web/src/analyzer/scaffoldPlan.ts`: in `adkSkeletonContractFor`, preserve the reviewed `remote_a2a_registry_projection_stub` contract for a compatible local-function adapter instead of replacing it with `adapter_placeholder_stub`; add a derivation regression.
- `scripts/validate-artifacts.mjs`: enforce the compatibility rules above both on canonical Graph IR nodes (joined to their module candidates) and on derived scaffold modules; reject incoherent selector/binding combinations before generation.
- `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs`: set the selector in the registry module contract and remove output/state-name reliance as the trigger (the names themselves remain legitimate reviewed fixture vocabulary).
- `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs`: replace body-regex/string-fragment assertions with executed generated-Python behavior (section 5).
- `packages/web/src/analyzer/scaffoldPlan.test.ts`: prove a reviewed Graph IR contract carrying the selector survives derivation byte-for-byte into the scaffold-plan module.
- `scripts/validate-artifacts.test.mjs`: positive compatible-selector case plus negative wrong category, binding, connected-MCP, and generation-mode cases.
- Active documentation during implementation: record the reviewed-template selector and artifact ownership in `docs/workbench/agent-factory-harness.md`; append the contract decision to `docs/decision-log.md`.

No shape change is needed in `schemas/module-candidate.schema.json`, `schemas/analysis-result.schema.json`, `schemas/analysis-draft.schema.json`, `schemas/process-flow.schema.json`, or `schemas/scaffold-plan.schema.json`; `packages/web/src/analyzer/types.ts` and `scripts/artifact-validation/constants.mjs` likewise need no new field/enum. This is the main advantage of using the existing implementation-template contract. If implementation elects to close the pre-existing free-string schema globally, that should be a separate compatibility change covering every current template value, not bundled into this neutrality fix.

### UI judgment

Do not add a duplicate field to the module-candidate review tab. The selector belongs to the Graph IR node’s ADK Skeleton contract, which is already visible in `GraphElementEditor.tsx:588-599` and `GraphInspector.tsx:317-327`. No new visible UI surface is required for this campaign. If authoring the selector in-browser becomes a requirement, add editing to that ADK Skeleton section in a separate UX change; generator neutrality only requires that proposed/imported reviewed artifacts display and preserve it.

## 3. V3 confirmation

Current generator-source search:

```text
rg -n --glob 'scripts/generate-adk-source.mjs' --glob 'scripts/adk-source/**' 'Super Agent' scripts
scripts/adk-source/emitters/agent-node.mjs:71: ...
```

That is the only `Super Agent` occurrence in generator source; a case-insensitive `super[ _-]?agent` search returns the same line only. Fixture/test occurrences under `scripts/adk-source-test/**` are reviewed scenario vocabulary and should remain permitted.

Replace line 71 with a template string using the reviewed module name and the particle-safe suffix:

```text
Route JSON은 ${module.name} 에이전트가 직접 결정한 구조화 출력이어야 하며 ...
```

Keep the space before `에이전트가`; do not synthesize Korean particles from the module name. Add a regression using a route-decision agent whose name is not `Super Agent`, so substitution is observable rather than accidentally producing identical text from the existing fixture.

## 4. T1 neutrality-guard design

### Replace a deny-list with a source-structure check

Move the neutrality check out of the general assertion collection into a dedicated test family:

- `scripts/adk-source-test/generator-neutrality.mjs`: literal extraction, reviewed-fixture vocabulary collection, and violation reporting.
- `scripts/adk-source-test/generator-neutrality-allowlist.mjs`: the only explicit allowlist.
- `scripts/adk-source-test/generator-neutrality.test.mjs`: positive scan of real generator sources plus negative canaries.
- `scripts/generate-adk-source.test.mjs`: import the new test file.
- `scripts/adk-source-test/assertions.mjs`: delete `generatorAuthoredLeaks`, `assertGeneratorSourcesStayDomainNeutral`, and the fixed-token `assertNoGeneratorAuthoredGeneratedLeaks` helper/call; retain the separately scoped `LEGACY_ROUTE_ALIAS_COMPAT` check.
- `scripts/adk-source-test/basic-bundle.test.mjs`: remove its call to the old fixed-token guard.

`collectGeneratorSourceFiles()` remains the source boundary: `scripts/generate-adk-source.mjs` plus every `scripts/adk-source/**/*.mjs`. Do not scan test fixtures as generator source.

### Detector inputs and algorithm

1. Lex quoted string/template atoms from generator source while ignoring comments and regex literals. Preserve strings embedded inside JavaScript template literals because those become generated Python.
2. Always treat a generator-authored quoted atom matching snake case (`^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$`) as a candidate. This means a newly added snake-case literal fails unless it is approved vocabulary, even when no fixture contains it yet.
3. Derive scenario vocabulary from:
   - `templates/regression-scenarios/**/analysis-result.json`;
   - `templates/regression-scenarios/**/scaffold-plan.json`;
   - `scripts/adk-source-test/*fixture*.mjs` quoted atoms.
4. From the reviewed-fixture atoms, retain domain-literal shapes:
   - snake-case identifiers;
   - short ASCII title labels (2-5 words, such as `Super Agent` or `Page Metadata RAG`);
   - uppercase/alphanumeric identifiers (`T2S`, `PAGE_B`);
   - compact Korean identifiers without whitespace/punctuation (2-20 characters).
5. Report a violation when either:
   - a generator snake-case atom is not allowlisted; or
   - a generator-authored string contains a derived reviewed-fixture atom that is not allowlisted.
6. Report `relative-file:line`, the offending token, its extraction class, and (for artifact-derived collisions) the fixture path(s) that supplied it. Sort violations by generator path, line, then token for stable output.

This catches all three campaign examples structurally:

- `analysis_input_bundle`: snake-case and reviewed fixture output;
- `agent_registry_snapshot`: snake-case and test-fixture output/channel;
- `Super Agent`: short title label derived from the CDP fixture and found inside the longer generator guidance string.

Add negative-canary tests that pass synthetic generator snippets containing those three token shapes to the detector and assert violations. The literals may live in test data; the production-source scan boundary excludes tests.

### Allowlist location and contents

`scripts/adk-source-test/generator-neutrality-allowlist.mjs` should export immutable, lexicographically sorted entries with a reason, not a bare `Set`, for example:

```js
export const GENERATOR_NEUTRAL_LITERAL_ALLOWLIST = [
  { token: "agent_card_url", source: "A2A provider projection protocol" },
  { token: "input_mapping", source: "scaffold-plan schema field" },
  { token: "runtime_mock", source: "scaffold-plan schema field" },
  { token: "structured_content", source: "MCP structured content envelope" }
];
```

Allowed categories are limited to:

- schema field names and enum values used by the generator;
- ADK/MCP/A2A protocol vocabulary;
- generator-internal runtime/control/status vocabulary that is scenario-independent;
- explicitly marked legacy compatibility tokens already isolated by a compatibility boundary.

Do not allowlist product names, scenario IDs, module/output/channel names, route aliases, user-facing role names, or Korean domain nouns. A scenario token that legitimately appears in generated output must arrive through serialized artifact data; it does not need to exist in generator source and therefore does not need an allowlist entry.

### Update policy

- Every allowlist addition must include its contract/protocol provenance in the same entry and a focused test showing why the generator must author it.
- Schema provenance must cite the active schema property/enum; protocol provenance must cite the local implementation contract or official ADK/MCP/A2A term. “Existing test failed” is not acceptable provenance.
- Keep entries sorted and unique; the neutrality test fails on duplicate/unsorted entries.
- A fixture addition must never auto-update the allowlist. If it collides with generator source, the author must remove the generator literal or justify it as generic contract vocabulary.
- Baseline the initial allowlist once in the campaign PR and review it as a contract artifact. Do not mechanically add every reported token.
- Do not apply the same global token deny-list to generated bundles: source neutrality proves the generator does not author scenario vocabulary, while generated bundles are allowed to contain vocabulary serialized from their reviewed input artifacts. Bundle tests should instead use explicit provenance canaries (a synthetic marker present in the input must be present where serialized; an unrelated marker absent from the input must not appear).

## 5. T2 test conversion list

Exactly two existing test files pin the behaviors changed by V1/V2 and require conversion:

1. `scripts/adk-source-test/basic-bundle.test.mjs:163-174`
   - Delete the regex that checks tuple text and specifically names `analysis_input_bundle`.
   - Generate a runnable fixture whose reviewed module output includes a unique `object` envelope (and an `array` envelope if the section 1 decision is accepted).
   - Run `py_compile` on the generated `agent.py`.
   - Parse the generated Python with `ast`, compile only `PAYLOAD_WRAPPER_KEYS` plus `_content_text`, `_json_payload`, and `_payload_value`, then execute `_payload_value({reviewedEnvelope: {"needle": "ok"}}, "needle")` and assert `"ok"`.
   - Add a scalar-output counterexample and assert its name is not traversed as a wrapper.
   - The assertion is about runtime lookup behavior; it must not inspect tuple formatting or pin a scenario literal.

2. `scripts/adk-source-test/cdp-a2a-registry-provider.test.mjs:34-52`
   - Keep the direct JavaScript `remoteA2aRegistrySnapshotRows` deep-equality test at lines 6-32; it already verifies behavior rather than source formatting.
   - Replace both regex-extracted function-body tests with execution of the generated async function in a minimal Python namespace (`Context`, dict-like state with `to_dict`, `COMPONENT_CONTRACTS`, and `asyncio.run`).
   - Provider-present case: assert the returned/state payload contains the reviewed provider row, URL, configured status, and provider count; assert the payload was written under the fixture’s reviewed state channel without checking how that assignment is spelled.
   - Provider-absent case: assert the returned/state payload is the safe unconnected placeholder and has no configured provider rows.
   - Add a negative selector case: same output/state names but no `remote_a2a_registry_projection_stub` selector must stay on the generic placeholder path. This proves names no longer trigger behavior.

Add one shared support helper, `scripts/adk-source-test/generated-python-runtime.mjs`, modeled on `cdp-a2a-route-runtime.mjs:32-116` and `dynamic-loop-decisions.test.mjs`:

- resolve Python via `AF_TEST_PYTHON`, then the shared runtime venv path used by existing tests;
- run `python -m py_compile` for syntax-only verification;
- use Python `ast` node selection rather than JavaScript regex block extraction;
- execute only named generated assignments/functions with explicit stubs, avoiding ADK imports and source-layout coupling;
- return JSON over stdout for Node assertions.

No other existing test file needs conversion for these contracts. Route/dynamic/terminal exact-string assertions are broader plan-4e debt but do not pin V1 or V2; converting them belongs in a separate bounded test-hardening slice. `cdp-a2a-owner-route.test.mjs`, `route-type-decision.test.mjs`, and `cdp-a2a-super-agent-route-context.test.mjs` already execute route behavior through `evaluateGeneratedRoute` and should retain their reviewed CDP vocabulary.

## 6. Fixture/template migration steps

### `templates/regression-scenarios/wf-page-recommendation-required/*`

No JSON contract edit is required for V1. The reviewed vocabulary is already correctly owned by both artifacts:

- `analysis-result.json`: `mod-analysis-input-builder.outputs[]` has `name: "analysis_input_bundle"`, `type: "object"`, `required: true` (`:405-410`).
- `scaffold-plan.json`: the corresponding module has the same output contract (`:230-235`).
- The three fan-out edges continue to carry `data_label`/`schema_ref` values in the reviewed Graph IR (`analysis-result.json:2062-2120`); they are not generator configuration.

Migration action for this directory is therefore validation/regeneration only:

1. leave `analysis-result.json`, `scaffold-plan.json`, and `mock-lab/mock-spec.json` vocabulary unchanged;
2. regenerate a temporary runtime bundle from the existing scaffold plan;
3. execute the V1 resolver behavior check against the generated helper and run the real ADK runtime gate from plan 4d;
4. confirm no generated-output snapshot is tracked under this template directory (currently only the three source fixture files are tracked), so there is no checked-in runtime stub to update.

Do **not** add `input_mapping`, `output_mapping`, or a new wrapper field merely to migrate this scenario; doing so would duplicate the authoritative output contract.

### `scripts/adk-source-test/cdp-a2a-*fixture*`

Required V2 edit in `scripts/adk-source-test/cdp-a2a-registry-fixture.mjs`:

1. define one reusable reviewed contract object/helper whose `implementation_template` is `remote_a2a_registry_projection_stub`;
2. attach it to the registry scaffold module’s `adk_skeleton_contract` in `registryDiscoveryModule()`;
3. set the scaffold module’s `runtime_binding: "local_function"` and `invoke_binding: "local_function"` so the selector satisfies the explicit compatibility contract rather than relying on the base fixture’s null binding;
4. attach the same ADK skeleton contract plus `runtime_binding: "local_function"`, `invoke_binding: "local_function"`, and `call_control: "fixed_by_workflow"` to the registry Graph IR node in `registryProcessFlow()` so the fixture models the canonical reviewed Graph IR → scaffold-plan path rather than scaffold-only hidden configuration;
5. retain `outputs[].name === "agent_registry_snapshot"` and the outgoing `state_key` unchanged, because those are valid scenario-owned data contracts, no longer triggers;
6. add a fixture option that omits the selector while leaving those names and compatible bindings intact for the negative behavioral test;
7. retain provider-present/provider-absent variants and approved embedded A2A contract data.

V3 verification edit in `scripts/adk-source-test/cdp-a2a-super-agent-fixture.mjs`:

- parameterize the route-decision agent display name (default may remain `Super Agent` for the CDP scenario), and generate one test bundle with a different reviewed name such as `Delegation Router Agent`;
- assert the generated route guidance uses that alternate name. The default CDP vocabulary remains in the fixture and related test descriptions; it is correct for it to stay there.

No contract edits are needed in `cdp-a2a-contracts.mjs`, `cdp-a2a-launcher-fixture.mjs`, or `cdp-a2a-route-runtime.mjs`.

## 7. Risks & open questions for the main session

### Decisions requested

1. **Approve container outputs as `object` + `array` (recommended), or narrow V1 to `object` only.** The current resolver already descends lists, so including reviewed array envelopes is the internally consistent choice. Narrowing to object only leaves the same class of future leak likely for array envelopes.
2. **Approve reuse of `adk_skeleton_contract.implementation_template` (recommended), or require a new field.** The existing field has the right meaning and review path. A new `runtime_behavior` field would duplicate template selection across module candidate/Graph IR/scaffold plan and force unnecessary schema/type/UI migration.
3. **Approve preservation of the current no-provider fallback (recommended).** The selector authorizes registry projection, but zero reviewed providers should continue producing the generic unconnected placeholder rather than a misleading configured registry with zero rows.
4. **Keep global enumeration of all `implementation_template` strings out of this PR (recommended).** The field is currently free-form across several existing fixtures. Closing it to an enum is useful hardening but is a separate compatibility decision and migration, not required to remove the literal trigger.

### Risks and mitigations

- **Wrapper precedence:** two reviewed container outputs can contain the same nested source key. Preserve direct-key lookup first, generic wrapper order second, and derived wrapper lexicographic order last. Document this deterministic precedence; do not let module order decide it.
- **Over-broad wrapper admission:** accepting arbitrary output types would increase accidental matches. Limit the derived set to normalized `object`/`array` only and add the scalar negative test.
- **Template selector without coherent binding:** because `implementation_template` is an existing free string, an incoherent artifact could otherwise silently fall back. The validator compatibility rules and the selector-negative runtime test are required gates.
- **Analyzer derivation loss:** current `adkSkeletonContractFor` replaces explicit contracts for non-MCP adapters in some cases (`scaffoldPlan.ts:336-363`). The campaign is incomplete unless the registry selector survives Graph IR → scaffold plan and that path has a web analyzer regression.
- **Neutrality-guard baseline noise:** the first structural scan will expose many generic snake-case literals. Review and justify the allowlist entry-by-entry; do not mechanically snapshot the initial output. Keep fixture-derived scenario atoms out even if that requires moving more literals into artifact data.
- **False confidence from `py_compile`:** syntax compilation and isolated helper execution do not prove ADK node semantics. Plan 4d remains a completion gate: run the updated page-recommendation scenario and registry fixture through the available `InMemoryRunner` or `adk api_server`, observing payload resolution/state projection. Unit tests alone are insufficient.
- **Artifact-originated generated literals:** generated `agent.py` will still contain scenario vocabulary inside serialized `COMPONENT_CONTRACTS` and derived wrapper tuples. That is correct provenance. The source-neutrality test must distinguish generator-authored source from artifact-serialized generated output.
- **Missing requested evidence file:** `.evidence-reviews/c5-generator.md` was absent from both this worktree and the nearby primary checkout. This design used its preserved review summary only to locate the three findings, then re-verified every code/fixture claim against the current worktree. The main session should attach/recover the original report if it needs wording or evidence beyond those findings.

### Implementation completion gates

The campaign implementation should not be called complete until all of the following pass:

```text
node scripts/validate-artifacts.test.mjs
node scripts/generate-adk-source.test.mjs
node scripts/validate-artifacts.mjs
cd packages/web && npm run test:analyzer
cd packages/web && npm run build
```

Additionally run the plan-4d real ADK smoke described above and record the observed payload/state results. Documentation impact is material (reviewed contract selector and generator-neutrality policy), so the implementation change set must also update the active harness and decision log identified in section 2.
