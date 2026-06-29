import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../ui/primitives";
import { buildScaffoldPlan } from "../../analyzer/scaffoldPlan";
import type { ScaffoldOutputMode, ScaffoldPlanModule } from "../../analyzer/types";
import { catalogIndexToScaffoldCatalog } from "../../catalog/scaffoldCatalog";
import { applyMockLabBinding, isMcpBoundAdapter, type MockLabBindingSelection } from "../../mock-lab/mockLabIntegration";
import { useAnalysisArtifact } from "../../state/useAnalysisArtifact";
import { useArtifactSync } from "../../state/useArtifactSync";
import { useCatalog } from "../../state/useCatalog";
import { useMockLabDiscovery } from "../../state/useMockLabDiscovery";
import { useBuildRuntimeStub, useRuntimeStub, useSaveScaffoldPlan, useScaffoldPlan } from "../../state/useScaffoldPlan";
import { ArtifactSyncRunPanel } from "./ArtifactSyncRunPanel";
import { buildArtifactSyncRunOptions } from "./artifactSyncRunOptions";
import { buildAdkGraphReadiness } from "./buildReadiness";
import { ManualRuntimeStubPanel } from "./ManualRuntimeStubPanel";
import { ManualScaffoldPanel } from "./ManualScaffoldPanel";
import { useBuildProcessLog } from "./processLog";

interface BuildRunStepProps {
  readonly boundariesApproved: boolean;
  readonly designGatesReady: boolean;
  readonly reqId: string;
  readonly runtimeApproved: boolean;
}

