import { buildSmokeGraphWorkflowEdges } from "./dispatch/index.mjs";
import { collectGenerationNodes } from "./graph/collector.mjs";
import { nodeFunctionName, todoFunctionName } from "./naming.mjs";
import { escapePythonString, toPythonEdgeTupleLiteral, toPythonLiteral } from "./python-literals.mjs";
import { componentContracts } from "./agent-contracts.mjs";

export function buildSmokeAgentPy(context) {
  const { graphContext, modules, packageName } = context;
  const collection = collectGenerationNodes(graphContext, { mode: "smoke" });
  const functions = [
    ...modules.map(buildTodoFunction),
    ...collection.moduleSpecsInDeclarationOrder.map(buildNodeFunction)
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
    description="검토된 workbench 인계 artifact를 확인하는 합성 ADK 런타임 smoke bridge입니다.",
)
`;
}

function buildTodoFunction(module) {
  return `def ${todoFunctionName(module)}(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("${escapePythonString(module.name)} requires developer implementation")`;
}

function buildNodeFunction(target) {
  const module = target.module ?? target;
  return `def ${nodeFunctionName(target)}(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["${module.id}"]
    output = _event_output("${module.id}", "${escapePythonString(module.name)}", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "${todoFunctionName(module)}"
    return output`;
}
