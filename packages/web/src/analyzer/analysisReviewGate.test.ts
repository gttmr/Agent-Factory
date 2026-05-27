import assert from "node:assert/strict";
import { canToggleAnalysisReviewed } from "./analysisReviewGate.ts";

assert.equal(
  canToggleAnalysisReviewed({
    hasAnalysis: true,
    missingInfo: ["분류 기준이 필요하다"],
    acceptedMissing: ["분류 기준이 필요하다"]
  }),
  true
);

assert.equal(
  canToggleAnalysisReviewed({
    hasAnalysis: true,
    missingInfo: ["분류 기준이 필요하다"],
    acceptedMissing: []
  }),
  false
);

assert.equal(
  canToggleAnalysisReviewed({
    hasAnalysis: false,
    missingInfo: [],
    acceptedMissing: []
  }),
  false
);
