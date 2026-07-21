import assert from "node:assert/strict";
import { buildRuntimeContracts, requiredRuntimeContractKeys, runtimeContractReadinessIssues } from "./runtimeContracts.ts";
import { buildScaffoldPlan } from "./scaffoldPlan.ts";
import { assetCandidate, runtimeContract, strictAnalysisFixture } from "./targetContract.testFixture.ts";
import type { AssetCandidate, GraphIR, RuntimeContract } from "./types.ts";

const analysis = strictAnalysisFixture();
const plan = buildScaffoldPlan({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: analysis.assetCandidates,
  graph: analysis.graph,
  runtimeContracts: []
});
assert.equal(plan.contract_version, "2.0");
assert.equal(plan.raw_requirement_to_code, false);
assert.equal(plan.assets.length, 2);
assert.equal(plan.validation.can_generate_source, true);
assert.equal("modules" in plan, false);

const emptyPlan = buildScaffoldPlan({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: [],
  graph: { ...analysis.graph, workflow_ref: null, nodes: [], edges: [], regions: [] }
});
assert.equal(emptyPlan.validation.can_generate_source, false);
assert.ok(emptyPlan.validation.blockers.some((blocker) => blocker.includes("approved Asset")));

function planFor(assetCandidates: AssetCandidate[], graph: GraphIR, runtimeContracts: RuntimeContract[] = []) {
  return buildScaffoldPlan({
    normalizedRequirement: analysis.normalizedRequirement,
    assetCandidates,
    graph,
    runtimeContracts
  });
}

const deferredWorkflow = { ...analysis.assetCandidates[0]!, status: "deferred" as const };
const deferredAgent = { ...analysis.assetCandidates[1]!, status: "deferred" as const };
const approvedTool = assetCandidate({
  asset_id: "tool.lookup",
  name: "Lookup Tool",
  asset_type: "tool",
  binding: { kind: "function" },
  connection: { transport: "in_process" }
});
const deferredTool = { ...approvedTool, status: "deferred" as const };
const approvedSubworkflow = assetCandidate({
  asset_id: "workflow.child",
  name: "Child Workflow",
  asset_type: "workflow",
  workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null }
});
const deferredSubworkflow = { ...approvedSubworkflow, status: "deferred" as const };

const referenceCases: Array<{ name: string; assets: AssetCandidate[]; graph: GraphIR; reference: string }> = [
  { name: "root Workflow", assets: [deferredWorkflow, analysis.assetCandidates[1]!], graph: analysis.graph, reference: "workflow.review" },
  { name: "Agent Node", assets: [analysis.assetCandidates[0]!, deferredAgent], graph: analysis.graph, reference: "agent.reviewer" },
  {
    name: "Tool Node",
    assets: [analysis.assetCandidates[0]!, deferredTool],
    graph: { ...analysis.graph, nodes: analysis.graph.nodes.map((node) => node.id === "node-agent" ? { id: "node-agent", label: "Lookup", node_kind: "tool", tool_ref: "tool.lookup", invocation_control: "workflow" } : node) },
    reference: "tool.lookup"
  },
  {
    name: "available Tool",
    assets: [analysis.assetCandidates[0]!, analysis.assetCandidates[1]!, deferredTool],
    graph: { ...analysis.graph, nodes: analysis.graph.nodes.map((node) => node.node_kind === "agent" ? { ...node, available_tools: [{ tool_ref: "tool.lookup", invocation_control: "agent" }] } : node) },
    reference: "tool.lookup"
  },
  {
    name: "Subworkflow Node",
    assets: [analysis.assetCandidates[0]!, deferredSubworkflow],
    graph: { ...analysis.graph, nodes: analysis.graph.nodes.map((node) => node.id === "node-agent" ? { id: "node-agent", label: "Child", node_kind: "subworkflow", workflow_ref: "workflow.child" } : node) },
    reference: "workflow.child"
  },
  {
    name: "wrong approved Asset type",
    assets: [analysis.assetCandidates[0]!, approvedTool],
    graph: { ...analysis.graph, nodes: analysis.graph.nodes.map((node) => node.node_kind === "agent" ? { ...node, agent_ref: approvedTool.asset_id } : node) },
    reference: "tool.lookup"
  }
];
for (const testCase of referenceCases) {
  const referencePlan = planFor(testCase.assets, testCase.graph);
  assert.equal(referencePlan.validation.can_generate_source, false, `${testCase.name} must resolve through the approved projection`);
  assert.ok(referencePlan.validation.blockers.some((blocker) => blocker.includes(testCase.reference)));
}

