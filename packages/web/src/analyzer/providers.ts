import { analyzeRequirement } from "./mockAnalyzer";
import type { AnalysisResult, RequirementIntakeInput } from "./types";

export interface AnalyzerProvider {
  readonly id: string;
  readonly label: string;
  analyze(input: RequirementIntakeInput): Promise<AnalysisResult>;
}

export class MockAnalyzerProvider implements AnalyzerProvider {
  readonly id = "mock-rule-analyzer";
  readonly label = "Rule-based mock analyzer";

  async analyze(input: RequirementIntakeInput): Promise<AnalysisResult> {
    return analyzeRequirement(input);
  }
}

export interface OpenAICompatibleAnalyzerOptions {
  endpoint?: "/api/analyze-requirement";
}

export class OpenAICompatibleAnalyzerProvider implements AnalyzerProvider {
  readonly id = "secure-backend-analyzer-placeholder";
  readonly label = "Secure backend analyzer placeholder";
  readonly options: OpenAICompatibleAnalyzerOptions;

  constructor(options: OpenAICompatibleAnalyzerOptions = { endpoint: "/api/analyze-requirement" }) {
    this.options = options;
  }

  async analyze(): Promise<AnalysisResult> {
    throw new Error(
      "Live analysis is intentionally disabled in this public workbench. Future use must call POST /api/analyze-requirement from a trusted backend that validates schemas, applies policy gates, preserves audit logs, rejects invalid module_category values, and blocks Remote A2A approval without independent owner, lifecycle, contract, auth, timeout, retry, fallback, and audit details."
    );
  }
}

export const defaultAnalyzerProvider: AnalyzerProvider = new MockAnalyzerProvider();
