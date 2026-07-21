import { validateTargetAnalysisResult } from "../src/analyzer/targetContract";

/** Strict Target Contract v2 validation shared with browser import. */
export function validateAnalysisResult(value: unknown): string[] {
  return validateTargetAnalysisResult(value);
}
