import "./artifact-validation/validate-artifacts-saved-analysis.test.mjs";
import "./artifact-validation/validate-artifacts-graph.test.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
