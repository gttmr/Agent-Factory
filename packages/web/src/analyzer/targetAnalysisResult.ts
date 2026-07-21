import { assertTargetAnalysisResult } from "./targetContract";
import type { AnalysisResult } from "./types";

/** Parse an AnalysisResult at the strict Target v2 read boundary. */
export function parseTargetAnalysisResult(result: unknown): AnalysisResult {
  assertTargetAnalysisResult(result);
  return result;
}
