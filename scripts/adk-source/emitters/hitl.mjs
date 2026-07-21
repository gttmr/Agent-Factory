import { hitlFuncName, pyGraphNodeName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr, toPythonLiteral } from "../python-literals.mjs";
import { routeCasesFor } from "../graph/routes.mjs";
import { asyncResumeContractForHumanNode } from "../resume-contracts.mjs";

export function emitHumanInputFunc(node, context = null) {
  const runtimeContract = asyncResumeContractForHumanNode(context, node);
  if (!runtimeContract) {
    throw new Error(`Human Input Node ${node.id} requires one approved async_resume contract.`);
  }
  const prompt = toPyStr(humanInputPrompt(node));
  const responseSchema = humanInputResponseSchema(node, context);
  const reviewed = node?.human_input_contract ?? {};
  const choices = stringList(reviewed.choice_options);
  const aliases = normalizedAliases(reviewed.accepted_aliases);
  const responseMapping = isRecord(reviewed.response_mapping) ? reviewed.response_mapping : {};
  const defaultChoice = typeof reviewed.default_choice === "string" ? reviewed.default_choice.trim() : "";
  const policy = runtimeContract.resume_policy;
  return `def ${hitlFuncName(node)}(ctx: Context, node_input=None):
    _interrupt_id = ${toPyStr(policy.interrupt_id)}
    _state_key = f"af_resume_record:${runtimeContract.contract_id}:{ctx.invocation_id}"
    _now = time.time()
    _record = ctx.state.get(_state_key)
    if not isinstance(_record, dict) or _record.get("interrupt_id") != _interrupt_id:
        _record = {
            "contract_id": ${toPyStr(runtimeContract.contract_id)},
            "interrupt_id": _interrupt_id,
            "node_id": ${toPyStr(node.id)},
            "status": "pending",
            "requested_at": _now,
            "expires_at": _now + ${Number(policy.timeout_seconds)},
            "node_payload": _json_safe_node_value(node_input),
        }
        ctx.state[_state_key] = _record
    _hitl_response = _resume_input_for(ctx, _interrupt_id)
    if _hitl_response is None:
        yield RequestInput(
            interrupt_id=_interrupt_id,
            message=${prompt},
            payload={
                "contract_id": ${toPyStr(runtimeContract.contract_id)},
                "interrupt_id": _interrupt_id,
                "expires_at": _record.get("expires_at"),
                "node_payload": _json_safe_node_value(node_input),
            }${responseSchema},
        )
        return
    _response_fingerprint = _resume_response_fingerprint(_hitl_response)
    if _record.get("status") != "pending":
        if _record.get("response_fingerprint") != _response_fingerprint:
            raise RuntimeError(
                f"${runtimeContract.contract_id}: conflicting response rejected for interrupt_id={_interrupt_id}."
            )
        yield _record.get("result")
        return
    _choices = ${toPythonLiteral(choices)}
    _aliases = ${toPythonLiteral(aliases)}
    _mapping = ${toPythonLiteral(responseMapping)}
    _default_choice = ${toPyStr(defaultChoice)}
    _response_text = str(_hitl_response or "").strip().lower()
    _choice = next((choice for choice in _choices if choice.lower() == _response_text), None)
    if _choice is None:
        for _canonical, _accepted in _aliases.items():
            if _response_text in [str(alias).strip().lower() for alias in _accepted]:
                _choice = _canonical
                break
    _valid_choice = _choice is not None or not _choices
    if _choice is None:
        _choice = _response_text if not _choices and _response_text else _default_choice
    _expired = time.time() > float(_record.get("expires_at") or 0)
    if _expired or not _valid_choice:
        _choice = _default_choice
    _decision = _mapping.get(_choice, _choice)
    _status = "expired" if _expired else ("accepted" if _valid_choice else "invalid_defaulted")
    _result = {
        "node_kind": "human_input",
        "contract_id": ${toPyStr(runtimeContract.contract_id)},
        "interrupt_id": _interrupt_id,
        "prompt": ${prompt},
        "input_status": "received" if node_input is not None else "empty",
        "response": _hitl_response,
        "choice": _choice,
        "decision": _decision,
        "status": _status,
        "expired": _expired,
        "payload": _json_safe_node_value(node_input),
    }
    _record = {
        **_record,
        "status": _status,
        "completed_at": time.time(),
        "response_fingerprint": _response_fingerprint,
        "result": _result,
    }
    ctx.state[_state_key] = _record
    yield _result`;
}

export function emitHumanInputNodeDecl(node) {
  return `${syntheticNodeSymbol(node)} = FunctionNode(func=${hitlFuncName(node)}, name=${toPyStr(pyGraphNodeName(node))}, rerun_on_resume=True)`;
}

function humanInputPrompt(node) {
  const reviewedPrompt = node?.human_input_contract?.message;
  if (typeof reviewedPrompt === "string" && reviewedPrompt.trim()) return promptWithChoiceDetails(reviewedPrompt.trim(), node?.human_input_contract);
  // Only a reviewed, human-readable label is fit as the runtime prompt; do not
  // fall back to a technical runtime selector.
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

  const graph = context?.graph;
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!node?.id || edges.length === 0) return false;

  const nodesById = new Map((Array.isArray(graph?.nodes) ? graph.nodes : []).map((graphNode) => [graphNode.id, graphNode]));
  const downstreamRouteIds = edges
    .filter((edge) => edge?.from === node.id && nodesById.get(edge.to)?.node_kind === "function" && nodesById.get(edge.to)?.role === "route")
    .map((edge) => edge.to);
  return downstreamRouteIds.some((routeId) =>
    routeCasesFor(graph, routeId).some((routeCase) => routeCase.aliases.some(isNumericChoiceToken))
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

function normalizedAliases(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([choice]) => choice.trim())
      .map(([choice, aliases]) => [choice.trim(), stringList(aliases)])
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
