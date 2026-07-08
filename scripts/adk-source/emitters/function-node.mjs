import { adapterConnection } from "../adapters.mjs";
import { emitOutgoingArtifactChannelWrites, emitOutgoingStateChannelWrites, outgoingStateChannelKeys } from "../channels.mjs";
import { funcName, nodeSymbol, pyNodeName, stateKey } from "../naming.mjs";
import { escapePythonString, toPyStr, toPythonLiteral } from "../python-literals.mjs";
import { remoteA2aRegistrySnapshotRows } from "../remote-a2a.mjs";

export function emitFunctionNodeDecl(module) {
  return `${nodeSymbol(module)} = FunctionNode(func=${funcName(module)}, name=${toPyStr(pyNodeName(module))})`;
}

export function emitStubFunc(target, context) {
  const module = target.module ?? target;
  const registryRows = registrySnapshotRowsForStub(module, context);
  if (registryRows.length) return emitRegistrySnapshotFunc(target, context, registryRows);
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

function emitRegistrySnapshotFunc(target, context, providerRows) {
  const module = target.module ?? target;
  return `async def ${funcName(target)}(ctx: Context, node_input=None) -> dict:
    """TODO_IMPLEMENT_HERE: ${escapePythonString(module.name)} — reviewed Remote A2A provider registry projection.

    검토된 Remote A2A contract/provider metadata만 session state에 투영합니다. 실제 업무 로직은 없습니다.
    """
    contract = COMPONENT_CONTRACTS[${toPyStr(module.id)}]
    payload = {
        "module_id": ${toPyStr(module.id)},
        "module_name": ${toPyStr(module.name)},
        "connection_status": "configured",
        "status": "configured_remote_a2a_providers",
        "providers": ${toPythonLiteral(providerRows, 2)},
        "provider_count": ${providerRows.length},
        "developer_todos": contract.get("developer_todos", []),
        "input_status": "received" if node_input is not None else "empty",
    }
    ctx.state[${toPyStr(stateKey(module))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, module.id)}${emitOutgoingArtifactChannelWrites(context.graphContext, module.id)}    return payload`;
}

function registrySnapshotRowsForStub(module, context) {
  if (!emitsRegistrySnapshot(module, context)) return [];
  return remoteA2aRegistrySnapshotRows({ analysisResult: context.analysisResult, modules: context.modules });
}

function emitsRegistrySnapshot(module, context) {
  const outputNames = (Array.isArray(module.outputs) ? module.outputs : [])
    .map((output) => (typeof output?.name === "string" ? output.name.trim() : ""))
    .filter(Boolean);
  return (
    outputNames.includes("agent_registry_snapshot") ||
    outgoingStateChannelKeys(context.graphContext, module.id).includes("agent_registry_snapshot")
  );
}
