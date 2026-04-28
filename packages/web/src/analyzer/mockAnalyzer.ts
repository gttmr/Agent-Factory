import type {
  AnalysisResult,
  FieldSpec,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow,
  RequirementIntakeInput,
  SystemSpec
} from "./types";

const defaultExample: RequirementIntakeInput = {
  title: "Customer complaint triage agent",
  domainHint: "customer-service",
  requesterTeam: "example-operations",
  requesterRole: "business-user",
  knownSystems: "customer_profile_system, response_template_library",
  expectedOutput: "triage category, recommended next step, draft response outline",
  rawText:
    "We need a customer complaint triage agent that reads incoming complaint text, checks the customer profile when an identifier is present, looks up response guidance, classifies the issue, and recommends the next step. The team also wants reusable routing rules because other support workflows may need the same priority thresholds later. The exact complaint taxonomy is not final. System access is still unknown."
};

export function getExampleRequirement(): RequirementIntakeInput {
  return defaultExample;
}

export function analyzeRequirement(input: RequirementIntakeInput): AnalysisResult {
  const normalizedText = input.rawText.trim();
  const lowerText = normalizedText.toLowerCase();
  const requirementId = "req-001";
  const knownSystems = parseList(input.knownSystems);
  const systemsMentioned = inferSystems(lowerText, knownSystems);
  const inputs = inferInputs(lowerText);
  const outputs = inferOutputs(lowerText, input.expectedOutput);
  const missingInformation = inferMissingInformation(input, systemsMentioned, lowerText);
  const riskSignals = inferRiskSignals(lowerText);
  const contradictions = inferContradictions(lowerText);

  const normalizedRequirement: NormalizedRequirement = {
    id: requirementId,
    title: input.title.trim() || "Untitled requirement",
    raw_text: normalizedText,
    domain: input.domainHint.trim() || "unknown-domain",
    requester: {
      team: input.requesterTeam.trim() || "unknown-team",
      role: input.requesterRole.trim() || "unknown-role"
    },
    business_goal: inferBusinessGoal(lowerText),
    current_process: inferCurrentProcess(lowerText),
    inputs,
    outputs,
    systems: systemsMentioned.map<SystemSpec>((name) => ({
      name,
      access: "unknown"
    })),
    risk_signals: riskSignals,
    missing_information: missingInformation,
    contradictions,
    status: "draft"
  };

  const moduleCandidates = inferModuleCandidates(normalizedRequirement, lowerText);
  const processFlow = buildProcessFlow(normalizedRequirement, moduleCandidates);

  return {
    normalizedRequirement,
    evidence: {
      requested_goal: normalizedRequirement.business_goal,
      business_domain_hint: normalizedRequirement.domain,
      user_role: normalizedRequirement.requester.role,
      input_data: inputs.map((field) => field.name),
      output_data: outputs.map((field) => field.name),
      systems_mentioned: systemsMentioned,
      decisions_implied: inferDecisions(lowerText),
      risk_signals: riskSignals,
      missing_information: missingInformation,
      contradictions,
      assumptions: inferAssumptions(input, lowerText)
    },
    moduleCandidates,
    processFlow
  };
}

export function buildProcessFlow(
  normalizedRequirement: NormalizedRequirement,
  moduleCandidates: ModuleCandidate[]
): ProcessFlow {
  const inputNodes = normalizedRequirement.inputs.map((field) => ({
    id: field.name,
    label: field.name,
    type: "input" as const
  }));
  const moduleNodes = moduleCandidates.map((candidate) => ({
    id: candidate.id,
    label: candidate.name,
    type: candidate.recommended_type
  }));
  const outputNodes = normalizedRequirement.outputs.map((field) => ({
    id: field.name,
    label: field.name,
    type: "output" as const
  }));

  const firstModule = moduleCandidates[0];
  const lastModule = moduleCandidates[moduleCandidates.length - 1];
  const edges: ProcessFlow["edges"] = [];

  if (firstModule) {
    normalizedRequirement.inputs.forEach((field) => {
      edges.push({
        from: field.name,
        to: firstModule.id,
        data: field.name,
        edge_type: "local" as const
      });
    });
  }

  moduleCandidates.forEach((candidate, index) => {
    const next = moduleCandidates[index + 1];
    if (next) {
      edges.push({
        from: candidate.id,
        to: next.id,
        data: summarizeEdgeData(candidate.outputs),
        edge_type:
          candidate.recommended_type === "remote_a2a_contract" ||
          next.recommended_type === "remote_a2a_contract"
            ? ("remote_a2a" as const)
            : ("local" as const)
      });
    }
  });

  if (lastModule) {
    normalizedRequirement.outputs.forEach((field) => {
      edges.push({
        from: lastModule.id,
        to: field.name,
        data: field.name,
        edge_type: "local" as const
      });
    });
  }

  return {
    requirement_id: normalizedRequirement.id,
    nodes: [...inputNodes, ...moduleNodes, ...outputNodes],
    edges
  };
}

