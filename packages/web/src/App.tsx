import { A2AContractReview } from "./components/A2AContractReview";
import { AnalysisResult } from "./components/AnalysisResult";
import { CatalogManager } from "./components/CatalogManager";
import { AdkRuntimeWorkbench } from "./components/AdkRuntimeWorkbench";
import { ModuleReview } from "./components/ModuleReview";
import { GraphCanvas } from "./components/GraphCanvas";
import { RequirementIntake, RequirementIntakeContext } from "./components/RequirementIntake";
import { RuntimeContractReview } from "./components/RuntimeContractReview";
import { SavedAnalyses } from "./components/SavedAnalyses";
import { Panel, SectionHeader } from "./ui/primitives";
import { WorkbenchShell } from "./ui/WorkbenchShell";
import { useWorkbenchState } from "./workbench/useWorkbenchState";

export default function App() {
  const {
    state,
    processFlow,
    a2aContracts,
    runtimeContracts,
    hasA2AReviewStep,
    hasRuntimeContractReviewStep,
    visibleSteps,
    canOpenStep,
    providerLabel,
    actions
  } = useWorkbenchState();

  const statusItems = [
    { label: "상태", value: state.isAnalyzing ? "Codex CLI 분석 중" : state.analysis ? "초안 분석 완료" : "분석 전" },
    { label: "모듈", value: `${state.moduleCandidates.length}개` },
    { label: "저장", value: `${state.savedAnalyses.length}개` },
    { label: "Analyzer", value: providerLabel }
  ];

  return (
    <WorkbenchShell
      activeStep={state.activeStep}
      steps={visibleSteps}
      canOpenStep={canOpenStep}
      onStepChange={actions.setActiveStep}
      statusItems={statusItems}
      context={renderContext()}
    >
      {renderWorkspace()}
    </WorkbenchShell>
  );

  function renderWorkspace() {
    if (state.activeStep === "intake") {
      return (
        <RequirementIntake
          input={state.input}
          onInputChange={actions.setInput}
          onAnalyze={actions.runAnalysis}
          onLoadExample={actions.loadExample}
          onLoadRemoteA2AExample={actions.loadRemoteA2AExample}
          onClear={actions.clearAll}
          validationMessage={state.validationMessage}
          isAnalyzing={state.isAnalyzing}
          analyzerModel={state.analyzerModel}
          onAnalyzerModelChange={actions.setAnalyzerModel}
        />
      );
    }

    if (state.activeStep === "analysis" && state.analysis) {
      return (
        <AnalysisResult
          analysis={state.analysis}
          onRerun={actions.runAnalysis}
          onContinue={() => actions.setActiveStep("modules")}
          acceptedMissing={state.acceptedMissing}
          onToggleAcceptedMissing={actions.toggleAcceptedMissing}
        />
      );
    }

    if (state.activeStep === "modules" && state.analysis) {
      return (
        <ModuleReview
          normalizedRequirement={state.analysis.normalizedRequirement}
          evidence={state.analysis.evidence}
          analyzerModel={state.analyzerModel}
          moduleCandidates={state.moduleCandidates}
          catalogEntries={state.catalogEntries}
          processFlow={processFlow}
          onReviewSave={actions.setModuleReviewArtifacts}
          onContinue={() => actions.setActiveStep("graph")}
          onNavigateToA2AContracts={hasA2AReviewStep ? () => actions.setActiveStep("a2aContracts") : undefined}
        />
      );
    }

    if (state.activeStep === "graph" && state.analysis && processFlow) {
      return (
        <GraphCanvas
          graphIR={processFlow}
          moduleCandidates={state.moduleCandidates}
          a2aContracts={a2aContracts}
          onNavigateToA2AContracts={hasA2AReviewStep ? () => actions.setActiveStep("a2aContracts") : undefined}
          onContinue={() => actions.setActiveStep(hasRuntimeContractReviewStep ? "runtimeContracts" : hasA2AReviewStep ? "a2aContracts" : "catalog")}
        />
      );
    }

    if (state.activeStep === "runtimeContracts" && state.analysis && hasRuntimeContractReviewStep) {
      return (
        <RuntimeContractReview
          contracts={runtimeContracts}
          moduleCandidates={state.moduleCandidates}
          onContractsChange={actions.setRuntimeContracts}
          onContinue={() => actions.setActiveStep(hasA2AReviewStep ? "a2aContracts" : "catalog")}
        />
      );
    }

    if (state.activeStep === "a2aContracts" && state.analysis && hasA2AReviewStep) {
      return (
        <A2AContractReview
          contracts={a2aContracts}
          moduleCandidates={state.moduleCandidates}
          onContractsChange={actions.setA2AContracts}
          onContinue={() => actions.setActiveStep("catalog")}
        />
      );
    }

    if (state.activeStep === "catalog") {
      return (
        <CatalogManager
          entries={state.catalogEntries}
          onEntriesChange={actions.setCatalogEntries}
          moduleCandidates={state.moduleCandidates}
          onContinue={() => actions.setActiveStep("export")}
        />
      );
    }

    if (state.activeStep === "saved") {
      return (
        <SavedAnalyses
          records={state.savedAnalyses}
          hasCurrentAnalysis={state.analysis !== null}
          currentSavedId={state.currentSavedId}
          onSaveCurrent={actions.saveCurrentAnalysis}
          onLoad={actions.loadSavedAnalysis}
          onDelete={actions.removeSavedAnalysis}
        />
      );
    }

    if (state.activeStep === "export" && state.analysis && processFlow) {
      return (
        <AdkRuntimeWorkbench
          normalizedRequirement={state.analysis.normalizedRequirement}
          evidence={state.analysis.evidence}
          moduleCandidates={state.moduleCandidates}
          processFlow={processFlow}
          acceptedMissing={state.acceptedMissing}
          catalogEntries={state.catalogEntries}
          runtimeContracts={runtimeContracts}
          onNavigateToModules={() => actions.setActiveStep("modules")}
        />
      );
    }

    return (
      <Panel className="guard-panel">
        <SectionHeader
          eyebrow="대기"
          title="먼저 요구사항을 분석하세요"
          description="이 단계는 분석 결과가 있어야 열립니다. 좌측 rail에서 요구사항 접수로 돌아가 분석을 실행하세요."
        />
      </Panel>
    );
  }

  function renderContext() {
    if (state.activeStep === "intake") {
      return (
        <RequirementIntakeContext
          input={state.input}
          onInputChange={actions.setInput}
          analysisProgress={state.analysisProgress}
          analyzerModel={state.analyzerModel}
        />
      );
    }

    return null;
  }
}
