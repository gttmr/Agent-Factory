import assert from "node:assert/strict";
import { buildDesignSteps } from "./designStageModelCore.ts";

{
  // Given: a canonical analysis-result.json already carries Graph IR.
  const steps = buildDesignSteps({
    hasGraph: true,
    boundariesApproved: false,
    runtimeContractsApproved: false,
    activeStep: "review"
  });

  // When: the Design stepper is built for the review surface.
  const runStep = steps.find((step) => step.id === "run");

  // Then: artifact presence alone makes "1. 실행" complete.
  assert.ok(runStep);
  assert.equal(runStep.status, "done");
}

{
  // Given: module/contract readiness may still be unresolved, but boundaries_approved is already true.
  const steps = buildDesignSteps({
    hasGraph: true,
    boundariesApproved: true,
    runtimeContractsApproved: false,
    activeStep: "approve"
  });

  // When: the Design stepper is built from manifest approvals and artifact presence.
  const reviewStep = steps.find((step) => step.id === "review");

  // Then: candidate-derived reviewReady does not control the Review step's done state.
  assert.ok(reviewStep);
  assert.equal(reviewStep.status, "done");
}

{
  // Given: the approve step is currently active, but boundaries_approved is not set.
  const steps = buildDesignSteps({
    hasGraph: true,
    boundariesApproved: false,
    runtimeContractsApproved: false,
    activeStep: "approve"
  });

  // When: the Design stepper is built for ?step=approve.
  const approveStep = steps.find((step) => step.id === "approve");

  // Then: the active step must not be labeled as locked.
  assert.ok(approveStep);
  assert.equal(approveStep.status, "current");
}

{
  // Given: both Design manifest approvals are true.
  const steps = buildDesignSteps({
    hasGraph: true,
    boundariesApproved: true,
    runtimeContractsApproved: true,
    activeStep: "approve"
  });

  // When: the Design stepper is built for a fully approved artifact.
  const approveStep = steps.find((step) => step.id === "approve");

  // Then: the Approve step is complete only from manifest approval state.
  assert.ok(approveStep);
  assert.equal(approveStep.status, "done");
}
