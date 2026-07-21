import { buildSmokeGraphWorkflowEdges } from "./dispatch/index.mjs";
import { collectGenerationNodes } from "./graph/collector.mjs";
import { nodeFunctionName, todoFunctionName } from "./naming.mjs";
import { escapePythonString, toPythonEdgeTupleLiteral, toPythonLiteral } from "./python-literals.mjs";
import { componentContracts } from "./agent-contracts.mjs";

export function buildSmokeAgentPy(context) {
  const { assets, graphContext, packageName } = context;
  const collection = collectGenerationNodes(graphContext, { mode: "smoke" });
  const functions = [
    ...assets.map(buildTodoFunction),
    ...collection.assetSpecsInDeclarationOrder.map(buildNodeFunction)
  ].join("\n\n");
  const graphEdges = buildSmokeGraphWorkflowEdges(graphContext, collection);

  return `from __future__ import annotations

from typing import AsyncGenerator
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types


COMPONENT_CONTRACTS = ${toPythonLiteral(componentContracts(context))}
GRAPH_EDGES = ${toPythonEdgeTupleLiteral(graphEdges)}
TERMINAL_OUTPUTS = ${toPythonLiteral(collection.terminalOutputNodes.map((node) => node.id))}


def _event_output(asset_id: str, asset_name: str, node_input: Any = None):
    contract = COMPONENT_CONTRACTS[asset_id]
    return {
        "asset_id": asset_id,
        "asset_name": asset_name,
        "input": node_input,
        "status": "todo_implementation_required",
    }


${functions}


def emit_workflow_result(node_input: Any = None):
    return {
        "node_id": "workflow_result",
        "terminal_outputs": TERMINAL_OUTPUTS,
        "input": node_input,
        "status": "synthetic_smoke",
    }


def _synthetic_asset_outputs():
    return {
        asset_id: {
            "asset_name": asset_id,
            "status": "todo_implementation_required",
            "developer_todos": contract["developer_todos"],
        }
        for asset_id, contract in COMPONENT_CONTRACTS.items()
    }


def _build_smoke_text(user_text: str = ""):
    terminal_outputs = ", ".join(TERMINAL_OUTPUTS) if TERMINAL_OUTPUTS else "none"
    user_note = f" 받은 메시지: {user_text[:160]}" if user_text else ""
    return (
        "${packageName} ADK 런타임 smoke: "
        f"승인된 자산 {len(COMPONENT_CONTRACTS)}개를 불러왔고, "
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
                "status": "synthetic_smoke",
                "guardrails": {
                    "raw_requirement_to_code": False,
                    "generated_business_logic": False,
                    "private_data_or_endpoints": False,
                },
                "graph_edges": GRAPH_EDGES,
                "terminal_outputs": TERMINAL_OUTPUTS,
                "asset_outputs": _synthetic_asset_outputs(),
            },
        )


root_agent = SyntheticRuntimeSmokeAgent(
    name="${packageName}",
    description="검토된 workbench 인계 artifact를 확인하는 합성 ADK 런타임 smoke bridge입니다.",
)
`;
}

function buildTodoFunction(asset) {
  return `def ${todoFunctionName(asset)}(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved asset after filling the reviewed handoff."""
    raise NotImplementedError("${escapePythonString(asset.name)} requires developer implementation")`;
}

function buildNodeFunction(target) {
  const asset = target.asset ?? target;
  return `def ${nodeFunctionName(target)}(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["${asset.asset_id}"]
    output = _event_output("${asset.asset_id}", "${escapePythonString(asset.name)}", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "${todoFunctionName(asset)}"
    return output`;
}
