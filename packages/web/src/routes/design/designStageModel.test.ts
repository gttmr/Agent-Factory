import assert from "node:assert/strict";
import type { AfRunManifest } from "../../analyzer/afRunManifest.ts";
import { buildBuildStageRunnerConfig, buildVerifyStageRunnerConfig, summarizeVerifyRunState } from "../stageRunnerScreenConfig.ts";
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

{
  // Given: Verify has Stage Runner history even before a validation result is written.
  const manifest: AfRunManifest = {
    requirement_id: "req-verify",
    artifact_root: "artifacts/af/req-verify",
    current_stage: "verify",
    stages: {
      analyze: { status: "complete", outputs: ["analysis-result.json"] },
      design: { status: "complete", outputs: ["boundary-design.md"] },
      build: { status: "complete", outputs: ["runtime-stub"] },
      verify: { status: "pending", outputs: [] }
    },
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: true
    },
    validation: { commands: [], last_result: "not_run" },
    stage_runs: {
      verify: {
        latest_run_id: "20260709T120000Z-verify-a1b2c3",
        status: "running",
        started_at: "2026-07-09T12:00:00.000Z",
        finished_at: null,
        skill_name: "af-verify-runtime",
        model: "gpt-5.5",
        output_artifacts: [],
        last_error: null
      }
    }
  };

  // When: the Verify screen state is summarized for the route stepper and metrics.
  const state = summarizeVerifyRunState(manifest);

  // Then: run presence comes from Stage Runner history, while validation status remains manifest-owned.
  assert.equal(state.hasRun, true);
  assert.equal(state.latestRunStatusLabel, "실행 중");
  assert.equal(state.validationLabel, "미실행");
}

{
  // Given: the Verify config owns the Stage Runner command body.
  const runState = summarizeVerifyRunState(undefined);

  // When: a command is selected in the Verify Stage Runner controls slot.
  const config = buildVerifyStageRunnerConfig({
    commandKey: "test_analyzer",
    runState,
    buildComplete: true,
    stubApproved: true,
    runtimeStubFileCount: 4,
    reportExists: false,
    deltaExists: true
  });
  const body = config.buildRunBody("gpt-5.5");

  // Then: the canonical Stage Runner request carries the selected allow-list command.
  assert.equal(config.stage, "verify");
  assert.equal(config.skillName, "af-verify-runtime");
  assert.equal(body.model, "gpt-5.5");
  assert.equal(body.verifyCommand, "test_analyzer");
  assert.equal(config.disabledReason, null);
}

{
  const runState = summarizeVerifyRunState(undefined);
  const base = {
    commandKey: "validate_artifact_root",
    runState,
    buildComplete: true,
    stubApproved: true,
    runtimeStubFileCount: 1,
    reportExists: false,
    deltaExists: false
  };

  assert.equal(
    buildVerifyStageRunnerConfig({ ...base, buildComplete: false }).disabledReason,
    "Build stage가 complete 상태여야 Verify를 실행할 수 있습니다."
  );
  assert.equal(
    buildVerifyStageRunnerConfig({ ...base, stubApproved: false }).disabledReason,
    "stub_ready_for_followup=true 승인 후 Verify를 실행할 수 있습니다."
  );
  assert.equal(
    buildVerifyStageRunnerConfig({ ...base, runtimeStubFileCount: 0 }).disabledReason,
    "검증할 runtime-stub 파일이 없습니다."
  );
}

{
  // Given: Build keeps its primitive runner config shared but apply mode outside the helper.
  const config = buildBuildStageRunnerConfig({
    analysisExists: true,
    boundariesApproved: true,
    runtimeApproved: true,
    modeDirty: false,
    planReady: false,
    stubReady: false,
    runtimeStubFileCount: 0,
    selectedOutputMode: "smoke"
  });

  // When: the Build Stage Runner config is read by the route.
  const body = config.buildRunBody("gpt-5.4");

  // Then: shared config covers the primitive request without hiding Build's call-site applyMode.
  assert.equal(config.stage, "build");
  assert.equal(config.skillName, "af-scaffold-runtime");
  assert.equal(config.disabledReason, "scaffold-plan.json 이 생성 가능 상태여야 build stage를 실행할 수 있습니다.");
  assert.equal(body.model, "gpt-5.4");
}
