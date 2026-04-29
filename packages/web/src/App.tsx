import { useRef, useState } from "react";
import { AnalysisResult } from "./components/AnalysisResult";
import { DomainCapabilityMap } from "./components/DomainCapabilityMap";
import { ExportArtifacts } from "./components/ExportArtifacts";
import { ModuleReview } from "./components/ModuleReview";
import { ProcessFlowView } from "./components/ProcessFlowView";
import { RequirementIntake } from "./components/RequirementIntake";
import { ReuseHeatmap } from "./components/ReuseHeatmap";
import { getExampleRequirement } from "./analyzer/mockAnalyzer";
import { defaultAnalyzerProvider } from "./analyzer/providers";
import type {
  AnalysisResult as AnalyzerResult,
  AnalyzerProgressEvent,
  CodexAnalyzerModel,
  ModuleCandidate,
  RequirementIntakeInput
} from "./analyzer/types";

type StepId = "intake" | "analysis" | "modules" | "flow" | "reuse" | "domainMap" | "export";

const emptyInput: RequirementIntakeInput = {
  title: "",
  domainHint: "",
  rawText: "",
  requesterTeam: "",
  requesterRole: "",
  knownSystems: "",
  expectedOutput: ""
};

const steps: Array<{ id: StepId; label: string }> = [
  { id: "intake", label: "요구사항 접수" },
  { id: "analysis", label: "분석 결과" },
  { id: "modules", label: "모듈 검토" },
  { id: "flow", label: "프로세스 플로우" },
  { id: "reuse", label: "재사용 히트맵" },
  { id: "domainMap", label: "도메인 맵" },
  { id: "export", label: "아티팩트 내보내기" }
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

  const processFlow = analysis?.processFlow ?? null;

  const canReview = analysis !== null;

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
        onProgress: (event) => {
          setAnalysisProgress((current) => [...current.slice(-59), compactProgressEvent(event)]);
        }
      });
      setAnalysis(result);
      setModuleCandidates(result.moduleCandidates);
      setAcceptedMissing([]);
      setValidationMessage("");
      setActiveStep("analysis");
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
  }

  function clearAll() {
    setInput(emptyInput);
    setAnalysis(null);
    setModuleCandidates([]);
    setAcceptedMissing([]);
    setValidationMessage("");
    setAnalysisProgress([]);
    setActiveStep("intake");
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
          <span>{defaultAnalyzerProvider.label}</span>
        </div>
      </header>

      <nav className="stepper" aria-label="워크벤치 단계">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={activeStep === step.id ? "step active" : "step"}
            onClick={() => setActiveStep(step.id)}
            disabled={step.id !== "intake" && !canReview}
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
            onModuleCandidatesChange={setModuleCandidates}
            onContinue={() => setActiveStep("flow")}
          />
        )}

        {activeStep === "flow" && analysis && processFlow && (
          <ProcessFlowView
            processFlow={processFlow}
            moduleCandidates={moduleCandidates}
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
            onContinue={() => setActiveStep("export")}
          />
        )}

        {activeStep === "export" && analysis && processFlow && (
          <ExportArtifacts
            normalizedRequirement={analysis.normalizedRequirement}
            evidence={analysis.evidence}
            moduleCandidates={moduleCandidates}
            processFlow={processFlow}
            acceptedMissing={acceptedMissing}
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
