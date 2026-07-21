import { yamlScalar } from "../python-literals.mjs";
import { routeValue } from "../graph/routes.mjs";

export function buildSampleInputsYaml({ assets, normalizedRequirement, packageName, graph, terminalOutputIds }) {
  const lines = buildWorkflowChatSampleYaml({ assets, normalizedRequirement, packageName, graph, terminalOutputIds });
  lines.push("samples:");
  let count = 0;
  for (const asset of assets) {
    const inputs = asset.smoke_spec?.synthetic_inputs;
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) continue;
    count += 1;
    lines.push(`  - asset_id: ${yamlScalar(asset.asset_id)}`);
    lines.push(`    asset_name: ${yamlScalar(asset.name)}`);
    lines.push("    input:");
    for (const [key, value] of Object.entries(inputs)) {
      lines.push(`      ${key}: ${yamlScalar(value)}`);
    }
  }
  if (!count) {
    lines.push("  - asset_id: workflow");
    lines.push(`    asset_name: ${yamlScalar(normalizedRequirement.title || packageName)}`);
    lines.push("    input:");
    lines.push(`      user_request: ${yamlScalar(firstSmokeSample({ assets }) || "ADK development UI smoke test sample")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildRuntimeChatSmoke({ assets, normalizedRequirement, outputMode, packageName }) {
  const sample = firstSmokeSample({ assets });
  const text =
    outputMode === "runnable"
      ? sample || `${normalizedRequirement.title} 워크플로우를 합성 sample input으로 실행하고 결과를 요약하세요.`
      : `${normalizedRequirement.title}에 대한 합성 ADK chat smoke를 실행하세요.`;
  return {
    host: "127.0.0.1",
    port: 8765,
    appName: packageName,
    userId: "af-reviewer",
    sessionId: "af-smoke",
    newMessage: {
      role: "user",
      parts: [{ text }]
    }
  };
}

function firstSmokeSample({ assets }) {
  for (const asset of assets) {
    const sample = asset.smoke_spec?.sample_user_message;
    if (typeof sample === "string" && sample.trim()) return sample.trim();
  }
  return "";
}

export function sampleConversationTranscript(context) {
  return sampleConversationMessages(context)
    .map((message) => `${message.role}:\n${message.text}`)
    .join("\n\n");
}

function buildWorkflowChatSampleYaml(context) {
  const { normalizedRequirement, packageName } = context;
  const sampleText =
    firstSmokeSample(context) || `${normalizedRequirement.title || packageName} 워크플로우를 합성 sample input으로 실행하세요.`;
  const lines = ["workflow_chat_smoke:", `  initial_user_message: ${yamlScalar(sampleText)}`];
  const replies = humanInputSamples(context);
  if (replies.length) {
    lines.push("  operator_replies:");
    for (const reply of replies) {
      lines.push(`    - prompt: ${yamlScalar(reply.prompt)}`);
      lines.push(`      response: ${yamlScalar(reply.response)}`);
    }
  }
  lines.push("  conversation:");
  for (const message of sampleConversationMessages(context)) {
    lines.push(`    - role: ${yamlScalar(message.role)}`);
    lines.push(`      text: ${yamlScalar(message.text)}`);
  }
  lines.push(`  expected_checkpoint: ${yamlScalar("reviewed synthetic sample reaches the generated output or handoff node")}`);
  const unresolvedWorkflow = firstWorkflowPlaceholder(context);
  if (unresolvedWorkflow) {
    lines.push("  unresolved_followup:");
    lines.push(`    workflow_ref: ${yamlScalar(unresolvedWorkflow)}`);
    lines.push(`    status: ${yamlScalar("placeholder_only")}`);
  }
  lines.push("");
  return lines;
}

function humanInputSamples({ graph, assets }) {
  return (Array.isArray(graph.nodes) ? graph.nodes : [])
    .filter((node) => node?.node_kind === "human_input")
    .map((node, index) => ({
      prompt: humanInputPrompt(node),
      response: suggestedHumanInputReply(node, index, { assets, graph }),
    }));
}

function suggestedHumanInputReply(node, index, context) {
  const reviewedDefault = reviewedDefaultChoice(node);
  if (reviewedDefault) return reviewedDefault;
  const routeReply = reviewedRouteReplyAfterNode(node, context.graph);
  if (routeReply) return routeReply;
  const label = humanInputPrompt(node);
  if (/목적|시나리오/.test(label)) return inferredPurposeText(context);
  return index === 0 ? firstSmokeSample(context) || "확인" : "확인";
}

function humanInputPrompt(node) {
  const reviewedPrompt = node?.human_input_contract?.message;
  if (typeof reviewedPrompt === "string" && reviewedPrompt.trim()) return reviewedPrompt.trim();
  return typeof node.label === "string" && node.label.trim() ? node.label.trim() : node.id;
}

function reviewedDefaultChoice(node) {
  const contract = node?.human_input_contract;
  if (typeof contract?.default_choice === "string" && contract.default_choice.trim()) return contract.default_choice.trim();
  const choices = Array.isArray(contract?.choice_options)
    ? contract.choice_options.filter((choice) => typeof choice === "string" && choice.trim())
    : [];
  return choices[0]?.trim() ?? "";
}

function reviewedRouteReplyAfterNode(node, graph) {
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const outgoing = edges.filter((edge) => edge?.from === node.id);
  const routeNodeIds = new Set(
    outgoing
      .map((edge) => edge.to)
      .filter((id) => nodes.some((candidate) => candidate?.id === id && candidate.node_kind === "function" && candidate.role === "route"))
  );
  const routes = edges.filter((edge) => routeNodeIds.has(edge?.from) && edge.control?.kind === "condition");
  const selected = routes.find((edge) => edge.control?.default === true) ?? routes[0];
  if (!selected) return "";
  const reviewedAlias = Array.isArray(selected.control?.accepted_aliases)
    ? selected.control.accepted_aliases.find((alias) => typeof alias === "string" && alias.trim())
    : "";
  return reviewedAlias || routeValue(selected);
}

function inferredPurposeText({ assets }) {
  for (const asset of assets) {
    const inputs = asset.smoke_spec?.synthetic_inputs;
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) continue;
    const objective = inputs.objective_text ?? inputs.user_request ?? inputs.request_text;
    if (typeof objective === "string" && objective.trim()) return objective.trim();
  }
  return firstSmokeSample({ assets }) || "확인";
}

function firstWorkflowPlaceholder({ graph }) {
  const node = (graph.nodes ?? []).find((candidate) => candidate.node_kind === "subworkflow" && candidate.workflow_ref);
  if (!node) return "";
  return node.workflow_ref || "";
}

// Generic, artifact-derived sample transcript. Walks the approved Graph IR
// (objective → human-input turns → terminal outputs) and stays domain-neutral —
// no requirement-specific narration is baked into the generator.
function sampleConversationMessages(context) {
  const objective = inferredPurposeText(context);
  const messages = [
    {
      role: "User",
      text: firstSmokeSample(context) || `${objective} 합성 sample 실행`,
    },
    {
      role: "Assistant",
      text: [
        "검토된 합성 입력으로 진행합니다.",
        `- 목적: ${objective}`,
        "이 응답은 검토된 합성 테스트 더블만 사용하며 실제 업무 로직이 아닙니다.",
      ].join("\n"),
    },
  ];
  for (const reply of humanInputSamples(context)) {
    messages.push({ role: "Assistant", text: reply.prompt });
    messages.push({ role: "User", text: reply.response });
  }
  const terminals = context.terminalOutputIds();
  const summary = terminals.length
    ? terminals.map((terminal) => `Terminal output node ${terminal} completed. Final state keys: <runtime state keys>.`)
    : ["Terminal output node none completed. Final state keys: <runtime state keys>."];
  const unresolved = firstWorkflowPlaceholder(context);
  if (unresolved) summary.push(`- 미확정 후속 workflow: ${unresolved} (placeholder_only)`);
  messages.push({ role: "Assistant", text: summary.join("\n") });
  return messages;
}