function inferInputs(lowerText: string): FieldSpec[] {
  const fields: FieldSpec[] = [{ name: "raw_requirement_text", type: "text", required: true }];

  if (lowerText.includes("complaint")) {
    fields.push({ name: "complaint_text", type: "text", required: true });
  }
  if (lowerText.includes("customer") || lowerText.includes("identifier")) {
    fields.push({ name: "customer_id", type: "string", required: false });
  }
  if (lowerText.includes("document") || lowerText.includes("policy") || lowerText.includes("faq")) {
    fields.push({ name: "knowledge_query", type: "text", required: true });
  }

  return uniqueFields(fields);
}

function inferOutputs(lowerText: string, expectedOutput: string): FieldSpec[] {
  const outputText = `${lowerText} ${expectedOutput.toLowerCase()}`;
  const outputs: FieldSpec[] = [];

  if (outputText.includes("category") || outputText.includes("classif")) {
    outputs.push({ name: "classification", type: "string" });
  }
  if (outputText.includes("recommend") || outputText.includes("next step")) {
    outputs.push({ name: "recommended_next_step", type: "string" });
  }
  if (outputText.includes("draft") || outputText.includes("response")) {
    outputs.push({ name: "draft_response_outline", type: "text" });
  }
  if (outputs.length === 0) {
    outputs.push({ name: "normalized_recommendation", type: "object" });
  }

  return uniqueFields(outputs);
}

function inferSystems(lowerText: string, knownSystems: string[]): string[] {
  const systems = [...knownSystems];

  if (lowerText.includes("profile")) {
    systems.push("customer_profile_system");
  }
  if (lowerText.includes("template") || lowerText.includes("guidance")) {
    systems.push("response_template_library");
  }
  if (lowerText.includes("registry") || lowerText.includes("routing")) {
    systems.push("capability_registry");
  }

  return uniqueStrings(systems);
}

function inferMissingInformation(input: RequirementIntakeInput, systems: string[], lowerText: string): string[] {
  const missing: string[] = [];

  if (!input.domainHint.trim()) {
    missing.push("Domain boundary");
  }
  if (!input.requesterTeam.trim()) {
    missing.push("Requester team");
  }
  if (!input.expectedOutput.trim()) {
    missing.push("Expected output contract");
  }
  if (systems.length === 0 || lowerText.includes("unknown")) {
    missing.push("System access method");
  }
  if (lowerText.includes("taxonomy") && (lowerText.includes("not final") || lowerText.includes("unknown"))) {
    missing.push("Final classification taxonomy");
  }
  if (!lowerText.includes("success") && !lowerText.includes("metric")) {
    missing.push("Success metric");
  }

  return uniqueStrings(missing);
}

function inferRiskSignals(lowerText: string): string[] {
  const risks: string[] = [];

  if (lowerText.includes("customer") || lowerText.includes("personal")) {
    risks.push("personal_data", "customer_impact");
  }
  if (lowerText.includes("approve") || lowerText.includes("decision")) {
    risks.push("decision_support");
  }
  if (lowerText.includes("external") || lowerText.includes("remote")) {
    risks.push("remote_dependency");
  }

  return uniqueStrings(risks.length ? risks : ["review_required"]);
}

function inferContradictions(lowerText: string): string[] {
  const contradictions: string[] = [];

  if (lowerText.includes("fully automated") && lowerText.includes("human approval")) {
    contradictions.push("Requirement asks for full automation and human approval.");
  }
  if (lowerText.includes("no external system") && lowerText.includes("lookup")) {
    contradictions.push("Requirement denies external systems but asks for lookup behavior.");
  }

  return contradictions;
}

function inferBusinessGoal(lowerText: string): string {
  if (lowerText.includes("reduce") || lowerText.includes("faster")) {
    return "Reduce manual effort and improve turnaround time.";
  }
  if (lowerText.includes("consistent") || lowerText.includes("standard")) {
    return "Improve consistency in requirement handling.";
  }
  return "Make the requested process easier to review, route, and execute.";
}

function inferCurrentProcess(lowerText: string): string[] {
  const steps: string[] = [];

  if (lowerText.includes("read")) {
    steps.push("Read the submitted text or work item");
  }
  if (lowerText.includes("check") || lowerText.includes("lookup")) {
    steps.push("Check referenced systems or records");
  }
  if (lowerText.includes("look up") || lowerText.includes("guidance") || lowerText.includes("policy")) {
    steps.push("Retrieve relevant guidance");
  }
  if (lowerText.includes("classif") || lowerText.includes("triage")) {
    steps.push("Classify the request");
  }
  if (lowerText.includes("recommend") || lowerText.includes("route")) {
    steps.push("Recommend the next action or route");
  }

  return steps.length ? steps : ["Review request", "Identify needed context", "Produce a draft recommendation"];
}

