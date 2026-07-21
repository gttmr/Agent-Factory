import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAgainstSchema } from "../../../../scripts/artifact-validation/json-schema.mjs";
import { createA2AContractForCandidate } from "./a2aContracts.ts";
import { assetCandidate, runtimeContract, strictAnalysisFixture } from "./targetContract.testFixture.ts";
import { validateTargetAnalysisResult } from "./targetContract.ts";

assert.deepEqual(validateTargetAnalysisResult(strictAnalysisFixture()), []);

const standaloneAgent = strictAnalysisFixture();
standaloneAgent.assetCandidates = [standaloneAgent.assetCandidates[1]!];
standaloneAgent.graph = { ...standaloneAgent.graph, workflow_ref: null };
assert.deepEqual(validateTargetAnalysisResult(standaloneAgent), [], "one standalone Agent remains valid");

const standaloneTool = strictAnalysisFixture();
const tool = assetCandidate({
  asset_id: "tool.lookup",
  name: "Lookup Tool",
  asset_type: "tool",
  binding: { kind: "function" },
  connection: { transport: "in_process" }
});
standaloneTool.assetCandidates = [tool];
standaloneTool.graph = {
  ...standaloneTool.graph,
  workflow_ref: null,
  nodes: standaloneTool.graph.nodes.map((node) => node.node_kind === "agent"
    ? { id: node.id, label: node.label, node_kind: "tool", tool_ref: tool.asset_id, invocation_control: "workflow" }
    : node)
};
assert.deepEqual(validateTargetAnalysisResult(standaloneTool), [], "one standalone Tool remains valid");

const ownershipCases = [
  { id: "function", node: { id: "node-private", label: "Private", node_kind: "function", role: "transform" } },
  {
    id: "human_input",
    node: {
      id: "node-human",
      label: "Human",
      node_kind: "human_input",
      human_input_contract: {
        message: "Choose",
        payload_schema_ref: null,
        response_schema_ref: null,
        response_mapping: null,
        choice_options: null,
        accepted_aliases: null,
        default_choice: null
      }
    }
  },
  { id: "subworkflow", node: { id: "node-child", label: "Child", node_kind: "subworkflow", workflow_ref: "workflow.review" } },
  { id: "join", node: { id: "node-join", label: "Join", node_kind: "join" } }
] as const;
for (const testCase of ownershipCases) {
  const noOwner = strictAnalysisFixture();
  noOwner.graph = { ...noOwner.graph, workflow_ref: null, nodes: [testCase.node], edges: [], regions: [] } as typeof noOwner.graph;
  assert.ok(
    validateTargetAnalysisResult(noOwner).some((error) => error.includes("owning approved Workflow")),
    `${testCase.id} requires an owning Workflow`
  );
}

const multipleExecutionNodes = strictAnalysisFixture();
multipleExecutionNodes.assetCandidates.push(tool);
multipleExecutionNodes.graph = {
  ...multipleExecutionNodes.graph,
  workflow_ref: null,
  nodes: [multipleExecutionNodes.graph.nodes[1]!, { id: "node-tool", label: "Lookup", node_kind: "tool", tool_ref: tool.asset_id, invocation_control: "workflow" }],
  edges: [],
  regions: []
};
assert.ok(validateTargetAnalysisResult(multipleExecutionNodes).some((error) => error.includes("owning approved Workflow")));

const standaloneRegion = structuredClone(standaloneAgent);
standaloneRegion.graph.regions = [{
  id: "region-standalone",
  kind: "parallel",
  node_ids: ["node-agent"],
  entry_node_ids: ["node-agent"],
  exit_node_ids: ["node-agent"],
  parent_region_id: null
}];
assert.ok(validateTargetAnalysisResult(standaloneRegion).some((error) => error.includes("owning approved Workflow")));

for (const candidate of [
  assetCandidate({ asset_id: "tool.unresolved", asset_type: "tool", binding: { kind: "unresolved" }, connection: { transport: "unknown" } }),
  assetCandidate({ asset_id: "tool.unknown", asset_type: "tool", binding: { kind: "function" }, connection: { transport: "unknown" } }),
  assetCandidate({ asset_id: "workflow.unresolved", asset_type: "workflow", workflow_profile: { representation: "unresolved", coordination: "explicit", template_ref: null } }),
  assetCandidate({ asset_id: "agent.missing", missing_information: ["auth"] })
]) {
  const invalidApproved = strictAnalysisFixture();
  invalidApproved.assetCandidates.push(candidate);
  assert.ok(
    validateTargetAnalysisResult(invalidApproved).some((error) => error.includes(candidate.asset_id) && error.includes("approved")),
    `${candidate.asset_id} must not be structurally accepted as approved while unresolved`
  );
}

