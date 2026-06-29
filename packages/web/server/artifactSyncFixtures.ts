import { join } from "node:path";
import type { AnalysisResult, GraphIR, ScaffoldPlan } from "../src/analyzer/types.ts";
import { type ArtifactTestRequest, createRoot, writeJson } from "./artifactSyncTestHarness.ts";

export async function writeSyncReadyRoot(request: ArtifactTestRequest, root: string, reqId: string): Promise<void> {
  await createRoot(request, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const analysis = driftAnalysisResult(reqId);
  const staleProcessFlow = staleGraphVersion(reqId);
  await writeJson(join(rootDir, "analysis-result.json"), analysis);
  await writeJson(join(rootDir, "normalized-requirement.json"), analysis.normalizedRequirement);
  await writeJson(join(rootDir, "module-candidates.json"), analysis.moduleCandidates);
  await writeJson(join(rootDir, "process-flow.json"), staleProcessFlow);
  await writeJson(join(rootDir, "scaffold-plan.json"), staleScaffoldPlan(reqId, staleProcessFlow));
}

export function driftAnalysisResult(reqId: string): AnalysisResult {
  const processFlow = graphVersion(reqId, "graph-002", "node-reviewed-agent", "Reviewed graph version B");
  return {
    normalizedRequirement: {
      id: reqId,
      title: "Artifact sync drift regression",
      raw_text: "Keep split artifacts synchronized with the reviewed analysis graph.",
      domain: "workbench",
      requester: { team: "platform", role: "developer" },
      business_goal: "Prevent stale split artifacts from overriding reviewed Graph IR.",
      current_process: ["Review analysis graph", "Regenerate derived artifacts"],
      inputs: [{ name: "reviewed_graph", type: "json", required: true }],
      outputs: [{ name: "synced_artifacts", type: "json", required: true }],
      systems: [],
      risk_signals: ["audit_required"],
      missing_information: [],
      contradictions: [],
      status: "approved"
    },
    evidence: {
      requested_goal: "Sync derived artifact files from analysis-result.json.",
      business_domain_hint: "workbench",
      user_role: "developer",
      input_data: ["analysis-result.json.processFlow"],
      output_data: ["process-flow.json", "scaffold-plan.json"],
      systems_mentioned: [],
      decisions_implied: ["analysis-result.json is canonical"],
      risk_signals: ["audit_required"],
      missing_information: [],
      contradictions: [],
      assumptions: ["artifact sync does not mutate approval gates"]
    },
    moduleCandidates: [
      {
        id: "mod-reviewed",
        source_requirement_id: reqId,
        name: "reviewed_graph_agent",
        module_category: "agent",
        agent_kind: "specialist",
        workflow_kind: null,
        adapter_kind: null,
        remote_contract_kind: null,
        legacy_recommended_type: "specialist_agent",
        confidence: 0.91,
        rationale: "Single reviewed agent node used to detect process-flow drift.",
        adk_hints: {
          state_memory: "session_state carries reviewed_graph",
          callbacks: null,
          artifacts_events: "emits synced_artifacts",
          mcp_a2a: null,
          streaming_grounding: null
        },
        inputs: [{ name: "reviewed_graph", type: "json", required: true }],
        outputs: [{ name: "synced_artifacts", type: "json", required: true }],
        reuse_candidate: false,
        risk_level: "low",
        risk_signals: ["audit_required"],
        status: "approved",
        missing_information: [],
        side_effect: "none",
        auth_required: false,
        audit_required: true,
        citation_required: false,
        grounding_required: false,
        source_acl_required: false,
        versioned: false,
        effective_date_required: false,
        owner_domain: "workbench",
        owner: null,
        agent_card: null,
        auth: null,
        task_lifecycle: null,
        timeout: null,
        retry: null,
        fallback: null,
        audit: null,
        data_policy: null,
        a2a_contract_id: null
      }
    ],
    a2aContracts: [],
    runtimeContracts: [],
    processFlow
  };
}

export function staleGraphVersion(reqId: string): GraphIR {
  return graphVersion(reqId, "graph-001", "node-stale-agent", "Stale split graph version A");
}

export function staleScaffoldPlan(reqId: string, processFlow: GraphIR): ScaffoldPlan {
  return {
    requirement_id: reqId,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    output_mode: "smoke",
    modules: [
      {
        id: "mod-reviewed",
        name: "reviewed_graph_agent",
        module_category: "agent",
        agent_kind: "specialist",
        workflow_kind: null,
        adapter_kind: null,
        remote_contract_kind: null,
        scaffold_output: "Smoke TODO stub for artifact sync drift regression.",
        no_runnable_business_logic: true,
        developer_todos: ["Keep derived artifacts synchronized from analysis-result.json."],
        inputs: [{ name: "reviewed_graph", type: "json", required: true }],
        outputs: [{ name: "synced_artifacts", type: "json", required: true }],
        risk_signals: ["audit_required"],
        required_review_fields: []
      }
    ],
    runtime_contracts: [],
    excluded_modules: [],
    graph: {
      nodes: processFlow.nodes.map((node) => ({
        id: node.id,
        module_id: node.module_id,
        node_kind: node.node_kind,
        invoke_binding: node.node_kind === "agent" ? "unresolved" : "ui_input",
        decision_owner: "workflow_code",
        call_control: "fixed_by_workflow",
        side_effect: "none",
        policy: "none",
        human_input_contract: null
      })),
      edges: processFlow.edges.map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        edge_kind: edge.edge_kind,
        schema_ref: edge.schema_ref,
        route_condition: edge.route_condition,
        route_aliases: [],
        is_default_route: false,
        state_key: edge.state_key,
        artifact_key: edge.artifact_key,
        flow_kind: "sequence",
        call_control: "fixed_by_workflow"
      }))
    },
    manifest: {
      catalog_bound_modules: [],
      new_code_required: [
        {
          module_id: "mod-reviewed",
          module_name: "reviewed_graph_agent",
          reason: "No catalog binding is selected for this regression fixture.",
          developer_todos: ["Keep derived artifacts synchronized from analysis-result.json."]
        }
      ]
    },
    validation: { can_generate_source: true, blockers: [], warnings: [] }
  };
}

