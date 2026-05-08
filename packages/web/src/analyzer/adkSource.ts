import type { ModuleCandidate, NormalizedRequirement, ProcessFlow, ScaffoldPlan, ScaffoldPlanModule } from "./types";
import {
  ADK_FINAL_OUTPUT_FUNCTION,
  ADK_FINAL_OUTPUT_ID,
  buildAdkGraphIr,
  hasGraphErrors,
  toPythonIdentifier,
  type AdkGraphIr,
  type AdkGraphNode,
  type AdkRuntimeMode
} from "./adkGraph";

export interface AdkSourceBundleInput {
  normalizedRequirement: NormalizedRequirement;
  processFlow: ProcessFlow;
  scaffoldPlan: ScaffoldPlan;
  runtimeMode?: AdkRuntimeMode;
}

export interface AdkSourceBundle {
  appName: string;
  graphIr: AdkGraphIr;
  files: Record<string, string>;
  commands: string[];
  canRun: boolean;
}

export function buildAdkSourceBundle(input: AdkSourceBundleInput): AdkSourceBundle {
  const graphIr = buildAdkGraphIr({
    normalizedRequirement: input.normalizedRequirement,
    moduleCandidates: input.scaffoldPlan.modules.map(scaffoldModuleToCandidate),
    processFlow: input.processFlow,
    runtimeMode: input.runtimeMode
  });
  const packageName = graphIr.packageName;
  const manifest = buildManifest(input, graphIr);
  const requirements = buildRequirements();

  const files: Record<string, string> = {
    [`${packageName}/__init__.py`]: "from .agent import root_agent\n",
    [`${packageName}/agent.py`]: buildAgentPy(input, graphIr),
    [`${packageName}/workflow_manifest.json`]: `${JSON.stringify(manifest, null, 2)}\n`,
    "requirements.txt": requirements,
    "tests/test_workflow_contract.py": buildContractTest(packageName),
    "README.md": buildReadme(input, graphIr)
  };

  return {
    appName: packageName,
    graphIr,
    files,
    canRun: !hasGraphErrors(graphIr),
    commands: [
      "python3 -m venv .venv",
      "source .venv/bin/activate",
      "pip install -r requirements.txt",
      `python -m compileall ${packageName} tests`,
      "python -m pytest -q",
      `adk run --jsonl --in_memory --timeout 10s ${packageName} "sample complaint for workflow smoke"`,
      "adk web --port 8000 --host 127.0.0.1"
    ]
  };
}

function buildAgentPy(input: AdkSourceBundleInput, graphIr: AdkGraphIr): string {
  const activeNodes = graphIr.nodes.filter((node) => node.activeInGraph && node.nodeKind !== "output");
  const edgeRows = buildEdgeRows(graphIr);
  const scaffoldModuleById = new Map(input.scaffoldPlan.modules.map((module) => [module.id, module]));
  const nodeFunctions = activeNodes.map((node) => buildNodeFunction(node, scaffoldModuleById.get(node.id))).join("\n\n");
  const manifestSummary = {
    requirement_id: input.normalizedRequirement.id,
    title: input.normalizedRequirement.title,
    package: graphIr.packageName,
    runtime_mode: graphIr.runtimeMode,
    node_count: input.processFlow.nodes.length,
    edge_count: input.processFlow.edges.length,
    graph_errors: graphIr.issues.filter((issue) => issue.severity === "error").length
  };

  return `from __future__ import annotations

import json
from typing import Any

from google.adk import Event, Workflow
from google.adk.events import RequestInput
from google.adk.workflow import JoinNode


WORKFLOW_MANIFEST = ${toPythonLiteral(manifestSummary)}


def capture_request_context(node_input: Any = None):
    """Capture the initial ADK run input before routing into the generated graph."""
    return Event(output={
        "requirement_id": WORKFLOW_MANIFEST["requirement_id"],
        "input": node_input,
    })


def _event_output(node_id: str, node_label: str, edge_kind: str, node_input: Any = None):
    return {
        "node_id": node_id,
        "node_label": node_label,
        "edge_kind": edge_kind,
        "input": node_input,
        "status": "stubbed_runtime_contract",
    }


def _component_contract(module_id: str):
    return COMPONENT_CONTRACTS[module_id]


COMPONENT_CONTRACTS = ${toPythonLiteral(buildComponentContracts(input.scaffoldPlan))}


WORKFLOW_TERMINAL_OUTPUTS = ${toPythonLiteral(graphIr.terminalOutputs)}


def ${ADK_FINAL_OUTPUT_FUNCTION}(node_input: Any = None):
    """Single ADK terminal output node for the generated workflow skeleton."""
    return Event(output={
        "node_id": "workflow_result",
        "node_label": "workflow_result",
        "edge_kind": "event_message",
        "terminal_outputs": WORKFLOW_TERMINAL_OUTPUTS,
        "input": node_input,
        "status": "stubbed_runtime_contract",
    })


${nodeFunctions}

${buildJoinDeclarations(graphIr)}

root_agent = Workflow(
    name="${graphIr.packageName}",
    edges=[
${edgeRows}
    ],
)
`;
}

