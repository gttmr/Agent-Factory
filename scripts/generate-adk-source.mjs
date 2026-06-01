#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const artifactRoot = resolve(process.argv[2] ?? "templates");
const outputRoot = resolve(process.argv[3] ?? "generated/adk-source");

const analysisResult = readOptionalJson("analysis-result.json");
const normalizedRequirement = readOptionalJson("normalized-requirement.json") ?? analysisResult?.normalizedRequirement;
const processFlow = readOptionalJson("process-flow.json") ?? analysisResult?.processFlow;
const moduleCandidates = readOptionalJson("module-candidates.json") ?? analysisResult?.moduleCandidates ?? null;
const runManifest = readOptionalJson("af-run-manifest.json");
const scaffoldPlan = readJson("scaffold-plan.json", "scaffold-plan.template.json");

if (!normalizedRequirement || typeof normalizedRequirement !== "object") {
  throw new Error("Missing required artifact: normalized-requirement.json or analysis-result.json:normalizedRequirement");
}
if (!processFlow || typeof processFlow !== "object") {
  throw new Error("Missing required artifact: process-flow.json or analysis-result.json:processFlow");
}
if (scaffoldPlan?.source !== "approved_workbench_artifact" || scaffoldPlan?.raw_requirement_to_code !== false) {
  throw new Error("scaffold-plan.json must be an approved_workbench_artifact with raw_requirement_to_code=false.");
}
if (!Array.isArray(scaffoldPlan.modules) || scaffoldPlan.modules.length === 0) {
  throw new Error("scaffold-plan.json must contain at least one approved module.");
}
const modules = scaffoldPlan.modules;
if (scaffoldPlan.validation?.can_generate_source === false) {
  throw new Error(`scaffold-plan.json has blockers: ${(scaffoldPlan.validation.blockers ?? []).join("; ")}`);
}
validateRunInputs();

const packageName = `${toPythonIdentifier(normalizedRequirement.id || scaffoldPlan.requirement_id || "agent_factory_workflow")}_adk`;
const files = buildFiles();

