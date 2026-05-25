import { normalizeAnalysisResultForWorkbench } from "./analysisResultNormalization";
import {
  requirementDomains,
  type AnalysisResult,
  type ModuleCandidate,
  type RequirementDomain,
  type RequirementIntakeInput
} from "./types";

export interface ImportedAnalysisArtifact {
  analysis: AnalysisResult;
  input: RequirementIntakeInput;
  moduleCandidates: ModuleCandidate[];
  title: string;
}

export function parseAnalysisResultArtifact(source: string, fileName = "analysis-result.json"): ImportedAnalysisArtifact {
  if (!source.trim()) {
    throw new Error(`${fileName} 파일이 비어 있습니다.`);
  }

  const parsed = parseJsonObject(source, fileName);
  assertAnalysisResultShape(parsed, fileName);

  const analysis = normalizeAnalysisResultForWorkbench(parsed as unknown as AnalysisResult);
  const rawText = typeof analysis.normalizedRequirement.raw_text === "string"
    ? analysis.normalizedRequirement.raw_text
    : "";
  const title = analysis.normalizedRequirement.title || fileName;

  return {
    analysis,
    input: {
      domain: normalizeRequirementDomain(analysis.normalizedRequirement.domain),
      rawText
    },
    moduleCandidates: analysis.moduleCandidates,
    title
  };
}

function parseJsonObject(source: string, fileName: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(source);
    if (!isRecord(parsed)) {
      throw new Error("top-level value is not an object");
    }
    return parsed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown parse failure";
    throw new Error(`${fileName} JSON을 읽을 수 없습니다: ${detail}`);
  }
}

function assertAnalysisResultShape(value: Record<string, unknown>, fileName: string): asserts value is Record<string, unknown> {
  const missing: string[] = [];
  if (!isRecord(value.normalizedRequirement)) missing.push("normalizedRequirement");
  if (!isRecord(value.evidence)) missing.push("evidence");
  if (!Array.isArray(value.moduleCandidates)) missing.push("moduleCandidates");
  if (!isRecord(value.processFlow)) missing.push("processFlow");

  if (missing.length > 0) {
    throw new Error(`${fileName}은 AnalysisResult artifact가 아닙니다. 누락: ${missing.join(", ")}`);
  }
}

function normalizeRequirementDomain(value: unknown): RequirementDomain {
  if (typeof value === "string" && requirementDomains.includes(value as RequirementDomain)) {
    return value as RequirementDomain;
  }
  return "공통";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