function buildNodeFunction(node: AdkGraphNode, scaffoldModule: ScaffoldPlanModule | undefined): string {
  if (node.runtimeRole === "human_input") {
    return `def ${node.functionName}(node_input: Any = None):
    """Human review node generated from Agent Factory workflow analysis."""
    yield RequestInput(
        message="검토 후 계속 진행할지 입력하세요.",
        payload=_event_output("${node.id}", "${escapePythonString(node.label)}", "event_message", node_input),
        response_schema=str,
    )`;
  }

  if (node.runtimeRole === "workflow_route") {
    return `def ${node.functionName}(node_input: Any = None):
    """Route node generated from Agent Factory edge metadata."""
    return Event(route="${node.defaultRouteValue ?? `ROUTE_${node.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`}")`;
  }

  if (node.runtimeRole === "llm_agent") {
    return `def ${node.functionName}(node_input: Any = None):
    """LLM Agent placeholder. Configure model credentials before replacing this stub with a real LLM node."""
    return Event(output=_event_output("${node.id}", "${escapePythonString(node.label)}", "llm_agent", node_input))`;
  }

  if (node.runtimeRole === "mcp_adapter") {
    const contractCall = {
      mcp_server: node.candidate?.mcp_server ?? null,
      mcp_tool_name: node.candidate?.mcp_tool_name ?? null,
      mcp_schema_ref: node.candidate?.mcp_schema_ref ?? null,
      mcp_auth_mode: node.candidate?.mcp_auth_mode ?? null,
      declared_inputs: node.candidate?.inputs ?? [],
      declared_outputs: node.candidate?.outputs ?? []
    };
    return `def ${node.functionName}(node_input: Any = None):
    """MCP Adapter contract placeholder generated from catalog metadata."""
    contract_call = json.loads(${JSON.stringify(JSON.stringify(contractCall))})
    output = _event_output("${node.id}", "${escapePythonString(node.label)}", "mcp_adapter", node_input)
    output["mcp_contract_call"] = contract_call
    output["status"] = "runtime_configuration_required"
    return Event(output=output)`;
  }

  if (scaffoldModule) {
    const todoFunctionName = todoImplementationFunctionName(scaffoldModule);
    return `def ${todoFunctionName}(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("${escapePythonString(scaffoldModule.name)} requires developer implementation")


def ${node.functionName}(node_input: Any = None):
    """New-code TODO boundary generated from scaffold-plan."""
    contract = _component_contract("${scaffoldModule.id}")
    output = _event_output("${node.id}", "${escapePythonString(node.label)}", "event_output", node_input)
    output["status"] = "todo_implementation_required"
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "${todoFunctionName}"
    return Event(output=output)`;
  }

  const channel = node.nodeKind === "output" ? "event_message" : "event_output";
  return `def ${node.functionName}(node_input: Any = None):
    """${escapePythonString(node.label)} generated ${node.runtimeRole} node."""
    return Event(output=_event_output("${node.id}", "${escapePythonString(node.label)}", "${channel}", node_input))`;
}

function buildJoinDeclarations(graphIr: AdkGraphIr): string {
  if (!graphIr.joinGroups.length) {
    return "";
  }
  return graphIr.joinGroups.map((join) => `${join.joinName} = JoinNode(name="${join.joinName}")`).join("\n");
}

function buildEdgeRows(graphIr: AdkGraphIr): string {
  const nodeById = new Map(graphIr.nodes.map((node) => [node.id, node]));
  return graphIr.edges
    .map((edge) => {
      const from = edge.from === "START" || edge.from.startsWith("join_") ? edge.from : nodeById.get(edge.from)?.functionName;
      const to =
        edge.to === ADK_FINAL_OUTPUT_ID
          ? ADK_FINAL_OUTPUT_FUNCTION
          : edge.to.startsWith("join_")
            ? edge.to
            : nodeById.get(edge.to)?.functionName;
      if (!from || !to) return "";
      if (edge.kind === "route") {
        return `        (${from}, {"${edge.routeValue}": ${to}}),`;
      }
      return `        (${from === "START" ? '"START"' : from}, ${to}),`;
    })
    .filter(Boolean)
    .join("\n");
}

function buildManifest(input: AdkSourceBundleInput, graphIr: AdkGraphIr) {
  const scaffoldModuleById = new Map(input.scaffoldPlan.modules.map((module) => [module.id, module]));
  return {
    package: graphIr.packageName,
    runtime_mode: graphIr.runtimeMode,
    requirement: {
      id: input.normalizedRequirement.id,
      title: input.normalizedRequirement.title,
      status: input.normalizedRequirement.status
    },
    guardrails: {
      raw_requirement_to_code: false,
      generated_business_logic: false,
      private_data_or_endpoints: false
    },
    scaffold_plan: {
      source: input.scaffoldPlan.source,
      raw_requirement_to_code: input.scaffoldPlan.raw_requirement_to_code,
      approved_module_count: input.scaffoldPlan.modules.length,
      excluded_modules: input.scaffoldPlan.excluded_modules
    },
    catalog_bound_modules: input.scaffoldPlan.manifest.catalog_bound_modules,
    new_code_required: input.scaffoldPlan.manifest.new_code_required,
    nodes: graphIr.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      node_kind: node.nodeKind,
      execution_kind: node.executionKind,
      function: node.nodeKind === "output" ? ADK_FINAL_OUTPUT_FUNCTION : node.functionName,
      runtime_role: node.runtimeRole,
      active_in_graph: node.nodeKind === "output" ? false : node.activeInGraph,
      review_status: node.candidate?.status ?? null,
      risk_level: node.candidate?.risk_level ?? null,
      catalog_binding: scaffoldModuleById.get(node.id)?.catalog_binding ?? null,
      developer_todos: scaffoldModuleById.get(node.id)?.developer_todos ?? []
    })),
    graph_ir: {
      start_nodes: graphIr.edges.filter((edge) => edge.kind === "start").map((edge) => edge.to),
      route_nodes: graphIr.fanOutGroups.filter((group) => group.kind === "route"),
      fan_out_groups: graphIr.fanOutGroups,
      join_groups: graphIr.joinGroups,
      loop_edges: graphIr.loopEdges,
      terminal_outputs: graphIr.terminalOutputs,
      issues: graphIr.issues
    },
    edges: input.processFlow.edges
  };
}

