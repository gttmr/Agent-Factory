import { useEffect, useMemo, useState } from "react";
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
  onNavigateToModules: () => void;
}

interface RuntimeResponse {
  appName?: string;
  outputRoot?: string;
  url?: string;
  embedUrl?: string;
  port?: number;
  status?: string;
  files?: string[];
  commands?: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  steps?: Array<{ name: string; stdout: string; stderr: string; exitCode: number }>;
  checks?: Array<{ name: string; ok: boolean }>;
  sessionId?: string;
  userId?: string;
  query?: string;
  session?: unknown;
  events?: unknown;
  error?: string;
}

type RuntimeAction =
  | "generate-plan"
  | "generate"
  | "install"
  | "verify"
  | "run"
  | "start-web"
  | "check-web"
  | "chat-smoke";

type MacroStepStatus = "pending" | "running" | "ok" | "fail";
interface MacroStep {
  action: RuntimeAction;
  label: string;
  status: MacroStepStatus;
  detail?: string;
}

const SMOKE_MACRO_ACTIONS: Array<{ action: RuntimeAction; label: string }> = [
  { action: "generate", label: "ADK 소스 생성" },
  { action: "install", label: "의존성 설치" },
  { action: "start-web", label: "ADK Web 실행" },
  { action: "check-web", label: "구조 자동 확인" },
  { action: "chat-smoke", label: "채팅 smoke" }
];

