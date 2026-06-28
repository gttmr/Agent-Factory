import assert from "node:assert/strict";
import { mergeGraphIRValidation, normalizeGraphIRForRuntime, validateGraphIRSoft } from "./graphMigration.ts";
import type { GraphEdge, GraphIR, GraphNode } from "./types.ts";

const graph: GraphIR = {
  requirement_id: "req-position",
  graph_id: "graph-001",
  root_workflow_module_id: null,
  nodes: [
    {
      id: "node-input",
      label: "Input",
      module_id: null,
      node_kind: "input",
      execution_kind: null,
      adk_node_role: null,
      owner_scope: "local",
      container_id: null,
      lane_id: "input",
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: "n/a",
      position: { x: 123, y: 456 }
    },
    {
      id: "node-output",
      label: "Output",
      module_id: null,
      node_kind: "output",
      execution_kind: null,
      adk_node_role: null,
      owner_scope: "local",
      container_id: null,
      lane_id: "output",
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: "n/a",
      position: null
    }
  ],
  edges: [],
  containers: [],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

const normalized = normalizeGraphIRForRuntime(graph, "req-position");

assert.deepEqual(normalized.nodes[0]?.position, { x: 123, y: 456 });
assert.equal(normalized.nodes[1]?.position, null);

function graphWithNodes(nodes: GraphNode[]): GraphIR {
  return {
    requirement_id: "req-module-gate",
    graph_id: "graph-001",
    root_workflow_module_id: null,
    nodes,
    edges: [],
    containers: [],
    lanes: [],
    validation: { ok: true, errors: [], warnings: [] }
  };
}

function node(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node-agent",
    label: "Agent",
    module_id: null,
    node_kind: "agent",
    execution_kind: null,
    adk_node_role: null,
    owner_scope: "local",
    container_id: null,
    lane_id: "local_graph",
    input_ports: [],
    output_ports: [],
    schema_refs: [],
    review_status: "n/a",
    ...overrides
  };
}

const missingModule = validateGraphIRSoft(graphWithNodes([node()]));
const missingModuleErrors = missingModule.errors.filter((issue) => issue.code === "node_missing_module_id");
assert.equal(missingModuleErrors.length, 1);
assert.deepEqual(missingModuleErrors[0], {
  code: "node_missing_module_id",
  message: "Node node-agent (agent) requires a module_id.",
  target_kind: "node",
  target_id: "node-agent"
});

const lenientKinds: GraphNode["node_kind"][] = ["input", "output", "function", "tool"];
const lenientResult = validateGraphIRSoft(
  graphWithNodes(
    lenientKinds.map((nodeKind) =>
      node({
        id: `node-${nodeKind}`,
        label: nodeKind,
        node_kind: nodeKind,
        lane_id: nodeKind === "input" ? "input" : nodeKind === "output" ? "output" : "local_graph"
      })
    )
  )
);
assert.equal(lenientResult.errors.filter((issue) => issue.code === "node_missing_module_id").length, 0);

const graphSemanticsMustNotBindModules = validateGraphIRSoft(
  graphWithNodes([
    node({
      id: "node-human-input",
      label: "Approval",
      module_id: "mod-human",
      node_kind: "human_input",
      lane_id: "human_input"
    }),
    node({
      id: "node-callback-wait",
      label: "Callback",
      module_id: "mod-callback",
      node_kind: "callback_wait",
      lane_id: "local_graph",
      invoke_binding: "callback_wait",
      decision_owner: "workflow_code",
      call_control: "event_callback"
    } as Partial<GraphNode>)
  ])
);
assert.equal(
  graphSemanticsMustNotBindModules.errors.filter((issue) => issue.code === "node_kind_must_not_bind_module").length,
  2
);

const linkedModule = validateGraphIRSoft(graphWithNodes([node({ module_id: "mod-agent" })]));
assert.equal(linkedModule.errors.filter((issue) => issue.code === "node_missing_module_id").length, 0);