function buildContractTest(packageName: string): string {
  return `from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_agent_source_declares_adk_workflow():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk import Event, Workflow" in source
    assert "root_agent = Workflow(" in source
    assert "def ${ADK_FINAL_OUTPUT_FUNCTION}" in source
    assert '"START"' in source


def test_manifest_has_runtime_guardrails():
    manifest = (ROOT / "${packageName}" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"raw_requirement_to_code": false' in manifest
    assert '"generated_business_logic": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"graph_ir"' in manifest
    assert '"catalog_bound_modules"' in manifest
    assert '"new_code_required"' in manifest


def test_agent_source_marks_developer_todo_boundaries():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "TODO_IMPLEMENT_HERE" in source
`;
}

function buildReadme(input: AdkSourceBundleInput, graphIr: AdkGraphIr): string {
  return `# ${graphIr.packageName}

Generated ADK 2.0 graph workflow source for ${input.normalizedRequirement.title}.

Runtime mode: ${graphIr.runtimeMode}

## Install

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
\`\`\`

## Verify

\`\`\`bash
python -m compileall ${graphIr.packageName} tests
python -m pytest -q
\`\`\`

## Run

\`\`\`bash
adk run --jsonl --in_memory --timeout 10s ${graphIr.packageName} "sample complaint for workflow smoke"
\`\`\`

## Inspect In ADK Web

\`\`\`bash
adk web --port 8000 --host 127.0.0.1
\`\`\`

Open http://127.0.0.1:8000, select \`${graphIr.packageName}\`, run a sample message, then inspect session state and event history in the ADK web interface.

The generated nodes preserve the reviewed workflow topology, Graph IR edge kinds, route metadata, and safety guardrails without adding private system calls or domain business logic.
Approved modules are emitted as \`TODO_IMPLEMENT_HERE\` boundaries. Catalog bindings are recorded in \`workflow_manifest.json\`, but no Python package import contract is generated.

## Graph IR

- start nodes: ${graphIr.edges.filter((edge) => edge.kind === "start").map((edge) => edge.to).join(", ") || "none"}
- join groups: ${graphIr.joinGroups.map((join) => join.joinName).join(", ") || "none"}
- loop edges: ${graphIr.loopEdges.map((edge) => `${edge.from}->${edge.to}`).join(", ") || "none"}
- issues: ${graphIr.issues.length}
`;
}

