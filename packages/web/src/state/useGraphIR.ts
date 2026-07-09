import { useMemo } from "react";
import type { AnalysisResult, GraphIR } from "../analyzer/types";
import { mergeGraphIRValidation, normalizeGraphIRForRuntime, validateGraphIRSoft } from "../analyzer/graphMigration";

export interface GraphIRDerivation {
  graphIR: GraphIR | null;
  errorCount: number;
  warningCount: number;
  normalizationError?: string;
}

export function deriveGraphIRForAnalysis(analysis: AnalysisResult | null | undefined): GraphIRDerivation {
  if (!analysis?.processFlow) {
    return { graphIR: null, errorCount: 0, warningCount: 0 };
  }
  try {
    const reqId = analysis.normalizedRequirement?.id ?? "req-001";
    const migrated = normalizeGraphIRForRuntime(analysis.processFlow, reqId) as GraphIR;
    const soft = validateGraphIRSoft(migrated);
    const validation = mergeGraphIRValidation(migrated.validation, soft);
    return {
      graphIR: { ...migrated, validation },
      errorCount: validation.errors?.length ?? 0,
      warningCount: validation.warnings?.length ?? 0
    };
  } catch (error) {
    console.warn("[useGraphIR] migration failed:", error);
    return {
      graphIR: null,
      errorCount: 1,
      warningCount: 0,
      normalizationError: error instanceof Error ? error.message : "Graph IR normalization failed."
    };
  }
}

export function useGraphIR(analysis: AnalysisResult | null | undefined): GraphIRDerivation {
  return useMemo(() => deriveGraphIRForAnalysis(analysis), [analysis]);
}
