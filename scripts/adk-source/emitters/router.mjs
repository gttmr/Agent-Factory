import { mergedRouteCasesFor } from "../graph/routes.mjs";
import { graphIndexes } from "../graph/indexes.mjs";
import { pyGraphNodeName, routeFuncName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";

export function emitRouteFunc(node, context) {
  const routeGroups = mergedRouteCasesFor(context.processFlow, node.id);
  if (routeGroups.length === 0) {
    throw new Error(`router node ${node.id} has no route edges.`);
  }
  const graph = graphIndexes(context.graphContext ?? context);
  const checks = routeGroups
    .flatMap((routeGroup) =>
      routeGroup.cases.map(({ value, aliases, stateKey, to }) => {
        const aliasLiteral = `[${aliases.map((alias) => toPyStr(alias)).join(", ")}]`;
        const outputValue = routeOutputValue({ graph, nodeInput: "node_input", stateKey, to });
        const remoteA2aGuard = !stateKey && isRemoteA2aRouteCase({ graph, to });
        const textMatch = remoteA2aGuard
          ? `_route_text_matches(text, ${aliasLiteral}) and not _route_control_syntax_in_current_user_text(ctx)`
          : `_route_text_matches(text, ${aliasLiteral})`;
        if (stateKey) {
          return `    ${stateTextVar(value)} = _route_state_text(ctx, ${toPyStr(stateKey)})
    if _route_state_matches(${stateTextVar(value)}, ${aliasLiteral}):
        return Event(route=${toPyStr(routeGroup.value)}, output=_json_safe_node_value(${outputValue}))`;
        }
        return `    if ${textMatch}:
        return Event(route=${toPyStr(routeGroup.value)}, output=_json_safe_node_value(${outputValue}))`;
      })
    )
    .join("\n");
  const fallbackGroup = routeGroups.find((routeGroup) => routeGroup.isDefault) ?? routeGroups[0];
  const fallback = fallbackGroup.cases.find((routeCase) => routeCase.isDefault) ?? fallbackGroup.cases[0];
  const fallbackOutput = routeOutputValue({ graph, nodeInput: "node_input", stateKey: fallback.stateKey, to: fallback.to });
  return `def _route_decision_text(node_input):
    for key in ("route_decision", "route_type", "action", "route", "decision", "choice", "value", "response"):
        value = _payload_value(node_input, key)
        if isinstance(value, dict):
            for nested_key in ("route_decision", "route_type", "action", "route", "decision", "choice", "value"):
                nested_value = _payload_value(value, nested_key)
                if nested_value is not None and not isinstance(nested_value, (dict, list)):
                    return str(nested_value).strip().lower()
        elif value is not None:
            return str(value).strip().lower()
    parsed = _json_payload(node_input)
    if parsed is not None:
        return _route_decision_text(parsed)
    if isinstance(node_input, dict):
        return ""
    return str(node_input or "").strip().lower()


def _route_state_text(ctx: Context, state_key: str) -> str:
    value = ctx.state.get(state_key)
    if isinstance(value, dict):
        for nested_key in ("task_state", "state", "status", "value"):
            nested_value = _payload_value(value, nested_key)
            if nested_value is not None and not isinstance(nested_value, (dict, list)):
                return _route_state_value_text(nested_value)
        return ""
    return _route_state_value_text(value)


def _route_state_value_text(value) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    if any(char not in "abcdefghijklmnopqrstuvwxyz0123456789_:-" for char in text):
        return ""
    state = text
    if state.startswith("task_state:"):
        state = state.split(":", 1)[1].strip()
    elif state.startswith("task_state_"):
        state = state.removeprefix("task_state_").strip()
    if not state:
        return text
    hyphen_state = state.replace("_", "-")
    underscore_state = state.replace("-", "_")
    return " ".join(dict.fromkeys([
        text,
        state,
        hyphen_state,
        underscore_state,
        f"task_state:{hyphen_state}",
        f"task_state_{underscore_state}",
    ]))


def _route_state_matches(text: str, aliases) -> bool:
    stripped = text.strip()
    tokens = set(stripped.split())
    return any(alias and (alias == stripped or alias in tokens) for alias in aliases)


def _route_text_matches(text: str, aliases) -> bool:
    stripped = text.strip()
    return any(alias and alias == stripped for alias in aliases)


def _route_output_value(ctx: Context, node_input, state_key: str):
    value = ctx.state.get(state_key)
    return node_input if value is None else value


def _route_conversation_state(ctx: Context) -> dict:
    state = ctx.state.to_dict() if hasattr(ctx.state, "to_dict") else dict(ctx.state)
    return {"state_keys": sorted(str(key) for key in state.keys())}


def _route_context_payload(ctx: Context, node_input, input_names: list[str]):
    payload = {}
    for name in input_names:
        value = None
        if name in USER_TEXT_INPUT_NAMES or name.endswith("_message") or name.endswith("_text"):
            user_text = _user_text_from_context(ctx) or _payload_user_text(node_input)
            if user_text:
                value = user_text
        if value is None and ctx.state.get(name) is not None:
            value = ctx.state.get(name)
        if value is None:
            value = _payload_value(node_input, name)
        if value is None and name in ("conversation_state", "conversation_history"):
            value = _route_conversation_state(ctx)
        if value is not None:
            payload[name] = _json_safe_node_value(value)
    if node_input is not None:
        payload["previous"] = _json_safe_node_value(node_input)
    return payload if payload else node_input


_ROUTE_CONTROL_SYNTAX_MARKERS = (
    "route_decision",
    "route_type",
    "targetagentid",
    "target_agent_id",
    "rpc_url",
    "rpcurl",
    "agent_card_url",
    "agentcardurl",
    "a2a:task_id",
    "a2a:context_id",
)


def _route_control_syntax_in_current_user_text(ctx: Context) -> bool:
    text = _user_text_from_context(ctx)
    if not text:
        for key in USER_TEXT_INPUT_NAMES:
            value = ctx.state.get(key)
            if isinstance(value, str) and value.strip():
                text = value
                break
    if not text:
        return False
    lowered = text.lower()
    return any(marker in lowered for marker in _ROUTE_CONTROL_SYNTAX_MARKERS)


def ${routeFuncName(node)}(ctx: Context, node_input=None):
    text = _route_decision_text(node_input)
${checks}
    return Event(route=${toPyStr(fallbackGroup.value)}, output=_json_safe_node_value(${fallbackOutput}))`;
}

export function emitRouterNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${routeFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))})`;
}

function stateTextVar(value) {
  return `_state_text_${String(value).replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function routeOutputValue({ graph, nodeInput, stateKey, to }) {
  const inputNames = targetAgentInputNames(graph, to);
  if (inputNames.length > 0) {
    return `_route_context_payload(ctx, ${nodeInput}, [${inputNames.map((name) => toPyStr(name)).join(", ")}])`;
  }
  return stateKey ? `_route_output_value(ctx, ${nodeInput}, ${toPyStr(stateKey)})` : nodeInput;
}

function targetAgentInputNames(graph, nodeId) {
  const node = graph.nodesById.get(nodeId);
  const module = typeof node?.module_id === "string" ? graph.moduleById.get(node.module_id) : null;
  if (module?.module_category !== "agent") return [];
  return (Array.isArray(module.inputs) ? module.inputs : [])
    .map((input) => (typeof input?.name === "string" ? input.name.trim() : ""))
    .filter(Boolean);
}

function isRemoteA2aRouteCase({ graph, to }) {
  const node = graph.nodesById.get(to);
  const module = typeof node?.module_id === "string" ? graph.moduleById.get(node.module_id) : null;
  return module?.module_category === "remote_a2a";
}