for (const unresolvedApproved of [
  assetCandidate({ binding: { kind: "unresolved" }, connection: { transport: "unknown" } }),
  assetCandidate({ binding: { kind: "function" }, connection: { transport: "unknown" } }),
  assetCandidate({
    asset_id: "workflow.review",
    asset_type: "workflow",
    workflow_profile: { representation: "unresolved", coordination: "explicit", template_ref: null }
  }),
  assetCandidate({ missing_information: ["auth"] })
]) {
  const unresolvedPlan = planFor([unresolvedApproved], {
    ...analysis.graph,
    workflow_ref: null,
    nodes: [{ id: "node-input", label: "Input", node_kind: "input" }],
    edges: [],
    regions: []
  });
  assert.equal(unresolvedPlan.validation.can_generate_source, false);
  assert.ok(unresolvedPlan.validation.blockers.some((blocker) => blocker.includes(unresolvedApproved.asset_id)));
}

const blockedCandidate = assetCandidate({ asset_id: "tool.write", asset_type: "tool", status: "needs_info", missing_information: ["auth"], binding: { kind: "mcp", server_ref: "mcp.write", tool_name: "write" }, connection: { transport: "http" }, side_effect: "write" });
const contracts = buildRuntimeContracts({ normalizedRequirement: analysis.normalizedRequirement, assetCandidates: [blockedCandidate] });
assert.equal(contracts[0]?.asset_id, "tool.write");
assert.equal(contracts[0]?.contract_kind, "mcp_connection");
assert.ok(runtimeContractReadinessIssues(contracts[0]!).length > 0);
const blockedPlan = buildScaffoldPlan({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: [analysis.assetCandidates[0]!, blockedCandidate],
  graph: analysis.graph,
  runtimeContracts: contracts,
  outputMode: "runnable"
});
assert.equal(blockedPlan.validation.can_generate_source, false);
assert.ok(blockedPlan.validation.blockers.some((blocker) => blocker.includes("정보 필요")));

const runtimeCandidate = assetCandidate({
  asset_id: "tool.runtime-boundary",
  name: "Runtime Boundary Tool",
  asset_type: "tool",
  binding: { kind: "mcp", server_ref: "mcp.runtime", tool_name: "invoke" },
  connection: { transport: "http" },
  inputs: [{ name: "change_id", type: "string", required: true }],
  side_effect: "write",
  risk_signals: ["human_approval_required", "external_message"]
});
const runtimeKeys = requiredRuntimeContractKeys({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: [runtimeCandidate, { ...approvedTool, status: "deferred" }]
});
assert.deepEqual(runtimeKeys, [
  { asset_id: "tool.runtime-boundary", contract_kind: "mcp_connection" },
  { asset_id: "tool.runtime-boundary", contract_kind: "external_connection" },
  { asset_id: "tool.runtime-boundary", contract_kind: "context_manager" },
  { asset_id: "tool.runtime-boundary", contract_kind: "adk_callback" },
  { asset_id: "tool.runtime-boundary", contract_kind: "callback_broker" },
  { asset_id: "tool.runtime-boundary", contract_kind: "async_resume" }
]);
const a2aRuntimeKeys = requiredRuntimeContractKeys({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: [
    assetCandidate({
      asset_id: "agent.remote",
      binding: { kind: "a2a", contract_ref: "a2a.remote.v1" },
      connection: { transport: "http" }
    }),
    assetCandidate({
      asset_id: "agent.provider",
      exposure: { protocol: "a2a", contract_ref: "a2a.provider.v1" }
    })
  ]
});
assert.deepEqual(a2aRuntimeKeys, [
  { asset_id: "agent.provider", contract_kind: "external_connection" },
  { asset_id: "agent.remote", contract_kind: "external_connection" }
]);
const runtimeGraph: GraphIR = {
  ...analysis.graph,
  workflow_ref: null,
  nodes: [{ id: "node-tool", label: "Runtime", node_kind: "tool", tool_ref: runtimeCandidate.asset_id, invocation_control: "workflow" }],
  edges: [],
  regions: []
};
const missingRuntimePlan = planFor([runtimeCandidate], runtimeGraph);
assert.equal(missingRuntimePlan.validation.can_generate_source, false);
for (const key of runtimeKeys) {
  assert.ok(missingRuntimePlan.validation.blockers.some((blocker) => blocker.includes(`${key.asset_id}:${key.contract_kind}`)));
}