const invalidAgentConnection = assetCandidate({ connection: { transport: "http" } });
assert.ok(validateAgainstSchema(invalidAgentConnection, "asset-candidate.schema.json", "candidate").length > 0);
const invalidAgentConnectionAnalysis = strictAnalysisFixture();
invalidAgentConnectionAnalysis.assetCandidates[1] = invalidAgentConnection;
assert.ok(validateTargetAnalysisResult(invalidAgentConnectionAnalysis).some((error) => error.includes("binding이 null일 때 null")));

const candidateMismatch = strictAnalysisFixture();
candidateMismatch.assetCandidates[0] = {
  ...candidateMismatch.assetCandidates[0],
  source_requirement_id: "req-other"
};
assert.ok(
  validateTargetAnalysisResult(candidateMismatch).includes(
    "assetCandidates[0].source_requirement_id는 normalizedRequirement.id와 일치해야 합니다."
  ),
  "candidate source_requirement_id mismatch must be rejected"
);

const graphMismatch = strictAnalysisFixture();
graphMismatch.graph = {
  ...graphMismatch.graph,
  source_requirement_id: "req-other"
};
assert.ok(
  validateTargetAnalysisResult(graphMismatch).includes(
    "graph.source_requirement_id는 normalizedRequirement.id와 일치해야 합니다."
  ),
  "graph source_requirement_id mismatch must be rejected"
);

const extraTopLevelKey = {
  ...strictAnalysisFixture(),
  a2a_contracts: []
};
assert.ok(
  validateTargetAnalysisResult(extraTopLevelKey).includes(
    "AnalysisResult.a2a_contracts는 허용되지 않는 필드입니다."
  ),
  "cross-field validation must preserve exact-key strictness"
);

const duplicateNode = strictAnalysisFixture();
duplicateNode.graph.nodes.push({ ...duplicateNode.graph.nodes[0] });
assert.ok(
  validateTargetAnalysisResult(duplicateNode).includes(
    "graph.nodes[3].id node-input가 중복됩니다."
  ),
  "duplicate Graph node IDs must be rejected"
);

const duplicateEdge = strictAnalysisFixture();
duplicateEdge.graph.edges.push({ ...duplicateEdge.graph.edges[0] });
assert.ok(
  validateTargetAnalysisResult(duplicateEdge).includes(
    "graph.edges[2].id edge-001가 중복됩니다."
  ),
  "duplicate Graph edge IDs must be rejected"
);

const validRegion = {
  id: "region-a",
  kind: "parallel" as const,
  node_ids: ["node-agent"],
  entry_node_ids: ["node-agent"],
  exit_node_ids: ["node-agent"],
  parent_region_id: null
};

const duplicateRegion = strictAnalysisFixture();
duplicateRegion.graph.regions.push(validRegion, { ...validRegion });
assert.ok(
  validateTargetAnalysisResult(duplicateRegion).includes(
    "graph.regions[1].id region-a가 중복됩니다."
  ),
  "duplicate Graph region IDs must be rejected"
);

const uncontainedRegionBoundary = strictAnalysisFixture();
uncontainedRegionBoundary.graph.regions.push({
  ...validRegion,
  node_ids: ["node-agent"],
  entry_node_ids: ["node-input"],
  exit_node_ids: ["node-output"]
});
const uncontainedErrors = validateTargetAnalysisResult(uncontainedRegionBoundary);
assert.ok(
  uncontainedErrors.includes(
    "graph.regions[0].entry_node_ids는 node_ids에 포함된 Node만 가리켜야 합니다."
  ),
  "Region entry nodes must be contained in node_ids"
);
assert.ok(
  uncontainedErrors.includes(
    "graph.regions[0].exit_node_ids는 node_ids에 포함된 Node만 가리켜야 합니다."
  ),
  "Region exit nodes must be contained in node_ids"
);

const danglingParent = strictAnalysisFixture();
danglingParent.graph.regions.push({ ...validRegion, parent_region_id: "region-missing" });
assert.ok(
  validateTargetAnalysisResult(danglingParent).includes(
    "graph.regions[0].parent_region_id가 존재하지 않는 Region을 가리킵니다."
  ),
  "dangling parent_region_id must be rejected"
);

