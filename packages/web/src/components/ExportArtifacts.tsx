import { useMemo, useState } from "react";
import { getCandidateSubtype, moduleCategoryLabels } from "../analyzer/classificationRules";
import {
  buildCatalogDeltaYaml,
  buildCommonizationNotes,
  buildDomainCapabilityMap,
  buildMermaidProcessFlow,
  buildReuseHeatmap
} from "../analyzer/commonization";
import type {
  ClassificationSummary,
  EvidenceSummary,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow
} from "../analyzer/types";

const statusLabels = {
  needs_info: "정보 필요",
  approved: "승인됨",
  deferred: "보류",
  rejected: "반려"
} as const;

const requirementStatusLabels = {
  draft: "초안",
  reviewed: "검토됨",
  approved: "승인됨",
  rejected: "반려"
} as const;

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
    const reuseHeatmap = buildReuseHeatmap(moduleCandidates);
    const domainCapabilityMap = buildDomainCapabilityMap(moduleCandidates);

    return {
      "normalized-requirement.json": JSON.stringify(normalizedRequirement, null, 2),
      "evidence-summary.json": JSON.stringify(evidence, null, 2),
      "module-candidates.json": JSON.stringify(moduleCandidates.map(stripLegacyCandidate), null, 2),
      "process-flow.json": JSON.stringify(processFlow, null, 2),
      "process-flow.mmd": buildMermaidProcessFlow(processFlow),
      "classification.json": JSON.stringify(classification, null, 2),
      "commonization-notes.json": JSON.stringify(commonizationNotes, null, 2),
      "reuse-heatmap.json": JSON.stringify(reuseHeatmap, null, 2),
      "domain-capability-map.json": JSON.stringify(domainCapabilityMap, null, 2),
      "catalog-delta.yaml": buildCatalogDeltaYaml(moduleCandidates),
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
    const blob = new Blob([content], { type: artifactMimeType(name) });
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
              <p className="eyebrow">아티팩트</p>
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
    subtype: getCandidateSubtype(candidate),
    why_agent:
      candidate.module_category === "agent"
        ? "요약, 분류, 판단, 권고처럼 LLM reasoning responsibility를 소유하므로 Agent로 분류했습니다."
        : undefined,
    why_adapter:
      candidate.module_category === "adapter"
        ? "reasoning responsibility를 소유하지 않고 callable capability 또는 data access만 제공하므로 Adapter로 선택했습니다."
        : undefined,
    why_workflow:
      candidate.module_category === "workflow"
        ? "실행 순서, 분기, 반복, 승인 같은 local orchestration 책임을 가지므로 Workflow로 분류했습니다."
        : undefined,
    why_not_remote_a2a:
      candidate.module_category !== "remote_a2a"
        ? "independent remote agent owner, lifecycle, discovery, task contract가 확인되지 않았으므로 Remote A2A로 보지 않습니다."
        : undefined,
    why_remote_a2a:
      candidate.module_category === "remote_a2a"
        ? "owner, lifecycle, auth, timeout, retry, fallback, audit 세부 정보가 검토될 때까지 contract placeholder로만 허용합니다."
        : undefined
  }));
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
    return ["owner", "agent_card", "auth", "task_lifecycle", "timeout", "retry", "fallback", "audit", "data_policy"];
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
    `# 구현 인계: ${normalizedRequirement.title}`,
    "",
    `요구사항: ${normalizedRequirement.id}`,
    `상태: ${requirementStatusLabels[normalizedRequirement.status]}`,
    "",
    "## 확인된 부족 정보",
    ...(acceptedMissing.length ? acceptedMissing.map((item) => `- ${item}`) : ["- 없음"]),
    "",
    "## 승인된 모듈 후보",
    ...(approved.length
      ? approved.map(
          (candidate) =>
            `- ${candidate.name}: ${moduleCategoryLabels[candidate.module_category]}${
              getCandidateSubtype(candidate) ? ` / ${getCandidateSubtype(candidate)}` : ""
            }`
        )
      : ["- 없음"]),
    "",
    "## 분류 메모",
    ...classification.map((item) => {
      const reasons = [
        item.why_agent,
        item.why_adapter,
        item.why_workflow,
        item.why_not_remote_a2a,
        item.why_remote_a2a
      ].filter(Boolean);
      return `- ${item.name}: ${moduleCategoryLabels[item.selected_category]}${item.subtype ? ` / ${item.subtype}` : ""}. ${reasons.join(" ")}`;
    }),
    "",
    "## 남은 검토 항목",
    ...(review.length ? review.map(formatReviewCandidate) : ["- 없음"]),
    "",
    "## Scaffold Guardrails",
    "- 원문 사용자 요구사항이 코드 생성을 직접 구동하면 안 됩니다.",
    "- Adapter module은 contract 또는 stub만 생성합니다.",
    "- Agent module은 agent shell만 생성합니다.",
    "- Workflow module은 orchestration shell만 생성합니다.",
    "- Remote A2A module은 remote boundary detail이 승인될 때까지 contract placeholder만 생성합니다.",
    "- runnable business logic은 scaffold output에 포함하지 않습니다.",
    "",
    "## 공개 안전 기준",
    "- 아티팩트에는 일반 예시만 사용합니다.",
    "- 자격 증명, 비공개 엔드포인트, 비공개 데이터셋, 배포 세부 정보는 포함하지 않습니다."
  ].join("\n");
}

function formatReviewCandidate(candidate: ModuleCandidate): string {
  const missingInformation = candidate.missing_information.length
    ? ` - 필요 정보: ${candidate.missing_information.join(", ")}`
    : "";
  return `- ${candidate.name}: ${statusLabels[candidate.status]}${missingInformation}`;
}

function stripLegacyCandidate(candidate: ModuleCandidate): Omit<ModuleCandidate, "legacy_recommended_type"> {
  const { legacy_recommended_type: _legacyRecommendedType, ...visibleCandidate } = candidate;
  return visibleCandidate;
}

function artifactMimeType(name: string): string {
  if (name.endsWith(".json")) {
    return "application/json";
  }
  if (name.endsWith(".md")) {
    return "text/markdown";
  }
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    return "application/yaml";
  }
  return "text/plain";
}