function scaffoldModuleToCandidate(module: ScaffoldPlanModule): ModuleCandidate {
  return {
    id: module.id,
    source_requirement_id: "",
    name: module.name,
    module_category: module.module_category,
    agent_kind: module.agent_kind,
    workflow_kind: module.workflow_kind,
    adapter_kind: module.adapter_kind,
    remote_contract_kind: module.remote_contract_kind,
    confidence: 1,
    rationale: "Approved scaffold-plan module",
    inputs: module.inputs,
    outputs: module.outputs,
    reuse_candidate: Boolean(module.catalog_binding),
    risk_level: module.risk_signals.length ? "medium" : "low",
    risk_signals: module.risk_signals,
    status: "approved",
    missing_information: [],
    access_protocol: module.catalog_binding?.component_source === "mcp" ? "mcp" : null,
    developer_todos: module.developer_todos
  };
}

function buildRequirements(): string {
  return `${["--pre", "google-adk", "pytest"].join("\n")}\n`;
}

function buildComponentContracts(scaffoldPlan: ScaffoldPlan) {
  return Object.fromEntries(
    scaffoldPlan.modules.map((module) => [
      module.id,
      {
        catalog_binding: module.catalog_binding ?? null,
        developer_todos: module.developer_todos,
        inputs: module.inputs,
        outputs: module.outputs,
        risk_signals: module.risk_signals
      }
    ])
  );
}

function todoImplementationFunctionName(module: ScaffoldPlanModule): string {
  return `TODO_IMPLEMENT_HERE_${toPythonIdentifier(module.id)}`;
}

function toPythonLiteral(value: unknown): string {
  return JSON.stringify(value, null, 4)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

function escapePythonString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