const chatAgentMode = validateGraphIRSoft(
  graphWithNodes([node({ module_id: "mod-agent", agent_execution_mode: "chat" })])
);
assert.equal(chatAgentMode.errors.filter((issue) => issue.code === "invalid_agent_execution_mode").length, 0);
assert.equal(chatAgentMode.errors.filter((issue) => issue.code === "agent_execution_mode_on_non_agent").length, 0);

const taskAgentMode = validateGraphIRSoft(
  graphWithNodes([node({ module_id: "mod-agent", agent_execution_mode: "task" as never })])
);
assert.equal(taskAgentMode.errors.filter((issue) => issue.code === "invalid_agent_execution_mode").length, 1);

const nonAgentMode = validateGraphIRSoft(
  graphWithNodes([node({ id: "node-input", node_kind: "input", lane_id: "input", agent_execution_mode: "chat" })])
);
assert.equal(nonAgentMode.errors.filter((issue) => issue.code === "agent_execution_mode_on_non_agent").length, 1);

function graphWithRemoteEdge(nodes: GraphNode[], edges: GraphEdge[]): GraphIR {
  return {
    requirement_id: "req-remote-link",
    graph_id: "graph-001",
    root_workflow_module_id: null,
    nodes,
    edges,
    containers: [],
    lanes: [],
    validation: {
      ok: true,
      errors: [],
      warnings: [
        {
          code: "remote_link_incoherent",
          message: "stale warning",
          target_kind: "edge",
          target_id: "edge-stale"
        }
      ]
    }
  };
}

function edge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: "edge-001",
    from: "node-input",
    to: "node-output",
    from_port: null,
    to_port: null,
    edge_kind: "remote_a2a",
    execution_semantics: "boundary_crossing",
    data_label: "",
    schema_ref: null,
    route_condition: null,
    state_key: null,
    artifact_key: null,
    a2a_contract_id: "a2a-001",
    is_remote_boundary_crossing: true,
    ...overrides
  };
}

const remoteLinkWithoutRemoteEndpoint = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-input", node_kind: "input", lane_id: "input" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [edge()]
  )
);
const remoteLinkWarnings = remoteLinkWithoutRemoteEndpoint.warnings.filter((issue) => issue.code === "remote_link_incoherent");
assert.equal(remoteLinkWarnings.length, 1);
assert.deepEqual(remoteLinkWarnings[0], {
  code: "remote_link_incoherent",
  message: "Remote edge edge-001 should connect to a remote agent node with module_id.",
  target_kind: "edge",
  target_id: "edge-001"
});

const coherentRemoteLink = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-input", node_kind: "input", lane_id: "input" }),
      node({ id: "node-remote", node_kind: "remote_a2a", module_id: "mod-remote", owner_scope: "remote", lane_id: "remote_boundary" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({ to: "node-remote" }),
      edge({
        id: "edge-002",
        from: "node-remote",
        to: "node-output",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false
      })
    ]
  )
);
assert.equal(coherentRemoteLink.warnings.filter((issue) => issue.code === "remote_link_incoherent").length, 0);

