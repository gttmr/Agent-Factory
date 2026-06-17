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
const RUNTIME_MCP_LABEL = "런타임 MCP";
const RUNTIME_MCP_NOTE = "실행 시점에 Mock Lab MCP 서버를 통해 모델이 파악한 데이터입니다.";
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
  console.log("  # .env.example을 <repo>/.agent-factory/runtime.env로 복사하고 GOOGLE_API_KEY를 그 파일에 설정하세요");
}
console.log(`  python -m compileall ${packageName}`);
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
    // tests live INSIDE the agent package so the ADK agents_dir (the bundle
    // root) has only the package as a non-dot subdir. Otherwise `adk
    // api_server` scans a sibling `tests/` as an app and the dev UI errors
    // with "No root_agent found for 'tests'".
    [`${packageName}/tests/__init__.py`]: "",
    [`${packageName}/tests/test_workflow_contract.py`]: buildContractTest(),
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
  // agent.py builders keyed by output mode. A future runtime form (e.g. an ADK
  // dynamic-workflow bundle) plugs in as one entry here plus its builder, rather
  // than another branch. Declared inside the function so the top-level
  // buildFiles() driver does not hit a temporal-dead-zone on these consts.
  const AGENT_PY_BUILDERS = {
    smoke: buildSmokeAgentPy,
    runnable: buildRunnableAgentPy
  };
  return (AGENT_PY_BUILDERS[outputMode] ?? buildSmokeAgentPy)();
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
    user_note = f" 받은 메시지: {user_text[:160]}" if user_text else ""
    return (
        "${packageName} ADK 런타임 smoke: "
        f"승인된 모듈 {len(COMPONENT_CONTRACTS)}개를 불러왔고, "
        f"합성 런타임 mock {mock_count}개를 사용할 수 있습니다. "
        f"최종 출력: {terminal_outputs}. "
        "이 응답은 검토된 합성 테스트 더블만 사용하며 실제 업무 로직이 아닙니다."
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
    description="검토된 Agent Factory 인계 artifact를 확인하는 합성 ADK 런타임 smoke bridge입니다.",
)
`;
}

function buildRunnableAgentPy() {
  assertRunnableGraphSupported();
  assertDataChannelsSupported();
  const { edges, joins } = buildRunnableGraph();
  const graph = graphIndexes();
  const orderedModules = orderedGraphModules();
  const humanInputNodes = graph.nodes.filter((node) => node.node_kind === "human_input");
  const explicitJoinNodes = graph.nodes.filter((node) => node.node_kind === "join");
  const autoJoins = joins.filter((join) => join.explicit === false);
  assertNoSymbolCollisions(orderedModules, [...humanInputNodes, ...explicitJoinNodes, ...autoJoins]);
  const nodeBlocks = [];
  const funcBlocks = [];

  // Node lowering registry: maps a node's lowering role to its function/
  // declaration emitters, replacing the per-role if/elif chain. Adding a node
  // kind (e.g. a future remote_a2a or dynamic node) adds a registry entry here —
  // though it may also need import, guard (assertRunnableGraphSupported), and
  // graph-resolution support, so this is the emission seam, not the whole story.
  // emitFunc returns null when the node needs no standalone function (LlmAgent
  // agents are declared inline). Emission order — module nodes in graph order,
  // then human-input nodes — is preserved.
  const NODE_LOWERING = {
    agent: { emitFunc: () => null, emitDecl: emitAgentNode },
    connected_adapter: { emitFunc: emitConnectedAdapterFunc, emitDecl: emitFunctionNodeDecl },
    stub_function: { emitFunc: emitStubFunc, emitDecl: emitFunctionNodeDecl },
    human_input: { emitFunc: emitHumanInputFunc, emitDecl: emitHumanInputNodeDecl }
  };
  const emitNode = (role, target) => {
    const handler = NODE_LOWERING[role];
    if (!handler) throw new Error(`runnable codegen: no node-lowering handler for role "${role}".`);
    const func = handler.emitFunc(target);
    if (func) funcBlocks.push(func);
    nodeBlocks.push(handler.emitDecl(target));
  };

  for (const module of orderedModules) emitNode(moduleLoweringRole(module), module);
  for (const node of humanInputNodes) emitNode("human_input", node);

  const joinDecls = joins.map((join) => `${join.sym} = JoinNode(name=${toPyStr(join.name)})`);
  const edgeLiteral = `[\n${edges.map(([s, t]) => `        (${s}, ${t}),`).join("\n")}\n    ]`;
  const description = `검토된 Agent Factory artifact에서 생성한 실행 가능한 ADK 2.1 워크플로우입니다: ${truncate(
    normalizedRequirement.title || packageName
  )}.`;

  return `from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from google.adk import Context
from google.adk.agents import LlmAgent
from google.adk.events import RequestInput
from google.adk.workflow import FunctionNode, JoinNode, START, Workflow


