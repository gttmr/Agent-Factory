import { useMemo, useState } from "react";
import { buildAdkSourceBundle } from "../analyzer/adkSource";
import type { AdkRuntimeMode } from "../analyzer/adkGraph";
import { buildScaffoldPlan } from "../analyzer/scaffoldPlan";
import type { CatalogEntry } from "../catalog/types";
import type { EvidenceSummary, ModuleCandidate, NormalizedRequirement, ProcessFlow } from "../analyzer/types";

interface AdkRuntimeWorkbenchProps {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  acceptedMissing: string[];
  catalogEntries: CatalogEntry[];
}

interface RuntimeResponse {
  appName?: string;
  outputRoot?: string;
  url?: string;
  files?: string[];
  commands?: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  steps?: Array<{ name: string; stdout: string; stderr: string; exitCode: number }>;
  checks?: Array<{ name: string; ok: boolean }>;
  error?: string;
}

type RuntimeAction = "generate-plan" | "generate" | "verify" | "run" | "start-web" | "check-web";

export function AdkRuntimeWorkbench({
  normalizedRequirement,
  moduleCandidates,
  processFlow,
  catalogEntries
}: AdkRuntimeWorkbenchProps) {
  const [runtimeMode, setRuntimeMode] = useState<AdkRuntimeMode>("stub");
  const [outputDir, setOutputDir] = useState("generated/adk-source");
  const [webPort, setWebPort] = useState(8020);
  const [query, setQuery] = useState("sample complaint for workflow smoke");
  const [isBusy, setIsBusy] = useState(false);
  const [lastResponse, setLastResponse] = useState<RuntimeResponse | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const scaffoldPlan = useMemo(
    () =>
      buildScaffoldPlan({
        normalizedRequirement,
        moduleCandidates,
        processFlow,
        catalogEntries
      }),
    [catalogEntries, moduleCandidates, normalizedRequirement, processFlow]
  );

  const bundle = useMemo(
    () =>
      buildAdkSourceBundle({
        normalizedRequirement,
        processFlow,
        scaffoldPlan,
        runtimeMode
      }),
    [normalizedRequirement, processFlow, runtimeMode, scaffoldPlan]
  );
  const graphErrors = bundle.graphIr.issues.filter((issue) => issue.severity === "error");
  const graphWarnings = bundle.graphIr.issues.filter((issue) => issue.severity === "warning");

  async function runAction(action: RuntimeAction) {
    setIsBusy(true);
    appendLog(`$ ${action}`);
    try {
      const response = await fetch("/api/adk-runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          outputDir,
          runtimeMode,
          appName: bundle.appName,
          normalizedRequirement,
          processFlow,
          scaffoldPlan,
          query,
          port: webPort
        })
      });
      const payload = (await response.json()) as RuntimeResponse;
      setLastResponse(payload);
      appendLog(formatRuntimeResponse(action, payload));
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "runtime action failed");
    } finally {
      setIsBusy(false);
    }
  }

  function appendLog(message: string) {
    setLog((current) => [...current.slice(-9), message]);
  }

  return (
    <div className="stack">
      <section className="panel adk-console">
        <div className="artifact-header">
          <div className="section-heading">
            <p className="eyebrow">ADK Runtime Handoff</p>
            <h2>{bundle.appName}</h2>
          </div>
        </div>

        <div className="runtime-controls">
          <label>
            <span>output directory</span>
            <input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
          </label>
          <label>
            <span>runtime mode</span>
            <select value={runtimeMode} onChange={(event) => setRuntimeMode(event.target.value as AdkRuntimeMode)}>
              <option value="stub">Stub mode</option>
              <option value="llm">LLM mode</option>
              <option value="adapter">Adapter mode</option>
            </select>
          </label>
          <label>
            <span>ADK Web port</span>
            <input
              type="number"
              min="1024"
              max="65535"
              value={webPort}
              onChange={(event) => setWebPort(Number(event.target.value) || 8020)}
            />
          </label>
          <label className="span-2">
            <span>adk run query</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="runtime-mode-note">
          <strong>{modeTitle(runtimeMode)}</strong>
          <span>{modeDescription(runtimeMode)}</span>
        </div>

        {scaffoldPlan.validation.blockers.length ? (
          <div className="runtime-issues error">
            {scaffoldPlan.validation.blockers.map((blocker) => (
              <p key={blocker}>
                <strong>scaffold-plan</strong> {blocker}
              </p>
            ))}
          </div>
        ) : null}

        {bundle.graphIr.issues.length ? (
          <div className={graphErrors.length ? "runtime-issues error" : "runtime-issues warning"}>
            {bundle.graphIr.issues.map((issue) => (
              <p key={`${issue.code}-${issue.node_id ?? issue.message}`}>
                <strong>{issue.code}</strong> {issue.message}
              </p>
            ))}
          </div>
        ) : null}

        <div className="runtime-actions">
          <button type="button" onClick={() => runAction("generate-plan")} disabled={isBusy}>
            scaffold-plan.json 생성
          </button>
          <button
            type="button"
            onClick={() => runAction("generate")}
            disabled={isBusy || graphErrors.length > 0 || !scaffoldPlan.validation.can_generate_source}
          >
            ADK 소스 생성
          </button>
          <button type="button" onClick={() => runAction("verify")} disabled={isBusy}>
            compileall / pytest
          </button>
          <button type="button" onClick={() => runAction("run")} disabled={isBusy}>
            adk run --jsonl
          </button>
          <button type="button" onClick={() => runAction("start-web")} disabled={isBusy}>
            ADK Web 실행
          </button>
          <button type="button" onClick={() => runAction("check-web")} disabled={isBusy}>
            구조 자동 확인
          </button>
        </div>

        <div className="graph-ir-summary">
          <div>
            <span>Approved</span>
            <strong>{scaffoldPlan.modules.length}</strong>
          </div>
          <div>
            <span>Imported</span>
            <strong>{scaffoldPlan.manifest.imported_components.length}</strong>
          </div>
          <div>
            <span>TODO</span>
            <strong>{scaffoldPlan.manifest.new_code_required.length}</strong>
          </div>
          <div>
            <span>Start</span>
            <strong>{bundle.graphIr.edges.filter((edge) => edge.kind === "start").length}</strong>
          </div>
          <div>
            <span>Route</span>
            <strong>{bundle.graphIr.fanOutGroups.filter((group) => group.kind === "route").length}</strong>
          </div>
          <div>
            <span>Join</span>
            <strong>{bundle.graphIr.joinGroups.length}</strong>
          </div>
          <div>
            <span>Loop</span>
            <strong>{bundle.graphIr.loopEdges.length}</strong>
          </div>
          <div>
            <span>Warnings</span>
            <strong>{graphWarnings.length}</strong>
          </div>
        </div>

        {lastResponse?.url ? (
          <p className="runtime-link">
            ADK Web: <a href={lastResponse.url}>{lastResponse.url}</a>
          </p>
        ) : null}

        <pre className="runtime-log">{log.join("\n\n")}</pre>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">승인 산출물</p>
          <h2>scaffold-plan.json</h2>
        </div>
        <pre className="json-preview">{JSON.stringify(scaffoldPlan, null, 2)}</pre>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">생성 파일</p>
          <h2>ADK source bundle</h2>
        </div>
        <div className="generated-file-list">
          {Object.keys(bundle.files).map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <p className="eyebrow">Graph IR</p>
          <h2>runtime topology</h2>
        </div>
        <pre className="json-preview">{JSON.stringify(bundle.graphIr, null, 2)}</pre>
      </section>
    </div>
  );
}