const cyclicParents = strictAnalysisFixture();
cyclicParents.graph.regions.push(
  { ...validRegion, id: "region-a", parent_region_id: "region-b" },
  { ...validRegion, id: "region-b", parent_region_id: "region-a" }
);
const cyclicErrors = validateTargetAnalysisResult(cyclicParents);
for (const regionId of ["region-a", "region-b"]) {
  assert.ok(
    cyclicErrors.includes(
      `graph.regions ${regionId}의 parent_region_id 체인이 순환합니다.`
    ),
    `cyclic parent_region_id must be rejected for ${regionId}`
  );
}

const duplicateRuntimeContract = strictAnalysisFixture();
duplicateRuntimeContract.runtimeContracts.push(runtimeContract(), runtimeContract());
assert.ok(
  validateTargetAnalysisResult(duplicateRuntimeContract).includes(
    "runtimeContracts[1].contract_id runtime-agent-reviewer-context-manager가 중복됩니다."
  ),
  "duplicate runtime contract IDs must be rejected"
);

const danglingRuntimeAsset = strictAnalysisFixture();
danglingRuntimeAsset.runtimeContracts.push(runtimeContract({ asset_id: "agent.missing" }));
assert.ok(
  validateTargetAnalysisResult(danglingRuntimeAsset).includes(
    "runtimeContracts[0].asset_id agent.missing가 존재하지 않는 assetCandidate를 가리킵니다."
  ),
  "non-null runtime contract asset IDs must reference an existing candidate"
);

const globalRuntimeContract = strictAnalysisFixture();
globalRuntimeContract.runtimeContracts.push(runtimeContract({ asset_id: null }));
assert.deepEqual(
  validateTargetAnalysisResult(globalRuntimeContract),
  [],
  "null runtime contract asset IDs remain valid for global contracts"
);

const unstructuredAsyncResume = strictAnalysisFixture();
unstructuredAsyncResume.runtimeContracts.push(runtimeContract({
  contract_id: "runtime-workflow-review-async-resume",
  contract_kind: "async_resume",
  asset_id: "workflow.review",
  contract_status: "approved",
  runtime_support: {
    context_manager_required: true,
    callback_broker_required: false,
    human_approval_required: true,
    idempotency_required: true,
    audit_required: true,
    compensation_required: false
  },
  operation: {
    operation_type: "approval",
    side_effect_level: "write",
    callback_expected: false,
    async_resume_required: true
  }
}));
const unstructuredAsyncResumeErrors = validateTargetAnalysisResult(unstructuredAsyncResume);
assert.ok(
  unstructuredAsyncResumeErrors.some((error) => error.includes("resume_policy")),
  "approved async_resume contracts must define a typed resume_policy"
);
assert.ok(
  unstructuredAsyncResumeErrors.some((error) => error.includes("side_effect_guard")),
  "idempotent approved async_resume contracts must define a typed side_effect_guard"
);

const structuredAsyncResume = JSON.parse(readFileSync(
  new URL("../../../../templates/skill-scenarios/S11-human-input-resume/context/analysis-result.json", import.meta.url),
  "utf8"
));
assert.deepEqual(
  validateAgainstSchema(structuredAsyncResume, "analysis-result.schema.json", "S11 analysis result"),
  [],
  "the reviewed S11 async-resume artifact must remain schema-valid"
);
assert.deepEqual(
  validateTargetAnalysisResult(structuredAsyncResume),
  [],
  "the reviewed S11 async-resume artifact must remain semantically valid"
);

const danglingHumanResume = structuredClone(structuredAsyncResume);
danglingHumanResume.runtimeContracts[0].graph_ir_annotations.human_input_node_id = "node-missing-human";
assert.ok(
  validateTargetAnalysisResult(danglingHumanResume).some((error) => error.includes("Human Input Node")),
  "approved async-resume contracts must reference an existing Human Input Node"
);

const danglingToolResume = structuredClone(structuredAsyncResume);
danglingToolResume.runtimeContracts[0].graph_ir_annotations.side_effect_tool_node_id = "node-missing-tool";
assert.ok(
  validateTargetAnalysisResult(danglingToolResume).some((error) => error.includes("side_effect_guard.tool_ref")),
  "approved guarded side effects must reference the matching Tool Node"
);

