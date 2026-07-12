import "./artifact-validation/validate-artifacts-saved-analysis.test.mjs";
import "./artifact-validation/validate-artifacts-graph.test.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import test from "node:test";
import {
  registrySelectorArtifacts,
  runValidatorExpectingFailure,
  tempArtifactRoot,
  validator,
  writeJson,
  writeRegistrySelectorArtifacts
} from "./artifact-validation/validate-artifacts-test-utils.mjs";
import {
  a2aContractStatuses,
  a2aHttpPaths,
  a2aOperationNames,
  a2aPartFields,
  a2aRoles,
  a2aRuntimeAuthModes,
  a2aRuntimeFallbackModes,
  a2aStreamWrappers,
  a2aTaskStates,
  accessProtocols,
  adapterKinds,
  agentExecutionModes,
  agentKinds,
  categories,
  graphCallControls,
  graphContainerKinds,
  graphDecisionOwners,
  graphEdgeKinds,
  graphExecutionSemantics,
  graphFlowKinds,
  graphInvokeBindings,
  graphLaneIds,
  graphLayoutPolicies,
  graphNodeKinds,
  graphPolicies,
  graphSideEffects,
  remoteKinds,
  runtimeContractKinds,
  runtimeContractStatuses,
  workflowKinds
} from "./artifact-validation/constants.mjs";

test("validate-artifacts keeps analyzer, validator, and schema enums aligned", () => {
  for (const entry of enumAlignmentEntries()) {
    const analyzerValues = readAnalyzerConstArray(entry.typeConst);
    assert.deepEqual(analyzerValues, [...entry.validatorSet], `${entry.label}: analyzer types.ts vs validator constants`);
    for (const schema of entry.schemas) {
      assert.deepEqual(analyzerValues, readSchemaEnum(schema.file, schema.pointer), `${entry.label}: analyzer types.ts vs ${schema.file} ${schema.pointer}`);
    }
  }
});

test("validate-artifacts accepts compatible registry projection selectors on Graph IR and scaffold modules", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-ok-");
  writeRegistrySelectorArtifacts(artifactRoot, registrySelectorArtifacts());
  const output = execFileSync(process.execPath, [validator, artifactRoot], { encoding: "utf8", stdio: "pipe" });
  rmSync(artifactRoot, { recursive: true, force: true });
  assert.match(output, /Artifact validation OK/);
});

test("validate-artifacts rejects a Graph IR selector missing from the matching scaffold module", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-graph-only-");
  const artifacts = registrySelectorArtifacts();
  delete artifacts.module.adk_skeleton_contract;
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /Graph IR selector .* is not preserved in scaffold module/);
});

test("validate-artifacts rejects a scaffold selector without matching Graph IR approval", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-scaffold-only-");
  const artifacts = registrySelectorArtifacts();
  delete artifacts.node.adk_skeleton_contract;
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /scaffold selector .* has no matching Graph IR approval/);
});

test("validate-artifacts rejects a registry-selector Graph IR node without a scaffold module", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-missing-scaffold-module-");
  const artifacts = registrySelectorArtifacts();
  artifacts.plan.modules = artifacts.plan.modules.filter((item) => item.id !== artifacts.module.id);
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /Graph IR selector .* for module .* has no matching scaffold module/);
});

test("validate-artifacts rejects a registry-selector scaffold module without a Graph IR node", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-missing-graph-node-");
  const artifacts = registrySelectorArtifacts();
  artifacts.analysis.processFlow.nodes = artifacts.analysis.processFlow.nodes.filter(
    (item) => item.module_id !== artifacts.module.id
  );
  const incomingEdge = artifacts.analysis.processFlow.edges.find((item) => item.to === artifacts.node.id);
  const outgoingEdge = artifacts.analysis.processFlow.edges.find((item) => item.from === artifacts.node.id);
  assert.ok(incomingEdge && outgoingEdge);
  incomingEdge.to = outgoingEdge.to;
  artifacts.analysis.processFlow.edges = artifacts.analysis.processFlow.edges.filter(
    (item) => item.from !== artifacts.node.id
  );
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /scaffold selector .* for module .* has no matching Graph IR node/);
});

test("validate-artifacts rejects different selector values across Graph IR and scaffold surfaces", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-value-drift-");
  const artifacts = registrySelectorArtifacts();
  artifacts.module.adk_skeleton_contract.implementation_template = "adapter_placeholder_stub";
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /Graph IR selector .* is not preserved in scaffold module .*adapter_placeholder_stub/);
});

