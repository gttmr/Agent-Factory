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
      "이 공개 workbench에서는 live analysis가 의도적으로 비활성화되어 있습니다. 이후 사용 시에는 trusted backend에서 POST /api/analyze-requirement를 호출하고, schema validation, policy gate, audit log 보존, 잘못된 module_category 값 거부, owner/lifecycle/contract/auth/timeout/retry/fallback/audit 세부 정보가 없는 Remote A2A 승인을 차단해야 합니다."
    );
  }
}

export const defaultAnalyzerProvider: AnalyzerProvider = new MockAnalyzerProvider();
