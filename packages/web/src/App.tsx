import { useMemo, useState } from "react";
import { AnalysisResult } from "./components/AnalysisResult";
import { ExportArtifacts } from "./components/ExportArtifacts";
import { ModuleReview } from "./components/ModuleReview";
import { ProcessFlowView } from "./components/ProcessFlowView";
import { RequirementIntake } from "./components/RequirementIntake";
import { buildProcessFlow, getExampleRequirement } from "./analyzer/mockAnalyzer";
import { defaultAnalyzerProvider } from "./analyzer/providers";
import type { AnalysisResult as AnalyzerResult, ModuleCandidate, RequirementIntakeInput } from "./analyzer/types";

type StepId = "intake" | "analysis" | "modules" | "flow" | "export";

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

  const processFlow = useMemo(() => {
    if (!analysis) {
      return null;
    }
    return buildProcessFlow(analysis.normalizedRequirement, moduleCandidates);
  }, [analysis, moduleCandidates]);

  const canReview = analysis !== null;

  async function runAnalysis() {
    if (!input.rawText.trim()) {
      setValidationMessage("분석 전에 원문 요구사항을 입력해야 합니다.");
      setActiveStep("intake");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await defaultAnalyzerProvider.analyze(input);
      setAnalysis(result);
      setModuleCandidates(result.moduleCandidates);
      setAcceptedMissing([]);
      setValidationMessage("");
      setActiveStep("analysis");
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "분석을 완료하지 못했습니다.");
      setActiveStep("intake");
    } finally {
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
          <p className="eyebrow">Local-first planning workbench</p>
          <h1>요구사항 접수</h1>
        </div>
        <div className="status-strip" aria-label="Workbench state">
          <span>{analysis ? "초안 분석 완료" : "분석 전"}</span>
          <span>{moduleCandidates.length} modules</span>
          <span>{defaultAnalyzerProvider.label}</span>
        </div>
      </header>

      <nav className="stepper" aria-label="Workbench steps">
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