function inferDecisions(lowerText: string): string[] {
  const decisions: string[] = [];

  if (lowerText.includes("classif") || lowerText.includes("category")) {
    decisions.push("classification");
  }
  if (lowerText.includes("route")) {
    decisions.push("routing");
  }
  if (lowerText.includes("recommend")) {
    decisions.push("recommendation");
  }

  return decisions.length ? decisions : ["module classification"];
}

function inferAssumptions(input: RequirementIntakeInput, lowerText: string): string[] {
  const assumptions: string[] = [];

  if (!input.domainHint.trim()) {
    assumptions.push("Domain is treated as unknown until reviewed.");
  }
  if (lowerText.includes("agent")) {
    assumptions.push("The word agent may describe several implementation units, not one deployable agent.");
  }
  if (!input.requesterRole.trim()) {
    assumptions.push("Requester role is unknown and should be confirmed before approval.");
  }

  return assumptions;
}

function inferModuleCandidates(requirement: NormalizedRequirement, lowerText: string): ModuleCandidate[] {
  const modules: ModuleCandidate[] = [];

  if (lowerText.includes("lookup") || lowerText.includes("check") || lowerText.includes("profile")) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "customer_profile_lookup",
      recommended_type: "tool_adapter",
      confidence: 0.82,
      rationale: "The request describes a deterministic lookup with clear input and output data.",
      inputs: [{ name: "customer_id", type: "string", required: true }],
      outputs: [{ name: "customer_profile", type: "object" }],
      reuse_candidate: true,
      risk_level: "medium",
      status: "needs_review"
    });
  }

  if (
    lowerText.includes("guidance") ||
    lowerText.includes("document") ||
    lowerText.includes("policy") ||
    lowerText.includes("faq")
  ) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "guidance_retrieval",
      recommended_type: "knowledge_retrieval",
      confidence: 0.78,
      rationale: "The request needs grounded information from reusable knowledge sources.",
      inputs: [{ name: "knowledge_query", type: "text", required: true }],
      outputs: [
        { name: "guidance_summary", type: "text" },
        { name: "citations", type: "array" }
      ],
      reuse_candidate: true,
      risk_level: "medium",
      status: "needs_review"
    });
  }

  if (requirement.current_process.length > 2 || lowerText.includes("workflow") || lowerText.includes("handoff")) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "requirement_handling_workflow",
      recommended_type: "internal_workflow",
      confidence: 0.76,
      rationale: "The request describes ordered steps inside one work boundary.",
      inputs: requirement.inputs,
      outputs: [{ name: "workflow_context", type: "object" }],
      reuse_candidate: false,
      risk_level: "medium",
      status: "needs_review"
    });
  }

  modules.push({
    id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
    source_requirement_id: requirement.id,
    name: "requirement_review_specialist",
    recommended_type: "specialist_agent",
    confidence: 0.8,
    rationale: "The request needs narrow judgment over gathered context to produce a recommendation.",
    inputs: [{ name: "workflow_context", type: "object", required: true }],
    outputs: requirement.outputs,
    reuse_candidate: false,
    risk_level: requirement.risk_signals.includes("personal_data") ? "medium" : "low",
    status: "needs_review"
  });

  if (lowerText.includes("reusable") || lowerText.includes("shared capability")) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "shared_review_capability",
      recommended_type: "shared_agent",
      confidence: 0.64,
      rationale: "The requirement hints that multiple specialists may need the same higher-level capability.",
      inputs: [{ name: "review_context", type: "object", required: true }],
      outputs: [{ name: "shared_recommendation", type: "object" }],
      reuse_candidate: true,
      risk_level: "medium",
      status: "needs_review"
    });
  }

  if (lowerText.includes("registry") || lowerText.includes("routing") || lowerText.includes("threshold")) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "routing_rules_registry",
      recommended_type: "metadata_registry",
      confidence: 0.72,
      rationale: "Routing rules and thresholds are structured operating metadata.",
      inputs: [{ name: "classification", type: "string", required: true }],
      outputs: [{ name: "routing_decision", type: "object" }],
      reuse_candidate: true,
      risk_level: "low",
      status: "needs_review"
    });
  }

  if (lowerText.includes("remote agent") || lowerText.includes("independent agent") || lowerText.includes("a2a")) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "remote_specialist_contract",
      recommended_type: "remote_a2a_contract",
      confidence: 0.7,
      rationale: "The request references an independent remote agent boundary.",
      inputs: [{ name: "delegated_task", type: "object", required: true }],
      outputs: [{ name: "remote_agent_result", type: "object" }],
      reuse_candidate: false,
      risk_level: "high",
      status: "needs_review"
    });
  }

  return modules;
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => toIdentifier(item))
    .filter(Boolean);
}

function summarizeEdgeData(fields: FieldSpec[]): string {
  return fields.map((field) => field.name).join(", ") || "module output";
}

function uniqueFields(fields: FieldSpec[]): FieldSpec[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    if (seen.has(field.name)) {
      return false;
    }
    seen.add(field.name);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