test("validate-artifacts accepts a non-registry Graph IR template without a scaffold counterpart", () => {
  const artifactRoot = tempArtifactRoot("af-validator-derived-graph-template-");
  const artifacts = registrySelectorArtifacts();
  artifacts.node.adk_skeleton_contract.implementation_template = "function_stub";
  delete artifacts.module.adk_skeleton_contract;
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const output = execFileSync(process.execPath, [validator, artifactRoot], { encoding: "utf8", stdio: "pipe" });
  rmSync(artifactRoot, { recursive: true, force: true });
  assert.match(output, /Artifact validation OK/);
});

test("validate-artifacts accepts a derived scaffold template without a Graph IR counterpart", () => {
  const artifactRoot = tempArtifactRoot("af-validator-derived-scaffold-template-");
  const artifacts = registrySelectorArtifacts();
  delete artifacts.node.adk_skeleton_contract;
  artifacts.module.adk_skeleton_contract.implementation_template = "llm_agent_selection_stub";
  writeRegistrySelectorArtifacts(artifactRoot, artifacts);
  const output = execFileSync(process.execPath, [validator, artifactRoot], { encoding: "utf8", stdio: "pipe" });
  rmSync(artifactRoot, { recursive: true, force: true });
  assert.match(output, /Artifact validation OK/);
});

test("validate-artifacts loads split module candidates when validating selector compatibility", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-split-");
  const artifacts = registrySelectorArtifacts();
  artifacts.candidate.module_category = "agent";
  artifacts.candidate.agent_kind = "specialist";
  artifacts.candidate.adapter_kind = null;
  writeJson(`${artifactRoot}/process-flow.json`, artifacts.analysis.processFlow);
  writeJson(`${artifactRoot}/module-candidates.json`, artifacts.analysis.moduleCandidates);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /remote_a2a_registry_projection_stub module category must be adapter/);
});

test("validate-artifacts falls back to embedded candidates for split flows without module-candidates.json", () => {
  const artifactRoot = tempArtifactRoot("af-validator-registry-selector-embedded-");
  const artifacts = registrySelectorArtifacts();
  artifacts.candidate.module_category = "agent";
  artifacts.candidate.agent_kind = "specialist";
  artifacts.candidate.adapter_kind = null;
  writeJson(`${artifactRoot}/process-flow.json`, artifacts.analysis.processFlow);
  writeJson(`${artifactRoot}/analysis-result.json`, artifacts.analysis);
  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /process-flow\.json[^\n]*remote_a2a_registry_projection_stub module category must be adapter/);
});

for (const { name, surface, mutate, expected } of [
  { name: "wrong category", surface: "graph", mutate: ({ candidate }) => { candidate.module_category = "agent"; candidate.agent_kind = "specialist"; candidate.adapter_kind = null; }, expected: /module category must be adapter/ },
  { name: "wrong runtime binding", surface: "scaffold", mutate: ({ module }) => { module.runtime_binding = "direct_api"; }, expected: /runtime_binding must be local_function/ },
  { name: "wrong invoke binding", surface: "graph", mutate: ({ node }) => { node.invoke_binding = "direct_api"; }, expected: /invoke_binding must be local_function or local_python/ },
  { name: "connected MCP adapter", surface: "scaffold", mutate: ({ module }) => { Object.assign(module, { access_protocol: "mcp", mcp_server: "mock-registry", mcp_tool_name: "lookup_registry", invoke_binding: "mcp_tool", call_control: "fixed_by_workflow" }); }, expected: /must lower through the stub-function path/ },
  { name: "non-deterministic generation mode", surface: "graph", mutate: ({ node }) => { node.adk_skeleton_contract.generation_mode = "manual"; }, expected: /generation_mode must be deterministic_template/ },
  { name: "smoke output mode", surface: "scaffold", mutate: ({ plan }) => { plan.output_mode = "smoke"; }, expected: /requires runnable output_mode/ }
]) {
  test(`validate-artifacts rejects registry projection selector with ${name} on ${surface}`, () => {
    const artifactRoot = tempArtifactRoot("af-validator-registry-selector-bad-");
    const artifacts = registrySelectorArtifacts();
    if (surface === "graph") delete artifacts.module.adk_skeleton_contract;
    else delete artifacts.node.adk_skeleton_contract;
    mutate(artifacts);
    writeRegistrySelectorArtifacts(artifactRoot, artifacts);
    const result = runValidatorExpectingFailure(artifactRoot);
    assert.match(result.stderr, expected);
  });
}

const analyzerTypesUrl = new URL("../packages/web/src/analyzer/types.ts", import.meta.url);
const schemaCache = new Map();

