import {
  emitIncomingArtifactLoad,
  emitOutgoingArtifactChannelWrites,
  emitOutgoingStateChannelWrites,
  incomingArtifactChannelKeys,
  incomingStateChannelKeys
} from "../channels.mjs";
import { RUNTIME_MCP_LABEL, RUNTIME_MCP_NOTE } from "../context.mjs";
import { funcName, stateKey } from "../naming.mjs";
import { toPyStr, toPythonLiteral } from "../python-literals.mjs";

export function emitConnectedAdapterFunc(target, context) {
  const module = target.module ?? target;
  const inputNames = (module.inputs ?? []).map((field) => field.name).filter(Boolean);
  const requiredNames = (module.inputs ?? []).filter((field) => field.required).map((field) => field.name).filter(Boolean);
  const channelKeys = incomingStateChannelKeys(context.graphContext, module.id);
  const channelArg = channelKeys.length ? `,\n        ${toPythonLiteral(channelKeys, 2)}` : "";
  const artifactLoad = emitIncomingArtifactLoad(context.graphContext, module.id);
  const artifactArg = incomingArtifactChannelKeys(context.graphContext, module.id).length
    ? ",\n        extra_payloads=_artifact_payloads"
    : "";
  return `async def ${funcName(target)}(ctx: Context, node_input=None) -> dict:
    """실행 시점에 synthetic MCP tool ${toPyStr(module.mcp_tool_name)}을 호출합니다. local synthetic runtime 전용입니다.

    결정적 Adapter입니다. 모델이 tool을 고르게 하지 않고 MCP session을 열어
    지정된 tool을 직접 호출하므로 audit에서 실제 tools/call을 확인할 수 있습니다.
    """
    import asyncio

    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url(${toPyStr(module.id)}, ${toPyStr(module.mcp_server)})
${artifactLoad}    arguments, input_resolution = _collect_tool_inputs(
        ctx, ${toPyStr(module.id)}, ${toPythonLiteral(inputNames)}, ${toPythonLiteral(requiredNames)}${channelArg}${artifactArg},
        node_input=node_input
    )
    try:
        async with asyncio.timeout(5):
            async with streamablehttp_client(url) as (read_stream, write_stream, _close):
                async with ClientSession(read_stream, write_stream) as session:
                    await session.initialize()
                    tool_result = await session.call_tool(${toPyStr(module.mcp_tool_name)}, arguments=arguments)
    except Exception as exc:
        contract = COMPONENT_CONTRACTS[${toPyStr(module.id)}]
        payload = {
            "module_id": ${toPyStr(module.id)},
            "module_name": ${toPyStr(module.name)},
            "connection_status": "mcp_degraded",
            "status": "mcp_unreachable_degraded",
            "server": ${toPyStr(module.mcp_server)},
            "url": url,
            "tool": ${toPyStr(module.mcp_tool_name)},
            "mcp_server": ${toPyStr(module.mcp_server)},
            "mcp_tool": ${toPyStr(module.mcp_tool_name)},
            "runtime_mcp_label": ${toPyStr(RUNTIME_MCP_LABEL)},
            "runtime_mcp_note": ${toPyStr(RUNTIME_MCP_NOTE)},
            "reason": _short_error_reason(exc),
            "runtime_mock": _json_safe_node_value(contract.get("runtime_mock")),
            "developer_todos": _json_safe_node_value(contract.get("developer_todos", [])),
            "arguments": _json_safe_node_value(arguments),
            "input_resolution": _json_safe_node_value(input_resolution),
            "structured_content": {},
            "result": [],
        }
        ctx.state[${toPyStr(stateKey(module))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, module.id, "        ")}${emitOutgoingArtifactChannelWrites(context.graphContext, module.id, "        ")}        return payload
    content = getattr(tool_result, "content", None) or []
    structured_content = getattr(tool_result, "structuredContent", None)
    if structured_content is None:
        structured_content = getattr(tool_result, "structured_content", None)
    if hasattr(structured_content, "model_dump"):
        structured_content = structured_content.model_dump()
    if not isinstance(structured_content, dict):
        structured_content = {}
    structured_content = _json_safe_node_value(structured_content)
    payload = {
        "module_id": ${toPyStr(module.id)},
        "module_name": ${toPyStr(module.name)},
        "connection_status": "mcp_connected",
        "runtime_mcp_label": ${toPyStr(RUNTIME_MCP_LABEL)},
        "runtime_mcp_note": ${toPyStr(RUNTIME_MCP_NOTE)},
        "status": "mcp_tool_called",
        "mcp_server": ${toPyStr(module.mcp_server)},
        "mcp_tool": ${toPyStr(module.mcp_tool_name)},
        "arguments": _json_safe_node_value(arguments),
        "input_resolution": _json_safe_node_value(input_resolution),
        "structured_content": structured_content,
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    ctx.state[${toPyStr(stateKey(module))}] = payload
${emitOutgoingStateChannelWrites(context.graphContext, module.id)}${emitOutgoingArtifactChannelWrites(context.graphContext, module.id)}    return payload`;
}
