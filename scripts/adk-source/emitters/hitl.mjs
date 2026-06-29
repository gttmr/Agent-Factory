import { hitlFuncName, pyGraphNodeName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";
import { routeCasesFor } from "../graph/routes.mjs";

export function emitHumanInputFunc(node, context = null) {
  const prompt = toPyStr(humanInputPrompt(node));
  const responseSchema = humanInputResponseSchema(node, context);
  return `def ${hitlFuncName(node)}(ctx: Context, node_input=None):
    _hitl_response = _first_resume_input(ctx)
    if _hitl_response is None:
        yield RequestInput(message=${prompt}, payload=node_input${responseSchema})
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
  const reviewedPrompt = node?.human_input_contract?.message;
  if (typeof reviewedPrompt === "string" && reviewedPrompt.trim()) return promptWithChoiceDetails(reviewedPrompt.trim(), node?.human_input_contract);
  // Only a reviewed, human-readable label is fit as the runtime prompt; do not
  // fall back to execution_kind (technical, e.g. "request_input").
  if (typeof node.label === "string" && node.label.trim()) return promptWithChoiceDetails(node.label.trim(), node?.human_input_contract);
  return "사람의 입력이 필요합니다:";
}

function promptWithChoiceDetails(basePrompt, contract) {
  const lines = [basePrompt];
  const choices = stringList(contract?.choice_options);
  if (choices.length) lines.push(`선택지: ${choices.join(", ")}`);
  const defaultChoice = typeof contract?.default_choice === "string" && contract.default_choice.trim() ? contract.default_choice.trim() : "";
  if (defaultChoice) lines.push(`기본값: ${defaultChoice}`);
  const aliases = aliasSummary(contract?.accepted_aliases);
  if (aliases) lines.push(`alias: ${aliases}`);
  return lines.join("\n");
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function aliasSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const entries = Object.entries(value)
    .map(([choice, aliases]) => {
      const aliasList = stringList(aliases);
      return choice.trim() && aliasList.length ? `${choice.trim()}=${aliasList.join("/")}` : "";
    })
    .filter(Boolean);
  return entries.join("; ");
}

function humanInputResponseSchema(node, context) {
  const responseSchemaRef = node?.human_input_contract?.response_schema_ref;
  if (responseSchemaRef === "str" && hasNumericChoiceAlias(node, context)) return "";
  if (responseSchemaRef === "str") return ", response_schema=str";
  return "";
}

function hasNumericChoiceAlias(node, context) {
  const contract = node?.human_input_contract;
  if (choiceAliases(contract).some(isNumericChoiceToken)) return true;

  const processFlow = context?.processFlow;
  const edges = Array.isArray(processFlow?.edges) ? processFlow.edges : [];
  if (!node?.id || edges.length === 0) return false;

  const nodesById = new Map((Array.isArray(processFlow?.nodes) ? processFlow.nodes : []).map((graphNode) => [graphNode.id, graphNode]));
  const downstreamRouterIds = edges
    .filter((edge) => edge?.from === node.id && nodesById.get(edge.to)?.node_kind === "router")
    .map((edge) => edge.to);
  return downstreamRouterIds.some((routerId) =>
    routeCasesFor(processFlow, routerId).some((routeCase) => routeCase.aliases.some(isNumericChoiceToken))
  );
}

function choiceAliases(contract) {
  if (!contract || typeof contract !== "object") return [];
  const aliases = [];
  aliases.push(...stringList(contract.choice_options));
  aliases.push(...stringList(contract.default_choice ? [contract.default_choice] : []));
  const acceptedAliases = contract.accepted_aliases;
  if (acceptedAliases && typeof acceptedAliases === "object") {
    if (Array.isArray(acceptedAliases)) {
      for (const entry of acceptedAliases) aliases.push(...stringList(entry?.aliases));
    } else {
      for (const values of Object.values(acceptedAliases)) aliases.push(...stringList(values));
    }
  }
  return aliases;
}

function isNumericChoiceToken(value) {
  return typeof value === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(value.trim());
}
