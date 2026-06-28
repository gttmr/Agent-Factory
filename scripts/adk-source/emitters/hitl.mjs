import { hitlFuncName, pyGraphNodeName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";

export function emitHumanInputFunc(node) {
  const prompt = toPyStr(humanInputPrompt(node));
  return `def ${hitlFuncName(node)}(ctx: Context, node_input=None):
    _hitl_response = _first_resume_input(ctx)
    if _hitl_response is None:
        yield RequestInput(message=${prompt}, payload=node_input)
        return
    yield {
        "node_kind": "human_input",
        "prompt": ${prompt},
        "previous": node_input,
        "response": _hitl_response,
    }`;
}

export function emitHumanInputNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${hitlFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))}, rerun_on_resume=True)`;
}

function humanInputPrompt(node) {
  // Only a reviewed, human-readable label is fit as the runtime prompt; do not
  // fall back to execution_kind (technical, e.g. "request_input").
  if (typeof node.label === "string" && node.label.trim()) return node.label.trim();
  return "사람의 입력이 필요합니다:";
}
