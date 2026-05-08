import { A2AContractReview } from "./components/A2AContractReview";
import { AnalysisResult } from "./components/AnalysisResult";
import { CatalogManager } from "./components/CatalogManager";
import { DomainCapabilityMap } from "./components/DomainCapabilityMap";
import { AdkRuntimeWorkbench } from "./components/AdkRuntimeWorkbench";
import { ModuleReview } from "./components/ModuleReview";
import { GraphCanvas } from "./components/GraphCanvas";
import { RequirementIntake, RequirementIntakeContext } from "./components/RequirementIntake";
import { ReuseHeatmap } from "./components/ReuseHeatmap";
import { SavedAnalyses } from "./components/SavedAnalyses";
import { MetricPill, Panel, SectionHeader } from "./ui/primitives";
import { WorkbenchShell } from "./ui/WorkbenchShell";
import { useWorkbenchState } from "./workbench/useWorkbenchState";

export default function App() {
  const {
    state,
    processFlow,
    a2aContracts,
    hasA2AReviewStep,
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
          acceptedMissing={state.acceptedMissing}
          onToggleAcceptedMissing={actions.toggleAcceptedMissing}
          onRerun={actions.runAnalysis}
          onContinue={() => actions.setActiveStep("modules")}
        />
      );
    }

    if (state.activeStep === "modules" && state.analysis) {
      return (
        <ModuleReview
          moduleCandidates={state.moduleCandidates}
          catalogEntries={state.catalogEntries}
          onModuleCandidatesChange={actions.setModuleCandidates}
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
          onContinue={() => actions.setActiveStep(hasA2AReviewStep ? "a2aContracts" : "reuse")}
        />
      );
    }

    if (state.activeStep === "a2aContracts" && state.analysis && hasA2AReviewStep) {
      return (
        <A2AContractReview
          contracts={a2aContracts}
          moduleCandidates={state.moduleCandidates}
          onContractsChange={actions.setA2AContracts}
          onContinue={() => actions.setActiveStep("reuse")}
        />
      );
    }

    if (state.activeStep === "reuse" && state.analysis) {
      return <ReuseHeatmap moduleCandidates={state.moduleCandidates} onContinue={() => actions.setActiveStep("domainMap")} />;
    }

    if (state.activeStep === "domainMap" && state.analysis) {
      return <DomainCapabilityMap moduleCandidates={state.moduleCandidates} onContinue={() => actions.setActiveStep("catalog")} />;
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

    return (
      <div className="context-stack">
        <Panel tone="muted" className="context-panel-block">
          <SectionHeader eyebrow="작업 상태" title="현재 분석" />
          <div className="metric-pill-row">
            <MetricPill label="모듈" value={state.moduleCandidates.length} />
            <MetricPill label="Remote A2A" value={a2aContracts.length} />
            <MetricPill label="누락 확인" value={state.acceptedMissing.length} />
          </div>
        </Panel>
        <Panel tone="muted" className="context-panel-block">
          <SectionHeader eyebrow="운영 기준" title="검토 게이트" />
          <ul className="context-check-list">
            <li>분석 결과를 검토한 뒤 모듈 상태를 승인합니다.</li>
            <li>Remote A2A는 계약 검토 없이 소스 생성으로 넘기지 않습니다.</li>
            <li>ADK 소스 생성은 승인된 scaffold plan만 사용합니다.</li>
          </ul>
        </Panel>
      </div>
    );
  }
}
