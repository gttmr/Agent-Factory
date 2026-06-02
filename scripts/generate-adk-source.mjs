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
// Hard invariant in BOTH smoke and runnable modes: runnable output is still
// generated from approved workbench artifacts, never from raw requirements.
if (scaffoldPlan?.source !== "approved_workbench_artifact" || scaffoldPlan?.raw_requirement_to_code !== false) {
  throw new Error("scaffold-plan.json must be an approved_workbench_artifact with raw_requirement_to_code=false.");
}
if (!Array.isArray(scaffoldPlan.modules) || scaffoldPlan.modules.length === 0) {
  throw new Error("scaffold-plan.json must contain at least one approved module.");
}
const modules = scaffoldPlan.modules;
const outputMode = scaffoldPlan.output_mode === "runnable" ? "runnable" : "smoke";
const DEFAULT_MODEL = "gemini-2.5-flash";
if (scaffoldPlan.validation?.can_generate_source === false) {
  throw new Error(`scaffold-plan.json has blockers: ${(scaffoldPlan.validation.blockers ?? []).join("; ")}`);
}
validateRunInputs();

const packageName = `${toPythonIdentifier(normalizedRequirement.id || scaffoldPlan.requirement_id || "agent_factory_workflow")}_adk`;
const connectedAdapters = modules.filter((module) => adapterConnection(module) === "mcp_connected");
const unconnectedAdapters = modules.filter((module) => adapterConnection(module) === "unconnected");
const files = buildFiles();

