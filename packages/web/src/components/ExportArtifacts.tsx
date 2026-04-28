import { useMemo, useState } from "react";
import { getCandidateSubtypeValue, moduleCategoryLabels } from "../analyzer/classificationRules";
import type {
  ClassificationSummary,
  CommonizationNotes,
  EvidenceSummary,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow
} from "../analyzer/types";

interface ExportArtifactsProps {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  acceptedMissing: string[];
}

export function ExportArtifacts({
  normalizedRequirement,
  evidence,
  moduleCandidates,
  processFlow,
  acceptedMissing
}: ExportArtifactsProps) {
  const [copiedKey, setCopiedKey] = useState("");
  const artifacts = useMemo(() => {
    const classification = buildClassification(moduleCandidates);
    const commonizationNotes = buildCommonizationNotes(moduleCandidates);
    const scaffoldPlan = buildScaffoldPlan(normalizedRequirement, moduleCandidates);

    return {
      "normalized-requirement.json": JSON.stringify(normalizedRequirement, null, 2),
      "evidence-summary.json": JSON.stringify(evidence, null, 2),
      "module-candidates.json": JSON.stringify(moduleCandidates, null, 2),
      "process-flow.json": JSON.stringify(processFlow, null, 2),
      "classification.json": JSON.stringify(classification, null, 2),
      "commonization-notes.json": JSON.stringify(commonizationNotes, null, 2),
      "implementation-handoff.md": buildImplementationHandoff(
        normalizedRequirement,
        moduleCandidates,
        acceptedMissing,
        classification
      ),
      "scaffold-plan.json": JSON.stringify(scaffoldPlan, null, 2)
    };
  }, [acceptedMissing, evidence, moduleCandidates, normalizedRequirement, processFlow]);

  async function copyArtifact(name: string, content: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(content);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopiedKey(name);
  }

  function downloadArtifact(name: string, content: string) {
    const blob = new Blob([content], { type: name.endsWith(".json") ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      {Object.entries(artifacts).map(([name, content]) => (
        <section className="panel" key={name}>
          <div className="artifact-header">
            <div className="section-heading">
              <p className="eyebrow">Artifact</p>
              <h2>{name}</h2>
            </div>
            <div className="actions compact">
              <button type="button" onClick={() => copyArtifact(name, content)}>
                {copiedKey === name ? "복사됨" : "복사"}
              </button>
              <button type="button" onClick={() => downloadArtifact(name, content)}>
                다운로드
              </button>
            </div>
          </div>
          <pre className="json-preview">{content}</pre>
        </section>
      ))}
    </div>
  );
}

function buildClassification(moduleCandidates: ModuleCandidate[]): ClassificationSummary[] {
  return moduleCandidates.map((candidate) => ({
    module_id: candidate.id,
    name: candidate.name,
    selected_category: candidate.module_category,
    subtype: getCandidateSubtypeValue(candidate),
    why_adapter_not_agent:
      candidate.module_category === "adapter"
        ? "Selected as Adapter because it exposes callable capability or data access without owning reasoning responsibility."
        : undefined,
    why_workflow_not_remote_a2a:
      candidate.module_category === "workflow"
        ? "Selected as Workflow because it coordinates local steps and does not prove an independent remote agent owner or lifecycle."
        : undefined,
    remote_a2a_decision:
      candidate.module_category === "remote_a2a"
        ? "Accepted only as a contract placeholder until owner, lifecycle, auth, timeout, retry, fallback, and audit details are reviewed."
        : "Deferred because the module does not require an independent remote agent boundary."
  }));
}

function buildCommonizationNotes(moduleCandidates: ModuleCandidate[]): CommonizationNotes {
  return {
    reusable_adapters: moduleCandidates
      .filter((candidate) => candidate.module_category === "adapter" && candidate.reuse_candidate)
      .map((candidate) => candidate.name),
    shared_agent_candidates: moduleCandidates
      .filter((candidate) => candidate.module_category === "agent" && candidate.agent_kind === "shared")
      .map((candidate) => candidate.name),
    workflow_reuse_candidates: moduleCandidates
      .filter((candidate) => candidate.module_category === "workflow" && candidate.reuse_candidate)
      .map((candidate) => candidate.name),
    remote_a2a_contracts: moduleCandidates
      .filter((candidate) => candidate.module_category === "remote_a2a")
      .map((candidate) => candidate.name)
  };
}

function buildScaffoldPlan(normalizedRequirement: NormalizedRequirement, moduleCandidates: ModuleCandidate[]) {
  const approved = moduleCandidates.filter((candidate) => candidate.status === "approved");

  return {
    requirement_id: normalizedRequirement.id,
    source: "approved_workbench_artifact",
    raw_requirement_to_code: false,
    modules: approved.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      module_category: candidate.module_category,
      agent_kind: candidate.agent_kind ?? null,
      workflow_kind: candidate.workflow_kind ?? null,
      adapter_kind: candidate.adapter_kind ?? null,
      remote_contract_kind: candidate.remote_contract_kind ?? null,
      legacy_recommended_type: candidate.legacy_recommended_type ?? null,
      scaffold_output: scaffoldOutputFor(candidate),
      no_runnable_business_logic: true,
      inputs: candidate.inputs,
      outputs: candidate.outputs,
      required_review_fields: requiredReviewFields(candidate)
    }))
  };
}

