import { useMemo, useState } from "react";
import type { ModuleCandidate, NormalizedRequirement, ProcessFlow } from "../analyzer/types";

interface ExportArtifactsProps {
  normalizedRequirement: NormalizedRequirement;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  acceptedMissing: string[];
}

export function ExportArtifacts({
  normalizedRequirement,
  moduleCandidates,
  processFlow,
  acceptedMissing
}: ExportArtifactsProps) {
  const [copiedKey, setCopiedKey] = useState("");
  const artifacts = useMemo(
    () => ({
      "normalized-requirement.json": JSON.stringify(normalizedRequirement, null, 2),
      "module-candidates.json": JSON.stringify(moduleCandidates, null, 2),
      "process-flow.json": JSON.stringify(processFlow, null, 2),
      "decision-notes.md": buildDecisionNotes(normalizedRequirement, moduleCandidates, acceptedMissing)
    }),
    [acceptedMissing, moduleCandidates, normalizedRequirement, processFlow]
  );

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

function buildDecisionNotes(
  normalizedRequirement: NormalizedRequirement,
  moduleCandidates: ModuleCandidate[],
  acceptedMissing: string[]
): string {
  const approved = moduleCandidates.filter((candidate) => candidate.status === "approved");
  const review = moduleCandidates.filter((candidate) => candidate.status !== "approved");

  return [
    `# Decision Notes: ${normalizedRequirement.title}`,
    "",
    `Requirement: ${normalizedRequirement.id}`,
    `Status: ${normalizedRequirement.status}`,
    "",
    "## Accepted Missing Information",
    ...(acceptedMissing.length ? acceptedMissing.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Approved Module Candidates",
    ...(approved.length
      ? approved.map((candidate) => `- ${candidate.name}: ${candidate.recommended_type}`)
      : ["- None"]),
    "",
    "## Remaining Review Items",
    ...(review.length
      ? review.map((candidate) => `- ${candidate.name}: ${candidate.status}`)
      : ["- None"]),
    "",
    "## ADK Review Guidance",
    "- Prefer `ParallelAgent` for independent lookup or retrieval branches.",
    "- Prefer `SequentialAgent` for deterministic ordered handoff and review stages.",
    "- Consider `Custom Agent` only for conditional routing, dynamic agent selection, complex state management, external integration flow control, or unique workflow patterns.",
    "- Treat `Session.state` as a serializable scratchpad; candidate keys include `current_step`, `temp:branch_results`, `user:preferred_language`, and `app:taxonomy_version`.",
    "",
    "## Public Safety",
    "- Artifacts use generic examples only.",
    "- No credentials, private endpoints, private datasets, or deployment details are included."
  ].join("\n");
}