export function AdkRuntimeWorkbench({
  normalizedRequirement,
  moduleCandidates,
  processFlow,
  catalogEntries,
  acceptedMissing,
  onNavigateToModules
}: AdkRuntimeWorkbenchProps) {
  const [runtimeMode, setRuntimeMode] = useState<AdkRuntimeMode>("stub");
  const [outputDir, setOutputDir] = useState("generated/adk-source");
  const [webPort, setWebPort] = useState(8020);
  const [query, setQuery] = useState("sample complaint for workflow smoke");
  const [isBusy, setIsBusy] = useState(false);
  const [lastResponse, setLastResponse] = useState<RuntimeResponse | null>(null);
  const [embeddedUrl, setEmbeddedUrl] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [macroSteps, setMacroSteps] = useState<MacroStep[] | null>(null);

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
  const scaffoldReady = scaffoldPlan.validation.can_generate_source && graphErrors.length === 0;
  const approvedSmokeSpec = scaffoldPlan.modules.find((module) => module.smoke_spec?.ready)?.smoke_spec ?? null;
  const chatSmokeReady = scaffoldReady && Boolean(approvedSmokeSpec?.sample_user_message.trim());
  const needsInfoCount = moduleCandidates.filter(
    (candidate) =>
      candidate.missing_information.length > 0 ||
      (candidate.status === "needs_info" &&
        !(candidate.resolution_applied_at && candidate.schema_review_state === "applied" && candidate.smoke_spec?.ready))
  ).length;
  const isStubOutput =
    runtimeMode === "stub" || JSON.stringify(lastResponse?.events ?? []).includes("stubbed_runtime_contract");

  useEffect(() => {
    if (approvedSmokeSpec?.sample_user_message) {
      setQuery(approvedSmokeSpec.sample_user_message);
    }
  }, [approvedSmokeSpec?.sample_user_message]);

  async function runAction(action: RuntimeAction): Promise<RuntimeResponse | null> {
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
          smokeSpec: approvedSmokeSpec,
          query,
          port: webPort
        })
      });
      const payload = (await response.json()) as RuntimeResponse;
      setLastResponse(payload);
      if (payload.embedUrl) {
        setEmbeddedUrl(payload.embedUrl);
      }
      appendLog(formatRuntimeResponse(action, payload));
      return payload;
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "runtime action failed");
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function runSmokeMacro() {
    const initial: MacroStep[] = SMOKE_MACRO_ACTIONS.map((entry) => ({
      action: entry.action,
      label: entry.label,
      status: "pending"
    }));
    setMacroSteps(initial);
    for (let index = 0; index < SMOKE_MACRO_ACTIONS.length; index += 1) {
      const entry = SMOKE_MACRO_ACTIONS[index];
      setMacroSteps((current) =>
        current ? current.map((step, idx) => (idx === index ? { ...step, status: "running" } : step)) : current
      );
      const payload = await runAction(entry.action);
      const result = payloadStatus(entry.action, payload);
      setMacroSteps((current) =>
        current
          ? current.map((step, idx) =>
              idx === index ? { ...step, status: result.ok ? "ok" : "fail", detail: result.detail } : step
            )
          : current
      );
      if (!result.ok) break;
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
          {acceptedMissing.length > 0 ? (
            <div className="accepted-missing-chip" aria-label="요구사항 누락 수용 수">
              <span>요구사항 누락 수용</span>
              <strong>{acceptedMissing.length}건</strong>
            </div>
          ) : null}
        </div>

        {!scaffoldReady ? (
          <div className="adk-empty-state">
            <div>
              <h3>ADK 소스 생성 준비 미완료</h3>
              <p className="review-muted">아래 조건을 모듈 검토에서 해소한 뒤 다시 시도하세요.</p>
              <ul>
                {scaffoldPlan.validation.blockers.map((blocker) => (
                  <li key={`bl-${blocker}`}>{blocker}</li>
                ))}
                {graphErrors.map((issue) => (
                  <li key={`gerr-${issue.code}-${issue.node_id ?? issue.message}`}>
                    Graph IR {issue.code}: {issue.message}
                  </li>
                ))}
                {needsInfoCount > 0 ? (
                  <li>정보 필요 후보 {needsInfoCount}개가 남아 있습니다.</li>
                ) : null}
              </ul>
            </div>
            <button type="button" className="primary" onClick={onNavigateToModules}>
              모듈 검토로 이동
            </button>
          </div>
        ) : !chatSmokeReady ? (
          <div className="adk-empty-state">
            <div>
              <h3>채팅 smoke 준비 미완료</h3>
              <p className="review-muted">
                소스 생성은 가능하지만 chat smoke에는 후보별 smoke 계약이 필요합니다. 모듈 검토에서 Resolution Draft를 적용하세요.
              </p>
            </div>
            <button type="button" className="secondary" onClick={onNavigateToModules}>
              모듈 검토로 이동
            </button>
          </div>
        ) : null}

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
          <button type="button" onClick={() => runAction("generate-plan")} disabled={isBusy || !scaffoldReady}>
            scaffold-plan.json 생성
          </button>
          <button
            type="button"
            onClick={() => runAction("generate")}
            disabled={isBusy || !scaffoldReady}
          >
            ADK 소스 생성
          </button>
          <button type="button" onClick={() => runAction("install")} disabled={isBusy || !scaffoldReady}>
            의존성 설치
          </button>
          <button type="button" onClick={() => runAction("verify")} disabled={isBusy || !scaffoldReady}>
            compileall / pytest
          </button>
          <button type="button" onClick={() => runAction("run")} disabled={isBusy || !scaffoldReady}>
            adk run --jsonl
          </button>
          <button type="button" onClick={() => runAction("start-web")} disabled={isBusy || !scaffoldReady}>
            ADK Web 실행
          </button>
          <button type="button" onClick={() => runAction("check-web")} disabled={isBusy || !scaffoldReady}>
            구조 자동 확인
          </button>
          <button type="button" onClick={() => runAction("chat-smoke")} disabled={isBusy || !chatSmokeReady}>
            채팅 smoke
          </button>
        </div>

        <div className="smoke-macro">
          <div className="smoke-macro-header">
            <div>
              <strong>Smoke 일괄 실행</strong>
              <span>generate → install → start-web → check-web → chat-smoke</span>
            </div>
            <button
              type="button"
              className="primary"
              onClick={runSmokeMacro}
              disabled={isBusy || !chatSmokeReady}
            >
              일괄 실행
            </button>
          </div>
          {macroSteps && macroSteps.length ? (
            <ol className="smoke-macro-steps">
              {macroSteps.map((step, index) => (
                <li key={`${step.action}-${index}`} className={`smoke-macro-step is-${step.status}`}>
                  <span className="smoke-macro-step-index">{index + 1}</span>
                  <span className="smoke-macro-step-label">{step.label}</span>
                  <span className="smoke-macro-step-status">{macroStatusLabel(step.status)}</span>
                  {step.detail ? <span className="smoke-macro-step-detail">{step.detail}</span> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <div className="graph-ir-summary">
          <div>
            <span>Approved</span>
            <strong>{scaffoldPlan.modules.length}</strong>
          </div>
          <div>
            <span>Catalog-bound</span>
            <strong>{scaffoldPlan.manifest.catalog_bound_modules.length}</strong>
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
            {lastResponse.embedUrl ? (
              <>
                {" "}
                <span>{lastResponse.embedUrl}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <pre className="runtime-log">{log.join("\n\n")}</pre>
      </section>

      {embeddedUrl ? (
        <section className="panel adk-embed-panel">
          {isStubOutput ? (
            <div className="stub-banner" role="status">
              <strong>스텁 런타임</strong>
              <span>graph 구조만 검증합니다. 실제 모델/어댑터 호출은 발생하지 않습니다.</span>
            </div>
          ) : null}
          <div className="artifact-header">
            <div className="section-heading">
              <p className="eyebrow">ADK Web</p>
              <h2>embedded chat</h2>
            </div>
            <div className="runtime-status-strip">
              <span>{bundle.appName}</span>
              <span>{lastResponse?.port ? `:${lastResponse.port}` : `:${webPort}`}</span>
              <span>{lastResponse?.status ?? "ready"}</span>
            </div>
          </div>
          <div className="adk-embed-grid">
            <iframe
              title="Embedded ADK Web chat"
              className="adk-web-frame"
              src={embeddedUrl}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            />
            <aside className="adk-chat-result">
              <div className="section-heading">
                <p className="eyebrow">chat smoke</p>
                <h3>{lastResponse?.sessionId ?? "대기"}</h3>
              </div>
              {lastResponse?.checks?.length ? (
                <dl className="runtime-checks">
                  {lastResponse.checks.map((check) => (
                    <div key={check.name}>
                      <dt>{check.name}</dt>
                      <dd className={check.ok ? "ok" : "fail"}>{check.ok ? "OK" : "FAIL"}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <pre className="json-preview compact">{formatChatEvents(lastResponse)}</pre>
            </aside>
          </div>
        </section>
      ) : null}

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
  if (payload.sessionId) {
    return `${action} session=${payload.sessionId}\n${formatChatEvents(payload)}`;
  }
  if (payload.files) {
    return `generated ${payload.files.length} files at ${payload.outputRoot}`;
  }
  if (payload.embedUrl) {
    return `ADK Web ${payload.embedUrl}`;
  }
  if (payload.url) {
    return `ADK Web ${payload.url}`;
  }
  return `${action} completed`;
}

function formatChatEvents(payload: RuntimeResponse | null): string {
  if (!payload?.events) return "[]";
  return JSON.stringify(payload.events, null, 2);
}

function payloadStatus(
  action: RuntimeAction,
  payload: RuntimeResponse | null
): { ok: boolean; detail?: string } {
  if (!payload) return { ok: false, detail: "응답 없음" };
  if (payload.error) return { ok: false, detail: payload.error };
  if (Array.isArray(payload.steps)) {
    const failedStep = payload.steps.find((step) => step.exitCode !== 0);
    if (failedStep) return { ok: false, detail: `${failedStep.name} exit=${failedStep.exitCode}` };
  }
  if (typeof payload.exitCode === "number" && payload.exitCode !== 0) {
    return { ok: false, detail: `exit=${payload.exitCode}` };
  }
  if ((action === "check-web" || action === "chat-smoke") && Array.isArray(payload.checks) && payload.checks.length) {
    const failing = payload.checks.find((check) => !check.ok);
    if (failing) return { ok: false, detail: failing.name };
  }
  if (action === "chat-smoke" && (!Array.isArray(payload.events) || payload.events.length === 0)) {
    return { ok: false, detail: "events 없음" };
  }
  return { ok: true };
}

function macroStatusLabel(status: MacroStepStatus): string {
  if (status === "pending") return "대기";
  if (status === "running") return "실행 중";
  if (status === "ok") return "성공";
  return "실패";
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
