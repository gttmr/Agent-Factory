import assert from "node:assert/strict";
import { baseAnalysis, createActionsHarness, normalWorkflowEntry } from "./designWorkbenchActions.test-fixtures.ts";

const insertHarness = createActionsHarness(baseAnalysis());
await insertHarness.actions.insertCatalogWorkflow(normalWorkflowEntry());
assert.equal(insertHarness.savedAnalyses.length, 1);
const insertedAnalysis = insertHarness.savedAnalyses[0];
const workflowAsset = insertedAnalysis.assetCandidates[insertedAnalysis.assetCandidates.length - 1];
const workflowNode = insertedAnalysis.graph.nodes.find((node) => node.node_kind === "subworkflow" && node.workflow_ref === workflowAsset?.asset_id);
assert.equal(workflowAsset?.asset_type, "workflow");
assert.equal(workflowNode?.node_kind, "subworkflow");
assert.equal(insertHarness.selectedReviewAssetId, workflowAsset?.asset_id);
assert.equal(insertHarness.activeTab, "assets");
assert.equal(insertHarness.pickerOpen, false);

const graphHarness = createActionsHarness(baseAnalysis());
const nextGraph = { ...baseAnalysis().graph, regions: [{ id: "region-loop-1", kind: "loop" as const, node_ids: ["agent-local"], entry_node_ids: ["agent-local"], exit_node_ids: ["agent-local"], parent_region_id: null }] };
graphHarness.actions.saveGraphIR(nextGraph);
assert.deepEqual(graphHarness.savedAnalyses[0]?.graph, nextGraph);
assert.deepEqual(Object.keys(graphHarness.savedAnalyses[0]!.graph).sort(), ["edges", "graph_id", "nodes", "regions", "source_requirement_id", "workflow_ref"]);

const assetHarness = createActionsHarness(baseAnalysis());
const agent = baseAnalysis().assetCandidates.find((asset) => asset.asset_id === "agent.local")!;
assetHarness.actions.saveAsset(agent.asset_id, { ...agent, status: "deferred" });
assert.equal(assetHarness.savedAnalyses[0]?.assetCandidates.find((asset) => asset.asset_id === agent.asset_id)?.status, "deferred");

const a2aHarness = createActionsHarness(baseAnalysis());
a2aHarness.actions.createA2AContract(agent);
assert.equal(a2aHarness.savedAnalyses[0]?.a2aContracts[0]?.agent_ref, agent.asset_id);
assert.equal(a2aHarness.savedAnalyses[0]?.assetCandidates.find((asset) => asset.asset_id === agent.asset_id)?.binding?.kind, "a2a");