const merged = mergeGraphIRValidation(
  graphWithRemoteEdge(
    [
      node({ id: "node-input", node_kind: "input", lane_id: "input" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [edge()]
  ).validation,
  remoteLinkWithoutRemoteEndpoint
);
assert.equal(merged.warnings.filter((issue) => issue.code === "remote_link_incoherent").length, 1);

const mergedWithoutStaleModuleConnectivityWarnings = mergeGraphIRValidation(
  {
    ok: false,
    errors: [],
    warnings: [
      {
        code: "module_node_missing_incoming",
        message: "stale missing incoming warning",
        target_kind: "node",
        target_id: "node-agent"
      },
      {
        code: "module_node_missing_outgoing",
        message: "stale missing outgoing warning",
        target_kind: "node",
        target_id: "node-agent"
      }
    ]
  },
  { errors: [], warnings: [] }
);
assert.deepEqual(
  mergedWithoutStaleModuleConnectivityWarnings.warnings.map((issue) => issue.code),
  []
);

const graphWithControlMetadata: GraphIR = {
  requirement_id: "req-control-metadata",
  graph_id: "graph-001",
  root_workflow_module_id: null,
  nodes: [
    node({
      id: "node-callback-wait",
      label: "Wait for callback",
      node_kind: "callback_wait",
      lane_id: "local_graph",
      invoke_binding: "callback_wait",
      decision_owner: "workflow_code",
      call_control: "event_callback",
      side_effect: "none",
      policy: "callback_resume_required"
    } as Partial<GraphNode>),
    node({ id: "node-output", node_kind: "output", lane_id: "output" })
  ],
  edges: [
    edge({
      id: "edge-001",
      from: "node-callback-wait",
      to: "node-output",
      edge_kind: "control",
      execution_semantics: "normal_transition",
      a2a_contract_id: null,
      is_remote_boundary_crossing: false,
      flow_kind: "resume",
      call_control: "resume"
    } as Partial<GraphEdge>)
  ],
  containers: [],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

const normalizedControlMetadata = normalizeGraphIRForRuntime(graphWithControlMetadata, "req-control-metadata");
assert.deepEqual(
  {
    invoke_binding: normalizedControlMetadata.nodes[0]?.invoke_binding,
    decision_owner: normalizedControlMetadata.nodes[0]?.decision_owner,
    call_control: normalizedControlMetadata.nodes[0]?.call_control,
    side_effect: normalizedControlMetadata.nodes[0]?.side_effect,
    policy: normalizedControlMetadata.nodes[0]?.policy
  },
  {
    invoke_binding: "callback_wait",
    decision_owner: "workflow_code",
    call_control: "event_callback",
    side_effect: "none",
    policy: "callback_resume_required"
  }
);
assert.deepEqual(
  {
    flow_kind: normalizedControlMetadata.edges[0]?.flow_kind,
    call_control: normalizedControlMetadata.edges[0]?.call_control
  },
  {
    flow_kind: "resume",
    call_control: "resume"
  }
);

const callbackWaitWithoutControl = validateGraphIRSoft(
  graphWithNodes([
    node({
      id: "node-callback-wait",
      label: "Wait for callback",
      node_kind: "callback_wait",
      lane_id: "local_graph"
    } as Partial<GraphNode>)
  ])
);
assert.equal(callbackWaitWithoutControl.errors.filter((issue) => issue.code === "callback_wait_missing_control_metadata").length, 1);

const callbackWaitWithControl = validateGraphIRSoft(
  graphWithNodes([
    node({
      id: "node-callback-wait",
      label: "Wait for callback",
      node_kind: "callback_wait",
      lane_id: "local_graph",
      invoke_binding: "callback_wait",
      call_control: "event_callback",
      policy: "callback_resume_required"
    } as Partial<GraphNode>)
  ])
);
assert.equal(callbackWaitWithControl.errors.filter((issue) => issue.code === "callback_wait_missing_control_metadata").length, 0);

const graphWithReviewedAdkFields: GraphIR = {
  requirement_id: "req-reviewed-adk-fields",
  graph_id: "graph-001",
  root_workflow_module_id: null,
  nodes: [
    node({ id: "node-input", node_kind: "input", lane_id: "input" }),
    node({
      id: "node-human-input",
      label: "Legacy label",
      node_kind: "human_input",
      lane_id: "human_input",
      human_input_contract: {
        message: "담당자 승인 여부를 입력하세요.",
        payload_schema_ref: null,
        response_schema_ref: "str",
        response_mapping: null
      }
    } as Partial<GraphNode>),
    node({ id: "node-router", node_kind: "router", lane_id: "local_graph" }),
    node({ id: "node-output", node_kind: "output", lane_id: "output" })
  ],
  edges: [
    edge({
      id: "edge-001",
      from: "node-router",
      to: "node-output",
      edge_kind: "route",
      execution_semantics: "conditional",
      route_condition: "choice == approve",
      route_aliases: ["승인", "approve"],
      is_default_route: true
    } as Partial<GraphEdge>)
  ],
  containers: [],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

const normalizedReviewedAdkFields = normalizeGraphIRForRuntime(graphWithReviewedAdkFields, "req-reviewed-adk-fields");
assert.deepEqual(normalizedReviewedAdkFields.nodes[1]?.human_input_contract, {
  message: "담당자 승인 여부를 입력하세요.",
  payload_schema_ref: null,
  response_schema_ref: "str",
  response_mapping: null
});
assert.deepEqual(normalizedReviewedAdkFields.edges[0]?.route_aliases, ["승인", "approve"]);
assert.equal(normalizedReviewedAdkFields.edges[0]?.is_default_route, true);

const humanInputBackfill = normalizeGraphIRForRuntime(
  graphWithNodes([node({ id: "node-human-input", label: "사람 승인", node_kind: "human_input", lane_id: "human_input" })]),
  "req-human-backfill"
);
assert.equal(humanInputBackfill.nodes[0]?.human_input_contract?.message, "사람 승인");
assert.equal(humanInputBackfill.nodes[0]?.human_input_contract?.response_schema_ref, "str");

const explicitNullHumanInputContract = normalizeGraphIRForRuntime(
  graphWithNodes([
    node({
      id: "node-human-input",
      label: "사람 승인",
      node_kind: "human_input",
      lane_id: "human_input",
      human_input_contract: {
        message: "담당자 승인 여부를 입력하세요.",
        payload_schema_ref: null,
        response_schema_ref: null,
        response_mapping: null
      }
    } as Partial<GraphNode>)
  ]),
  "req-human-null-contract"
);
assert.equal(explicitNullHumanInputContract.nodes[0]?.human_input_contract?.response_schema_ref, null);

const invalidHumanInputContractShape = validateGraphIRSoft(
  graphWithNodes([
    node({
      id: "node-human-input",
      label: "사람 승인",
      node_kind: "human_input",
      lane_id: "human_input",
      human_input_contract: {
        message: "담당자 승인 여부를 입력하세요.",
        payload_schema_ref: {} as never,
        response_schema_ref: null,
        response_mapping: [] as never
      }
    } as Partial<GraphNode>)
  ])
);
assert.equal(
  invalidHumanInputContractShape.errors.filter((issue) => issue.code === "human_input_payload_schema_invalid").length,
  1
);
assert.equal(
  invalidHumanInputContractShape.errors.filter((issue) => issue.code === "human_input_response_mapping_invalid").length,
  1
);

const invalidRouteContractFields = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-router", node_kind: "router", lane_id: "local_graph" }),
      node({ id: "node-a", node_kind: "output", lane_id: "output" }),
      node({ id: "node-b", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({
        id: "edge-001",
        from: "node-router",
        to: "node-a",
        edge_kind: "route",
        execution_semantics: "conditional",
        route_condition: "choice == a",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        is_default_route: true
      } as Partial<GraphEdge>),
      edge({
        id: "edge-002",
        from: "node-router",
        to: "node-b",
        edge_kind: "route",
        execution_semantics: "conditional",
        route_condition: "choice == b",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        route_aliases: ["", "B"],
        is_default_route: true
      } as Partial<GraphEdge>),
      edge({
        id: "edge-003",
        from: "node-a",
        to: "node-b",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        route_aliases: ["not allowed"]
      } as Partial<GraphEdge>)
    ]
  )
);
assert.equal(invalidRouteContractFields.errors.filter((issue) => issue.code === "route_alias_empty").length, 1);
assert.equal(invalidRouteContractFields.errors.filter((issue) => issue.code === "route_aliases_on_non_route").length, 1);
assert.equal(invalidRouteContractFields.errors.filter((issue) => issue.code === "multiple_default_routes").length, 1);

const invalidControlMetadata = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({
        id: "node-function",
        label: "Function",
        node_kind: "function",
        invoke_binding: "invalid-binding",
        decision_owner: "invalid-owner",
        call_control: "invalid-control",
        side_effect: "invalid-effect",
        policy: "invalid-policy"
      } as unknown as Partial<GraphNode>),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({
        id: "edge-001",
        from: "node-function",
        to: "node-output",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        flow_kind: "invalid-flow",
        call_control: "invalid-edge-control"
      } as unknown as Partial<GraphEdge>)
    ]
  )
);
assert.equal(invalidControlMetadata.errors.filter((issue) => issue.code === "invalid_invoke_binding").length, 1);
assert.equal(invalidControlMetadata.errors.filter((issue) => issue.code === "invalid_decision_owner").length, 1);
assert.equal(invalidControlMetadata.errors.filter((issue) => issue.code === "invalid_call_control").length, 2);
assert.equal(invalidControlMetadata.errors.filter((issue) => issue.code === "invalid_side_effect").length, 1);
assert.equal(invalidControlMetadata.errors.filter((issue) => issue.code === "invalid_policy").length, 1);
assert.equal(invalidControlMetadata.errors.filter((issue) => issue.code === "invalid_flow_kind").length, 1);

const remoteAgentCallEdge = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-local", node_kind: "agent", module_id: "mod-local", lane_id: "local_graph" }),
      node({
        id: "node-remote-agent-call",
        node_kind: "remote_agent_call",
        module_id: "mod-remote-agent",
        lane_id: "remote_boundary",
        owner_scope: "remote"
      })
    ],
    [
      edge({
        id: "edge-001",
        from: "node-local",
        to: "node-remote-agent-call",
        edge_kind: "remote_a2a",
        execution_semantics: "normal_transition",
        a2a_contract_id: "a2a-001",
        is_remote_boundary_crossing: true,
        flow_kind: "sequence",
        call_control: "fixed_by_workflow"
      })
    ]
  )
);
assert.equal(remoteAgentCallEdge.errors.filter((issue) => issue.code === "remote_missing_contract").length, 0);
assert.equal(remoteAgentCallEdge.warnings.filter((issue) => issue.code === "remote_link_incoherent").length, 0);

