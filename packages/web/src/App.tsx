import { useMemo, useRef, useState } from "react";
import { A2AContractReview } from "./components/A2AContractReview";
import { AnalysisResult } from "./components/AnalysisResult";
import { CatalogManager } from "./components/CatalogManager";
import { DomainCapabilityMap } from "./components/DomainCapabilityMap";
import { AdkRuntimeWorkbench } from "./components/AdkRuntimeWorkbench";
import { ModuleReview } from "./components/ModuleReview";
import { GraphCanvas } from "./components/GraphCanvas";
import { RequirementIntake } from "./components/RequirementIntake";
import { ReuseHeatmap } from "./components/ReuseHeatmap";
import { SavedAnalyses } from "./components/SavedAnalyses";
import { getExampleRequirement, getRemoteA2AExampleRequirement } from "./analyzer/exampleRequirement";
import { defaultAnalyzerProvider } from "./analyzer/providers";
import {
  createSavedAnalysisId,
  deleteSavedAnalysis,
  loadSavedAnalyses,
  upsertSavedAnalysis,
  type SavedAnalysisRecord
} from "./analyzer/savedAnalyses";
import { loadSeedCatalog } from "./catalog/seed";
import type { CatalogEntry } from "./catalog/types";
import type {
  A2AContract,
  AnalysisResult as AnalyzerResult,
  AnalyzerProgressEvent,
  CatalogReference,
  CodexAnalyzerModel,
  ModuleCandidate,
  RequirementDomain,
  RequirementIntakeInput
} from "./analyzer/types";

type StepId =
  | "intake"
  | "analysis"
  | "modules"
  | "graph"
  | "a2aContracts"
  | "reuse"
  | "domainMap"
  | "catalog"
  | "saved"
  | "export";

const emptyInput: RequirementIntakeInput = {
  domain: "공통",
  rawText: ""
};

const steps: Array<{ id: StepId; label: string; alwaysAvailable?: boolean }> = [
  { id: "intake", label: "요구사항 접수", alwaysAvailable: true },
  { id: "analysis", label: "분석 결과" },
  { id: "modules", label: "모듈 검토" },
  { id: "graph", label: "그래프 워크플로우 검토" },
  { id: "a2aContracts", label: "Remote A2A 계약 검토" },
  { id: "reuse", label: "재사용 히트맵" },
  { id: "domainMap", label: "도메인 맵" },
  { id: "catalog", label: "카탈로그", alwaysAvailable: true },
  { id: "saved", label: "저장된 분석", alwaysAvailable: true },
  { id: "export", label: "ADK 소스 생성" }
];

