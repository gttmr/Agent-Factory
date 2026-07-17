import { pyGraphNodeName, syntheticNodeSymbol, terminalFuncName } from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";

export function emitTerminalOutputFunc(node) {
  return `def ${terminalFuncName(node)}(ctx: Context, node_input=None):
    _node_id = ${toPyStr(node.id)}
    _state = ctx.state.to_dict() if hasattr(ctx.state, "to_dict") else dict(ctx.state)
    _state_keys = sorted(str(key) for key in _state.keys())
    _state_text = ", ".join(_state_keys) if _state_keys else "none"
    yield Event(
        author="agent_factory_terminal",
        content=types.Content(
            role="model",
            parts=[
                types.Part(text=f"Terminal output node {_node_id} completed. Final state keys: {_state_text}.")
            ],
        ),
    )
    yield {
        "node_kind": "output",
        "terminal_output_node_id": ${toPyStr(node.id)},
        "status": "completed",
        "final_state_keys": _state_keys,
    }`;
}

export function emitTerminalOutputNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${terminalFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))})`;
}