function graphVersion(reqId: string, graphId: string, agentNodeId: string, agentLabel: string): GraphIR {
  return {
    requirement_id: reqId,
    graph_id: graphId,
    root_workflow_module_id: null,
    nodes: [
      graphNode("node-input", null, "input", "input", "reviewed_graph"),
      graphNode(agentNodeId, "mod-reviewed", "agent", "local_graph", agentLabel),
      graphNode("node-output", null, "output", "output", "synced_artifacts")
    ],
    edges: [
      graphEdge("edge-input-agent", "node-input", agentNodeId),
      graphEdge("edge-agent-output", agentNodeId, "node-output")
    ],
    containers: [
      {
        id: "container-root",
        module_id: null,
        label: "Root graph workflow",
        container_kind: "graph_workflow",
        adk_mapping: "GraphWorkflow",
        contains_node_ids: ["node-input", agentNodeId, "node-output"],
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

function graphNode(
  id: string,
  moduleId: string | null,
  nodeKind: "input" | "agent" | "output",
  laneId: "input" | "local_graph" | "output",
  label: string
): GraphIR["nodes"][number] {
  return {
    id,
    module_id: moduleId,
    label,
    node_kind: nodeKind,
    execution_kind: nodeKind === "agent" ? "llm_agent" : "io",
    agent_execution_mode: nodeKind === "agent" ? "single_turn" : null,
    adk_node_role: nodeKind === "agent" ? "workflow_node" : "synthetic",
    owner_scope: "local",
    container_id: "container-root",
    lane_id: laneId,
    input_ports: [],
    output_ports: [],
    schema_refs: [],
    review_status: "approved"
  };
}

function graphEdge(id: string, from: string, to: string): GraphIR["edges"][number] {
  return {
    id,
    from,
    to,
    from_port: null,
    to_port: null,
    edge_kind: "event_output",
    execution_semantics: "normal_transition",
    data_label: id,
    schema_ref: null,
    route_condition: null,
    state_key: null,
    artifact_key: null,
    a2a_contract_id: null,
    is_remote_boundary_crossing: false
  };
}