# Reviewed contract data for each approved module (synthetic test doubles only).
COMPONENT_CONTRACTS: dict[str, dict] = ${toPythonLiteral(componentContracts())}

# Shared secrets live in <repo>/.agent-factory/runtime.env, or in the file
# pointed to by AF_RUNTIME_ENV_FILE. agents.config.yaml stays per-bundle and
# contains behavior overrides only.
_BUNDLE_DIR = Path(__file__).resolve().parent.parent
_CONFIG_PATH = _BUNDLE_DIR / "agents.config.yaml"
_DEFAULT_RUNTIME_ENV_RELATIVE_PATH = ".agent-factory/runtime.env"


def _parse_runtime_env(source: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in source.lstrip("\\ufeff").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key.replace("_", "A").isalnum() or key[0].isdigit():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = (
                value[1:-1]
                .replace("\\\\n", "\\n")
                .replace("\\\\r", "\\r")
                .replace("\\\\t", "\\t")
                .replace('\\\\"', '"')
                .replace("\\\\\\\\", "\\\\")
            )
        elif len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        values[key] = value
    return values


def _central_runtime_env_path() -> Path:
    configured = os.environ.get("AF_RUNTIME_ENV_FILE")
    if configured:
        path = Path(configured).expanduser()
        return path if path.is_absolute() else (Path.cwd() / path).resolve()
    for root in (_BUNDLE_DIR, *_BUNDLE_DIR.parents):
        candidate = root / _DEFAULT_RUNTIME_ENV_RELATIVE_PATH
        if candidate.exists():
            return candidate
    return _BUNDLE_DIR / _DEFAULT_RUNTIME_ENV_RELATIVE_PATH


def _load_central_runtime_env() -> None:
    path = _central_runtime_env_path()
    if not path.exists():
        return
    for key, value in _parse_runtime_env(path.read_text(encoding="utf-8")).items():
        os.environ[key] = value


_load_central_runtime_env()


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
    base = os.environ.get("AF_MOCK_LAB_MCP_URL", "http://127.0.0.1:5173/api/mock-lab/mcp").rstrip("/")
    return f"{base}/{mcp_server}"


def _user_text_from_context(ctx: Context) -> str:
    content = getattr(ctx, "user_content", None)
    parts = getattr(content, "parts", None) or []
    text = "".join(getattr(part, "text", "") or "" for part in parts)
    return text.strip()


def _collect_tool_inputs(
    ctx: Context, module_id: str, input_names: list[str], required_names: list[str],
    channel_keys: list[str] | None = None,
) -> dict:
    # Resolve each reviewed tool input from (1) an explicit agents.config.yaml
    # input_map (tool_input -> state/output key), (2) a named incoming data
    # channel (a reviewed edge's session/temp/user/app state key), (3) a
    # top-level session-state value, (4) a matching field inside an upstream
    # node's *_output payload, or (5) the reviewed smoke_spec.synthetic_inputs
    # seed for runnable synthetic Mock Lab calls. The fallback keeps runnable
    # scaffolds executable without inventing private data or hard-coding business
    # values in generated code.
    overrides = _adapter_cfg(module_id, "input_map", {}) or {}
    contract = COMPONENT_CONTRACTS.get(module_id, {})
    smoke_spec = contract.get("smoke_spec") if isinstance(contract, dict) else {}
    synthetic_inputs = smoke_spec.get("synthetic_inputs", {}) if isinstance(smoke_spec, dict) else {}
    channel_payloads = [
        ctx.state.get(channel_key)
        for channel_key in (channel_keys or [])
        if isinstance(ctx.state.get(channel_key), dict)
    ]
    args: dict = {}
    for name in input_names:
        source_key = overrides.get(name, name)
        if ctx.state.get(source_key) is not None:
            args[name] = ctx.state.get(source_key)
            continue
        # Prefer a field named source_key from an explicitly-named incoming data channel.
        for payload in channel_payloads:
            if payload.get(source_key) is not None:
                args[name] = payload.get(source_key)
                break
        if name in args:
            continue
        # Fall back to a field named source_key inside any upstream *_output dict.
        # ADK's State object is not a dict (no .items()); to_dict() merges base + delta.
        for key, value in ctx.state.to_dict().items():
            if key.endswith("_output") and isinstance(value, dict) and value.get(source_key) is not None:
                args[name] = value.get(source_key)
                break
        if name not in args and source_key in {"query", "user_request"}:
            user_text = _user_text_from_context(ctx)
            if user_text:
                args[name] = user_text
        if name not in args and isinstance(synthetic_inputs, dict) and synthetic_inputs.get(source_key) is not None:
            args[name] = synthetic_inputs.get(source_key)
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
  const instruction = module.instruction || defaultAgentInstruction(module);
  return `${sym} = LlmAgent(
    name=${toPyStr(pyNodeName(module))},
    model=_model_for(${toPyStr(module.id)}, ${toPyStr(module.model || DEFAULT_MODEL)}),
    instruction=_agent_cfg(${toPyStr(module.id)}, "instruction", ${toPyStr(instruction)}),
    description=${toPyStr(truncate(module.name))},
    output_key=${toPyStr(agentOutputStateKey(module))},
    mode="single_turn",
)`;
}

