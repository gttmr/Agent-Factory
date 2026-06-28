import { adapterConnection } from "../adapters.mjs";
import { agentOutputStateKey } from "../channels.mjs";
import { DEFAULT_MODEL } from "../context.mjs";
import { graphIndexes } from "../graph/indexes.mjs";
import { nodeSymbol, pyNodeName } from "../naming.mjs";
import { toPyStr, truncate } from "../python-literals.mjs";

export function emitAgentNode(module, context) {
  const sym = nodeSymbol(module);
  const instruction = module.instruction || defaultAgentInstruction(module);
  const mode = agentExecutionMode(module, context);
  return `${sym} = LlmAgent(
    name=${toPyStr(pyNodeName(module))},
    model=_model_for(${toPyStr(module.id)}, ${toPyStr(module.model || DEFAULT_MODEL)}),
    instruction=_agent_cfg(${toPyStr(module.id)}, "instruction", ${toPyStr(instruction)}),
    description=${toPyStr(truncate(module.name))},
    output_key=${toPyStr(agentOutputStateKey(context.graphContext, module))},
    mode=${toPyStr(mode)},
)`;
}

export function agentExecutionMode(module, context) {
  if (module?.agent_execution_mode === "chat" || module?.agent_execution_mode === "single_turn") {
    return module.agent_execution_mode;
  }
  const graphNode = graphIndexes(context.graphContext).moduleNodes.find((node) => node.module_id === module.id);
  return graphNode?.agent_execution_mode === "chat" ? "chat" : "single_turn";
}

export function defaultAgentInstruction(module) {
  return [
    `당신은 "${module.name}" Agent입니다.`,
    "검토된 synthetic 입력과 session state 안의 데이터만 사용하세요.",
    "private data, 실제 endpoint, credential은 만들거나 추정하지 마세요."
  ].join("\n");
}

export function moduleLoweringRole(module) {
  if (module.module_category === "remote_a2a") return "remote_a2a";
  if (module.module_category === "agent") return "agent";
  if (adapterConnection(module) === "mcp_connected") return "connected_adapter";
  return "stub_function";
}