Object.entries(files).forEach(([relativePath, content]) => {
  const target = join(outputRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
});
updateRunManifest();

console.log(`ADK source generated from scaffold-plan.json (output_mode=${outputMode}): ${join(outputRoot, packageName)}`);
console.log(`Run from ${outputRoot}:`);
console.log("  python3 -m venv .venv");
console.log("  source .venv/bin/activate");
console.log("  pip install -r requirements.txt");
if (outputMode === "runnable") {
  console.log("  cp .env.example .env   # then set GOOGLE_API_KEY=...");
}
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
  const base = {
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
  if (outputMode === "runnable") {
    base["agents.config.yaml"] = buildAgentsConfig();
    base[".env.example"] = buildEnvExample();
    base[".gitignore"] = buildGitignore();
  }
  return base;
}

// ---------------------------------------------------------------------------
// agent.py — dual mode
// ---------------------------------------------------------------------------

function buildAgentPy() {
  return outputMode === "runnable" ? buildRunnableAgentPy() : buildSmokeAgentPy();
}

function buildSmokeAgentPy() {
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

function buildRunnableAgentPy() {
  assertRunnableGraphSupported();
  const { edges, joins } = buildRunnableGraph();
  const orderedModules = orderedGraphModules();
  assertNoSymbolCollisions(orderedModules);
  const nodeBlocks = [];
  const funcBlocks = [];

  for (const module of orderedModules) {
    if (isAgentModule(module)) {
      nodeBlocks.push(emitAgentNode(module));
    } else if (adapterConnection(module) === "mcp_connected") {
      funcBlocks.push(emitConnectedAdapterFunc(module));
      nodeBlocks.push(emitFunctionNodeDecl(module));
    } else {
      funcBlocks.push(emitStubFunc(module));
      nodeBlocks.push(emitFunctionNodeDecl(module));
    }
  }

  const joinDecls = joins.map((join) => `${join.sym} = JoinNode(name=${toPyStr(join.sym)})`);
  const edgeLiteral = `[\n${edges.map(([s, t]) => `        (${s}, ${t}),`).join("\n")}\n    ]`;
  const description = `Runnable ADK 2.1 workflow generated from reviewed Agent Factory artifacts for ${truncate(
    normalizedRequirement.title || packageName
  )}.`;

  return `from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from google.adk import Context
from google.adk.agents import LlmAgent
from google.adk.workflow import FunctionNode, JoinNode, START, Workflow


# Reviewed contract data for each approved module (synthetic test doubles only).
COMPONENT_CONTRACTS: dict[str, dict] = ${toPythonLiteral(componentContracts())}

# Per-developer overrides live in agents.config.yaml (sibling of this package).
# This is how each developer individualizes the bundle; agent.py applies the
# overrides at import time so editing the YAML actually changes behavior.
_CONFIG_PATH = Path(__file__).resolve().parent.parent / "agents.config.yaml"


def _load_config() -> dict:
    if not _CONFIG_PATH.exists():
        return {}
    try:
        return yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except Exception as exc:  # malformed YAML, permissions, etc.
        import sys

        print(
            f"[agent.py] WARNING: could not load {_CONFIG_PATH.name} ({exc}); "
            "using seeded defaults.",
            file=sys.stderr,
        )
        return {}


_CONFIG = _load_config()


def _override(section: str, module_id: str, key: str, default: Any) -> Any:
    for entry in _CONFIG.get(section, []) or []:
        if isinstance(entry, dict) and entry.get("id") == module_id:
            value = entry.get(key)
            if value is not None:
                return value
    return default


def _agent_cfg(module_id: str, key: str, default: Any) -> Any:
    return _override("agents", module_id, key, default)


def _model_for(module_id: str, seed: str) -> str:
    # Per-agent override wins; then the top-level default_model knob; then the seed.
    per_agent = _override("agents", module_id, "model", None)
    if per_agent:
        return str(per_agent)
    default_model = _CONFIG.get("default_model")
    return str(default_model) if default_model else seed


def _adapter_cfg(module_id: str, key: str, default: Any) -> Any:
    return _override("adapters", module_id, key, default)


def _mcp_url(module_id: str, mcp_server: str) -> str:
    configured = _adapter_cfg(module_id, "mcp_url", None)
    if configured:
        return str(configured)
    base = os.environ.get("AF_MOCK_LAB_MCP_URL", "http://127.0.0.1:5176/api/mock-lab/mcp").rstrip("/")
    return f"{base}/{mcp_server}"


def _collect_tool_inputs(
    ctx: Context, module_id: str, input_names: list[str], required_names: list[str]
) -> dict:
    # Resolve each reviewed tool input from (1) an explicit agents.config.yaml
    # input_map (tool_input -> state/output key), (2) a top-level session-state
    # value, or (3) a matching field inside an upstream node's *_output payload.
    overrides = _adapter_cfg(module_id, "input_map", {}) or {}
    args: dict = {}
    for name in input_names:
        source_key = overrides.get(name, name)
        if ctx.state.get(source_key) is not None:
            args[name] = ctx.state.get(source_key)
            continue
        # Fall back to a field named source_key inside any upstream *_output dict.
        for key, value in ctx.state.items():
            if key.endswith("_output") and isinstance(value, dict) and value.get(source_key) is not None:
                args[name] = value.get(source_key)
                break
    missing = [name for name in required_names if name not in args]
    if missing:
        raise RuntimeError(
            f"{module_id}: required MCP tool inputs missing from session state / upstream outputs: {missing}. "
            "Set an input_map for this adapter in agents.config.yaml."
        )
    return args


${funcBlocks.join("\n\n")}${funcBlocks.length ? "\n\n\n" : ""}# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

${nodeBlocks.join("\n\n")}
${joinDecls.length ? `\n${joinDecls.join("\n")}\n` : ""}

root_agent = Workflow(
    name=${toPyStr(packageName)},
    description=${toPyStr(description)},
    edges=${edgeLiteral},
)
`;
}

function emitAgentNode(module) {
  const sym = nodeSymbol(module);
  const instruction = module.instruction || `You are ${module.name}. Operate only on the synthetic inputs in session state.`;
  return `${sym} = LlmAgent(
    name=${toPyStr(pyNodeName(module))},
    model=_model_for(${toPyStr(module.id)}, ${toPyStr(module.model || DEFAULT_MODEL)}),
    instruction=_agent_cfg(${toPyStr(module.id)}, "instruction", ${toPyStr(instruction)}),
    description=${toPyStr(truncate(module.name))},
    output_key=${toPyStr(stateKey(module))},
    mode="single_turn",
)`;
}

function emitFunctionNodeDecl(module) {
  return `${nodeSymbol(module)} = FunctionNode(func=${funcName(module)}, name=${toPyStr(pyNodeName(module))})`;
}

function emitStubFunc(module) {
  const kindNote =
    module.module_category === "workflow"
      ? "deterministic workflow coordinator placeholder"
      : adapterConnection(module) === "unconnected"
        ? "unconnected adapter (no Mock Lab MCP server bound)"
        : "reviewed TODO boundary";
  const connectionStatus = module.module_category === "adapter" ? "unconnected" : "coordinator";
  return `async def ${funcName(module)}(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: ${escapePythonString(module.name)} — ${kindNote}.

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS[${toPyStr(module.id)}]
    payload = {
        "module_id": ${toPyStr(module.id)},
        "module_name": ${toPyStr(module.name)},
        "connection_status": ${toPyStr(connectionStatus)},
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state[${toPyStr(stateKey(module))}] = payload
    return payload`;
}

function emitConnectedAdapterFunc(module) {
  const inputNames = (module.inputs ?? []).map((field) => field.name).filter(Boolean);
  const requiredNames = (module.inputs ?? []).filter((field) => field.required).map((field) => field.name).filter(Boolean);
  return `async def ${funcName(module)}(ctx: Context) -> dict:
    """Calls the live Mock Lab MCP tool ${toPyStr(module.mcp_tool_name)} (synthetic Mock Lab only).

    Deterministic adapter: opens an MCP session and calls the named tool directly
    so a real tools/call happens (verifiable in audit), instead of relying on a
    model to choose the tool.
    """
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url(${toPyStr(module.id)}, ${toPyStr(module.mcp_server)})
    arguments = _collect_tool_inputs(
        ctx, ${toPyStr(module.id)}, ${toPythonLiteral(inputNames)}, ${toPythonLiteral(requiredNames)}
    )
    async with streamablehttp_client(url) as (read_stream, write_stream, _close):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool(${toPyStr(module.mcp_tool_name)}, arguments=arguments)
    content = getattr(tool_result, "content", None) or []
    payload = {
        "module_id": ${toPyStr(module.id)},
        "module_name": ${toPyStr(module.name)},
        "connection_status": "mcp_connected",
        "status": "mcp_tool_called",
        "mcp_server": ${toPyStr(module.mcp_server)},
        "mcp_tool": ${toPyStr(module.mcp_tool_name)},
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    ctx.state[${toPyStr(stateKey(module))}] = payload
    return payload`;
}

// ---------------------------------------------------------------------------
// Runnable bundle support files
// ---------------------------------------------------------------------------

function buildAgentsConfig() {
  const lines = [];
  lines.push("# agents.config.yaml — per-node overrides for the runnable ADK bundle.");
  lines.push("# Edit model / instruction / mcp_url here. agent.py loads this at import and");
  lines.push("# applies the overrides, so editing this file actually changes behavior.");
  lines.push("# This file plus .env is how each developer individualizes the generated bundle.");
  lines.push(`default_model: ${DEFAULT_MODEL}`);

  const agents = modules.filter(isAgentModule);
  lines.push("agents:");
  if (!agents.length) lines.push("  []");
  for (const module of agents) {
    lines.push(`  - id: ${module.id}`);
    lines.push(`    name: ${pyNodeName(module)}`);
    lines.push(`    model: ${module.model || DEFAULT_MODEL}`);
    lines.push("    instruction: |");
    const instruction = module.instruction || `You are ${module.name}.`;
    for (const line of String(instruction).split("\n")) lines.push(`      ${line}`);
  }

  const adapters = modules.filter((module) => module.module_category === "adapter");
  lines.push("adapters:");
  if (!adapters.length) lines.push("  []");
  for (const module of adapters) {
    const connected = adapterConnection(module) === "mcp_connected";
    lines.push(`  - id: ${module.id}`);
    lines.push(`    connection: ${connected ? "mcp_connected" : "unconnected"}`);
    lines.push(`    mcp_server: ${module.mcp_server ? module.mcp_server : "null"}`);
    lines.push(`    mcp_tool: ${module.mcp_tool_name ? module.mcp_tool_name : "null"}`);
    lines.push("    mcp_url: null  # default: $AF_MOCK_LAB_MCP_URL/<mcp_server>");
    if (connected) {
      lines.push("    input_map: {}  # optional: {tool_input_name: state_or_upstream_output_key}");
    }
  }

  const workflows = modules.filter((module) => module.module_category === "workflow");
  if (workflows.length) {
    lines.push("workflows:");
    for (const module of workflows) {
      lines.push(`  - id: ${module.id}`);
      lines.push("    note: deterministic coordinator placeholder; expand into a sub-graph in a follow-up.");
    }
  }
  return `${lines.join("\n")}\n`;
}

function buildEnvExample() {
  return `# Copy to .env (gitignored). ADK auto-loads .env for the agent at runtime.
# Gemini provider key — required for runnable mode. Synthetic inputs only.
GOOGLE_API_KEY=
# Optional: base URL of the Mock Lab network MCP endpoint for connected adapters.
# AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5176/api/mock-lab/mcp
`;
}

function buildGitignore() {
  return `.env\n.venv/\n__pycache__/\n*.pyc\n`;
}

// ---------------------------------------------------------------------------
// Smoke-mode dead-stub node functions (preserved for the smoke bundle)
// ---------------------------------------------------------------------------

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
  const guardrails =
    outputMode === "runnable"
      ? {
          raw_requirement_to_code: false,
          generated_business_logic: false,
          private_data_or_endpoints: false,
          runnable_synthetic_wiring: true
        }
      : {
          raw_requirement_to_code: false,
          generated_business_logic: false,
          private_data_or_endpoints: false
        };
  return {
    package: packageName,
    output_mode: outputMode,
    requirement: {
      id: normalizedRequirement.id,
      title: normalizedRequirement.title,
      status: normalizedRequirement.status
    },
    guardrails,
    runtime:
      outputMode === "runnable"
        ? {
            provider: "gemini",
            default_model: DEFAULT_MODEL,
            connected_adapters: connectedAdapters.map((module) => ({
              module_id: module.id,
              module_name: module.name,
              mcp_server: module.mcp_server ?? null,
              mcp_tool_name: module.mcp_tool_name ?? null
            })),
            unconnected_adapters: unconnectedAdapters.map((module) => ({
              module_id: module.id,
              module_name: module.name
            }))
          }
        : null,
    scaffold_plan: {
      source: scaffoldPlan.source,
      raw_requirement_to_code: scaffoldPlan.raw_requirement_to_code,
      output_mode: outputMode,
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
  if (outputMode === "runnable") {
    const adk = connectedAdapters.length ? "google-adk[mcp]>=2.1.0" : "google-adk>=2.1.0";
    return `${[adk, "google-genai>=1.0.0", "pyyaml>=6.0", "pytest"].join("\n")}\n`;
  }
  return `${["google-adk>=2.0.0", "pytest"].join("\n")}\n`;
}

function buildContractTest() {
  if (outputMode === "runnable") {
    return `import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def test_agent_source_declares_runnable_workflow():
    source = (ROOT / "${packageName}" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk.workflow import" in source
    assert "from google.adk.agents import LlmAgent" in source
    assert "root_agent = Workflow(" in source
    assert "SyntheticRuntimeSmokeAgent" not in source
    assert 'mode="single_turn"' in source


def test_manifest_declares_runnable_mode():
    manifest = (ROOT / "${packageName}" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"output_mode": "runnable"' in manifest
    assert '"raw_requirement_to_code": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"runtime"' in manifest


def test_runtime_chat_smoke_contract_is_present():
    smoke = (ROOT / "runtime-chat-smoke.json").read_text(encoding="utf-8")
    assert '"appName": "${packageName}"' in smoke
    assert '"port": 8765' in smoke


@pytest.mark.skipif(importlib.util.find_spec("google.adk") is None, reason="google-adk not installed")
def test_root_agent_is_a_workflow():
    from google.adk.workflow import Workflow

    module = importlib.import_module("${packageName}.agent")
    assert isinstance(module.root_agent, Workflow)
`;
  }
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
  if (outputMode === "runnable") {
    return `# ${packageName}

Runnable ADK 2.1 workflow generated from approved scaffold-plan.json for ${normalizedRequirement.title}.

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set GOOGLE_API_KEY=...
python -m compileall ${packageName} tests
python -m pytest -q
\`\`\`

## What this bundle is

- \`root_agent\` is a \`google.adk.workflow.Workflow\` graph. Agent nodes are
  \`LlmAgent\` instances that call Gemini; adapter nodes are deterministic
  \`FunctionNode\`s. The graph runs over **synthetic inputs only** — no private
  endpoints, credentials, or real customer data.
- Generated from reviewed Agent Factory artifacts (\`raw_requirement_to_code=false\`).

## Individualize it

Edit \`agents.config.yaml\` to override any node's \`model\` or \`instruction\`
(and an adapter's \`mcp_url\`). \`agent.py\` loads this file at import, so changes
take effect on the next run. Put your \`GOOGLE_API_KEY\` in \`.env\` (gitignored).

## Adapters and the Mock Lab

Connected adapters call a live Mock Lab MCP tool over streamable-HTTP
(\`AF_MOCK_LAB_MCP_URL\` base, default \`http://127.0.0.1:5176/api/mock-lab/mcp\`). Adapters with no
bound/running Mock Lab server stay as TODO stubs returning reviewed synthetic
mock output and are listed under \`runtime.unconnected_adapters\` in
\`workflow_manifest.json\`.

## ADK runtime chat

\`\`\`bash
adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl -X POST http://127.0.0.1:8765/apps/${packageName}/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
\`\`\`
`;
  }
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
  const sample = firstSmokeSample();
  const text =
    outputMode === "runnable"
      ? sample || `Run the ${normalizedRequirement.title} workflow over synthetic sample inputs and summarize the result.`
      : `Run a synthetic ADK chat smoke for ${normalizedRequirement.title}.`;
  return {
    host: "127.0.0.1",
    port: 8765,
    appName: packageName,
    userId: "af-reviewer",
    sessionId: "af-smoke",
    newMessage: {
      role: "user",
      parts: [{ text }]
    }
  };
}

function firstSmokeSample() {
  for (const module of modules) {
    const sample = module.smoke_spec?.sample_user_message;
    if (typeof sample === "string" && sample.trim()) return sample.trim();
  }
  return "";
}

function buildImplementationHandoff() {
  const todoLines = scaffoldPlan.modules.flatMap((module) =>
    (module.developer_todos ?? []).map((todo) => `- ${module.name}: ${todo}`)
  );
  if (outputMode === "runnable") {
    const unconnected = unconnectedAdapters.map((module) => `- ${module.name}: bind a Mock Lab MCP server or keep the synthetic stub.`);
    return `# Implementation Handoff (runnable mode)

Generated from reviewed scaffold-plan.json for ${normalizedRequirement.title}.

## What runs today

- Agent nodes call Gemini; connected adapter nodes call live Mock Lab MCP tools.
- Everything runs over synthetic inputs only.

## Boundaries that still must hold

- Do not add private endpoints, credentials, customer data, or deployment scripts.
- Keep adapter calls pointed at synthetic Mock Lab servers, not real systems.
- Individualize via agents.config.yaml and .env, not by hard-coding secrets.

## Unconnected adapters (synthetic stub until a Mock Lab server is bound)

${unconnected.length ? unconnected.join("\n") : "- none"}

## Reviewed TODO notes

${todoLines.length ? todoLines.join("\n") : "- Review generated nodes before production wiring."}
`;
  }
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
    scaffoldPlan.modules.map((module) => {
      const base = {
        catalog_binding: module.catalog_binding ?? null,
        developer_todos: module.developer_todos,
        inputs: module.inputs,
        outputs: module.outputs,
        risk_signals: module.risk_signals,
        runtime_mock: module.runtime_mock ?? null
      };
      if (outputMode !== "runnable") return [module.id, base];
      return [
        module.id,
        {
          module_category: module.module_category,
          ...base,
          instruction: module.instruction ?? null,
          model: module.model ?? null,
          access_protocol: module.access_protocol ?? null,
          mcp_server: module.mcp_server ?? null,
          mcp_tool_name: module.mcp_tool_name ?? null,
          connection_status: adapterConnection(module)
        }
      ];
    })
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

// ---------------------------------------------------------------------------
// Runnable graph lowering — Python symbols, fan-out via repeated edges,
// fan-in via a synthetic JoinNode (normal nodes do NOT wait for all preds).
// ---------------------------------------------------------------------------

function buildRunnableGraph() {
  const graph = graphIndexes();
  const resolve = (nodeId, side) => {
    const node = graph.nodesById.get(nodeId);
    if (!node) return null;
    if (typeof node.module_id === "string" && graph.moduleById.has(node.module_id)) {
      return nodeSymbol(graph.moduleById.get(node.module_id));
    }
    if (side === "from" && node.node_kind === "input") return "START";
    return null; // output nodes (terminal markers) and unknowns are dropped
  };

  const baseEdges = [];
  const seen = new Set();
  const add = (from, to) => {
    if (!from || !to || from === to) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    baseEdges.push([from, to]);
  };

  if (Array.isArray(processFlow.edges)) {
    for (const edge of processFlow.edges) {
      const from = resolve(edge.from, "from");
      const to = resolve(edge.to, "to");
      if (from && to && from === to && from !== "START") {
        throw new Error(
          `runnable mode does not support self-loop/loop Graph IR yet (node ${from}). Use smoke mode or wait for loop lowering.`
        );
      }
      add(from, to);
    }
  }

  // Every module node must be reachable from START.
  const incoming = new Set(baseEdges.map(([, to]) => to));
  for (const node of graph.moduleNodes) {
    const sym = nodeSymbol(graph.moduleById.get(node.module_id));
    if (!incoming.has(sym)) add("START", sym);
  }

  // Fan-in: any target with >1 distinct predecessor gets a JoinNode.
  const sourcesByTarget = new Map();
  for (const [from, to] of baseEdges) {
    if (!sourcesByTarget.has(to)) sourcesByTarget.set(to, []);
    sourcesByTarget.get(to).push(from);
  }
  const joins = [];
  const finalEdges = [];
  const joined = new Set();
  let joinIndex = 0;
  for (const [target, sources] of sourcesByTarget) {
    if (sources.length > 1) {
      const joinSym = `join_${++joinIndex}`;
      joins.push({ sym: joinSym, target });
      for (const source of sources) finalEdges.push([source, joinSym]);
      finalEdges.push([joinSym, target]);
      joined.add(target);
    }
  }
  for (const [from, to] of baseEdges) {
    if (!joined.has(to)) finalEdges.push([from, to]);
  }

  if (finalEdges.length === 0) {
    throw new Error("processFlow does not provide any usable Graph IR edges for runnable workflow generation.");
  }
  assertAcyclic(finalEdges);
  return { edges: finalEdges, joins };
}

// Runnable v1 supports DAG + fan-out/fan-in only. A cycle (incl. one created by
// a back-edge feeding a JoinNode, which would deadlock waiting on a successor)
// is rejected with a clear error rather than emitting a broken/looping graph.
function assertAcyclic(edges) {
  const adjacency = new Map();
  const inDegree = new Map();
  const nodes = new Set();
  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
  }
  for (const node of nodes) {
    adjacency.set(node, []);
    inDegree.set(node, 0);
  }
  for (const [from, to] of edges) {
    adjacency.get(from).push(to);
    inDegree.set(to, inDegree.get(to) + 1);
  }
  const queue = [...nodes].filter((node) => inDegree.get(node) === 0);
  let visited = 0;
  while (queue.length) {
    const node = queue.shift();
    visited += 1;
    for (const next of adjacency.get(node)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== nodes.size) {
    const inCycle = [...nodes].filter((node) => inDegree.get(node) > 0);
    throw new Error(
      `runnable mode does not support cyclic/loop Graph IR yet (cycle involves: ${inCycle.join(", ")}). Use smoke mode or wait for loop lowering.`
    );
  }
}

// Runnable v1 lowers a DAG with fan-out/fan-in only. Conditional routing, loops,
// human-input, and remote boundary crossing are NOT lowered yet — emitting them
// as plain edges would silently produce a wrong graph, so reject them up front
// rather than mis-generate. (Sets are declared inside the function to avoid a
// temporal-dead-zone with the top-level buildFiles() call.)
function assertRunnableGraphSupported() {
  // remote_a2a is a real remote boundary, not lowered in v1 (degrading it to a
  // stub would silently fake the remote agent), so it is rejected like routes/loops.
  const unsupportedNodeKinds = new Set(["router", "loop_control", "human_input", "remote_a2a"]);
  const unsupportedExecSemantics = new Set(["loop_back", "loop_exit", "conditional", "boundary_crossing"]);
  const unsupportedEdgeKinds = new Set(["route", "remote_a2a"]);
  const unsupportedContainerKinds = new Set([
    "dynamic_workflow",
    "loop_region",
    "human_review_region",
    "remote_boundary"
  ]);
  const nodes = Array.isArray(processFlow.nodes) ? processFlow.nodes : [];
  const badNodes = nodes
    .filter((node) => node && unsupportedNodeKinds.has(node.node_kind))
    .map((node) => `${node.id} (${node.node_kind})`);
  if (badNodes.length > 0) {
    throw new Error(
      `runnable mode does not support these control-flow nodes yet: ${badNodes.join(", ")}. Use smoke mode or wait for route/loop/human-input/remote lowering.`
    );
  }
  // Containers are a separate top-level array in Graph IR, not a node field.
  const containers = Array.isArray(processFlow.containers) ? processFlow.containers : [];
  const badContainers = containers
    .filter((container) => container && unsupportedContainerKinds.has(container.container_kind))
    .map((container) => `${container.id} (${container.container_kind})`);
  if (badContainers.length > 0) {
    throw new Error(
      `runnable mode does not support these container regions yet: ${badContainers.join(", ")}. Use smoke mode or wait for loop/human-review/remote/dynamic lowering.`
    );
  }
  const edges = Array.isArray(processFlow.edges) ? processFlow.edges : [];
  const badEdges = edges
    .filter(
      (edge) =>
        edge &&
        (unsupportedExecSemantics.has(edge.execution_semantics) ||
          unsupportedEdgeKinds.has(edge.edge_kind) ||
          edge.is_remote_boundary_crossing === true)
    )
    .map((edge) => `${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
  if (badEdges.length > 0) {
    throw new Error(
      `runnable mode does not support these edges yet: ${badEdges.join(", ")}. Use smoke mode or wait for route/loop/remote lowering.`
    );
  }
}

// Defense-in-depth: module ids are pattern-constrained (^mod-[a-z0-9-]+$) so
// sanitization should not collide, but a collision would silently overwrite a
// node/function — fail loudly instead.
function assertNoSymbolCollisions(orderedModules) {
  const seen = new Map();
  for (const module of orderedModules) {
    const symbols = [
      ["node symbol", nodeSymbol(module)],
      ["function name", funcName(module)],
      ["node name", pyNodeName(module)],
      ["state key", stateKey(module)]
    ];
    for (const [kind, value] of symbols) {
      const key = `${kind}::${value}`;
      if (seen.has(key)) {
        throw new Error(`runnable codegen ${kind} collision "${value}" between ${seen.get(key)} and ${module.id}.`);
      }
      seen.set(key, module.id);
    }
  }
}

function orderedGraphModules() {
  // Emit nodes in Graph IR node order so the file is stable and readable.
  const graph = graphIndexes();
  const ordered = graph.moduleNodes
    .map((node) => graph.moduleById.get(node.module_id))
    .filter(Boolean);
  const seen = new Set(ordered.map((module) => module.id));
  for (const module of modules) {
    if (!seen.has(module.id)) {
      ordered.push(module);
      seen.add(module.id);
    }
  }
  return ordered;
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

// ---------------------------------------------------------------------------
// Module classification + symbol naming
// ---------------------------------------------------------------------------

function isAgentModule(module) {
  return module.module_category === "agent";
}

function adapterConnection(module) {
  if (module.module_category !== "adapter") return "n/a";
  if (module.access_protocol === "mcp" && module.mcp_server && module.mcp_tool_name) return "mcp_connected";
  return "unconnected";
}

function nodeSymbol(module) {
  return `${isAgentModule(module) ? "agent_" : "node_"}${toPythonIdentifier(module.id)}`;
}

function funcName(module) {
  return `_fn_${toPythonIdentifier(module.id)}`;
}

function pyNodeName(module) {
  return toPythonIdentifier(module.id);
}

function stateKey(module) {
  return `${toPythonIdentifier(module.id)}_output`;
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

function toPythonLiteral(value, indent = 0) {
  // Recursive emitter: strings stay opaque (via toPyStr) so values like "true"
  // or "null" are never rewritten; only real booleans/null become True/False/None.
  // Matches JSON.stringify(value, null, 4) spacing for ASCII data so smoke output
  // stays byte-identical.
  const pad = "    ".repeat(indent);
  const padInner = "    ".repeat(indent + 1);
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "string") return toPyStr(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${padInner}${toPythonLiteral(item, indent + 1)}`).join(",\n");
    return `[\n${items}\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const items = entries
      .map(([key, val]) => `${padInner}${toPyStr(key)}: ${toPythonLiteral(val, indent + 1)}`)
      .join(",\n");
    return `{\n${items}\n${pad}}`;
  }
  return "None";
}

function toPythonEdgeTupleLiteral(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "[]";
  return `[\n${rows.map(([from, to]) => `    (${JSON.stringify(from)}, ${JSON.stringify(to)})`).join(",\n")}\n]`;
}

function toPyStr(value) {
  // JSON string escapes (\n, \", \\, \uXXXX) are all valid Python string escapes.
  return JSON.stringify(String(value ?? ""));
}

function truncate(value, max = 200) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapePythonString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
