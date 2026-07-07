import { routeCasesFor } from "../graph/routes.mjs";
import { pyGraphNodeName, routeFuncName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";

export function emitRouteFunc(node, context) {
  const routeCases = routeCasesFor(context.processFlow, node.id);
  if (routeCases.length === 0) {
    throw new Error(`router node ${node.id} has no route edges.`);
  }
  const checks = routeCases
    .map(({ value, aliases, stateKey }) => {
      const aliasLiteral = `[${aliases.map((alias) => toPyStr(alias)).join(", ")}]`;
      if (stateKey) {
        return `    ${stateTextVar(value)} = _route_state_text(ctx, ${toPyStr(stateKey)})
    if any(alias and alias in ${stateTextVar(value)} for alias in ${aliasLiteral}):
        return Event(route=${toPyStr(value)}, output=_json_safe_node_value(_route_output_value(ctx, node_input, ${toPyStr(stateKey)})))`;
      }
      return `    if any(alias and alias in text for alias in ${aliasLiteral}):
        return Event(route=${toPyStr(value)}, output=_json_safe_node_value(node_input))`;
    })
    .join("\n");
  const fallback = routeCases.find((route) => route.isDefault) ?? routeCases[0];
  return `def _route_decision_text(node_input):
    if isinstance(node_input, dict):
        for key in ("response", "choice", "value"):
            value = node_input.get(key)
            if value is not None:
                return str(value).strip().lower()
        return str(_json_safe_node_value(node_input)).strip().lower()
    return str(node_input or "").strip().lower()


def _route_state_text(ctx: Context, state_key: str) -> str:
    value = ctx.state.get(state_key)
    return _route_decision_text(value)


def _route_output_value(ctx: Context, node_input, state_key: str):
    value = ctx.state.get(state_key)
    return node_input if value is None else value


def ${routeFuncName(node)}(ctx: Context, node_input=None):
    text = _route_decision_text(node_input)
${checks}
    return Event(route=${toPyStr(fallback.value)}, output=_json_safe_node_value(node_input))`;
}

export function emitRouterNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${routeFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))})`;
}

function stateTextVar(value) {
  return `_state_text_${String(value).replace(/[^A-Za-z0-9_]/g, "_")}`;
}