export default function App() {
  const [activeStep, setActiveStep] = useState<StepId>("intake");
  const [input, setInput] = useState<RequirementIntakeInput>(emptyInput);
  const [analysis, setAnalysis] = useState<AnalyzerResult | null>(null);
  const [moduleCandidates, setModuleCandidates] = useState<ModuleCandidate[]>([]);
  const [acceptedMissing, setAcceptedMissing] = useState<string[]>([]);
  const [validationMessage, setValidationMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzerModel, setAnalyzerModel] = useState<CodexAnalyzerModel>("gpt-5.3-codex-spark");
  const [analysisProgress, setAnalysisProgress] = useState<AnalyzerProgressEvent[]>([]);
  const analysisRequestInFlight = useRef(false);
  const seedEntries = useMemo(() => loadSeedCatalog(), []);
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>(seedEntries);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisRecord[]>(() => loadSavedAnalyses());
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

  const processFlow = analysis?.processFlow ?? null;
  const a2aContracts = analysis?.a2aContracts ?? [];
  const hasRemoteA2ACandidates = moduleCandidates.some((candidate) => candidate.module_category === "remote_a2a");
  const hasA2AReviewStep = hasRemoteA2ACandidates || a2aContracts.length > 0;

  const canReview = analysis !== null;

  const visibleSteps = useMemo(
    () => steps.filter((step) => (step.id === "a2aContracts" ? hasA2AReviewStep : true)),
    [hasA2AReviewStep]
  );

  function updateA2AContracts(updated: A2AContract[]) {
    if (!analysis) return;
    setAnalysis({ ...analysis, a2aContracts: updated });
  }

  async function runAnalysis() {
    if (analysisRequestInFlight.current) {
      return;
    }
    if (!input.rawText.trim()) {
      setValidationMessage("분석 전에 원문 요구사항을 입력해야 합니다.");
      setActiveStep("intake");
      return;
    }

    analysisRequestInFlight.current = true;
    setIsAnalyzing(true);
    setAnalysisProgress([]);
    try {
      const result = await defaultAnalyzerProvider.analyze(input, {
        model: analyzerModel,
        catalog: buildCatalogReferences(catalogEntries),
        onProgress: (event) => {
          setAnalysisProgress((current) => [...current.slice(-59), compactProgressEvent(event)]);
        }
      });
      setAnalysis(result);
      setModuleCandidates(result.moduleCandidates);
      setAcceptedMissing([]);
      setCurrentSavedId(null);
      setValidationMessage("");
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "분석을 완료하지 못했습니다.");
      setActiveStep("intake");
    } finally {
      analysisRequestInFlight.current = false;
      setIsAnalyzing(false);
    }
  }

  function loadExample() {
    setInput(getExampleRequirement());
    setValidationMessage("");
    setCurrentSavedId(null);
  }

  function loadRemoteA2AExample() {
    setInput(getRemoteA2AExampleRequirement());
    setValidationMessage("");
    setCurrentSavedId(null);
  }

  function clearAll() {
    setInput(emptyInput);
    setAnalysis(null);
    setModuleCandidates([]);
    setAcceptedMissing([]);
    setValidationMessage("");
    setAnalysisProgress([]);
    setCurrentSavedId(null);
    setActiveStep("intake");
  }

  function saveCurrentAnalysis() {
    if (!analysis) {
      setValidationMessage("저장할 분석 결과가 없습니다.");
      setActiveStep("intake");
      return;
    }
    const id = currentSavedId ?? createSavedAnalysisId();
    const savedAt = new Date().toISOString();
    const record: SavedAnalysisRecord = {
      id,
      title: analysis.normalizedRequirement.title || "제목 없는 분석",
      savedAt,
      input,
      analysis: {
        ...analysis,
        moduleCandidates
      },
      moduleCandidates,
      acceptedMissing,
      analyzerModel
    };
    setSavedAnalyses(upsertSavedAnalysis(record));
    setCurrentSavedId(id);
    setValidationMessage("현재 분석을 저장했습니다.");
    setActiveStep("saved");
  }

  function loadSavedAnalysis(record: SavedAnalysisRecord) {
    setInput(normalizeIntakeInput(record.input));
    setAnalysis(record.analysis);
    setModuleCandidates(record.moduleCandidates);
    setAcceptedMissing(record.acceptedMissing);
    setAnalyzerModel(record.analyzerModel);
    setAnalysisProgress([]);
    setCurrentSavedId(record.id);
    setValidationMessage(`저장된 분석을 불러왔습니다: ${record.title}`);
    setActiveStep("analysis");
  }

  function removeSavedAnalysis(id: string) {
    setSavedAnalyses(deleteSavedAnalysis(id));
    if (currentSavedId === id) {
      setCurrentSavedId(null);
    }
  }

  function toggleAcceptedMissing(item: string) {
    setAcceptedMissing((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">은행 요구사항 분석 워크벤치</p>
          <h1>Agent Factory</h1>
        </div>
        <div className="status-strip" aria-label="워크벤치 상태">
          <span>{isAnalyzing ? "Codex CLI 분석 중" : analysis ? "초안 분석 완료" : "분석 전"}</span>
          <span>{moduleCandidates.length}개 모듈</span>
          <span>{savedAnalyses.length}개 저장</span>
          <span>{defaultAnalyzerProvider.label}</span>
        </div>
      </header>

      <nav className="stepper" aria-label="워크벤치 단계">
        {visibleSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={activeStep === step.id ? "step active" : "step"}
            onClick={() => setActiveStep(step.id)}
            disabled={!step.alwaysAvailable && !canReview}
          >
            {step.label}
          </button>
        ))}
      </nav>

      <section className="workspace">
        {activeStep === "intake" && (
          <RequirementIntake
            input={input}
            onInputChange={setInput}
            onAnalyze={runAnalysis}
            onLoadExample={loadExample}
            onLoadRemoteA2AExample={loadRemoteA2AExample}
            onClear={clearAll}
            validationMessage={validationMessage}
            isAnalyzing={isAnalyzing}
            analysisProgress={analysisProgress}
            analyzerModel={analyzerModel}
            onAnalyzerModelChange={setAnalyzerModel}
          />
        )}

        {activeStep === "analysis" && analysis && (
          <AnalysisResult
            analysis={analysis}
            acceptedMissing={acceptedMissing}
            onToggleAcceptedMissing={toggleAcceptedMissing}
            onRerun={runAnalysis}
            onContinue={() => setActiveStep("modules")}
          />
        )}

        {activeStep === "modules" && analysis && (
          <ModuleReview
            moduleCandidates={moduleCandidates}
            catalogEntries={catalogEntries}
            onModuleCandidatesChange={setModuleCandidates}
            onContinue={() => setActiveStep("graph")}
            onNavigateToA2AContracts={hasA2AReviewStep ? () => setActiveStep("a2aContracts") : undefined}
          />
        )}

        {activeStep === "graph" && analysis && processFlow && (
          <GraphCanvas
            graphIR={processFlow}
            moduleCandidates={moduleCandidates}
            a2aContracts={a2aContracts}
            onNavigateToA2AContracts={hasA2AReviewStep ? () => setActiveStep("a2aContracts") : undefined}
            onContinue={() => setActiveStep(hasA2AReviewStep ? "a2aContracts" : "reuse")}
          />
        )}

        {activeStep === "a2aContracts" && analysis && hasA2AReviewStep && (
          <A2AContractReview
            contracts={a2aContracts}
            moduleCandidates={moduleCandidates}
            onContractsChange={updateA2AContracts}
            onContinue={() => setActiveStep("reuse")}
          />
        )}

        {activeStep === "reuse" && analysis && (
          <ReuseHeatmap
            moduleCandidates={moduleCandidates}
            onContinue={() => setActiveStep("domainMap")}
          />
        )}

        {activeStep === "domainMap" && analysis && (
          <DomainCapabilityMap
            moduleCandidates={moduleCandidates}
            onContinue={() => setActiveStep("catalog")}
          />
        )}

        {activeStep === "catalog" && (
          <CatalogManager
            entries={catalogEntries}
            onEntriesChange={setCatalogEntries}
            moduleCandidates={moduleCandidates}
            onContinue={() => setActiveStep("export")}
          />
        )}

        {activeStep === "saved" && (
          <SavedAnalyses
            records={savedAnalyses}
            hasCurrentAnalysis={analysis !== null}
            currentSavedId={currentSavedId}
            onSaveCurrent={saveCurrentAnalysis}
            onLoad={loadSavedAnalysis}
            onDelete={removeSavedAnalysis}
          />
        )}

        {activeStep === "export" && analysis && processFlow && (
          <AdkRuntimeWorkbench
            normalizedRequirement={analysis.normalizedRequirement}
            evidence={analysis.evidence}
            moduleCandidates={moduleCandidates}
            processFlow={processFlow}
            acceptedMissing={acceptedMissing}
            catalogEntries={catalogEntries}
          />
        )}
      </section>
    </main>
  );
}