function formatRuntimeResponse(action: RuntimeAction, payload: RuntimeResponse): string {
  if (payload.error) return `${action} failed: ${payload.error}`;
  if (payload.steps) {
    return payload.steps.map((step) => `${step.name} exit=${step.exitCode}\n${step.stdout}${step.stderr}`).join("\n");
  }
  if (payload.checks) {
    return payload.checks.map((check) => `${check.ok ? "OK" : "FAIL"} ${check.name}`).join("\n");
  }
  if (payload.stdout || payload.stderr) {
    return `${payload.stdout ?? ""}${payload.stderr ?? ""}`.trim();
  }
  if (payload.files) {
    return `generated ${payload.files.length} files at ${payload.outputRoot}`;
  }
  if (payload.url) {
    return `ADK Web ${payload.url}`;
  }
  return `${action} completed`;
}

function modeTitle(mode: AdkRuntimeMode): string {
  if (mode === "llm") return "LLM mode";
  if (mode === "adapter") return "Adapter mode";
  return "Stub mode";
}

function modeDescription(mode: AdkRuntimeMode): string {
  if (mode === "llm") return "agent 후보를 LLM Agent placeholder로 분리 표시합니다. 실제 모델 자격 증명 연결 전에는 stub output을 유지합니다.";
  if (mode === "adapter") return "approved MCP adapter 후보를 adapter runtime placeholder로 분리 표시합니다.";
  return "API key 없이 ADK graph 구조, route, Join, loop, output path만 검증합니다.";
}
