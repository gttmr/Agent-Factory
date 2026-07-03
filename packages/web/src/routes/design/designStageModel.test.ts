import assert from "node:assert/strict";
import { buildDesignSteps } from "./designStageModelCore.ts";

{
  // Given: an imported analysis-result.json already carries Graph IR, but no Design runner evidence exists.
  const steps = buildDesignSteps({
    hasGraph: true,
    designRunComplete: false,
    reviewReady: false,
    bothApproved: false,
    activeStep: "review"
  });

  // When: the Design stepper is built for the review surface.
  const runStep = steps.find((step) => step.id === "run");

  // Then: processFlow alone must not make "1. 실행" look complete.
  assert.ok(runStep);
  assert.equal(runStep.status, "todo");
}

{
  // Given: a Design runner application or explicit reviewer progression has completed the run step.
  const steps = buildDesignSteps({
    hasGraph: true,
    designRunComplete: true,
    reviewReady: false,
    bothApproved: false,
    activeStep: "review"
  });

  // When: the Design stepper is built with run-completion evidence.
  const runStep = steps.find((step) => step.id === "run");

  // Then: "1. 실행" can show complete independently of approval gates.
  assert.ok(runStep);
  assert.equal(runStep.status, "done");
}

{
  // Given: the approve step is currently active, but review conditions are not ready yet.
  const steps = buildDesignSteps({
    hasGraph: true,
    designRunComplete: true,
    reviewReady: false,
    bothApproved: false,
    activeStep: "approve"
  });

  // When: the Design stepper is built for ?step=approve.
  const approveStep = steps.find((step) => step.id === "approve");

  // Then: the active step must not be labeled as locked.
  assert.ok(approveStep);
  assert.equal(approveStep.status, "current");
}
