import { assertTargetAnalysisResult } from "./targetContract";
import {
  requirementDomains,
  type AnalysisResult,
  type AssetCandidate,
  type RequirementDomain,
  type RequirementIntakeInput
} from "./types";

export interface ImportedAnalysisArtifact {
  analysis: AnalysisResult;
  input: RequirementIntakeInput;
  assetCandidates: AssetCandidate[];
  title: string;
}

export function parseAnalysisResultArtifact(source: string, fileName = "analysis-result.json"): ImportedAnalysisArtifact {
  if (!source.trim()) throw new Error(`${fileName} 파일이 비어 있습니다.`);
  const parsed = parseJsonObject(source, fileName);
  assertTargetAnalysisResult(parsed, fileName);

  return {
    analysis: parsed,
    input: {
      domain: normalizeRequirementDomain(parsed.normalizedRequirement.domain),
      rawText: parsed.normalizedRequirement.raw_text
    },
    assetCandidates: parsed.assetCandidates,
    title: parsed.normalizedRequirement.title || fileName
  };
}

function parseJsonObject(source: string, fileName: string): unknown {
  try {
    const parsed: unknown = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON root must be an object");
    return parsed;
  } catch (error) {
    throw new Error(`${fileName} JSON을 읽지 못했습니다: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function normalizeRequirementDomain(value: string): RequirementDomain {
  return requirementDomains.includes(value as RequirementDomain) ? (value as RequirementDomain) : "공통";
}