const duplicateInterruptResume = structuredClone(structuredAsyncResume);
duplicateInterruptResume.runtimeContracts.push({
  ...structuredClone(duplicateInterruptResume.runtimeContracts[0]),
  contract_id: "rtc-s11-async-resume-copy",
  title: "Synthetic Human Input duplicate interrupt contract"
});
assert.ok(
  validateTargetAnalysisResult(duplicateInterruptResume).some((error) => error.includes("interrupt_id") && error.includes("중복")),
  "approved async-resume interrupt IDs must be unique within an analysis result"
);

const mismatchedA2AOwner = createA2AContractForCandidate(strictAnalysisFixture(), "agent.reviewer");
mismatchedA2AOwner.assetCandidates.push(assetCandidate({ asset_id: "agent.other", name: "Other Agent" }));
mismatchedA2AOwner.a2aContracts[0] = {
  ...mismatchedA2AOwner.a2aContracts[0],
  agent_ref: "agent.other"
};
const mismatchedA2AErrors = validateTargetAnalysisResult(mismatchedA2AOwner);
assert.ok(
  mismatchedA2AErrors.includes(
    "assetCandidates agent.reviewer.binding.contract_ref a2a-001의 A2A contract agent_ref는 같은 Agent여야 합니다."
  ),
  "an Agent A2A binding must reference a contract owned by that Agent"
);

const legacyA2A = createA2AContractForCandidate(strictAnalysisFixture(), "agent.reviewer");
assert.deepEqual(validateAgainstSchema(legacyA2A.a2aContracts[0], "a2a-contract.schema.json", "contract"), []);

const dottedA2A = structuredClone(legacyA2A);
dottedA2A.a2aContracts[0] = { ...dottedA2A.a2aContracts[0]!, contract_id: "a2a.document-review.v1" };
dottedA2A.assetCandidates = dottedA2A.assetCandidates.map((candidate) => candidate.asset_id === "agent.reviewer" ? {
  ...candidate,
  binding: { kind: "a2a", contract_ref: "a2a.document-review.v1" },
  exposure: { protocol: "a2a", contract_ref: "a2a.document-review.v1" }
} : candidate);
assert.deepEqual(validateTargetAnalysisResult(dottedA2A), []);
assert.deepEqual(validateAgainstSchema(dottedA2A.a2aContracts[0], "a2a-contract.schema.json", "contract"), []);

const malformedA2A = structuredClone(dottedA2A);
malformedA2A.a2aContracts[0] = { ...malformedA2A.a2aContracts[0]!, contract_id: "a2a_document_review" };
malformedA2A.assetCandidates = malformedA2A.assetCandidates.map((candidate) => candidate.asset_id === "agent.reviewer" ? {
  ...candidate,
  binding: { kind: "a2a", contract_ref: "a2a_document_review" },
  exposure: { protocol: "a2a", contract_ref: "a2a_document_review" }
} : candidate);
assert.ok(validateTargetAnalysisResult(malformedA2A).some((error) => error.includes("contract_id") && error.includes("문법")));
assert.ok(validateAgainstSchema(malformedA2A.a2aContracts[0], "a2a-contract.schema.json", "contract").length > 0);

const nonHttpA2A = structuredClone(legacyA2A);
nonHttpA2A.assetCandidates = nonHttpA2A.assetCandidates.map((candidate) => candidate.asset_id === "agent.reviewer"
  ? { ...candidate, connection: { transport: "stdio" } }
  : candidate);
const nonHttpCandidate = nonHttpA2A.assetCandidates.find((candidate) => candidate.asset_id === "agent.reviewer")!;
assert.ok(validateTargetAnalysisResult(nonHttpA2A).some((error) => error.includes("a2a") && error.includes("http")));
assert.ok(validateAgainstSchema(nonHttpCandidate, "asset-candidate.schema.json", "candidate").length > 0);
assert.ok(
  mismatchedA2AErrors.includes(
    "assetCandidates agent.reviewer.exposure.contract_ref a2a-001의 A2A contract agent_ref는 같은 Agent여야 합니다."
  ),
  "an Agent A2A exposure must reference a contract owned by that Agent"
);

const orphanA2AContract = createA2AContractForCandidate(strictAnalysisFixture(), "agent.reviewer");
orphanA2AContract.assetCandidates = orphanA2AContract.assetCandidates.map((candidate) =>
  candidate.asset_id === "agent.reviewer" ? { ...candidate, binding: null, exposure: null } : candidate
);
assert.ok(
  validateTargetAnalysisResult(orphanA2AContract).includes(
    "a2aContracts a2a-001는 agent_ref Agent의 binding 또는 exposure에서 참조되어야 합니다."
  ),
  "every A2A contract must be referenced by its owning Agent"
);
