import { toolConnection } from "../tools.mjs";
import { emitOutgoingArtifactChannelWrites, emitOutgoingStateChannelWrites } from "../channels.mjs";
import { funcName, nodeSymbol, pyNodeName, stateKey } from "../naming.mjs";
import { routeValue } from "../graph/routes.mjs";
import { escapePythonString, toPyStr, toPythonLiteral } from "../python-literals.mjs";
import { asyncResumeContractForToolTarget } from "../resume-contracts.mjs";

export function emitFunctionNodeDecl(asset) {
  return `${nodeSymbol(asset)} = FunctionNode(func=${funcName(asset)}, name=${toPyStr(pyNodeName(asset))})`;
}

export function emitStubFunc(target, context) {
  const asset = target.asset ?? target;
  const asyncResumeContract = asyncResumeContractForToolTarget(context, target);
  if (asyncResumeContract) return emitGuardedSyntheticToolFunc(target, context, asyncResumeContract);
  const kindNote =
    asset.asset_type === "workflow"
      ? "검토된 결정적 Workflow 조정자 자리표시자"
      : toolConnection(asset) === "unconnected"
        ? "연결이 아직 확정되지 않은 Tool"
        : "검토된 TODO boundary";
  const connectionStatus = asset.asset_type === "tool" ? "unconnected" : "coordinator";
  return `async def ${funcName(target)}(ctx: Context, node_input=None) -> dict:
    """TODO_IMPLEMENT_HERE: ${escapePythonString(asset.name)} — ${kindNote}.

    검토된 합성 테스트 더블 output만 반환합니다. 실제 업무 로직은 없습니다.
    """
    contract = COMPONENT_CONTRACTS[${toPyStr(asset.asset_id)}]
    payload = {
        "asset_id": ${toPyStr(asset.asset_id)},
        "asset_name": ${toPyStr(asset.name)},
        "connection_status": ${toPyStr(connectionStatus)},
        "status": "todo_implementation_required",
        "developer_todos": contract.get("developer_todos", []),
        "input_status": "received" if node_input is not None else "empty",
    }
    ctx.state[${toPyStr(stateKey(asset))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, asset.asset_id)}${emitOutgoingArtifactChannelWrites(context.graphContext, asset.asset_id)}    return payload`;
}

function emitGuardedSyntheticToolFunc(target, context, runtimeContract) {
  const asset = target.asset ?? target;
  const guard = runtimeContract.side_effect_guard;
  const inputNames = (asset.inputs ?? []).map((field) => field.name).filter(Boolean);
  const requiredNames = (asset.inputs ?? []).filter((field) => field.required).map((field) => field.name).filter(Boolean);
  const routeNodeId = runtimeContract.graph_ir_annotations.resume_entry_node_id;
  const guardedRoute = (context.graph?.edges ?? []).find(
    (edge) => edge?.from === routeNodeId && edge?.to === target.node?.id && edge?.control?.kind === "condition"
  );
  const reviewedRoute = routeValue(guardedRoute);
  return `async def ${funcName(target)}(ctx: Context, node_input=None) -> dict:
    """Apply the reviewed synthetic side-effect boundary at most once per session ledger key."""
    arguments, input_resolution = _collect_tool_inputs(
        ctx,
        ${toPyStr(asset.asset_id)},
        ${toPythonLiteral(inputNames)},
        ${toPythonLiteral(requiredNames)},
        node_input=node_input,
    )
    _idempotency_value = arguments.get(${toPyStr(guard.idempotency_key_input)})
    if _idempotency_value is None or not str(_idempotency_value).strip():
        raise RuntimeError(
            ${toPyStr(`${runtimeContract.contract_id}: idempotency key input ${guard.idempotency_key_input} is required.`)}
        )
    _idempotency_key = str(_idempotency_value)
    _ledger_state_key = ${toPyStr(`af_resume_ledger:${runtimeContract.contract_id}`)}
    _stored_ledger = ctx.state.get(_ledger_state_key)
    _ledger = dict(_stored_ledger) if isinstance(_stored_ledger, dict) else {}
    _fingerprint = json.dumps(
        _json_safe_node_value(arguments), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    _record = _ledger.get(_idempotency_key)
    if isinstance(_record, dict):
        if _record.get("fingerprint") != _fingerprint:
            raise RuntimeError(
                f"${runtimeContract.contract_id}: conflicting side-effect payload rejected for idempotency key {_idempotency_key}."
            )
        payload = _record.get("result")
        if not isinstance(payload, dict):
            raise RuntimeError(${toPyStr(`${runtimeContract.contract_id}: recorded side-effect result is invalid.`)})
        ctx.state[${toPyStr(stateKey(asset))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, asset.asset_id, "        ")}${emitOutgoingArtifactChannelWrites(context.graphContext, asset.asset_id, "        ")}        return payload
    payload = {
        "asset_id": ${toPyStr(asset.asset_id)},
        "asset_name": ${toPyStr(asset.name)},
        "connection_status": "in_process",
        "status": "synthetic_side_effect_applied",
        "applied": True,
        "apply_count": 1,
        "approved_route": ${toPyStr(reviewedRoute)},
        "idempotency_key": _idempotency_key,
        "idempotency_key_input": ${toPyStr(guard.idempotency_key_input)},
        "delivery_semantics": ${toPyStr(guard.delivery_semantics)},
        "ledger_scope": ${toPyStr(guard.ledger_scope)},
        "duplicate_response": ${toPyStr(runtimeContract.resume_policy.duplicate_response)},
        "arguments": _json_safe_node_value(arguments),
        "input_resolution": _json_safe_node_value(input_resolution),
    }
    _ledger[_idempotency_key] = {"fingerprint": _fingerprint, "result": payload}
    ctx.state[_ledger_state_key] = _ledger
    ctx.state[${toPyStr(stateKey(asset))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, asset.asset_id)}${emitOutgoingArtifactChannelWrites(context.graphContext, asset.asset_id)}    return payload`;
}