function enumAlignmentEntries() {
  return [
    enumEntry("module categories", "moduleCategories", categories, [
      schemaEnum("module-candidate.schema.json", "/$defs/moduleCategory"),
      schemaEnum("analysis-result.schema.json", "/$defs/moduleCandidate/properties/module_category")
    ]),
    enumEntry("adapter kinds", "adapterKinds", adapterKinds, [
      schemaEnum("module-candidate.schema.json", "/$defs/adapterKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/moduleCandidate/properties/adapter_kind")
    ]),
    enumEntry("agent kinds", "agentKinds", agentKinds, [
      schemaEnum("module-candidate.schema.json", "/$defs/agentKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/moduleCandidate/properties/agent_kind")
    ]),
    enumEntry("workflow kinds", "workflowKinds", workflowKinds, [
      schemaEnum("module-candidate.schema.json", "/$defs/workflowKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/moduleCandidate/properties/workflow_kind")
    ]),
    enumEntry("remote contract kinds", "remoteContractKinds", remoteKinds, [
      schemaEnum("module-candidate.schema.json", "/$defs/remoteContractKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/moduleCandidate/properties/remote_contract_kind")
    ]),
    enumEntry("access protocols", "accessProtocols", accessProtocols, [
      schemaEnum("module-candidate.schema.json", "/$defs/accessProtocol")
    ]),
    enumEntry("agent execution modes", "AGENT_EXECUTION_MODES", agentExecutionModes, [
      schemaEnum("process-flow.schema.json", "/$defs/agentExecutionMode"),
      schemaEnum("analysis-result.schema.json", "/$defs/agentExecutionMode")
    ]),
    enumEntry("graph node kinds", "GRAPH_NODE_KINDS", graphNodeKinds, [
      schemaEnum("process-flow.schema.json", "/$defs/nodeKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/node_kind")
    ]),
    enumEntry("graph container kinds", "GRAPH_CONTAINER_KINDS", graphContainerKinds, [
      schemaEnum("process-flow.schema.json", "/$defs/containerKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphContainer/properties/container_kind")
    ]),
    enumEntry("graph edge kinds", "GRAPH_EDGE_KINDS", graphEdgeKinds, [
      schemaEnum("process-flow.schema.json", "/$defs/edgeKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphEdge/properties/edge_kind")
    ]),
    enumEntry("graph lane ids", "GRAPH_LANE_IDS", graphLaneIds, [
      schemaEnum("process-flow.schema.json", "/$defs/laneId"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphLane/properties/id"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/lane_id")
    ]),
    enumEntry("graph layout policies", "GRAPH_LAYOUT_POLICIES", graphLayoutPolicies, [
      schemaEnum("process-flow.schema.json", "/$defs/layoutPolicy"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphContainer/properties/layout_policy")
    ]),
    enumEntry("graph execution semantics", "GRAPH_EXECUTION_SEMANTICS", graphExecutionSemantics, [
      schemaEnum("process-flow.schema.json", "/$defs/executionSemantics"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphEdge/properties/execution_semantics")
    ]),
    enumEntry("graph invoke bindings", "GRAPH_INVOKE_BINDINGS", graphInvokeBindings, [
      schemaEnum("process-flow.schema.json", "/$defs/invokeBinding"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/invoke_binding")
    ]),
    enumEntry("graph decision owners", "GRAPH_DECISION_OWNERS", graphDecisionOwners, [
      schemaEnum("process-flow.schema.json", "/$defs/decisionOwner"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/decision_owner")
    ]),
    enumEntry("graph call controls", "GRAPH_CALL_CONTROLS", graphCallControls, [
      schemaEnum("process-flow.schema.json", "/$defs/callControl"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/call_control"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphEdge/properties/call_control")
    ]),
    enumEntry("graph flow kinds", "GRAPH_FLOW_KINDS", graphFlowKinds, [
      schemaEnum("process-flow.schema.json", "/$defs/flowKind"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphEdge/properties/flow_kind")
    ]),
    enumEntry("graph side effects", "GRAPH_SIDE_EFFECTS", graphSideEffects, [
      schemaEnum("process-flow.schema.json", "/$defs/sideEffect"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/side_effect")
    ]),
    enumEntry("graph policies", "GRAPH_POLICIES", graphPolicies, [
      schemaEnum("process-flow.schema.json", "/$defs/policy"),
      schemaEnum("analysis-result.schema.json", "/$defs/graphNode/properties/policy")
    ]),
    enumEntry("A2A operation names", "A2A_OPERATION_NAMES", a2aOperationNames, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aOperationName"),
      schemaEnum("a2a-contract.schema.json", "/$defs/operationName")
    ]),
    enumEntry("A2A HTTP paths", "A2A_HTTP_PATHS", a2aHttpPaths, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aHttpPath"),
      schemaEnum("a2a-contract.schema.json", "/$defs/httpPath")
    ]),
    enumEntry("A2A task states", "A2A_TASK_STATES", a2aTaskStates, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aTaskState"),
      schemaEnum("a2a-contract.schema.json", "/$defs/taskState")
    ]),
    enumEntry("A2A part fields", "A2A_PART_FIELDS", a2aPartFields, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aPartField"),
      schemaEnum("a2a-contract.schema.json", "/$defs/partField")
    ]),
    enumEntry("A2A roles", "A2A_ROLES", a2aRoles, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aRole"),
      schemaEnum("a2a-contract.schema.json", "/$defs/role")
    ]),
    enumEntry("A2A stream wrappers", "A2A_STREAM_WRAPPERS", a2aStreamWrappers, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aStreamWrapper"),
      schemaEnum("a2a-contract.schema.json", "/$defs/streamWrapper")
    ]),
    enumEntry("A2A contract statuses", "A2A_CONTRACT_STATUSES", a2aContractStatuses, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aContract/properties/contract_status"),
      schemaEnum("a2a-contract.schema.json", "/$defs/contractStatus")
    ]),
    enumEntry("A2A runtime auth modes", "A2A_RUNTIME_AUTH_MODES", a2aRuntimeAuthModes, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aContract/properties/adk_runtime_policy/properties/auth/properties/mode"),
      schemaEnum("a2a-contract.schema.json", "/properties/adk_runtime_policy/properties/auth/properties/mode")
    ]),
    enumEntry("A2A runtime fallback modes", "A2A_RUNTIME_FALLBACK_MODES", a2aRuntimeFallbackModes, [
      schemaEnum("analysis-result.schema.json", "/$defs/a2aContract/properties/adk_runtime_policy/properties/fallback_handoff/properties/mode"),
      schemaEnum("a2a-contract.schema.json", "/properties/adk_runtime_policy/properties/fallback_handoff/properties/mode")
    ]),
    enumEntry("runtime contract kinds", "RUNTIME_CONTRACT_KINDS", runtimeContractKinds, [
      schemaEnum("analysis-result.schema.json", "/$defs/runtimeContractKind")
    ]),
    enumEntry("runtime contract statuses", "RUNTIME_CONTRACT_STATUSES", runtimeContractStatuses, [
      schemaEnum("analysis-result.schema.json", "/$defs/runtimeContractStatus")
    ])
  ];
}

