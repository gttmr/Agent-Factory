import { routeCasesFor } from "../graph/routes.mjs";
import { pyGraphNodeName, routeFuncName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr, toPythonLiteral } from "../python-literals.mjs";

export function emitRouteFunc(node, context) {
  const routeCases = routeCasesFor(context.processFlow, node.id);
  if (routeCases.length === 0) {
    throw new Error(`router node ${node.id} has no route edges.`);
  }
  const checks = routeCases
    .map(({ value, aliases }) => {
      const aliasLiteral = toPythonLiteral(aliases);
      return `    if any(alias and alias in text for alias in ${aliasLiteral}):
        return Event(route=${toPyStr(value)}, output=node_input)`;
    })
    .join("\n");
  const fallback = routeCases.find((route) => route.value.includes("skip")) ?? routeCases[0];
  return `def ${routeFuncName(node)}(node_input=None):
    text = str(node_input or "").strip().lower()
${checks}
    return Event(route=${toPyStr(fallback.value)}, output=node_input)`;
}

export function emitRouterNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${routeFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))})`;
}
