export interface AnalysisReviewGateInput {
  hasAnalysis: boolean;
  missingInfo: string[];
  acceptedMissing: string[];
}

export function canToggleAnalysisReviewed({
  hasAnalysis,
  missingInfo,
  acceptedMissing
}: AnalysisReviewGateInput): boolean {
  if (!hasAnalysis) return false;
  const acceptedSet = new Set(acceptedMissing);
  return missingInfo.every((item) => acceptedSet.has(item));
}