function enumEntry(label, typeConst, validatorSet, schemas) {
  return { label, typeConst, validatorSet, schemas };
}

function schemaEnum(file, pointer) {
  return { file, pointer };
}

function readAnalyzerConstArray(constName) {
  const typesText = readFileSync(analyzerTypesUrl, "utf8");
  const match = new RegExp(`export\\s+const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`, "m").exec(typesText);
  assert.ok(match, `packages/web/src/analyzer/types.ts is missing exported const array ${constName}`);
  const literals = [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)].map((literal) => JSON.parse(literal[0]));
  assert.ok(literals.length > 0, `packages/web/src/analyzer/types.ts ${constName} has no string literals`);
  return literals;
}

function readSchemaEnum(file, pointer) {
  const schema = readSchema(file);
  const schemaNode = schemaNodeAt(schema, pointer);
  const enumValues = enumValuesFor(schemaNode);
  assert.ok(enumValues, `${file} ${pointer} does not resolve to a string enum`);
  return enumValues;
}

function readSchema(file) {
  if (!schemaCache.has(file)) {
    schemaCache.set(file, JSON.parse(readFileSync(new URL(`../schemas/${file}`, import.meta.url), "utf8")));
  }
  return schemaCache.get(file);
}

function schemaNodeAt(schema, pointer) {
  return pointer
    .split("/")
    .slice(1)
    .reduce((node, segment) => {
      assert.ok(node && typeof node === "object", `${pointer} is not present`);
      return node[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
    }, schema);
}

function enumValuesFor(schemaNode) {
  if (Array.isArray(schemaNode?.enum)) return schemaNode.enum;
  if (Array.isArray(schemaNode?.anyOf)) {
    return schemaNode.anyOf.find((option) => Array.isArray(option?.enum))?.enum ?? null;
  }
  return null;
}