// Workflow-first invariant: LLM-selected MCP toolset semantics belong on an
// agent decision node. An adapter_call carrying mcp_toolset / selected_by_llm
// is rejected; the same semantics on an agent node are valid.
const toolsetOnAdapter = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({
        id: "node-toolset",
        node_kind: "adapter_call",
        module_id: "mod-toolset",
        lane_id: "adapter",
        invoke_binding: "mcp_toolset",
        decision_owner: "llm",
        call_control: "selected_by_llm"
      }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({
        id: "edge-001",
        from: "node-toolset",
        to: "node-output",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false
      })
    ]
  )
);
assert.equal(
  toolsetOnAdapter.errors.filter((issue) => issue.code === "llm_toolset_requires_agent_node").length,
  1
);

const toolsetOnAgent = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({
        id: "node-agent",
        node_kind: "agent",
        module_id: "mod-agent",
        lane_id: "local_graph",
        invoke_binding: "mcp_toolset",
        decision_owner: "llm",
        call_control: "selected_by_llm"
      }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({
        id: "edge-001",
        from: "node-agent",
        to: "node-output",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false
      })
    ]
  )
);
assert.equal(
  toolsetOnAgent.errors.filter((issue) => issue.code === "llm_toolset_requires_agent_node").length,
  0
);

// `selected_by_llm` is agent-node ownership metadata, never edge control —
// an edge carrying it is rejected too.
const toolsetOnEdge = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-agent", node_kind: "agent", module_id: "mod-agent", lane_id: "local_graph" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({
        id: "edge-001",
        from: "node-agent",
        to: "node-output",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false,
        call_control: "selected_by_llm"
      })
    ]
  )
);
assert.equal(
  toolsetOnEdge.errors.filter((issue) => issue.code === "llm_toolset_requires_agent_node").length,
  1
);