function scaffoldOutputFor(candidate: ModuleCandidate): string {
  if (candidate.module_category === "adapter") {
    return "contract_or_stub_only";
  }
  if (candidate.module_category === "agent") {
    return "agent_shell_only";
  }
  if (candidate.module_category === "workflow") {
    return "orchestration_shell_only";
  }
  return "contract_placeholder_only";
}

function requiredReviewFields(candidate: ModuleCandidate): string[] {
  if (candidate.module_category === "remote_a2a") {
    return ["owner", "agent_card", "auth", "task_lifecycle", "timeout", "retry", "fallback", "audit"];
  }
  if (candidate.adapter_kind === "retrieval") {
    return ["citation_required", "grounding_required", "source_acl_required"];
  }
  if (candidate.adapter_kind === "rule_registry") {
    return ["owner_domain", "versioned", "effective_date_required", "audit_required"];
  }
  if (candidate.adapter_kind === "legacy_api") {
    return ["auth_required", "timeout", "retry", "side_effect"];
  }
  return [];
}

function buildImplementationHandoff(
  normalizedRequirement: NormalizedRequirement,
  moduleCandidates: ModuleCandidate[],
  acceptedMissing: string[],
  classification: ClassificationSummary[]
): string {
  const approved = moduleCandidates.filter((candidate) => candidate.status === "approved");
  const review = moduleCandidates.filter((candidate) => candidate.status !== "approved");

  return [
    `# Implementation Handoff: ${normalizedRequirement.title}`,
    "",
    `Requirement: ${normalizedRequirement.id}`,
    `Status: ${normalizedRequirement.status}`,
    "",
    "## Accepted Missing Information",
    ...(acceptedMissing.length ? acceptedMissing.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Approved Module Candidates",
    ...(approved.length
      ? approved.map(
          (candidate) =>
            `- ${candidate.name}: ${moduleCategoryLabels[candidate.module_category]}${
              getCandidateSubtypeValue(candidate) ? ` / ${getCandidateSubtypeValue(candidate)}` : ""
            }`
        )
      : ["- None"]),
    "",
    "## Classification Notes",
    ...classification.map((item) => {
      const reasons = [
        item.why_adapter_not_agent,
        item.why_workflow_not_remote_a2a,
        item.remote_a2a_decision
      ].filter(Boolean);
      return `- ${item.name}: ${item.selected_category}${item.subtype ? ` / ${item.subtype}` : ""}. ${reasons.join(" ")}`;
    }),
    "",
    "## Remaining Review Items",
    ...(review.length ? review.map((candidate) => `- ${candidate.name}: ${candidate.status}`) : ["- None"]),
    "",
    "## Scaffold Guardrails",
    "- Raw user requirements must not drive code generation directly.",
    "- Adapter modules produce contracts or stubs only.",
    "- Agent modules produce agent shells only.",
    "- Workflow modules produce orchestration shells only.",
    "- Remote A2A modules produce contract placeholders only until remote boundary details are approved.",
    "- No runnable business logic is included in scaffold output.",
    "",
    "## Public Safety",
    "- Artifacts use generic examples only.",
    "- No credentials, private endpoints, private datasets, or deployment details are included."
  ].join("\n");
}