Object.entries(files).forEach(([relativePath, content]) => {
  const target = join(outputRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
});
updateRunManifest();

console.log(`ADK source generated from scaffold-plan.json: ${join(outputRoot, packageName)}`);
console.log(`Run from ${outputRoot}:`);
console.log("  python3 -m venv .venv");
console.log("  source .venv/bin/activate");
console.log("  pip install -r requirements.txt");
console.log(`  python -m compileall ${packageName} tests`);
console.log("  python -m pytest -q");

function readJson(name, fallbackName) {
  const path = join(artifactRoot, name);
  const selectedPath = existsSync(path) ? path : fallbackName ? join(artifactRoot, fallbackName) : path;
  if (!existsSync(selectedPath)) {
    throw new Error(`Missing required artifact: ${path}`);
  }
  return JSON.parse(readFileSync(selectedPath, "utf8"));
}

function readOptionalJson(name) {
  const path = join(artifactRoot, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function buildFiles() {
  return {
    [`${packageName}/__init__.py`]: "from .agent import root_agent\n",
    [`${packageName}/agent.py`]: buildAgentPy(),
    [`${packageName}/workflow_manifest.json`]: `${JSON.stringify(buildManifest(), null, 2)}\n`,
    "scaffold-plan.json": `${JSON.stringify(scaffoldPlan, null, 2)}\n`,
    "implementation-handoff.md": buildImplementationHandoff(),
    "runtime-chat-smoke.json": `${JSON.stringify(buildRuntimeChatSmoke(), null, 2)}\n`,
    "requirements.txt": buildRequirements(),
    "tests/test_workflow_contract.py": buildContractTest(),
    "README.md": buildReadme()
  };
}

function buildAgentPy() {
  const functions = modules.map(buildNodeFunction).join("\n\n");
  const graphEdges = buildGraphWorkflowEdges();

  return `from __future__ import annotations

from typing import AsyncGenerator
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types


COMPONENT_CONTRACTS = ${toPythonLiteral(componentContracts())}
GRAPH_EDGES = ${toPythonEdgeTupleLiteral(graphEdges)}
TERMINAL_OUTPUTS = ${toPythonLiteral(terminalOutputIds())}


def _event_output(module_id: str, module_name: str, node_input: Any = None):
    contract = COMPONENT_CONTRACTS[module_id]
    return {
        "module_id": module_id,
        "module_name": module_name,
        "input": node_input,
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
    }


${functions}


def emit_workflow_result(node_input: Any = None):
    return {
        "node_id": "workflow_result",
        "terminal_outputs": TERMINAL_OUTPUTS,
        "input": node_input,
        "status": "runtime_mock_smoke",
    }


def _synthetic_module_outputs():
    return {
        module_id: {
            "module_name": contract["catalog_binding"]["name"] if contract.get("catalog_binding") else module_id,
            "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
            "runtime_mock": contract.get("runtime_mock"),
            "developer_todos": contract["developer_todos"],
        }
        for module_id, contract in COMPONENT_CONTRACTS.items()
    }


def _build_smoke_text(user_text: str = ""):
    mock_count = sum(1 for contract in COMPONENT_CONTRACTS.values() if contract.get("runtime_mock") is not None)
    terminal_outputs = ", ".join(TERMINAL_OUTPUTS) if TERMINAL_OUTPUTS else "none"
    user_note = f" Received message: {user_text[:160]}" if user_text else ""
    return (
        "ADK runtime smoke for ${packageName}: "
        f"{len(COMPONENT_CONTRACTS)} approved modules loaded, "
        f"{mock_count} synthetic runtime mocks available. "
        f"Terminal outputs: {terminal_outputs}. "
        "This response uses reviewed synthetic test doubles only; it is not real business logic."
        f"{user_note}"
    )


def _latest_user_text(ctx: InvocationContext):
    try:
        events = list(getattr(ctx.session, "events", []) or [])
    except Exception:
        return ""
    for event in reversed(events):
        content = getattr(event, "content", None)
        if not content or getattr(content, "role", None) != "user":
            continue
        parts = getattr(content, "parts", []) or []
        text = "".join(getattr(part, "text", "") or "" for part in parts)
        if text.strip():
            return text.strip()
    return ""


class SyntheticRuntimeSmokeAgent(BaseAgent):
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            branch=ctx.branch,
            content=types.Content(
                role="model",
                parts=[types.Part(text=_build_smoke_text(_latest_user_text(ctx)))],
            ),
            output={
                "status": "runtime_mock_smoke",
                "guardrails": {
                    "raw_requirement_to_code": False,
                    "generated_business_logic": False,
                    "private_data_or_endpoints": False,
                },
                "graph_edges": GRAPH_EDGES,
                "terminal_outputs": TERMINAL_OUTPUTS,
                "module_outputs": _synthetic_module_outputs(),
            },
        )


root_agent = SyntheticRuntimeSmokeAgent(
    name="${packageName}",
    description="Synthetic ADK runtime smoke bridge for reviewed Agent Factory handoff artifacts.",
)
`;
}

function buildNodeFunction(module) {
  return `def ${todoFunctionName(module)}(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("${escapePythonString(module.name)} requires developer implementation")


def ${nodeFunctionName(module)}(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["${module.id}"]
    output = _event_output("${module.id}", "${escapePythonString(module.name)}", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "${todoFunctionName(module)}"
    return output`;
}

function buildManifest() {
  return {
    package: packageName,
    requirement: {
      id: normalizedRequirement.id,
      title: normalizedRequirement.title,
      status: normalizedRequirement.status
    },
    guardrails: {
      raw_requirement_to_code: false,
      generated_business_logic: false,
      private_data_or_endpoints: false
    },
    scaffold_plan: {
      source: scaffoldPlan.source,
      raw_requirement_to_code: scaffoldPlan.raw_requirement_to_code,
      approved_module_count: scaffoldPlan.modules.length,
      excluded_modules: scaffoldPlan.excluded_modules ?? []
    },
    catalog_bound_modules: scaffoldPlan.manifest?.catalog_bound_modules ?? [],
    new_code_required: scaffoldPlan.manifest?.new_code_required ?? [],
    runtime_contracts: scaffoldPlan.runtime_contracts ?? [],
    graph_ir: {
      start_nodes: startNodeIds(),
      terminal_outputs: terminalOutputIds(),
      node_count: Array.isArray(processFlow.nodes) ? processFlow.nodes.length : 0,
      edge_count: Array.isArray(processFlow.edges) ? processFlow.edges.length : 0,
      validation: processFlow.validation ?? null
    },
    edges: Array.isArray(processFlow.edges) ? processFlow.edges : [],
    excluded_modules: scaffoldPlan.excluded_modules ?? [],
    modules: scaffoldPlan.modules
  };
}

function buildRequirements() {
  return `${["google-adk>=2.0.0", "pytest"].join("\n")}\n`;
}

function buildContractTest() {
  return `from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_agent_source_declares_adk_workflow():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk.agents import BaseAgent" in source
    assert "class SyntheticRuntimeSmokeAgent(BaseAgent)" in source
    assert "TODO_IMPLEMENT_HERE" in source
    assert "runtime_mock_smoke" in source


def test_manifest_uses_scaffold_plan_contract():
    manifest = (ROOT / "${packageName}" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"raw_requirement_to_code": false' in manifest
    assert '"generated_business_logic": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"graph_ir"' in manifest
    assert '"catalog_bound_modules"' in manifest
    assert '"new_code_required"' in manifest
    assert '"runtime_contracts"' in manifest


def test_runtime_chat_smoke_contract_is_present():
    smoke = (ROOT / "runtime-chat-smoke.json").read_text(encoding="utf-8")
    assert '"appName": "${packageName}"' in smoke
    assert '"port": 8765' in smoke
`;
}

function buildReadme() {
  return `# ${packageName}

Generated from approved scaffold-plan.json for ${normalizedRequirement.title}.

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m compileall ${packageName} tests
python -m pytest -q
\`\`\`

## ADK runtime chat smoke

This bundle supports local ADK API/Web UI smoke testing with reviewed synthetic test doubles only.
It does not contain private endpoints, credentials, deployment scripts, or real business logic.

\`\`\`bash
adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl -X POST http://127.0.0.1:8765/apps/${packageName}/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
\`\`\`
`;
}

function buildRuntimeChatSmoke() {
  return {
    host: "127.0.0.1",
    port: 8765,
    appName: packageName,
    userId: "af-reviewer",
    sessionId: "af-smoke",
    newMessage: {
      role: "user",
      parts: [
        {
          text: `Run a synthetic ADK chat smoke for ${normalizedRequirement.title}.`
        }
      ]
    }
  };
}

function buildImplementationHandoff() {
  const todoLines = scaffoldPlan.modules.flatMap((module) =>
    (module.developer_todos ?? []).map((todo) => `- ${module.name}: ${todo}`)
  );
  return `# Implementation Handoff

Generated from reviewed scaffold-plan.json for ${normalizedRequirement.title}.

## Non-goals

- Do not add runnable business logic in this generated bundle.
- Do not add private endpoints, credentials, customer data, or deployment scripts.
- Replace TODO boundaries only in a separate implementation task after runtime wiring is approved.

## TODO Boundaries

${todoLines.length ? todoLines.join("\n") : "- Review generated TODO_IMPLEMENT_HERE functions before implementation."}
`;
}

function componentContracts() {
  return Object.fromEntries(
    scaffoldPlan.modules.map((module) => [
      module.id,
      {
        catalog_binding: module.catalog_binding ?? null,
        developer_todos: module.developer_todos,
        inputs: module.inputs,
        outputs: module.outputs,
        risk_signals: module.risk_signals,
        runtime_mock: module.runtime_mock ?? null
      }
    ])
  );
}

function validateRunInputs() {
  const requirementId = normalizedRequirement.id || scaffoldPlan.requirement_id;
  if (runManifest && runManifest.requirement_id !== requirementId) {
    throw new Error(
      `af-run-manifest.json requirement_id (${runManifest.requirement_id}) does not match ${requirementId}.`
    );
  }
  if (scaffoldPlan.requirement_id && requirementId && scaffoldPlan.requirement_id !== requirementId) {
    throw new Error(`scaffold-plan.json requirement_id (${scaffoldPlan.requirement_id}) does not match ${requirementId}.`);
  }
  if (runManifest) {
    const missingApprovals = [];
    if (runManifest.approvals?.analysis_reviewed !== true) missingApprovals.push("analysis_reviewed");
    if (runManifest.approvals?.boundaries_approved !== true) missingApprovals.push("boundaries_approved");
    if (runManifest.approvals?.runtime_contracts_approved !== true) missingApprovals.push("runtime_contracts_approved");
    if (missingApprovals.length > 0) {
      throw new Error(`af-run-manifest.json is not approved for build: ${missingApprovals.join(", ")}.`);
    }
    if (runManifest.stages?.design?.status !== "complete") {
      throw new Error("af-run-manifest.json design stage must be complete before runtime stub generation.");
    }
  }

  const graphErrors = processFlow.validation?.errors;
  if (Array.isArray(graphErrors) && graphErrors.length > 0) {
    throw new Error(`processFlow has Graph IR errors: ${graphErrors.join("; ")}`);
  }

  const runtimeContracts = Array.isArray(analysisResult?.runtimeContracts) ? analysisResult.runtimeContracts : [];
  const unapprovedRuntimeContracts = runtimeContracts.filter((contract) => contract?.contract_status !== "approved");
  if (unapprovedRuntimeContracts.length > 0) {
    throw new Error(
      `analysis-result.json has unapproved runtimeContracts: ${unapprovedRuntimeContracts
        .map((contract) => contract.contract_id ?? "unknown")
        .join(", ")}`
    );
  }
  const scaffoldRuntimeContracts = Array.isArray(scaffoldPlan.runtime_contracts) ? scaffoldPlan.runtime_contracts : [];
  const unapprovedScaffoldRuntimeContracts = scaffoldRuntimeContracts.filter(
    (contract) => contract?.contract_status !== "approved"
  );
  if (unapprovedScaffoldRuntimeContracts.length > 0) {
    throw new Error(
      `scaffold-plan.json has unapproved runtime_contracts: ${unapprovedScaffoldRuntimeContracts
        .map((contract) => contract.contract_id ?? "unknown")
        .join(", ")}`
    );
  }

  const a2aContracts = Array.isArray(analysisResult?.a2aContracts) ? analysisResult.a2aContracts : [];
  const unapprovedA2AContracts = a2aContracts.filter((contract) => contract?.contract_status !== "approved");
  if (unapprovedA2AContracts.length > 0) {
    throw new Error(
      `analysis-result.json has unapproved a2aContracts: ${unapprovedA2AContracts
        .map((contract) => contract.contract_id ?? "unknown")
        .join(", ")}`
    );
  }

  validateApprovedModuleSource();
  validateGraphCoverage();
}

function updateRunManifest() {
  if (!runManifest) return;
  const outputRelative = relative(artifactRoot, outputRoot).replace(/\\/g, "/");
  if (!outputRelative || outputRelative.startsWith("..")) {
    return;
  }
  const outputDir = outputRelative.endsWith("/") ? outputRelative : `${outputRelative}/`;
  const next = {
    ...runManifest,
    current_stage: "build",
    stages: {
      analyze: normalizeRunStage(runManifest.stages?.analyze),
      design: normalizeRunStage(runManifest.stages?.design),
      build: {
        status: "complete",
        outputs: uniqueStrings([
          ...(Array.isArray(runManifest.stages?.build?.outputs) ? runManifest.stages.build.outputs : []),
          outputDir,
          `${outputDir}scaffold-plan.json`,
          `${outputDir}implementation-handoff.md`
        ])
      },
      verify: normalizeRunStage(runManifest.stages?.verify)
    },
    approvals: {
      analysis_reviewed: runManifest.approvals?.analysis_reviewed === true,
      boundaries_approved: runManifest.approvals?.boundaries_approved === true,
      runtime_contracts_approved: runManifest.approvals?.runtime_contracts_approved === true,
      stub_ready_for_followup: true
    },
    validation: {
      commands: uniqueStrings([
        ...(Array.isArray(runManifest.validation?.commands) ? runManifest.validation.commands : []),
        `python3 -m compileall ${outputDir}${packageName} ${outputDir}tests`,
        `cd ${outputDir} && python -m pytest -q`
      ]),
      last_result: runManifest.validation?.last_result ?? "not_run"
    }
  };
  writeFileSync(join(artifactRoot, "af-run-manifest.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function normalizeRunStage(stage) {
  return {
    status: typeof stage?.status === "string" ? stage.status : "pending",
    outputs: Array.isArray(stage?.outputs) ? stage.outputs.filter((item) => typeof item === "string") : []
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function startNodeIds() {
  const graph = graphIndexes();
  const moduleNodeIds = new Set(graph.moduleNodes.map((node) => node.id));
  const moduleTargets = new Set(
    (Array.isArray(processFlow.edges) ? processFlow.edges : [])
      .filter((edge) => moduleNodeIds.has(edge.from) && moduleNodeIds.has(edge.to))
      .map((edge) => edge.to)
  );
  return [...moduleNodeIds].filter((id) => !moduleTargets.has(id));
}

function terminalOutputIds() {
  if (!Array.isArray(processFlow.nodes)) return [];
  return processFlow.nodes
    .filter((node) => node && node.node_kind === "output" && typeof node.id === "string")
    .map((node) => node.id);
}

function validateApprovedModuleSource() {
  if (!Array.isArray(moduleCandidates)) return;
  const candidatesById = new Map(
    moduleCandidates
      .filter((candidate) => candidate && typeof candidate.id === "string")
      .map((candidate) => [candidate.id, candidate])
  );
  const blockers = [];
  for (const module of modules) {
    const candidate = candidatesById.get(module.id);
    if (!candidate) {
      blockers.push(`${module.id}: missing module candidate`);
      continue;
    }
    if (candidate.status !== "approved") {
      blockers.push(`${module.id}: status ${candidate.status ?? "unknown"}`);
    }
    if (Array.isArray(candidate.missing_information) && candidate.missing_information.length > 0) {
      blockers.push(`${module.id}: unresolved missing_information`);
    }
  }
  if (blockers.length > 0) {
    throw new Error(`scaffold-plan.json includes modules that are not approved in analysis artifacts: ${blockers.join("; ")}`);
  }
}

function validateGraphCoverage() {
  const graph = graphIndexes();
  const graphModuleIds = new Set(graph.moduleNodes.map((node) => node.module_id));
  const missing = modules.filter((module) => !graphModuleIds.has(module.id)).map((module) => module.id);
  if (missing.length > 0) {
    throw new Error(`processFlow is missing Graph IR nodes for scaffold-plan modules: ${missing.join(", ")}`);
  }
}

function buildGraphWorkflowEdges() {
  const graph = graphIndexes();
  const rows = [];
  const seen = new Set();
  const push = (from, to) => {
    if (!from || !to || from === to) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push([from, to]);
  };

  if (Array.isArray(processFlow.edges)) {
    for (const edge of processFlow.edges) {
      push(graphEndpoint(edge.from, "from", graph), graphEndpoint(edge.to, "to", graph));
    }
  }

  const incoming = new Set(rows.map(([, to]) => to));
  const outgoing = new Set(rows.map(([from]) => from));
  for (const node of graph.moduleNodes) {
    const fn = nodeFunctionName(graph.moduleById.get(node.module_id));
    if (!incoming.has(fn)) push("START", fn);
    if (!outgoing.has(fn)) push(fn, "emit_workflow_result");
  }

  if (rows.length === 0) {
    throw new Error("processFlow does not provide any usable Graph IR edges for runtime stub generation.");
  }
  return rows;
}

function graphEndpoint(nodeId, side, graph) {
  const node = graph.nodesById.get(nodeId);
  if (!node) return null;
  if (typeof node.module_id === "string" && graph.moduleById.has(node.module_id)) {
    return nodeFunctionName(graph.moduleById.get(node.module_id));
  }
  if (side === "from" && node.node_kind === "input") return "START";
  if (side === "to" && node.node_kind === "output") return "emit_workflow_result";
  return null;
}

function graphIndexes() {
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const nodes = Array.isArray(processFlow.nodes) ? processFlow.nodes : [];
  const nodesById = new Map(nodes.filter((node) => node && typeof node.id === "string").map((node) => [node.id, node]));
  const moduleNodes = nodes.filter(
    (node) => node && typeof node.module_id === "string" && moduleById.has(node.module_id)
  );
  return { moduleById, moduleNodes, nodesById };
}

function nodeFunctionName(module) {
  return `node_${toPythonIdentifier(module.id)}`;
}

function todoFunctionName(module) {
  return `TODO_IMPLEMENT_HERE_${toPythonIdentifier(module.id)}`;
}

function toPythonIdentifier(value) {
  const identifier = String(value).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return /^[a-z_]/.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
}

function toPythonLiteral(value) {
  return JSON.stringify(value, null, 4)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

function toPythonEdgeTupleLiteral(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "[]";
  return `[\n${rows.map(([from, to]) => `    (${JSON.stringify(from)}, ${JSON.stringify(to)})`).join(",\n")}\n]`;
}

function escapePythonString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