export function BuildRunStep({ boundariesApproved, designGatesReady, reqId, runtimeApproved }: BuildRunStepProps) {
  const { data: analysisData } = useAnalysisArtifact(reqId);
  const { data: scaffoldPlan, isLoading: scaffoldLoading } = useScaffoldPlan(reqId);
  const { data: runtimeStub } = useRuntimeStub(reqId);
  const saveScaffold = useSaveScaffoldPlan(reqId);
  const buildStub = useBuildRuntimeStub(reqId);
  const artifactSync = useArtifactSync(reqId);
  const catalog = useCatalog();
  const [outputMode, setOutputMode] = useState<ScaffoldOutputMode>("smoke");
  const [outputModeExplicitlyChosen, setOutputModeExplicitlyChosen] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [bindingOverrides, setBindingOverrides] = useState<Record<string, MockLabBindingSelection>>({});
  const processLog = useBuildProcessLog();
  const analysis = analysisData?.data ?? null;
  const catalogEntries = useMemo(() => (catalog.data ? catalogIndexToScaffoldCatalog(catalog.data) : []), [catalog.data]);

  const savedMode = scaffoldPlan
    ? scaffoldPlan.output_mode === "runnable"
      ? "runnable"
      : "smoke"
    : null;
  const selectedOutputMode = outputModeExplicitlyChosen ? outputMode : savedMode ?? outputMode;
  const mockLabDiscovery = useMockLabDiscovery(selectedOutputMode === "runnable");
  const generatedPlan = useMemo(() => {
    if (!analysis?.processFlow) return null;
    return buildScaffoldPlan({
      normalizedRequirement: analysis.normalizedRequirement,
      moduleCandidates: analysis.moduleCandidates,
      processFlow: analysis.processFlow,
      catalogEntries,
      runtimeContracts: analysis.runtimeContracts ?? [],
      outputMode: selectedOutputMode
    });
  }, [analysis, catalogEntries, selectedOutputMode]);

  useEffect(() => {
    if (!scaffoldPlan?.modules) return;
    const next: Record<string, MockLabBindingSelection> = {};
    for (const module of scaffoldPlan.modules) {
      if (isMcpBoundAdapter(module) && module.mcp_server && module.mcp_tool_name) {
        next[module.id] = {
          mcpServer: module.mcp_server,
          mcpToolName: module.mcp_tool_name,
          mcpSchemaRef: module.mcp_schema_ref ?? null
        };
      }
    }
    setBindingOverrides(next);
  }, [scaffoldPlan]);

  useEffect(() => {
    if (outputModeExplicitlyChosen) return;
    if (scaffoldPlan?.output_mode === "runnable" || scaffoldPlan?.output_mode === "smoke") {
      setOutputMode(scaffoldPlan.output_mode);
    }
  }, [outputModeExplicitlyChosen, scaffoldPlan?.output_mode]);

  const effectivePlan = useMemo(() => {
    if (!generatedPlan) return null;
    return Object.entries(bindingOverrides).reduce(
      (plan, [moduleId, selection]) => applyMockLabBinding(plan, moduleId, selection),
      generatedPlan
    );
  }, [bindingOverrides, generatedPlan]);

  const adapterConnections = useMemo(() => {
    const adapters = (effectivePlan?.modules ?? []).filter((module) => module.module_category === "adapter");
    return {
      connected: adapters.filter(isMcpBoundAdapter),
      unconnected: adapters.filter((module) => !isMcpBoundAdapter(module))
    };
  }, [effectivePlan]);

  const modeDirty = savedMode !== null && savedMode !== selectedOutputMode;
  const planReady = scaffoldPlan?.validation?.can_generate_source === true;
  const stubReady = (runtimeStub?.files ?? []).length > 0;
  const blockers = scaffoldPlan?.validation?.blockers ?? effectivePlan?.validation.blockers ?? [];
  const warnings = scaffoldPlan?.validation?.warnings ?? effectivePlan?.validation.warnings ?? [];
  const compoundDisabledReason = buildCompoundDisabledReason({ analysisExists: Boolean(analysis), boundariesApproved, runtimeApproved });

  function handleSavePlan() {
    if (!effectivePlan) return;
    saveScaffold.mutate(effectivePlan, {
      onSuccess: () => setActionMessage("scaffold-plan.json 저장 완료"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "저장 실패")
    });
  }

  function handleMockLabBinding(module: ScaffoldPlanModule, value: string) {
    if (!value) {
      setBindingOverrides((current) => {
        const next = { ...current };
        delete next[module.id];
        return next;
      });
      return;
    }
    const [mockId, toolName] = value.split("::");
    if (!mockId || !toolName) return;
    setBindingOverrides((current) => ({
      ...current,
      [module.id]: {
        mcpServer: mockId,
        mcpToolName: toolName,
        mcpSchemaRef: module.mcp_schema_ref ?? null
      }
    }));
  }

  function handleOutputModeChange(nextOutputMode: ScaffoldOutputMode) {
    setOutputModeExplicitlyChosen(true);
    setOutputMode(nextOutputMode);
  }

  function handleBuildStub() {
    setActionMessage(null);
    processLog.reset("runtime-stub");
    buildStub.mutate(
      { streamProgress: true, onEvent: processLog.append },
      {
        onSuccess: (result) =>
          setActionMessage(
            result.ok ? `runtime-stub 생성 완료 (${result.files.length} 파일)` : `runtime-stub 생성 실패 (exit ${result.exit_code ?? "?"})`
          ),
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "runtime-stub 생성 실패")
      }
    );
  }

  function handleArtifactSyncRun() {
    setActionMessage(null);
    processLog.reset("artifact-sync");
    artifactSync.mutate(
      buildArtifactSyncRunOptions({
        outputMode: selectedOutputMode,
        outputModeExplicitlyChosen,
        savedOutputMode: savedMode,
        onEvent: processLog.append
      }),
      {
        onSuccess: (result) =>
          setActionMessage(
            result.ok
              ? `계약 동기화 + runtime-stub 재생성 완료 (${result.artifacts_written.length}개 artifact)`
              : `계약 동기화 + runtime-stub 재생성 실패${result.error ? ` — ${result.error}` : ""}`
          ),
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "계약 동기화 + runtime-stub 재생성 실패")
      }
    );
  }

  return (
    <>
      {actionMessage ? <BuildRunNotice message={actionMessage} /> : null}
      {!designGatesReady ? (
        <Panel tone="muted">
          <p className="af-landing-error">
            게이트 미충족: boundaries_approved={boundariesApproved ? "예" : "아니오"}, runtime_contracts_approved=
            {runtimeApproved ? "예" : "아니오"}. Design 단계에서 게이트를 먼저 통과시키세요.
          </p>
          <Link className="ui-button ui-button-secondary" to={`/af/${reqId}/design`}>
            Design 으로 이동
          </Link>
        </Panel>
      ) : null}
      <ArtifactSyncRunPanel
        compoundDisabledReason={compoundDisabledReason}
        entries={processLog.entries}
        isLogRunning={artifactSync.isPending || buildStub.isPending}
        isPending={artifactSync.isPending}
        logRef={processLog.logRef}
        onRun={handleArtifactSyncRun}
        result={artifactSync.data ?? null}
        showLog={processLog.owner === "artifact-sync"}
      />
      <ManualScaffoldPanel
        adapterConnections={adapterConnections}
        adkGraphReadiness={buildAdkGraphReadiness(effectivePlan)}
        blockers={blockers}
        designGatesReady={designGatesReady}
        effectivePlan={effectivePlan}
        mockLabDiscovery={{
          data: mockLabDiscovery.data ?? null,
          error: mockLabDiscovery.error,
          isLoading: mockLabDiscovery.isLoading
        }}
        modeDirty={modeDirty}
        onMockLabBinding={handleMockLabBinding}
        onOutputModeChange={handleOutputModeChange}
        onSavePlan={handleSavePlan}
        outputMode={selectedOutputMode}
        reqId={reqId}
        savedMode={savedMode}
        savePending={saveScaffold.isPending}
        scaffoldLoading={scaffoldLoading}
        scaffoldPlan={scaffoldPlan}
        warnings={warnings}
      />
      <ManualRuntimeStubPanel
        artifactSyncPending={artifactSync.isPending}
        buildStubData={buildStub.data}
        buildStubPending={buildStub.isPending}
        designGatesReady={designGatesReady}
        entries={processLog.entries}
        logRef={processLog.logRef}
        onBuildStub={handleBuildStub}
        outputMode={selectedOutputMode}
        planReady={planReady}
        showLog={processLog.owner === "runtime-stub"}
        stubReady={stubReady}
      />
    </>
  );
}

function BuildRunNotice({ message }: { readonly message: string }) {
  return (
    <div className="af-stage-notice" role="status">
      <span>{message}</span>
    </div>
  );
}

function buildCompoundDisabledReason({
  analysisExists,
  boundariesApproved,
  runtimeApproved
}: {
  readonly analysisExists: boolean;
  readonly boundariesApproved: boolean;
  readonly runtimeApproved: boolean;
}): string | null {
  if (!boundariesApproved || !runtimeApproved) {
    return `게이트 미충족: boundaries_approved=${boundariesApproved ? "예" : "아니오"}, runtime_contracts_approved=${
      runtimeApproved ? "예" : "아니오"
    }`;
  }
  return analysisExists ? null : "analysis-result.json 이 없어 계약 동기화를 실행할 수 없습니다.";
}
