import assert from "node:assert/strict";
import type { CatalogHubEntry } from "../catalog/catalogIndex.ts";
import { insertCatalogWorkflowNode, pruneDetachedCatalogWorkflowCandidates } from "./nestedWorkflowInsert.ts";
import { strictAnalysisFixture } from "./targetContract.testFixture.ts";

const entry = {
  id: "workflow.fraud-review",
  category: "workflow",
  asset_id: "workflow.fraud-review",
  asset_type: "workflow",
  name: "Fraud review",
  domain_scope: "cross_domain",
  business_domains: ["카드", "리스크"],
  owner: "risk-platform",
  reuse_status: "reuse_existing",
  capability_tags: ["fraud-review"],
  binding: null,
  connection: null,
  workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
  exposure: null,
  inputs: [],
  outputs: [],
  risk_signals: []
} as CatalogHubEntry;

const inserted = insertCatalogWorkflowNode(strictAnalysisFixture(), entry);
assert.equal(inserted.assetCandidates[inserted.assetCandidates.length - 1]?.asset_id, "workflow.fraud-review");
assert.equal(inserted.graph.nodes[inserted.graph.nodes.length - 1]?.node_kind, "subworkflow");

const detached = { ...inserted, graph: { ...inserted.graph, nodes: inserted.graph.nodes.filter((node) => node.node_kind !== "subworkflow") } };
assert.equal(pruneDetachedCatalogWorkflowCandidates(detached).assetCandidates.some((candidate) => candidate.asset_id === "workflow.fraud-review"), false);
assert.equal(pruneDetachedCatalogWorkflowCandidates(inserted).assetCandidates.some((candidate) => candidate.asset_id === "workflow.fraud-review"), true);
console.log("nested Workflow Target insertion tests passed");
