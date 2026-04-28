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
  baseUrl?: string;
  model?: string;
  apiKeyEnvVar?: string;
}

export class OpenAICompatibleAnalyzerProvider implements AnalyzerProvider {
  readonly id = "openai-compatible-placeholder";
  readonly label = "OpenAI-compatible analyzer placeholder";
  readonly options: OpenAICompatibleAnalyzerOptions;

  constructor(options: OpenAICompatibleAnalyzerOptions = {}) {
    this.options = options;
  }

  async analyze(): Promise<AnalysisResult> {
    throw new Error(
      "OpenAI-compatible analysis is intentionally disabled in this public workbench. Configure a restricted or offline deployment before enabling network calls."
    );
  }
}

export const defaultAnalyzerProvider: AnalyzerProvider = new MockAnalyzerProvider();
