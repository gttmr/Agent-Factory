import { QueryClient } from "@tanstack/react-query";
import type { CatalogHubEntry } from "../../catalog/catalogIndex.ts";
import type { AnalysisResult, GraphEdge, GraphIR, GraphNode } from "../../analyzer/types.ts";
import { createDesignWorkbenchActions } from "./designWorkbenchActions.ts";
import type { DesignBottomTab } from "../../design/designWorkbenchTabs.ts";

type MutationOptions = {
  readonly onSuccess?: () => void;
  readonly onError?: (error: unknown) => void;
};

type TestNodeInput = {
  readonly id: string;
  readonly label: string;
  readonly kind: GraphNode["node_kind"];
  readonly laneId: GraphNode["lane_id"];
  readonly inputPorts?: GraphNode["input_ports"];
  readonly outputPorts?: GraphNode["output_ports"];
  readonly runtimeBinding?: GraphNode["runtime_binding"];
  readonly invokeBinding?: GraphNode["invoke_binding"];
  readonly decisionOwner?: GraphNode["decision_owner"];
};

function testNode(input: TestNodeInput): GraphNode {
  return {
    id: input.id,
    label: input.label,
    module_id: null,
    node_kind: input.kind,
    execution_kind: null,
    adk_node_role: "synthetic",
    owner_scope: "local",
    container_id: "container-root",
    lane_id: input.laneId,
    input_ports: input.inputPorts ?? [],
    output_ports: input.outputPorts ?? [],
    schema_refs: [],
    review_status: "n/a",
    position: null,
    runtime_binding: input.runtimeBinding ?? "unresolved",
    invoke_binding: input.invokeBinding ?? "unresolved",
    decision_owner: input.decisionOwner ?? "system",
    call_control: "none",
    side_effect: "none",
    policy: "none"
  };
}

function inputOutputEdge(): GraphEdge {
  return {
    id: "edge-input-output",
    from: "node-input",
    to: "node-output",
    from_port: "node-input:out",
    to_port: "node-output:in",
    edge_kind: "event_message",
    execution_semantics: "normal_transition",
    data_label: "message",
    schema_ref: null,
    route_condition: null,
    state_key: null,
    artifact_key: null,
    a2a_contract_id: null,
    is_remote_boundary_crossing: false,
    flow_kind: "sequence",
    call_control: "none"
  };
}

function baseGraph(): GraphIR {
  return {
    requirement_id: "req-consumer",
    graph_id: "graph-consumer",
    root_workflow_module_id: null,
    nodes: [
      testNode({
        id: "node-input",
        label: "Input",
        kind: "input",
        laneId: "input",
        outputPorts: [{ id: "node-input:out", label: "message", schema_ref: null }],
        runtimeBinding: "ui_input",
        invokeBinding: "ui_input",
        decisionOwner: "human"
      }),
      testNode({
        id: "node-output",
        label: "Output",
        kind: "output",
        laneId: "output",
        inputPorts: [{ id: "node-output:in", label: "result", schema_ref: null }]
      })
    ],
    edges: [inputOutputEdge()],
    containers: [
      {
        id: "container-root",
        module_id: null,
        label: "Root graph workflow",
        container_kind: "graph_workflow",
        adk_mapping: null,
        contains_node_ids: ["node-input", "node-output"],
        entry_node_ids: ["node-input"],
        exit_node_ids: ["node-output"],
        layout_policy: "dag_with_routes",
        parent_container_id: null
      }
    ],
    lanes: [
      { id: "input", label: "input" },
      { id: "local_graph", label: "local_graph" },
      { id: "output", label: "output" }
    ],
    validation: { ok: true, errors: [], warnings: [] }
  };
}

export function baseAnalysis(): AnalysisResult {
  return {
    normalizedRequirement: {
      id: "req-consumer",
      title: "Consumer",
      raw_text: "Insert workflow from catalog.",
      domain: "공통",
      requester: { team: "Workbench", role: "reviewer" },
      business_goal: "Use a catalog workflow",
      current_process: [],
      inputs: [],
      outputs: [],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "reviewed"
    },
    evidence: {
      requested_goal: "Insert workflow from catalog.",
      business_domain_hint: "공통",
      user_role: "reviewer",
      input_data: [],
      output_data: [],
      systems_mentioned: [],
      decisions_implied: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      assumptions: []
    },
    moduleCandidates: [],
    a2aContracts: [],
    runtimeContracts: [],
    processFlow: baseGraph()
  };
}

export function normalWorkflowEntry(): CatalogHubEntry {
  return {
    id: "workflow:Local Review",
    category: "workflow",
    name: "Local Review",
    workflow_kind: "graph",
    owner_domain: "공통",
    version: 1,
    status: "published",
    responsibility: "Insert as a local workflow_call node.",
    inputs: [{ name: "message", type: "string", required: true }],
    outputs: [{ name: "decision", type: "string", required: true }]
  };
}

export function remoteWorkflowEntry(): CatalogHubEntry {
  return {
    ...normalWorkflowEntry(),
    id: "workflow:Remote Provider Facade",
    name: "Remote Provider Facade",
    runtime_binding: "remote_a2a",
    a2a_provider_req_id: "req-provider"
  };
}

export function createActionsHarness(analysis: AnalysisResult) {
  let actionMessage: string | null = null;
  let selectedReviewModuleId: string | null = null;
  let selectedA2AModuleId: string | null = null;
  let activeTab: DesignBottomTab = "modules";
  let pickerOpen = true;
  const savedAnalyses: AnalysisResult[] = [];
  const actions = createDesignWorkbenchActions({
    reqId: "req-consumer",
    analysis,
    runtimeContracts: analysis.runtimeContracts ?? [],
    a2aContracts: analysis.a2aContracts ?? [],
    queryClient: new QueryClient(),
    setActionMessage: (message) => {
      actionMessage = message;
    },
    setSelectedA2AModuleId: (id) => {
      selectedA2AModuleId = id;
    },
    setSelectedReviewModuleId: (id) => {
      selectedReviewModuleId = id;
    },
    setActiveTab: (tab) => {
      activeTab = tab;
    },
    setCatalogWorkflowPickerOpen: (open) => {
      pickerOpen = open;
    },
    saveAnalysis: (next, options: MutationOptions) => {
      savedAnalyses.push(next);
      options.onSuccess?.();
    },
    approveGate: (_gate, _value, options: MutationOptions) => {
      options.onSuccess?.();
    }
  });
  return {
    actions,
    get actionMessage() {
      return actionMessage;
    },
    get selectedReviewModuleId() {
      return selectedReviewModuleId;
    },
    get selectedA2AModuleId() {
      return selectedA2AModuleId;
    },
    get activeTab() {
      return activeTab;
    },
    get pickerOpen() {
      return pickerOpen;
    },
    savedAnalyses
  };
}

export async function withAgentCardFetch<T>(response: Response | Error, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    if (response instanceof Error) throw response;
    return response;
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}
