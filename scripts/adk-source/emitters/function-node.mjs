import { adapterConnection } from "../adapters.mjs";
import { emitOutgoingArtifactChannelWrites, emitOutgoingStateChannelWrites } from "../channels.mjs";
import { funcName, nodeSymbol, pyNodeName, stateKey } from "../naming.mjs";
import { escapePythonString, toPyStr } from "../python-literals.mjs";

export function emitFunctionNodeDecl(module) {
  return `${nodeSymbol(module)} = FunctionNode(func=${funcName(module)}, name=${toPyStr(pyNodeName(module))})`;
}

export function emitStubFunc(target, context) {
  const module = target.module ?? target;
  const kindNote =
    module.module_category === "workflow"
      ? "검토된 결정적 워크플로우 조정자 자리표시자"
      : adapterConnection(module) === "unconnected"
        ? "Mock Lab MCP 서버가 아직 연결되지 않은 adapter"
        : "검토된 TODO boundary";
  const connectionStatus = module.module_category === "adapter" ? "unconnected" : "coordinator";
  return `async def ${funcName(target)}(ctx: Context, node_input=None) -> dict:
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
        "input_status": "received" if node_input is not None else "empty",
    }
    ctx.state[${toPyStr(stateKey(module))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, module.id)}${emitOutgoingArtifactChannelWrites(context.graphContext, module.id)}    return payload`;
}
