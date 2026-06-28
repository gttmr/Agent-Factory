import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export function updateRunManifest({ artifactRoot, outputRoot, packageName, runManifest }) {
  if (!runManifest) return;
  const outputRelative = relative(artifactRoot, outputRoot).replace(/\\/g, "/");
  if (!outputRelative || outputRelative.startsWith("..")) {
    return;
  }
  const outputDir = outputRelative.endsWith("/") ? outputRelative : `${outputRelative}/`;
  const next = {
    ...runManifest,
    current_stage: "build",
    stages: {
      analyze: normalizeRunStage(runManifest.stages?.analyze),
      design: normalizeRunStage(runManifest.stages?.design),
      build: {
        status: "complete",
        outputs: uniqueStrings([
          ...(Array.isArray(runManifest.stages?.build?.outputs) ? runManifest.stages.build.outputs : []),
          outputDir,
          `${outputDir}scaffold-plan.json`,
          `${outputDir}implementation-handoff.md`
        ])
      },
      verify: normalizeRunStage(runManifest.stages?.verify)
    },
    approvals: {
      analysis_reviewed: runManifest.approvals?.analysis_reviewed === true,
      boundaries_approved: runManifest.approvals?.boundaries_approved === true,
      runtime_contracts_approved: runManifest.approvals?.runtime_contracts_approved === true,
      stub_ready_for_followup: true
    },
    validation: {
      commands: uniqueStrings([
        ...(Array.isArray(runManifest.validation?.commands) ? runManifest.validation.commands : []),
        `python3 -m compileall ${outputDir}${packageName}`,
        `cd ${outputDir} && python -m pytest -q`
      ]),
      last_result: runManifest.validation?.last_result ?? "not_run"
    }
  };
  writeFileSync(join(artifactRoot, "af-run-manifest.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function normalizeRunStage(stage) {
  return {
    status: typeof stage?.status === "string" ? stage.status : "pending",
    outputs: Array.isArray(stage?.outputs) ? stage.outputs.filter((item) => typeof item === "string") : []
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}
