import { yamlScalar } from "../python-literals.mjs";

export function buildSampleInputsYaml({ modules, normalizedRequirement, packageName, processFlow, terminalOutputIds }) {
  const lines = buildWorkflowChatSampleYaml({ modules, normalizedRequirement, packageName, processFlow, terminalOutputIds });
  lines.push("samples:");
  let count = 0;
  for (const module of modules) {
    const inputs = module.smoke_spec?.synthetic_inputs;
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) continue;
    count += 1;
    lines.push(`  - module_id: ${yamlScalar(module.id)}`);
    lines.push(`    module_name: ${yamlScalar(module.name)}`);
    lines.push("    input:");
    for (const [key, value] of Object.entries(inputs)) {
      lines.push(`      ${key}: ${yamlScalar(value)}`);
    }
  }
  if (!count) {
    lines.push("  - module_id: workflow");
    lines.push(`    module_name: ${yamlScalar(normalizedRequirement.title || packageName)}`);
    lines.push("    input:");
    lines.push(`      user_request: ${yamlScalar(firstSmokeSample({ modules }) || "ADK Web smoke test sample")}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildRuntimeChatSmoke({ modules, normalizedRequirement, outputMode, packageName }) {
  const sample = firstSmokeSample({ modules });
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

export function firstSmokeSample({ modules }) {
  for (const module of modules) {
    const sample = module.smoke_spec?.sample_user_message;
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

function humanInputSamples({ processFlow, modules }) {
  return (Array.isArray(processFlow.nodes) ? processFlow.nodes : [])
    .filter((node) => node?.node_kind === "human_input")
    .map((node, index) => ({
      prompt: typeof node.label === "string" && node.label.trim() ? node.label.trim() : node.id,
      response: suggestedHumanInputReply(node, index, { modules }),
    }));
}

function suggestedHumanInputReply(node, index, context) {
  const label = typeof node.label === "string" ? node.label : "";
  if (/분석/.test(label) && /(수행|실행|1)/.test(label)) return "1";
  if (/목적|시나리오/.test(label)) return inferredPurposeText(context);
  return index === 0 ? firstSmokeSample(context) || "확인" : "확인";
}

function inferredPurposeText({ modules }) {
  for (const module of modules) {
    const inputs = module.smoke_spec?.synthetic_inputs;
    if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) continue;
    const objective = inputs.objective_text ?? inputs.user_request ?? inputs.request_text;
    if (typeof objective === "string" && objective.trim()) return objective.trim();
  }
  return firstSmokeSample({ modules }) || "확인";
}

function firstWorkflowPlaceholder({ modules }) {
  const workflow = modules.find((module) => module.module_category === "workflow" && module.workflow_ref);
  if (!workflow) return "";
  return workflow.workflow_ref?.display_name || workflow.workflow_ref?.id || workflow.name || workflow.id || "";
}

// Generic, artifact-derived sample transcript. Walks the approved process flow
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
  const summary = ["합성 실행을 완료했습니다."];
  const terminals = context.terminalOutputIds();
  if (terminals.length) summary.push(`- 최종 출력 노드: ${terminals.join(", ")}`);
  const unresolved = firstWorkflowPlaceholder(context);
  if (unresolved) summary.push(`- 미확정 후속 workflow: ${unresolved} (placeholder_only)`);
  messages.push({ role: "Assistant", text: summary.join("\n") });
  return messages;
}