function defaultAgentInstruction(module) {
  return [
    `당신은 "${module.name}" Agent입니다.`,
    "검토된 synthetic 입력과 session state 안의 데이터만 사용하세요.",
    "private data, 실제 endpoint, credential은 만들거나 추정하지 마세요."
  ].join("\n");
}

function emitFunctionNodeDecl(module) {
  return `${nodeSymbol(module)} = FunctionNode(func=${funcName(module)}, name=${toPyStr(pyNodeName(module))})`;
}

function emitHumanInputFunc(node) {
  return `def ${hitlFuncName(node)}(node_input=None):
    yield RequestInput(message=${toPyStr(humanInputPrompt(node))})`;
}

function emitHumanInputNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${hitlFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))})`;
}

function emitStubFunc(module) {
  const kindNote =
    module.module_category === "workflow"
      ? "검토된 결정적 워크플로우 조정자 자리표시자"
      : adapterConnection(module) === "unconnected"
        ? "Mock Lab MCP 서버가 아직 연결되지 않은 adapter"
        : "검토된 TODO boundary";
  const connectionStatus = module.module_category === "adapter" ? "unconnected" : "coordinator";
  return `async def ${funcName(module)}(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: ${escapePythonString(module.name)} — ${kindNote}.

    검토된 합성 테스트 더블 output만 반환합니다. 실제 업무 로직은 없습니다.
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
${emitOutgoingStateChannelWrites(module.id)}    return payload`;
}

function emitConnectedAdapterFunc(module) {
  const inputNames = (module.inputs ?? []).map((field) => field.name).filter(Boolean);
  const requiredNames = (module.inputs ?? []).filter((field) => field.required).map((field) => field.name).filter(Boolean);
  const channelKeys = incomingStateChannelKeys(module.id);
  const channelArg = channelKeys.length ? `,\n        ${toPythonLiteral(channelKeys, 2)}` : "";
  return `async def ${funcName(module)}(ctx: Context) -> dict:
    """실행 시점에 Mock Lab MCP tool ${toPyStr(module.mcp_tool_name)}을 호출합니다. synthetic Mock Lab 전용입니다.

    결정적 Adapter입니다. 모델이 tool을 고르게 하지 않고 MCP session을 열어
    지정된 tool을 직접 호출하므로 audit에서 실제 tools/call을 확인할 수 있습니다.
    """
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url(${toPyStr(module.id)}, ${toPyStr(module.mcp_server)})
    arguments = _collect_tool_inputs(
        ctx, ${toPyStr(module.id)}, ${toPythonLiteral(inputNames)}, ${toPythonLiteral(requiredNames)}${channelArg}
    )
    async with streamablehttp_client(url) as (read_stream, write_stream, _close):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool(${toPyStr(module.mcp_tool_name)}, arguments=arguments)
    content = getattr(tool_result, "content", None) or []
    structured_content = getattr(tool_result, "structuredContent", None)
    if structured_content is None:
        structured_content = getattr(tool_result, "structured_content", None)
    if hasattr(structured_content, "model_dump"):
        structured_content = structured_content.model_dump()
    if not isinstance(structured_content, dict):
        structured_content = {}
    payload = {
        "module_id": ${toPyStr(module.id)},
        "module_name": ${toPyStr(module.name)},
        "connection_status": "mcp_connected",
        "runtime_mcp_label": ${toPyStr(RUNTIME_MCP_LABEL)},
        "runtime_mcp_note": ${toPyStr(RUNTIME_MCP_NOTE)},
        "status": "mcp_tool_called",
        "mcp_server": ${toPyStr(module.mcp_server)},
        "mcp_tool": ${toPyStr(module.mcp_tool_name)},
        "structured_content": structured_content,
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    for key, value in structured_content.items():
        if key not in payload:
            payload[key] = value
    ctx.state[${toPyStr(stateKey(module))}] = payload
${emitOutgoingStateChannelWrites(module.id)}    return payload`;
}

// ---------------------------------------------------------------------------
// Runnable bundle support files
// ---------------------------------------------------------------------------

function buildAgentsConfig() {
  const lines = [];
  lines.push("# agents.config.yaml — runnable ADK bundle의 노드별 override 파일입니다.");
  lines.push("# 한글 우선 instruction을 여기에서 검토/수정하세요. model / instruction / mcp_url 변경은");
  lines.push("# agent.py import 시점에 반영되므로 다음 실행부터 실제 동작이 바뀝니다.");
  lines.push("# 공유 secret은 이 bundle이 아니라 <repo>/.agent-factory/runtime.env에 둡니다.");
  lines.push(`default_model: ${DEFAULT_MODEL}`);

  const agents = modules.filter(isAgentModule);
  lines.push("agents:");
  if (!agents.length) lines.push("  []");
  for (const module of agents) {
    lines.push(`  - id: ${module.id}`);
    lines.push(`    name: ${pyNodeName(module)}`);
    lines.push(`    model: ${module.model || DEFAULT_MODEL}`);
    lines.push("    instruction: |");
    const instruction = module.instruction || defaultAgentInstruction(module);
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
    if (connected) {
      lines.push(`    runtime_mcp_label: ${RUNTIME_MCP_LABEL}`);
      lines.push(`    runtime_mcp_note: ${RUNTIME_MCP_NOTE}`);
    }
    lines.push("    mcp_url: null  # 기본값: $AF_MOCK_LAB_MCP_URL/<mcp_server>");
    if (connected) {
      lines.push("    input_map: {}  # 선택: {tool_input_name: state_or_upstream_output_key}");
    }
  }

  const workflows = modules.filter((module) => module.module_category === "workflow");
  if (workflows.length) {
    lines.push("workflows:");
    for (const module of workflows) {
      lines.push(`  - id: ${module.id}`);
      lines.push("    note: 검토된 결정적 조정자 자리표시자입니다. 후속 작업에서 하위 그래프로 확장하세요.");
    }
  }
  return `${lines.join("\n")}\n`;
}

function buildEnvExample() {
  return `# Agent Factory 공유 runtime env template입니다.
# 이 파일을 <repo>/.agent-factory/runtime.env로 복사하거나 AF_RUNTIME_ENV_FILE을 지정하세요.
# Gemini key를 각 runtime-stub/.env에 반복해서 복사하지 마세요.
#
# GOOGLE_API_KEY=...
# AF_MOCK_LAB_MCP_URL=http://127.0.0.1:5173/api/mock-lab/mcp
`;
}

function buildGitignore() {
  return `.env\n.venv/\n.adk/\n__pycache__/\n*.pyc\n`;
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
              runtime_mcp_label: RUNTIME_MCP_LABEL,
              runtime_mcp_note: RUNTIME_MCP_NOTE,
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


ROOT = Path(__file__).resolve().parents[2]


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


ROOT = Path(__file__).resolve().parents[2]


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

${normalizedRequirement.title}의 승인된 scaffold-plan.json에서 생성한 runnable ADK 2.1 Workflow입니다.

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir -p ../../../../.agent-factory
cp .env.example ../../../../.agent-factory/runtime.env
python -m compileall ${packageName}
python -m pytest -q
\`\`\`

## 이 번들의 역할

- \`root_agent\`는 \`google.adk.workflow.Workflow\` graph입니다. Agent node는 Gemini를 호출하는
  \`LlmAgent\`이고, adapter node는 deterministic \`FunctionNode\`입니다.
- graph는 **synthetic input만** 사용합니다. private endpoint, credential, 실제 고객 데이터는 포함하지 않습니다.
- reviewed Agent Factory artifact에서만 생성되었습니다(\`raw_requirement_to_code=false\`).

## 설정 변경

\`agents.config.yaml\`에서 각 node의 \`model\`, \`instruction\`, adapter의 \`mcp_url\`을 검토/수정하세요.
\`agent.py\`가 import 시점에 이 파일을 읽으므로 다음 실행부터 변경이 적용됩니다.

\`.env.example\`을 repository root의 \`.agent-factory/runtime.env\`로 복사하고 공유 runtime secret은 그 파일에 둡니다.
\`AF_RUNTIME_ENV_FILE\`로 다른 파일을 지정할 수도 있습니다. 각 \`runtime-stub\`마다 \`GOOGLE_API_KEY\`를 반복해서 넣지 마세요.

## Adapter와 Mock Lab

연결된 adapter는 streamable-HTTP로 실행 중인 Mock Lab MCP tool을 호출합니다
(\`AF_MOCK_LAB_MCP_URL\` base, 기본값 \`http://127.0.0.1:5173/api/mock-lab/mcp\`).
이 결과는 \`${RUNTIME_MCP_LABEL}\` 라벨과 함께 payload와 \`workflow_manifest.json\`에 기록됩니다.
Mock Lab server가 binding/running 상태가 아닌 adapter는 reviewed synthetic mock output을 반환하는 TODO stub으로 남고,
\`workflow_manifest.json\`의 \`runtime.unconnected_adapters\`에 표시됩니다.

## ADK runtime chat

\`\`\`bash
adk api_server --host 127.0.0.1 --port 8765 --session_service_uri memory:// --artifact_service_uri memory:// --no-reload --with_ui .
curl -X POST http://127.0.0.1:8765/apps/${packageName}/users/af-reviewer/sessions/af-smoke -H "Content-Type: application/json" -d '{}'
curl -X POST http://127.0.0.1:8765/run -H "Content-Type: application/json" -d @runtime-chat-smoke.json
\`\`\`
`;
  }
  return `# ${packageName}

${normalizedRequirement.title}의 승인된 scaffold-plan.json에서 생성한 ADK smoke handoff입니다.

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m compileall ${packageName}
python -m pytest -q
\`\`\`

## ADK runtime chat smoke

이 bundle은 검토된 합성 테스트 더블만 사용해 로컬 ADK API/Web UI smoke test를 수행합니다.
비공개 endpoint, credential, 배포 script, 실제 업무 로직은 포함하지 않습니다.

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
      ? sample || `${normalizedRequirement.title} 워크플로우를 합성 sample input으로 실행하고 결과를 요약하세요.`
      : `${normalizedRequirement.title}에 대한 합성 ADK chat smoke를 실행하세요.`;
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
    const unconnected = unconnectedAdapters.map((module) => `- ${module.name}: Mock Lab MCP 서버를 binding하거나 합성 stub으로 유지하세요.`);
    return `# 구현 Handoff (runnable mode)

${normalizedRequirement.title}의 reviewed scaffold-plan.json에서 생성되었습니다.

## 현재 실행되는 것

- Agent node는 Gemini를 호출하고, 연결된 Adapter node는 실제 실행 시점에 Mock Lab MCP tool을 호출합니다.
- 연결된 MCP 결과는 \`${RUNTIME_MCP_LABEL}\` 라벨과 함께 payload에 기록됩니다.
- 모든 실행은 합성 input만 사용합니다.

## 반드시 유지할 경계

- 비공개 endpoint, credential, 고객 데이터, 배포 script를 추가하지 마세요.
- Adapter 호출은 실제 운영 system이 아니라 합성 Mock Lab 서버를 향해야 합니다.
- 동작은 \`agents.config.yaml\`에서 조정하고 공유 secret은 \`.agent-factory/runtime.env\`에 둡니다. secret을 코드에 hard-code하지 마세요.

## 미연결 adapter

${unconnected.length ? unconnected.join("\n") : "- none"}

## 검토된 TODO

${todoLines.length ? todoLines.join("\n") : "- 운영 wiring 전에 generated node를 검토하세요."}
`;
  }
  return `# 구현 Handoff

${normalizedRequirement.title}의 reviewed scaffold-plan.json에서 생성되었습니다.

## 하지 않는 일

- 이 generated bundle 안에 실행 가능한 업무 로직을 추가하지 않습니다.
- 비공개 endpoint, credential, 고객 데이터, 배포 script를 추가하지 않습니다.
- 런타임 wiring이 승인된 뒤 별도 구현 작업에서만 TODO boundary를 대체합니다.

## TODO Boundaries

${todoLines.length ? todoLines.join("\n") : "- 구현 전에 generated TODO_IMPLEMENT_HERE function을 검토하세요."}
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
        runtime_mock: module.runtime_mock ?? null,
        smoke_spec: module.smoke_spec ?? null
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
          runtime_mcp_label: adapterConnection(module) === "mcp_connected" ? RUNTIME_MCP_LABEL : null,
          runtime_mcp_note: adapterConnection(module) === "mcp_connected" ? RUNTIME_MCP_NOTE : null,
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
        `python3 -m compileall ${outputDir}${packageName}`,
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
  const explicitJoinNodes = graph.nodes.filter((node) => node.node_kind === "join");
  const explicitJoinSymbols = new Set(explicitJoinNodes.map((node) => syntheticNodeSymbol(node)));
  const resolve = (nodeId, side) => {
    const node = graph.nodesById.get(nodeId);
    if (!node) return null;
    if (typeof node.module_id === "string" && graph.moduleById.has(node.module_id)) {
      return nodeSymbol(graph.moduleById.get(node.module_id));
    }
    if (side === "from" && node.node_kind === "input") return "START";
    if (node.node_kind === "human_input" || node.node_kind === "join") return syntheticNodeSymbol(node);
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
  const joins = explicitJoinNodes.map((node) => ({
    sym: syntheticNodeSymbol(node),
    name: pyGraphNodeName(node),
    nodeId: node.id,
    explicit: true
  }));
  const finalEdges = [];
  const joined = new Set();
  let joinIndex = 0;
  for (const [target, sources] of sourcesByTarget) {
    // A target with >1 predecessor must fan in through a JoinNode so it waits for
    // all of them. Suppress auto-join only when the target IS an explicit join
    // node (it already is a JoinNode). An explicit join that feeds the target
    // *alongside* other predecessors still needs an auto JoinNode wrapping every
    // predecessor — otherwise the target could run without waiting for the others.
    if (sources.length > 1 && !explicitJoinSymbols.has(target)) {
      const joinSym = `join_${++joinIndex}`;
      joins.push({ sym: joinSym, name: joinSym, target, explicit: false });
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

  // Every emitted runtime node must be reachable from START. Synthetic nodes
  // (human_input/join) get no START backfill, so a bare human_input/join with an
  // outgoing edge but no incoming path would otherwise produce an orphan branch.
  const adjacency = new Map();
  for (const [from, to] of finalEdges) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  }
  const reachable = new Set(["START"]);
  const queue = ["START"];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = [...new Set(finalEdges.flat())].filter((sym) => sym !== "START" && !reachable.has(sym));
  if (unreachable.length > 0) {
    throw new Error(
      `runnable mode produced nodes unreachable from START: ${unreachable.join(", ")}. Ensure every node (incl. human_input/join) has an incoming path from an input node. Use smoke mode.`
    );
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

// Runnable lowering supports strict DAG Graph workflows: START fan-out, explicit
// and auto fan-in joins, module-bound agent/adapter/workflow nodes, and
// synthetic human-input nodes. Conditional routing, loops, and remote boundary
// crossing are still rejected up front rather than mis-generated. (Sets are
// declared inside the function to avoid a temporal-dead-zone with the top-level
// buildFiles() call.)
function assertRunnableGraphSupported() {
  const unsupportedExecSemantics = new Set(["loop_back", "loop_exit", "conditional", "boundary_crossing"]);
  const unsupportedEdgeKinds = new Set(["route", "remote_a2a"]);
  const unsupportedContainerKinds = new Set(["dynamic_workflow", "loop_region", "remote_boundary"]);
  const nodes = Array.isArray(processFlow.nodes) ? processFlow.nodes : [];
  const graph = graphIndexes();
  // Allowlist: lowering can represent input/output (→ START/terminal) and
  // synthetic human_input/join nodes, plus module-bound agent/adapter/workflow
  // nodes. ANY other module_id-null node would be silently dropped by resolve(),
  // which would break graph connectivity, so reject it. remote_a2a is a real
  // remote boundary, not a safe synthetic stub, so it is rejected even when
  // module-bound.
  const allowedBareKinds = new Set(["input", "output", "human_input", "join"]);
  // Router, loop-control, and remote node kinds are NOT lowerable even if they
  // happen to carry a module_id, so deny them by kind before the module-bound
  // check.
  const unlowerableNodeKinds = new Set(["router", "loop_control", "remote_a2a"]);
  const badNodes = [];
  for (const node of nodes) {
    if (!node) continue;
    const module = typeof node.module_id === "string" ? graph.moduleById.get(node.module_id) : null;
    if (allowedBareKinds.has(node.node_kind)) {
      // These are synthetic and must have module_id null. If one is
      // module-bound, resolve() (which checks module_id before node_kind) could
      // lower it as a module symbol instead of its synthetic runtime node —
      // reject it so the guard matches resolve()'s precedence exactly.
      if (module) badNodes.push(`${node.id} (${node.node_kind} bound to a module)`);
      continue;
    }
    if (unlowerableNodeKinds.has(node.node_kind)) {
      badNodes.push(`${node.id} (${node.node_kind})`);
      continue;
    }
    if (module) {
      if (module.module_category === "remote_a2a") badNodes.push(`${node.id} (remote_a2a module)`);
      // Dynamic workflows need ADK 2.x dynamic-workflow codegen (loops/while via
      // ctx.run_node), not the static-graph lowering — reject so they stay smoke-only
      // rather than silently lowering as a stub coordinator.
      else if (module.module_category === "workflow" && module.workflow_kind === "dynamic") {
        badNodes.push(`${node.id} (dynamic workflow module)`);
      }
      continue;
    }
    badNodes.push(`${node.id} (${node.node_kind})`);
  }
  if (badNodes.length > 0) {
    throw new Error(
      `runnable mode cannot lower these nodes yet: ${badNodes.join(", ")}. Supported nodes are input/output, synthetic human_input/join, and module-bound agent/adapter/workflow nodes (no router/loop-control/remote or module_id-null intermediary nodes). Use smoke mode.`
    );
  }
  // Containers are a separate top-level array in Graph IR, not a node field.
  const containers = Array.isArray(processFlow.containers) ? processFlow.containers : [];
  const badContainers = containers
    .filter((container) => container && unsupportedContainerKinds.has(container.container_kind))
    .map((container) => `${container.id} (${container.container_kind})`);
  if (badContainers.length > 0) {
    throw new Error(
      `runnable mode does not support these container regions yet: ${badContainers.join(", ")}. parallel_region and human_review_region are visual groupings only; use smoke mode or wait for loop/remote/dynamic lowering.`
    );
  }
  const edges = Array.isArray(processFlow.edges) ? processFlow.edges : [];
  // resolve() maps input only as a source (→START) and drops output as a target
  // (terminal). A reversed-polarity edge (output as source, or input as target)
  // would survive the kind/semantic checks but silently drop an endpoint and
  // disconnect the graph — reject it so the guard and lowering agree exactly.
  const badEdges = edges
    .filter((edge) => {
      if (!edge) return false;
      if (
        unsupportedExecSemantics.has(edge.execution_semantics) ||
        unsupportedEdgeKinds.has(edge.edge_kind) ||
        edge.is_remote_boundary_crossing === true
      ) {
        return true;
      }
      const fromNode = graph.nodesById.get(edge.from);
      const toNode = graph.nodesById.get(edge.to);
      // A dangling endpoint (node id not in the graph) also resolves to null and
      // is silently dropped — reject it (don't rely only on processFlow.validation).
      if (!fromNode || !toNode) return true;
      // Reversed polarity (output as source / input as target) and a direct
      // input->output passthrough all resolve to a dropped endpoint. After this,
      // every surviving edge keeps lowerable runtime endpoints, except the
      // intentional output terminal drop — guard and lowering agree exactly.
      return (
        fromNode.node_kind === "output" ||
        toNode.node_kind === "input" ||
        (fromNode.node_kind === "input" && toNode.node_kind === "output")
      );
    })
    .map((edge) => `${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
  if (badEdges.length > 0) {
    throw new Error(
      `runnable mode does not support these edges yet: ${badEdges.join(", ")}. Supported DAG edges include normal fan-out/fan-in transitions; use smoke mode or wait for route/loop/remote lowering.`
    );
  }
}