const readyRuntimeContracts = buildRuntimeContracts({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: [runtimeCandidate]
}).map((contract) => ({
  ...contract,
  contract_status: "approved" as const,
  policies: {
    ...contract.policies,
    auth_policy: "reviewed",
    timeout_policy: "reviewed",
    retry_policy: "reviewed"
  },
  ...(contract.contract_kind === "async_resume" ? {
    identifiers: ["runtime-boundary-approval-001"],
    resume_policy: {
      interrupt_id: "runtime-boundary-approval-001",
      correlation_scope: "invocation" as const,
      timeout_seconds: 60,
      on_timeout: "expire_without_side_effect" as const,
      duplicate_response: "return_recorded_result" as const,
      conflicting_response: "reject" as const,
      restart_policy: "resume_incomplete_replay_completed" as const
    },
    side_effect_guard: {
      tool_ref: runtimeCandidate.asset_id,
      idempotency_key_input: "change_id",
      delivery_semantics: "at_most_once" as const,
      ledger_scope: "session_state" as const
    }
  } : {})
}));
assert.equal(planFor([runtimeCandidate], runtimeGraph, readyRuntimeContracts).validation.can_generate_source, true);

const unapprovedRuntimePlan = planFor(
  [runtimeCandidate],
  runtimeGraph,
  readyRuntimeContracts.map((contract, index) => index === 0 ? { ...contract, contract_status: "draft" } : contract)
);
assert.equal(unapprovedRuntimePlan.validation.can_generate_source, false);
assert.ok(unapprovedRuntimePlan.validation.blockers.some((blocker) => blocker.includes("contract_status")));

const duplicateRequiredContract = runtimeContract({
  ...readyRuntimeContracts[0],
  contract_id: `${readyRuntimeContracts[0]!.contract_id}-duplicate`
});
const duplicateRuntimePlan = planFor([runtimeCandidate], runtimeGraph, [...readyRuntimeContracts, duplicateRequiredContract]);
assert.equal(duplicateRuntimePlan.validation.can_generate_source, false);
assert.ok(duplicateRuntimePlan.validation.blockers.some((blocker) => blocker.includes("exactly once")));

const standaloneAgentPlan = planFor([analysis.assetCandidates[1]!], { ...analysis.graph, workflow_ref: null });
assert.equal(standaloneAgentPlan.validation.can_generate_source, true);
const standaloneToolPlan = planFor([approvedTool], {
  ...runtimeGraph,
  nodes: [{ id: "node-tool", label: "Lookup", node_kind: "tool", tool_ref: approvedTool.asset_id, invocation_control: "workflow" }]
});
assert.equal(standaloneToolPlan.validation.can_generate_source, true);

for (const graph of [
  { ...analysis.graph, workflow_ref: null, nodes: [{ id: "node-function", label: "Private", node_kind: "function" as const, role: "transform" as const }] },
  { ...analysis.graph, workflow_ref: null, nodes: [analysis.graph.nodes[1]!, { id: "node-tool", label: "Lookup", node_kind: "tool" as const, tool_ref: approvedTool.asset_id, invocation_control: "workflow" as const }], edges: [] },
  { ...analysis.graph, workflow_ref: null, regions: [{ id: "region-1", kind: "parallel" as const, node_ids: ["node-agent"], entry_node_ids: ["node-agent"], exit_node_ids: ["node-agent"], parent_region_id: null }] }
]) {
  const ownershipPlan = planFor([analysis.assetCandidates[1]!, approvedTool], graph as GraphIR);
  assert.equal(ownershipPlan.validation.can_generate_source, false);
  assert.ok(ownershipPlan.validation.blockers.some((blocker) => blocker.includes("owning approved Workflow")));
}

const cyclicStaticGraph = structuredClone(analysis.graph);
cyclicStaticGraph.edges.push({
  id: "edge-cycle",
  from: "node-agent",
  to: "node-agent",
  control: { kind: "next", condition: null, accepted_aliases: [], default: false },
  channel: "event"
});
const cyclicStaticPlan = buildScaffoldPlan({
  normalizedRequirement: analysis.normalizedRequirement,
  assetCandidates: analysis.assetCandidates,
  graph: cyclicStaticGraph,
  runtimeContracts: [],
  outputMode: "runnable"
});
assert.equal(cyclicStaticPlan.validation.can_generate_source, false);
assert.ok(cyclicStaticPlan.validation.blockers.some((blocker) => /representation graph.*cycle/i.test(blocker)));
console.log("Target scaffold plan tests passed");
