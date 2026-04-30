import type {
  AnalysisResult,
  FieldSpec,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow,
  RequirementIntakeInput,
  RiskSignal,
  SystemSpec
} from "./types";

const defaultExample: RequirementIntakeInput = {
  title: "복잡한 고객 불만 처리 흐름",
  domainHint: "고객",
  requesterTeam: "예시 운영팀",
  requesterRole: "업무 사용자",
  knownSystems: "고객_프로필_시스템, 응답_가이드_라이브러리, 라우팅_규칙_저장소",
  expectedOutput: "불만 분류, 추천 다음 단계, 라우팅 결정, 응답 초안",
  rawText:
    "접수된 고객 불만을 처리하는 복잡한 업무 흐름이 필요합니다. 먼저 불만 내용을 읽고, 고객 식별자가 있으면 고객 프로필을 확인합니다. 동시에 응답 가이드도 찾아서 상담원이 사용할 수 있는 근거를 준비해야 합니다. 두 결과를 함께 보고 이슈를 분류한 뒤, 라우팅 규칙 저장소의 우선순위 기준에 따라 다음 경로를 결정합니다. 우선순위가 높으면 사람 승인 단계로 보내고, 우선순위가 낮으면 바로 응답 초안을 생성합니다. 고객 정보가 부족하거나 분류 신뢰도가 낮으면 고객에게 추가 확인을 요청하고, 답변이 들어오면 다시 필요한 정보를 수집해서 검토해야 합니다. 같은 라우팅 규칙은 다른 지원 업무 흐름에서도 재사용할 수 있어야 합니다. 정확한 불만 분류 체계는 아직 확정되지 않았고, 시스템 접근 방식도 아직 미정입니다."
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
    title: input.title.trim() || "제목 없는 요구사항",
    raw_text: normalizedText,
    domain: input.domainHint.trim() || "미정 도메인",
    requester: {
      team: input.requesterTeam.trim() || "미정 팀",
      role: input.requesterRole.trim() || "미정 역할"
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
    type: candidate.module_category,
    subtype: getCandidateSubtypeValue(candidate) ?? undefined
  }));
  const outputNodes = normalizedRequirement.outputs.map((field) => ({
    id: field.name,
    label: field.name,
    type: "output" as const
  }));

  const firstModule = moduleCandidates[0];
  const lastModule = moduleCandidates[moduleCandidates.length - 1];
  const edges: ProcessFlow["edges"] = [];
  const workflowModule = moduleCandidates.find((candidate) => candidate.module_category === "workflow");
  const reviewModule = moduleCandidates.find((candidate) => candidate.name === "requirement_review_specialist");
  const sharedModule = moduleCandidates.find((candidate) => candidate.name === "shared_review_capability");
  const ruleRegistryModule = moduleCandidates.find((candidate) => candidate.adapter_kind === "rule_registry");
  const branchModules = moduleCandidates.filter(
    (candidate) => candidate.adapter_kind === "legacy_api" || candidate.adapter_kind === "retrieval"
  );
  const parallelBranchModules = shouldInferParallelBranches(normalizedRequirement.raw_text, branchModules)
    ? branchModules
    : [];
  const hasComplexFlow = Boolean(workflowModule && (parallelBranchModules.length > 1 || ruleRegistryModule));
  const hasLoop = shouldInferClarificationLoop(normalizedRequirement.raw_text);
  const hasPriorityBranch = shouldInferPriorityBranches(normalizedRequirement.raw_text);

  function addEdge(from: string, to: string, data: string, edge_type: ProcessFlow["edges"][number]["edge_type"] = "local") {
    if (edges.some((edge) => edge.from === from && edge.to === to && edge.data === data)) {
      return;
    }
    edges.push({ from, to, data, edge_type });
  }

  if (hasComplexFlow && workflowModule) {
    normalizedRequirement.inputs.forEach((field) => {
      parallelBranchModules.forEach((candidate) => {
        addEdge(field.name, candidate.id, field.name);
      });
      if (parallelBranchModules.length === 0) {
        addEdge(field.name, workflowModule.id, field.name);
      }
    });

    parallelBranchModules.forEach((candidate) => {
      addEdge(candidate.id, workflowModule.id, `parallel: ${summarizeEdgeData(candidate.outputs)}`);
    });

    if (reviewModule && reviewModule.id !== workflowModule.id) {
      addEdge(workflowModule.id, reviewModule.id, "merged_context");
    }

    if (reviewModule && sharedModule) {
      addEdge(reviewModule.id, sharedModule.id, "review_context");
      addEdge(sharedModule.id, reviewModule.id, "shared_recommendation");
    }

    if (ruleRegistryModule && reviewModule) {
      addEdge(reviewModule.id, ruleRegistryModule.id, "classification");
      if (hasLoop) {
        addEdge(ruleRegistryModule.id, reviewModule.id, "loop: clarification_context_refresh");
      }
      if (hasPriorityBranch) {
        addEdge(ruleRegistryModule.id, reviewModule.id, "branch: high_priority_human_approval");
        addEdge(ruleRegistryModule.id, reviewModule.id, "branch: low_priority_draft_response");
      }
    }

    const outputSource = reviewModule ?? workflowModule;
    normalizedRequirement.outputs.forEach((field) => {
      addEdge(outputSource.id, field.name, field.name);
    });

    return {
      requirement_id: normalizedRequirement.id,
      nodes: [...inputNodes, ...moduleNodes, ...outputNodes],
      edges
    };
  }

  if (firstModule) {
    normalizedRequirement.inputs.forEach((field) => {
      addEdge(field.name, firstModule.id, field.name);
    });
  }

  moduleCandidates.forEach((candidate, index) => {
    const next = moduleCandidates[index + 1];
    if (next) {
      addEdge(
        candidate.id,
        next.id,
        summarizeEdgeData(candidate.outputs),
        candidate.module_category === "remote_a2a" || next.module_category === "remote_a2a" ? "remote_a2a" : "local"
      );
    }
  });

  if (lastModule) {
    normalizedRequirement.outputs.forEach((field) => {
      addEdge(lastModule.id, field.name, field.name);
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

  if (hasAny(lowerText, ["complaint", "불만", "민원"])) {
    fields.push({ name: "complaint_text", type: "text", required: true });
  }
  if (hasAny(lowerText, ["customer", "identifier", "고객", "식별자"])) {
    fields.push({ name: "customer_id", type: "string", required: false });
  }
  if (hasAny(lowerText, ["document", "policy", "faq", "문서", "정책", "가이드", "조회"])) {
    fields.push({ name: "knowledge_query", type: "text", required: true });
  }

  return uniqueFields(fields);
}

function inferOutputs(lowerText: string, expectedOutput: string): FieldSpec[] {
  const outputText = `${lowerText} ${expectedOutput.toLowerCase()}`;
  const outputs: FieldSpec[] = [];

  if (hasAny(outputText, ["category", "classif", "분류"])) {
    outputs.push({ name: "classification", type: "string" });
  }
  if (hasAny(outputText, ["recommend", "next step", "추천", "다음 단계"])) {
    outputs.push({ name: "recommended_next_step", type: "string" });
  }
  if (hasAny(outputText, ["draft", "response", "초안", "응답"])) {
    outputs.push({ name: "draft_response_outline", type: "text" });
  }
  if (outputs.length === 0) {
    outputs.push({ name: "normalized_recommendation", type: "object" });
  }

  return uniqueFields(outputs);
}

function inferSystems(lowerText: string, knownSystems: string[]): string[] {
  const systems = [...knownSystems];

  if (hasAny(lowerText, ["profile", "프로필"])) {
    systems.push("고객_프로필_시스템");
  }
  if (hasAny(lowerText, ["template", "guidance", "템플릿", "가이드"])) {
    systems.push("응답_템플릿_라이브러리");
  }
  if (hasAny(lowerText, ["registry", "routing", "레지스트리", "라우팅"])) {
    systems.push("역량_레지스트리");
  }

  return uniqueStrings(systems);
}

function inferMissingInformation(input: RequirementIntakeInput, systems: string[], lowerText: string): string[] {
  const missing: string[] = [];

  if (!input.domainHint.trim()) {
    missing.push("도메인 경계");
  }
  if (!input.requesterTeam.trim()) {
    missing.push("요청 팀");
  }
  if (!input.expectedOutput.trim()) {
    missing.push("예상 출력 계약");
  }
  if (systems.length === 0 || hasAny(lowerText, ["unknown", "미정", "불명확"])) {
    missing.push("System access method");
  }
  if (hasAny(lowerText, ["taxonomy", "분류 체계"]) && hasAny(lowerText, ["not final", "unknown", "확정되지", "미정"])) {
    missing.push("Final classification taxonomy");
  }
  if (!hasAny(lowerText, ["success", "metric", "성공", "지표", "측정"])) {
    missing.push("Success metric");
  }

  return uniqueStrings(missing);
}

function inferRiskSignals(lowerText: string): RiskSignal[] {
  const risks: RiskSignal[] = [];

  if (hasAny(lowerText, ["customer", "personal", "고객", "개인"])) {
    risks.push("personal_data", "customer_impact");
  }
  if (hasAny(lowerText, ["account", "balance", "loan", "credit", "deposit", "card", "금융", "계좌", "잔액", "대출", "신용", "수신", "여신", "카드"])) {
    risks.push("financial_data");
  }
  if (hasAny(lowerText, ["credit", "loan approval", "approve", "decision", "신용", "여신", "대출 승인", "승인", "의사결정", "판단"])) {
    risks.push("credit_decision_support");
  }
  if (hasAny(lowerText, ["message", "notify", "response", "external", "remote", "메시지", "알림", "응답", "외부", "원격"])) {
    risks.push("external_message");
  }
  if (hasAny(lowerText, ["write", "update", "transaction", "transfer", "수정", "등록", "거래", "이체"])) {
    risks.push("transaction_write");
  }
  if (hasAny(lowerText, ["approve", "human", "review", "승인", "사람", "검토"])) {
    risks.push("human_approval_required");
  }
  risks.push("audit_required");

  return uniqueRiskSignals(risks);
}

function inferContradictions(lowerText: string): string[] {
  const contradictions: string[] = [];

  if (lowerText.includes("fully automated") && lowerText.includes("human approval")) {
    contradictions.push("요구사항이 완전 자동화와 사람 승인을 동시에 요구합니다.");
  }
  if (lowerText.includes("no external system") && lowerText.includes("lookup")) {
    contradictions.push("요구사항이 외부 시스템을 부정하면서 조회 동작을 요구합니다.");
  }

  return contradictions;
}

function inferBusinessGoal(lowerText: string): string {
  if (hasAny(lowerText, ["reduce", "faster", "줄이", "감소", "빠르"])) {
    return "수작업 부담을 줄이고 처리 시간을 개선합니다.";
  }
  if (hasAny(lowerText, ["consistent", "standard", "일관", "표준"])) {
    return "요구사항 처리의 일관성을 개선합니다.";
  }
  return "요청된 프로세스를 더 쉽게 검토, 라우팅, 실행할 수 있게 합니다.";
}

function inferCurrentProcess(lowerText: string): string[] {
  const steps: string[] = [];

  if (hasAny(lowerText, ["read", "읽"])) {
    steps.push("제출된 텍스트 또는 작업 항목 읽기");
  }
  if (hasAny(lowerText, ["check", "lookup", "확인", "조회"])) {
    steps.push("참조 시스템 또는 기록 확인");
  }
  if (hasAny(lowerText, ["look up", "guidance", "policy", "가이드", "정책"])) {
    steps.push("관련 가이드 검색");
  }
  if (hasAny(lowerText, ["classif", "triage", "분류"])) {
    steps.push("요청 분류");
  }
  if (hasAny(lowerText, ["recommend", "route", "추천", "라우팅"])) {
    steps.push("다음 조치 또는 경로 추천");
  }

  return steps.length ? steps : ["요청 검토", "필요 컨텍스트 식별", "추천 초안 작성"];
}

function inferDecisions(lowerText: string): string[] {
  const decisions: string[] = [];

  if (hasAny(lowerText, ["classif", "category", "분류"])) {
    decisions.push("분류");
  }
  if (hasAny(lowerText, ["route", "라우팅"])) {
    decisions.push("라우팅");
  }
  if (hasAny(lowerText, ["recommend", "추천"])) {
    decisions.push("추천");
  }

  return decisions.length ? decisions : ["모듈 분류"];
}

function inferAssumptions(input: RequirementIntakeInput, lowerText: string): string[] {
  const assumptions: string[] = [];

  if (!input.domainHint.trim()) {
    assumptions.push("검토 전까지 도메인은 미정으로 취급합니다.");
  }
  if (hasAny(lowerText, ["agent", "에이전트"])) {
    assumptions.push("Agent라는 표현은 하나의 deployable agent가 아니라 여러 implementation unit을 뜻할 수 있습니다.");
  }
  if (!input.requesterRole.trim()) {
    assumptions.push("요청자 역할이 미정이므로 승인 전에 확인해야 합니다.");
  }

  return assumptions;
}

function inferModuleCandidates(requirement: NormalizedRequirement, lowerText: string): ModuleCandidate[] {
  const modules: ModuleCandidate[] = [];

  if (hasAny(lowerText, ["lookup", "check", "profile", "조회", "확인", "프로필"])) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "customer_profile_lookup",
      module_category: "adapter",
      adapter_kind: lowerText.includes("query") ? "data_query" : "legacy_api",
      legacy_recommended_type: "tool_adapter",
      confidence: 0.82,
      rationale: "요청이 명확한 입력과 출력 데이터를 가진 결정적 조회를 설명합니다.",
      inputs: [{ name: "customer_id", type: "string", required: true }],
      outputs: [{ name: "customer_profile", type: "object" }],
      reuse_candidate: true,
      risk_level: "medium",
      risk_signals: mergeRiskSignals(requirement.risk_signals, ["personal_data", "financial_data", "audit_required"]),
      status: "needs_info",
      missing_information: ["검토된 API 계약", "인증 방식", "timeout/retry 정책"],
      side_effect: "read",
      auth_required: true,
      audit_required: true
    });
  }

  if (
    hasAny(lowerText, ["guidance", "document", "policy", "faq", "가이드", "문서", "정책"])
  ) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "guidance_retrieval",
      module_category: "adapter",
      adapter_kind: "retrieval",
      legacy_recommended_type: "knowledge_retrieval",
      confidence: 0.78,
      rationale: "요청에 재사용 가능한 지식 원천에서 가져온 근거 있는 정보가 필요합니다.",
      inputs: [{ name: "knowledge_query", type: "text", required: true }],
      outputs: [
        { name: "guidance_summary", type: "text" },
        { name: "citations", type: "array" }
      ],
      reuse_candidate: true,
      risk_level: "medium",
      risk_signals: mergeRiskSignals(requirement.risk_signals, ["audit_required"]),
      status: "needs_info",
      missing_information: ["승인된 지식 원천 목록", "출처 표기 정책", "원천 접근 권한"],
      citation_required: true,
      grounding_required: true,
      source_acl_required: true
    });
  }

  if (
    requirement.current_process.length > 2 ||
    hasAny(lowerText, ["workflow", "handoff", "approval flow", "워크플로우", "인계", "승인 흐름"])
  ) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "requirement_handling_workflow",
      module_category: "workflow",
      workflow_kind: inferWorkflowKind(lowerText),
      legacy_recommended_type: "internal_workflow",
      confidence: 0.76,
      rationale: "요청이 하나의 작업 경계 안에서 순서가 있는 단계를 설명합니다.",
      inputs: requirement.inputs,
      outputs: [{ name: "workflow_context", type: "object" }],
      reuse_candidate: false,
      risk_level: "medium",
      risk_signals: mergeRiskSignals(requirement.risk_signals, ["human_approval_required", "audit_required"]),
      status: "needs_info",
      missing_information: ["단계 순서", "단계 간 인계 계약", "실패 또는 escalation 규칙"]
    });
  }

  modules.push({
    id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
    source_requirement_id: requirement.id,
    name: "requirement_review_specialist",
    module_category: "agent",
    agent_kind: "specialist",
    legacy_recommended_type: "specialist_agent",
    confidence: 0.8,
    rationale: "요청은 수집된 컨텍스트를 바탕으로 추천을 만들기 위한 좁은 범위의 판단을 필요로 합니다.",
    inputs: [{ name: "workflow_context", type: "object", required: true }],
    outputs: requirement.outputs,
    reuse_candidate: false,
    risk_level: requirement.risk_signals.includes("credit_decision_support") ? "high" : requirement.risk_signals.includes("personal_data") ? "medium" : "low",
    risk_signals: mergeRiskSignals(requirement.risk_signals, ["human_approval_required", "audit_required"]),
    status: "needs_info",
    missing_information: ["입력 계약", "eval placeholder"]
  });

  if (hasAny(lowerText, ["reusable", "shared capability", "재사용", "공유 역량"])) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "shared_review_capability",
      module_category: "agent",
      agent_kind: "shared",
      legacy_recommended_type: "shared_agent",
      confidence: 0.64,
      rationale: "요구사항은 여러 전문가가 같은 상위 역량을 필요로 할 수 있음을 시사합니다.",
      inputs: [{ name: "review_context", type: "object", required: true }],
      outputs: [{ name: "shared_recommendation", type: "object" }],
      reuse_candidate: true,
      risk_level: "medium",
      risk_signals: mergeRiskSignals(requirement.risk_signals, ["human_approval_required", "audit_required"]),
      status: "needs_info",
      missing_information: ["공유 책임 범위", "재사용 가능한 입력/출력 계약", "eval placeholder"]
    });
  }

  if (hasAny(lowerText, ["registry", "routing", "threshold", "레지스트리", "라우팅", "임계값"])) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "routing_rules_registry",
      module_category: "adapter",
      adapter_kind: "rule_registry",
      legacy_recommended_type: "metadata_registry",
      confidence: 0.72,
      rationale: "라우팅 규칙과 임계값은 구조화된 운영 메타데이터입니다.",
      inputs: [{ name: "classification", type: "string", required: true }],
      outputs: [{ name: "routing_decision", type: "object" }],
      reuse_candidate: true,
      risk_level: "low",
      risk_signals: mergeRiskSignals(requirement.risk_signals, ["audit_required"]),
      status: "needs_info",
      missing_information: ["registry 소유자", "버전 관리 규칙", "적용일 정책"],
      versioned: true,
      effective_date_required: true,
      audit_required: true
    });
  }

  if (hasAny(lowerText, ["remote agent", "independent agent", "a2a", "원격 에이전트", "독립 에이전트"])) {
    modules.push({
      id: `mod-${String(modules.length + 1).padStart(3, "0")}`,
      source_requirement_id: requirement.id,
      name: "remote_specialist_contract",
      module_category: "remote_a2a",
      remote_contract_kind: "a2a",
      legacy_recommended_type: "remote_a2a_contract",
      confidence: 0.7,
      rationale: "요청이 독립 원격 에이전트 경계를 언급합니다.",
      inputs: [{ name: "delegated_task", type: "object", required: true }],
      outputs: [{ name: "remote_agent_result", type: "object" }],
      reuse_candidate: false,
      risk_level: "high",
      risk_signals: mergeRiskSignals(requirement.risk_signals, ["human_approval_required", "audit_required"]),
      status: "needs_info",
      missing_information: [
        "remote owner",
        "agent card 또는 discovery 방식",
        "auth",
        "task lifecycle",
        "timeout",
        "retry",
        "fallback",
        "audit",
        "data policy"
      ]
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

function inferWorkflowKind(lowerText: string): ModuleCandidate["workflow_kind"] {
  if (hasAny(lowerText, ["loop", "iterate", "repeat", "반복", "다시", "돌아", "재수집", "추가 확인", "답변이 들어오면"])) {
    return "loop";
  }
  if (hasAny(lowerText, ["parallel", "branch", "fan-out", "병렬", "분기", "동시에", "함께", "각각", "별도로"])) {
    return "parallel";
  }
  if (hasAny(lowerText, ["approval", "human review", "승인", "사람 검토"])) {
    return "human_review";
  }
  return "sequential";
}

function shouldInferParallelBranches(rawText: string, branchModules: ModuleCandidate[]): boolean {
  const lowerText = rawText.toLowerCase();
  return branchModules.length > 1 && hasAny(lowerText, ["parallel", "branch", "fan-out", "병렬", "분기", "동시에", "함께", "각각", "별도로"]);
}

function shouldInferClarificationLoop(rawText: string): boolean {
  const lowerText = rawText.toLowerCase();
  return hasAny(lowerText, ["loop", "iterate", "repeat", "반복", "다시", "돌아", "재수집", "추가 확인", "답변이 들어오면"]);
}

function shouldInferPriorityBranches(rawText: string): boolean {
  const lowerText = rawText.toLowerCase();
  return hasAny(lowerText, ["priority", "threshold", "우선순위", "임계값", "높으면", "낮으면", "경우"]);
}

function getCandidateSubtypeValue(candidate: ModuleCandidate): string | null {
  return (
    candidate.adapter_kind ??
    candidate.agent_kind ??
    candidate.workflow_kind ??
    candidate.remote_contract_kind ??
    null
  );
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

function uniqueRiskSignals(values: RiskSignal[]): RiskSignal[] {
  return Array.from(new Set(values));
}

function mergeRiskSignals(primary: RiskSignal[], extra: RiskSignal[]): RiskSignal[] {
  return uniqueRiskSignals([...primary, ...extra]);
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function toIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}