// Defense-in-depth: module ids are pattern-constrained (^mod-[a-z0-9-]+$) so
// sanitization should not collide, but a collision would silently overwrite a
// node/function — fail loudly instead.
function assertNoSymbolCollisions(orderedModules, syntheticNodes = []) {
  const seen = new Map();
  const check = (owner, symbols) => {
    for (const [kind, value] of symbols) {
      const key = `${kind}::${value}`;
      if (seen.has(key)) {
        throw new Error(`runnable codegen ${kind} collision "${value}" between ${seen.get(key)} and ${owner}.`);
      }
      seen.set(key, owner);
    }
  };
  for (const module of orderedModules) {
    check(module.id, [
      ["node symbol", nodeSymbol(module)],
      ["function name", funcName(module)],
      ["node name", pyNodeName(module)],
      ["state key", stateKey(module)]
    ]);
  }
  for (const node of syntheticNodes) {
    if (!node || node.explicit === false) {
      check(node.sym, [["node symbol", node.sym], ["node name", node.name]]);
    } else if (node.node_kind === "human_input") {
      check(node.id, [
        ["node symbol", syntheticNodeSymbol(node)],
        ["function name", hitlFuncName(node)],
        ["node name", pyGraphNodeName(node)]
      ]);
    } else if (node.node_kind === "join" || node.explicit === true) {
      check(node.id, [["node symbol", syntheticNodeSymbol(node)], ["node name", pyGraphNodeName(node)]]);
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
  return { moduleById, moduleNodes, nodes, nodesById };
}

// ---------------------------------------------------------------------------
// Per-edge data-passing lowering (runnable): an edge may name an explicit data
// channel — a scoped session-state key (session/temp/user/app) or an artifact —
// that the producer writes and the consumer reads. Edges without a channel fall
// back to the existing {module_id}_output convention, so graphs that don't use
// the picker keep their current runtime behavior. (Artifact lowering lands in a
// follow-up; edgeDataChannel already classifies it.)
// ---------------------------------------------------------------------------

function edgeDataChannel(edge) {
  if (!edge) return null;
  // Declared inside the function to avoid a temporal-dead-zone with the
  // top-level buildFiles() call (same constraint as assertRunnableGraphSupported).
  const STATE_EDGE_SCOPE = {
    session_state: "",
    temp_state: "temp:",
    user_state: "user:",
    app_state: "app:"
  };
  const scopePrefix = STATE_EDGE_SCOPE[edge.edge_kind];
  if (scopePrefix !== undefined) {
    let key = typeof edge.state_key === "string" ? edge.state_key.trim() : "";
    if (!key) return null;
    // The bare key is authored in the picker; the scope prefix comes from
    // edge_kind. Strip any leading scope prefix so a manually-prefixed key is
    // not double-scoped (e.g. "temp:foo" on a temp_state edge).
    key = key.replace(/^(?:temp:|user:|app:)/, "");
    return key ? { kind: "state", key: `${scopePrefix}${key}` } : null;
  }
  if (edge.edge_kind === "artifact") {
    const key = typeof edge.artifact_key === "string" ? edge.artifact_key.trim() : "";
    return key ? { kind: "artifact", key } : null;
  }
  return null;
}

// Build per-module incoming/outgoing data channels by resolving Graph IR edge
// endpoints to their bound modules. Deduplicated by (kind,key).
function moduleDataChannels() {
  const graph = graphIndexes();
  const moduleIdOf = (nodeId) => {
    const node = graph.nodesById.get(nodeId);
    return node && typeof node.module_id === "string" && graph.moduleById.has(node.module_id)
      ? node.module_id
      : null;
  };
  const outgoing = new Map();
  const incoming = new Map();
  const pushUnique = (map, id, channel) => {
    if (!map.has(id)) map.set(id, []);
    const list = map.get(id);
    if (!list.some((existing) => existing.kind === channel.kind && existing.key === channel.key)) {
      list.push(channel);
    }
  };
  for (const edge of Array.isArray(processFlow.edges) ? processFlow.edges : []) {
    const channel = edgeDataChannel(edge);
    if (!channel) continue;
    const fromId = moduleIdOf(edge.from);
    const toId = moduleIdOf(edge.to);
    if (fromId) pushUnique(outgoing, fromId, channel);
    if (toId) pushUnique(incoming, toId, channel);
  }
  return { outgoing, incoming };
}

function outgoingStateChannelKeys(moduleId) {
  return [
    ...new Set(
      (moduleDataChannels().outgoing.get(moduleId) ?? [])
        .filter((channel) => channel.kind === "state")
        .map((channel) => channel.key)
    )
  ];
}

function incomingStateChannelKeys(moduleId) {
  return [
    ...new Set(
      (moduleDataChannels().incoming.get(moduleId) ?? [])
        .filter((channel) => channel.kind === "state")
        .map((channel) => channel.key)
    )
  ];
}

// An agent's single named outgoing state channel becomes its output_key so a
// downstream consumer reads from that exact key; otherwise the canonical
// {id}_output. Multiple distinct outgoing state keys are rejected up front
// (assertDataChannelsSupported) because an LlmAgent has only one output_key.
function agentOutputStateKey(module) {
  const keys = outgoingStateChannelKeys(module.id);
  return keys.length === 1 ? keys[0] : stateKey(module);
}

// Python lines for a function node to mirror its payload into each named
// outgoing state channel (in addition to the canonical {id}_output). Returns ""
// when the node has no outgoing state channel, keeping non-picker graphs byte-identical.
function emitOutgoingStateChannelWrites(moduleId, indent = "    ") {
  return outgoingStateChannelKeys(moduleId)
    .filter((key) => key !== stateKey({ id: moduleId }))
    .map((key) => `${indent}ctx.state[${toPyStr(key)}] = payload\n`)
    .join("");
}

// Reject runnable graphs whose agent nodes declare conflicting data channels.
function assertDataChannelsSupported() {
  const conflicts = [];
  for (const module of modules) {
    if (!isAgentModule(module)) continue;
    const keys = outgoingStateChannelKeys(module.id);
    if (keys.length > 1) conflicts.push(`${module.id} (${keys.join(", ")})`);
  }
  if (conflicts.length > 0) {
    throw new Error(
      `runnable mode cannot lower an agent node with multiple distinct outgoing state channels (LlmAgent has a single output_key): ${conflicts.join("; ")}. Use one state_key per agent output, route extra fan-out through a function node, or use smoke mode.`
    );
  }
}

// ---------------------------------------------------------------------------
// Module classification + symbol naming
// ---------------------------------------------------------------------------

function isAgentModule(module) {
  return module.module_category === "agent";
}

// Lowering role for a module-bound node, used as the key into the runnable
// NODE_LOWERING registry. New module-backed node kinds add a role here + a
// registry entry, not another branch in the emit loop.
function moduleLoweringRole(module) {
  if (isAgentModule(module)) return "agent";
  if (adapterConnection(module) === "mcp_connected") return "connected_adapter";
  return "stub_function";
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
  return toPythonIdentifier(module.name || module.id);
}

function syntheticNodeSymbol(node) {
  const prefix = node.node_kind === "join" ? "join" : "node";
  return `${prefix}_${toPythonIdentifier(node.id)}`;
}

function hitlFuncName(node) {
  return `_hitl_${toPythonIdentifier(node.id)}`;
}

function pyGraphNodeName(node) {
  return toPythonIdentifier(node.id);
}

function humanInputPrompt(node) {
  // Only a reviewed, human-readable label is fit as the runtime prompt; do not
  // fall back to execution_kind (technical, e.g. "request_input").
  if (typeof node.label === "string" && node.label.trim()) return node.label.trim();
  return "사람의 입력이 필요합니다:";
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
  const identifier = String(value)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}_]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return /^[\p{L}_]/u.test(identifier) ? identifier || "workflow" : `node_${identifier}`;
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