function compactProgressEvent(event: AnalyzerProgressEvent): AnalyzerProgressEvent {
  const { result: _result, ...progress } = event;
  return progress;
}

function normalizeIntakeInput(input: RequirementIntakeInput | Record<string, unknown>): RequirementIntakeInput {
  const record = input as Record<string, unknown>;
  const rawText = typeof record.rawText === "string" ? record.rawText : "";
  const legacyDomainHint = typeof record.domainHint === "string" ? record.domainHint : "";
  const domain = typeof record.domain === "string" && record.domain ? record.domain : legacyDomainHint || "공통";
  return {
    domain: normalizeRequirementDomain(domain),
    rawText
  };
}

function normalizeRequirementDomain(value: string): RequirementDomain {
  return value === "고객" || value === "수신" || value === "여신" || value === "카드" || value === "리스크"
    ? value
    : "공통";
}

function buildCatalogReferences(entries: CatalogEntry[]): CatalogReference[] {
  return entries
    .filter((entry) => entry.provenance !== "session_deleted")
    .filter((entry) => entry.name.trim().length > 0)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      module_category: entry.module_category,
      subtype: catalogSubtype(entry),
      access_protocol: entry.access_protocol ?? null,
      mcp_server: entry.mcp_server ?? null,
      mcp_tool_name: entry.mcp_tool_name ?? null,
      mcp_schema_ref: entry.mcp_schema_ref ?? null,
      mcp_auth_mode: entry.mcp_auth_mode ?? null,
      component_source: entry.component_source ?? null,
      package_name: entry.package_name ?? null,
      package_version: entry.package_version ?? null,
      import_path: entry.import_path ?? null,
      callable_name: entry.callable_name ?? null,
      owner_domain: entry.owner_domain ?? null,
      status: entry.status ?? null,
      responsibility: entry.responsibility ?? null,
      inputs: entry.inputs ?? [],
      outputs: entry.outputs ?? [],
      composition: entry.composition ?? [],
      risk_signals: entry.risk_signals ?? []
    }));
}

function catalogSubtype(entry: CatalogEntry): string | null {
  if (entry.module_category === "adapter") return entry.adapter_kind ?? null;
  if (entry.module_category === "agent") return entry.agent_kind ?? null;
  if (entry.module_category === "workflow") return entry.workflow_kind ?? null;
  if (entry.module_category === "remote_a2a") return entry.remote_contract_kind ?? null;
  return null;
}
