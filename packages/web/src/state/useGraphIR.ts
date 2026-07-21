import { useMemo } from "react";
import { validateTargetAnalysisResult } from "../analyzer/targetContract";
import type { AnalysisResult, GraphIR } from "../analyzer/types";

export interface GraphIRDerivation {
  graphIR: GraphIR | null;
  errorCount: number;
  warningCount: number;
  validationError?: string;
}

export function deriveGraphIRForAnalysis(analysis: AnalysisResult | null | undefined): GraphIRDerivation {
  if (!analysis) return { graphIR: null, errorCount: 0, warningCount: 0 };

  const errors = validateTargetAnalysisResult(analysis);
  if (errors.length > 0) {
    const message = `Graph IR contract validation failed: ${errors.join(" ")}`;
    console.warn("[useGraphIR] validation failed:", message);
    return { graphIR: null, errorCount: 1, warningCount: 0, validationError: message };
  }

  return { graphIR: analysis.graph, errorCount: 0, warningCount: 0 };
}

export function useGraphIR(analysis: AnalysisResult | null | undefined): GraphIRDerivation {
  return useMemo(() => deriveGraphIRForAnalysis(analysis), [analysis]);
}
