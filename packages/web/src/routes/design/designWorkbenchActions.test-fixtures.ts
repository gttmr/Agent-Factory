import { QueryClient } from "@tanstack/react-query";
import type { AnalysisResult } from "../../analyzer/types.ts";
import type { CatalogHubEntry } from "../../catalog/catalogIndex.ts";
import type { DesignBottomTab } from "../../design/designWorkbenchTabs.ts";
import { createDesignWorkbenchActions } from "./designWorkbenchActions.ts";

export type MutationOptions = { onSuccess?: () => void; onError?: (error: unknown) => void };

export function baseAnalysis(): AnalysisResult {
  return {
    contract_version: "2.0",
    normalizedRequirement: {
      id: "req-consumer", title: "Consumer", raw_text: "test", domain: "공통",
      requester: { team: "test", role: "reviewer" }, business_goal: "test", current_process: [], inputs: [], outputs: [], systems: [],
      risk_signals: [], missing_information: [], contradictions: [], status: "reviewed"
    },
    evidence: {
      requested_goal: "test", business_domain_hint: "공통", user_role: "reviewer", input_data: [], output_data: [], systems_mentioned: [],
      decisions_implied: [], risk_signals: [], missing_information: [], contradictions: [], assumptions: []
    },
    assetCandidates: [
      {
        asset_id: "workflow.root", source_requirement_id: "req-consumer", catalog_entry_id: null, name: "Root Workflow",
        asset_type: "workflow", domain_scope: "domain_neutral", business_domains: [], owner: "test", reuse_status: "project_only",
        capability_tags: [], binding: null, connection: null, workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
        exposure: null, confidence: 1, rationale: "root", inputs: [], outputs: [], risk_level: "low", risk_signals: [], status: "approved", missing_information: []
      },
      {
        asset_id: "agent.local", source_requirement_id: "req-consumer", catalog_entry_id: null, name: "Local Agent",
        asset_type: "agent", domain_scope: "domain_neutral", business_domains: [], owner: "test", reuse_status: "project_only",
        capability_tags: [], binding: null, connection: null, workflow_profile: null, exposure: null, confidence: 1,
        rationale: "agent", inputs: [], outputs: [], risk_level: "low", risk_signals: [], status: "approved", missing_information: []
      }
    ],
    a2aContracts: [], runtimeContracts: [],
    graph: {
      graph_id: "graph-consumer", source_requirement_id: "req-consumer", workflow_ref: "workflow.root",
      nodes: [{ id: "agent-local", label: "Local Agent", node_kind: "agent", agent_ref: "agent.local", available_tools: [] }],
      edges: [], regions: []
    }
  };
}

export function normalWorkflowEntry(): CatalogHubEntry {
  return {
    asset_id: "workflow.catalog-risk", asset_type: "workflow", name: "Risk Workflow", domain_scope: "cross_domain",
    business_domains: [], owner: "catalog", reuse_status: "reuse_existing", capability_tags: ["risk"], binding: null, connection: null,
    workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null }, exposure: null,
    responsibility: "Reusable risk workflow", inputs: [{ name: "message", type: "string", required: true }], outputs: []
  };
}

export function createActionsHarness(analysis: AnalysisResult) {
  let actionMessage: string | null = null;
  let selectedReviewAssetId: string | null = null;
  let selectedA2AAssetId: string | null = null;
  let activeTab: DesignBottomTab = "assets";
  let pickerOpen = true;
  const savedAnalyses: AnalysisResult[] = [];
  const actions = createDesignWorkbenchActions({
    reqId: "req-consumer", analysis, runtimeContracts: analysis.runtimeContracts, a2aContracts: analysis.a2aContracts,
    queryClient: new QueryClient(), setActionMessage: (message) => { actionMessage = message; },
    setSelectedA2AAssetId: (id) => { selectedA2AAssetId = id; },
    setSelectedReviewAssetId: (id) => { selectedReviewAssetId = id; },
    setActiveTab: (tab) => { activeTab = tab; }, setCatalogWorkflowPickerOpen: (open) => { pickerOpen = open; },
    saveAnalysis: (next, options: MutationOptions) => { savedAnalyses.push(next); options.onSuccess?.(); },
    approveGate: (_gate, _value, options: MutationOptions) => options.onSuccess?.()
  });
  return {
    actions, savedAnalyses,
    get actionMessage() { return actionMessage; }, get selectedReviewAssetId() { return selectedReviewAssetId; },
    get selectedA2AAssetId() { return selectedA2AAssetId; }, get activeTab() { return activeTab; }, get pickerOpen() { return pickerOpen; }
  };
}
