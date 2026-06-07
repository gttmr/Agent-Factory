import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { StageShell, useStageStep, type StageNextAction, type StageStep } from "../layout/StageShell";
import { useAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useApprovalGate } from "../state/useApprovalGate";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { useRecentRoots } from "../state/useRecentRoots";
import {
  useBuildRuntimeStub,
  useRuntimeStub,
  useSaveScaffoldPlan,
  useScaffoldPlan,
  fetchRuntimeStubFile
} from "../state/useScaffoldPlan";
import { useMockLabDiscovery, type MockLabDiscoveryPayload, type MockLabDiscoveryServer } from "../state/useMockLabDiscovery";
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import { buildScaffoldPlan } from "../analyzer/scaffoldPlan";
import type { ScaffoldOutputMode, ScaffoldPlan, ScaffoldPlanModule } from "../analyzer/types";
import type { CatalogEntry } from "../catalog/types";
import { loadSeedCatalog } from "../catalog/seed";
import type { ProcessStreamEvent } from "../state/useStreamingProcess";
import {
  applyMockLabBinding,
  buildMockLabRoute,
  isMcpBoundAdapter,
  type MockLabBindingSelection
} from "../mock-lab/mockLabIntegration";

interface StreamLogEntry {
  id: number;
  text: string;
}

type BuildStepId = "run" | "review" | "approve";
const BUILD_STEP_IDS: BuildStepId[] = ["run", "review", "approve"];

export default function BuildWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData } = useArtifactRoot(reqId);
  const { data: analysisData } = useAnalysisArtifact(reqId);
  const { data: scaffoldPlan, isLoading: scaffoldLoading } = useScaffoldPlan(reqId);
  const { data: runtimeStub } = useRuntimeStub(reqId);
  const saveScaffold = useSaveScaffoldPlan(reqId);
  const buildStub = useBuildRuntimeStub(reqId);
  const approvalMutation = useApprovalGate(reqId);
  const handoffArtifact = useTextArtifact(reqId, "implementation-handoff.md");
  const saveHandoff = useSaveTextArtifact(reqId, "implementation-handoff.md");

  const [outputMode, setOutputMode] = useState<ScaffoldOutputMode>("smoke");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [handoffDraft, setHandoffDraft] = useState<string>("");
  const [handoffDirty, setHandoffDirty] = useState(false);
  const [buildStreamLog, setBuildStreamLog] = useState<StreamLogEntry[]>([]);
  const [bindingOverrides, setBindingOverrides] = useState<Record<string, MockLabBindingSelection>>({});
  const buildStreamLogRef = useRef<HTMLPreElement | null>(null);
  const buildStreamSeq = useRef(0);

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;

  // catalog for buildScaffoldPlan
  const catalog = useQuery<CatalogEntry[]>({
    queryKey: ["af", "catalog-seed"] as const,
    queryFn: async () => loadSeedCatalog()
  });
  const catalogEntries = catalog.data ?? [];
  const mockLabDiscovery = useMockLabDiscovery(outputMode === "runnable");

  const generatedPlan = useMemo(() => {
    if (!analysis || !analysis.processFlow) return null;
    return buildScaffoldPlan({
      normalizedRequirement: analysis.normalizedRequirement,
      moduleCandidates: analysis.moduleCandidates,
      processFlow: analysis.processFlow,
      catalogEntries,
      runtimeContracts: analysis.runtimeContracts ?? [],
      outputMode
    });
  }, [analysis, catalogEntries, outputMode]);

  useEffect(() => {
    if (!scaffoldPlan?.modules) return;
    const next: Record<string, MockLabBindingSelection> = {};
    for (const module of scaffoldPlan.modules) {
      if (isMcpBoundAdapter(module)) {
        next[module.id] = {
          mcpServer: module.mcp_server!,
          mcpToolName: module.mcp_tool_name!,
          mcpSchemaRef: module.mcp_schema_ref ?? null
        };
      }
    }
    setBindingOverrides(next);
  }, [scaffoldPlan]);

  const effectivePlan = useMemo<ScaffoldPlan | null>(() => {
    if (!generatedPlan) return null;
    return Object.entries(bindingOverrides).reduce(
      (plan, [moduleId, selection]) => applyMockLabBinding(plan, moduleId, selection),
      generatedPlan
    );
  }, [bindingOverrides, generatedPlan]);

  // Adapter connection summary (mirrors the generator: a complete MCP binding
  // is connected, otherwise the adapter degrades to a synthetic stub).
  const adapterConnections = useMemo(() => {
    const adapters = (effectivePlan?.modules ?? []).filter((module) => module.module_category === "adapter");
    return {
      connected: adapters.filter(isMcpBoundAdapter),
      unconnected: adapters.filter((module) => !isMcpBoundAdapter(module))
    };
  }, [effectivePlan]);

  // The toggle drives the in-memory generatedPlan, but build consumes the saved
  // scaffold-plan.json. Reflect the persisted mode on load and flag unsaved drift.
  const savedMode: ScaffoldOutputMode | null = scaffoldPlan
    ? scaffoldPlan.output_mode === "runnable"
      ? "runnable"
      : "smoke"
    : null;
  const modeDirty = savedMode !== null && savedMode !== outputMode;

  // Reflect the persisted plan's mode in the toggle when it loads/changes.
  useEffect(() => {
    if (scaffoldPlan?.output_mode === "runnable" || scaffoldPlan?.output_mode === "smoke") {
      setOutputMode(scaffoldPlan.output_mode);
    }
  }, [scaffoldPlan?.output_mode]);

  useEffect(() => {
    if (!handoffDirty && handoffArtifact.data) setHandoffDraft(handoffArtifact.data.content);
  }, [handoffArtifact.data, handoffDirty]);
  useEffect(() => {
    const log = buildStreamLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [buildStreamLog]);

  const filePreview = useQuery<string>({
    queryKey: ["af", reqId, "runtime-stub", "files", previewPath] as const,
    queryFn: async () => {
      if (!reqId || !previewPath) return "";
      return await fetchRuntimeStubFile(reqId, previewPath);
    },
    enabled: Boolean(reqId && previewPath)
  });

  const boundariesApproved = manifest?.approvals.boundaries_approved ?? false;
  const runtimeApproved = manifest?.approvals.runtime_contracts_approved ?? false;
  const designGatesReady = boundariesApproved && runtimeApproved;
  const planReady = scaffoldPlan?.validation?.can_generate_source === true;
  const stubReady = (runtimeStub?.files?.length ?? 0) > 0;
  const stubApproved = manifest?.approvals.stub_ready_for_followup ?? false;

  const defaultStep: BuildStepId = !stubReady ? "run" : !stubApproved ? "review" : "approve";
  const [activeStep, setActiveStep] = useStageStep(BUILD_STEP_IDS, defaultStep);

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

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

  function handleBuildStub() {
    setActionMessage(null);
    setBuildStreamLog([]);
    buildStub.mutate({
      streamProgress: true,
      onEvent: appendBuildStreamEvent
    }, {
      onSuccess: (result) =>
        setActionMessage(
          result.ok
            ? `runtime-stub 생성 완료 (${result.files.length} 파일)`
            : `runtime-stub 생성 실패 (exit ${result.exit_code ?? "?"})`
        ),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "runtime-stub 생성 실패")
    });
  }

  function appendBuildStreamEvent(event: ProcessStreamEvent) {
    const text = formatProcessStreamLogLine(event);
    if (!text) return;
    buildStreamSeq.current += 1;
    setBuildStreamLog((entries) => [
      ...entries.slice(-199),
      { id: buildStreamSeq.current, text }
    ]);
  }

  function handleToggleStubReady() {
    if (!manifest) return;
    approvalMutation.mutate(
      {
        gate: "stub_ready_for_followup",
        value: !manifest.approvals.stub_ready_for_followup,
        etag: manifestEtag
      },
      {
        onSuccess: () => setActionMessage("stub_ready_for_followup 갱신 완료"),
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "갱신 실패")
      }
    );
  }

  function handleSaveHandoff() {
    saveHandoff.mutate(
      { content: handoffDraft, etag: handoffArtifact.data?.etag ?? null },
      {
        onSuccess: () => {
          setActionMessage("implementation-handoff.md 저장 완료");
          setHandoffDirty(false);
        },
        onError: (error) =>
          setActionMessage(error instanceof Error ? error.message : "implementation-handoff.md 저장 실패")
      }
    );
  }

  const blockers = scaffoldPlan?.validation?.blockers ?? effectivePlan?.validation?.blockers ?? [];
  const warnings = scaffoldPlan?.validation?.warnings ?? effectivePlan?.validation?.warnings ?? [];

  const steps: StageStep[] = [
    {
      id: "run",
      label: "1. 실행",
      hint: "scaffold·stub 생성",
      status: stubReady ? "done" : !designGatesReady ? "blocked" : activeStep === "run" ? "current" : "todo"
    },
    {
      id: "review",
      label: "2. 검토",
      hint: "stub·handoff",
      available: stubReady,
      status: !stubReady ? "todo" : activeStep === "review" ? "current" : "done"
    },
    {
      id: "approve",
      label: "3. 승인",
      hint: "stub_ready",
      available: stubReady,
      status: stubApproved
        ? "done"
        : !stubReady
          ? "todo"
          : activeStep === "approve"
            ? "current"
            : "todo"
    }
  ];

  const nextAction = buildBuildNextAction({
    activeStep: activeStep as BuildStepId,
    reqId,
    designGatesReady,
    planReady,
    stubReady,
    stubApproved,
    onAdvance: setActiveStep
  });

  const notice = actionMessage ? (
    <div className="af-stage-notice" role="status">
      <span>{actionMessage}</span>
    </div>
  ) : null;

  return (
    <StageShell
      eyebrow={`개발 · ${reqId}`}
      title="개발"
      steps={steps}
      activeStep={activeStep}
      onStepChange={setActiveStep}
      summary={
        <>
          <BuildSummaryItem label="출력 모드" value={outputMode} />
          <BuildSummaryItem label="모듈" value={effectivePlan ? `${effectivePlan.modules.length}개` : "—"} />
          <BuildSummaryItem label="stub 파일" value={`${runtimeStub?.files?.length ?? 0}개`} />
          <BuildSummaryItem label="게이트" value={stubApproved ? "stub_ready✓" : "stub_ready·"} />
        </>
      }
      nextAction={nextAction}
    >
      {notice}

      {activeStep === "run" ? (
        <>
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

          <Panel>
            <SectionHeader
              title="Scaffold plan"
              description="approved 상태 모듈과 승인된 runtime contract 만 포함됩니다. blockers 가 비어 있어야 runtime-stub 생성이 가능합니다."
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={!effectivePlan || !designGatesReady || saveScaffold.isPending}
                  onClick={handleSavePlan}
                >
                  {saveScaffold.isPending ? "저장 중…" : scaffoldPlan ? "scaffold-plan 재생성" : "scaffold-plan 생성"}
                </Button>
              }
            />
            <div className="af-output-mode-toggle" role="group" aria-label="출력 모드">
              <Button
                type="button"
                variant={outputMode === "smoke" ? "primary" : "ghost"}
                aria-pressed={outputMode === "smoke"}
                onClick={() => setOutputMode("smoke")}
              >
                smoke
              </Button>
              <Button
                type="button"
                variant={outputMode === "runnable" ? "primary" : "ghost"}
                aria-pressed={outputMode === "runnable"}
                onClick={() => setOutputMode("runnable")}
              >
                runnable
              </Button>
              <span className="af-output-mode-hint">
                {outputMode === "runnable"
                  ? "Gemini LlmAgent 그래프 + Mock Lab MCP 어댑터를 실행합니다. GOOGLE_API_KEY 는 .agent-factory/runtime.env 에 둡니다."
                  : "synthetic 스모크 핸드오프입니다 (LLM/키 불필요)."}
              </span>
            </div>
            {modeDirty ? (
              <p className="af-output-mode-dirty" role="status">
                저장된 scaffold-plan 은 <strong>{savedMode}</strong> 모드입니다. 현재 토글({outputMode})을 적용하려면 빌드 전에
                scaffold-plan 을 재생성하세요.
              </p>
            ) : null}
            {scaffoldLoading ? <p className="af-landing-message">scaffold-plan 불러오는 중…</p> : null}
            {!effectivePlan ? (
              <EmptyState
                title="분석 결과가 없습니다"
                description="Analyze 단계에서 analysis-result.json 을 먼저 import 하세요."
              />
            ) : (
              <ul className="af-gate-summary">
                <li>모듈 후보 → 승인된 모듈 {effectivePlan.modules.length}개 / 제외 {effectivePlan.excluded_modules.length}개</li>
                <li>런타임 계약 {effectivePlan.runtime_contracts.length}개</li>
                <li>can_generate_source: {effectivePlan.validation.can_generate_source ? "예" : "아니오"}</li>
                <li>blockers: {effectivePlan.validation.blockers.length}건, warnings: {effectivePlan.validation.warnings.length}건</li>
                {outputMode === "runnable" ? (
                  <li>
                    어댑터 MCP 바인딩(선언): 선언됨 {adapterConnections.connected.length} · 미선언{" "}
                    {adapterConnections.unconnected.length}
                    {adapterConnections.unconnected.length > 0
                      ? ` (미선언: ${adapterConnections.unconnected.map((module) => module.name).join(", ")})`
                      : ""}
                    . 실제 연결 여부는 실행 시 Mock Lab MCP discovery로 확인합니다.
                  </li>
                ) : null}
              </ul>
            )}
            {outputMode === "runnable" && effectivePlan ? (
              <MockLabBindingPanel
                plan={effectivePlan}
                discovery={mockLabDiscovery.data ?? null}
                discoveryLoading={mockLabDiscovery.isLoading}
                discoveryError={mockLabDiscovery.error}
                reqId={reqId}
                onChange={handleMockLabBinding}
              />
            ) : null}
            {blockers.length > 0 ? (
              <details open className="af-blocker-list">
                <summary>blockers ({blockers.length})</summary>
                <ul>
                  {blockers.map((entry, index) => (
                    <li key={index}>{entry}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {warnings.length > 0 ? (
              <details className="af-blocker-list">
                <summary>warnings ({warnings.length})</summary>
                <ul>
                  {warnings.map((entry, index) => (
                    <li key={index}>{entry}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            {scaffoldPlan ? (
              <details className="af-blocker-list">
                <summary>scaffold-plan.json 상세</summary>
                <pre>{JSON.stringify(scaffoldPlan, null, 2)}</pre>
              </details>
            ) : null}
          </Panel>

          <Panel>
            <SectionHeader
              title="Runtime stub 생성"
              description={
                outputMode === "runnable"
                  ? "scripts/generate-adk-source.mjs 를 spawn 하여 artifacts/af/<id>/runtime-stub/ 에 실행형 ADK 2.1 Workflow(Gemini LlmAgent + Mock Lab MCP 어댑터)를 생성합니다. 승인된 artifact 에서만 생성되며 private endpoint/credential/실데이터는 포함하지 않습니다."
                  : "scripts/generate-adk-source.mjs 를 spawn 하여 artifacts/af/<id>/runtime-stub/ 에 synthetic smoke stub 을 생성합니다. business logic 은 TODO 로만 남습니다."
              }
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={!planReady || !designGatesReady || buildStub.isPending}
                  onClick={handleBuildStub}
                >
                  {buildStub.isPending ? "생성 중…" : stubReady ? "runtime-stub 재생성" : "runtime-stub 생성"}
                </Button>
              }
            />
            {!planReady ? (
              <p className="af-landing-message">
                scaffold-plan 을 저장해 can_generate_source 가 통과되면 runtime-stub 을 생성할 수 있습니다.
              </p>
            ) : null}
            {buildStreamLog.length > 0 ? (
              <div className="af-stream-log-panel">
                <div className="af-stream-log-header">
                  <strong>실시간 로그</strong>
                  <span>{buildStub.isPending ? "실행 중" : "마지막 실행"}</span>
                </div>
                <pre ref={buildStreamLogRef} className="af-stream-log">
                  {buildStreamLog.map((entry) => entry.text).join("")}
                </pre>
              </div>
            ) : null}
            {buildStub.data?.stdout ? (
              <details className="af-blocker-list">
                <summary>generate-adk-source stdout</summary>
                <pre>{buildStub.data.stdout}</pre>
              </details>
            ) : null}
            {buildStub.data?.stderr ? (
              <details className="af-blocker-list">
                <summary>generate-adk-source stderr</summary>
                <pre>{buildStub.data.stderr}</pre>
              </details>
            ) : null}
          </Panel>
        </>
      ) : null}

      {activeStep === "review" ? (
        <>
          <Panel>
            <SectionHeader
              title="Runtime stub 파일"
              description="생성된 stub 파일을 열어 ADK Workflow·어댑터·테스트 구성을 확인하세요."
            />
            {!stubReady ? (
              <EmptyState title="아직 runtime-stub 이 없습니다" description="‘1. 실행’에서 scaffold-plan 저장 후 stub 을 생성하세요." />
            ) : (
              <div className="af-build-stub-grid">
                <ul className="af-build-file-list">
                  {runtimeStub!.files.map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        className={`af-build-file-button${previewPath === file.path ? " af-build-file-button-active" : ""}`}
                        onClick={() => setPreviewPath(file.path)}
                      >
                        <code>{file.path}</code>
                        <small>{file.bytes.toLocaleString()} bytes</small>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="af-build-file-preview">
                  {previewPath ? (
                    filePreview.isLoading ? (
                      <p className="af-landing-message">파일 불러오는 중…</p>
                    ) : filePreview.error ? (
                      <p className="af-landing-error">{(filePreview.error as Error).message}</p>
                    ) : (
                      <pre>{filePreview.data}</pre>
                    )
                  ) : (
                    <p className="af-landing-message">왼쪽에서 파일을 선택하세요.</p>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <SectionHeader
              title="implementation-handoff.md"
              description="다음 구현자가 받아야 할 TODO 목록과 범위 밖 항목을 markdown 으로 정리하세요."
              action={
                <Button
                  type="button"
                  variant="primary"
                  disabled={saveHandoff.isPending || !handoffDirty}
                  onClick={handleSaveHandoff}
                >
                  {saveHandoff.isPending ? "저장 중…" : "저장"}
                </Button>
              }
            />
            <textarea
              value={handoffDraft}
              onChange={(event) => {
                setHandoffDraft(event.target.value);
                setHandoffDirty(true);
              }}
              rows={12}
              className="af-markdown-editor"
              placeholder="# Implementation handoff&#10;&#10;- [ ] 모듈 A 의 runtime wiring …"
            />
          </Panel>
        </>
      ) : null}

      {activeStep === "approve" ? (
        manifest ? (
          <Panel tone="muted">
            <SectionHeader
              title="Gate: stub_ready_for_followup"
              description={
                stubReady
                  ? "runtime-stub 파일이 존재합니다. 후속 작업으로 인계할 준비가 되었다면 토글하세요."
                  : "runtime-stub 을 먼저 생성해야 합니다."
              }
              action={
                <Button
                  type="button"
                  variant={manifest.approvals.stub_ready_for_followup ? "secondary" : "primary"}
                  onClick={handleToggleStubReady}
                  disabled={approvalMutation.isPending || (!manifest.approvals.stub_ready_for_followup && !stubReady)}
                >
                  {approvalMutation.isPending
                    ? "갱신 중…"
                    : manifest.approvals.stub_ready_for_followup
                      ? "준비 표시 해제"
                      : "후속 인계 준비 완료"}
                </Button>
              }
            />
            <ul className="af-gate-summary">
              <li>boundaries_approved: {boundariesApproved ? "예" : "아니오"}</li>
              <li>runtime_contracts_approved: {runtimeApproved ? "예" : "아니오"}</li>
              <li>scaffold-plan can_generate_source: {planReady ? "예" : "아니오"}</li>
              <li>runtime-stub 파일: {runtimeStub?.files.length ?? 0}개</li>
            </ul>
          </Panel>
        ) : (
          <Panel>
            <EmptyState title="manifest 없음" description="af-run-manifest.json 을 확인하세요." />
          </Panel>
        )
      ) : null}
    </StageShell>
  );
}

function BuildSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MockLabBindingPanel({
  plan,
  discovery,
  discoveryLoading,
  discoveryError,
  reqId,
  onChange
}: {
  plan: ScaffoldPlan;
  discovery: MockLabDiscoveryPayload | null;
  discoveryLoading: boolean;
  discoveryError: unknown;
  reqId: string;
  onChange: (module: ScaffoldPlanModule, value: string) => void;
}) {
  const adapters = plan.modules.filter((module) => module.module_category === "adapter");
  const options = mockLabToolOptions(discovery);
  return (
    <div className="af-mcp-binding-panel">
      <div className="af-mcp-binding-header">
        <div>
          <strong>Mock Lab MCP 바인딩</strong>
          <p>running Mock Lab tool을 명시적으로 선택해야 generated ADK adapter가 live MCP를 호출합니다.</p>
        </div>
        <Link className="ui-button ui-button-secondary" to={buildMockLabRoute({ reqId })}>
          Mock Lab 열기
        </Link>
      </div>
      {discoveryLoading ? <p className="af-landing-message">Mock Lab discovery 조회 중…</p> : null}
      {discoveryError ? (
        <p className="af-landing-error">{discoveryError instanceof Error ? discoveryError.message : "Mock Lab discovery 조회 실패"}</p>
      ) : null}
      {!discoveryLoading && options.length === 0 ? (
        <p className="af-landing-message">실행 중인 Mock Lab tool이 없습니다. Mock Lab에서 server를 start한 뒤 다시 선택하세요.</p>
      ) : null}
      <div className="af-mcp-binding-list">
        {adapters.map((module) => {
          const selectedValue = selectedMockLabValue(module, options);
          return (
            <div className="af-mcp-binding-row" key={module.id}>
              <div className="af-mcp-binding-module">
                <strong>{module.name}</strong>
                <code>{module.id}</code>
                {isMcpBoundAdapter(module) ? (
                  <span>
                    bound: {module.mcp_server} / {module.mcp_tool_name}
                  </span>
                ) : (
                  <span>unconnected synthetic stub</span>
                )}
              </div>
              <select
                value={selectedValue}
                onChange={(event) => onChange(module, event.currentTarget.value)}
                disabled={options.length === 0}
                aria-label={`${module.name} Mock Lab MCP tool 선택`}
              >
                <option value="">선택 안 함</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Link className="ui-button ui-button-ghost" to={buildMockLabRoute({ adapterName: module.name, reqId })}>
                Mock 만들기
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MockLabToolOption {
  value: string;
  label: string;
  server: MockLabDiscoveryServer;
  toolName: string;
}

function mockLabToolOptions(discovery: MockLabDiscoveryPayload | null): MockLabToolOption[] {
  return (discovery?.servers ?? [])
    .filter((server) => server.running)
    .flatMap((server) =>
      (server.tools ?? []).map((toolName) => ({
        value: `${server.mock_id}::${toolName}`,
        label: `${server.mock_id} · ${toolName}`,
        server,
        toolName
      }))
    );
}

function selectedMockLabValue(module: ScaffoldPlanModule, options: MockLabToolOption[]): string {
  if (!module.mcp_server || !module.mcp_tool_name) return "";
  const match = options.find(
    (option) =>
      option.toolName === module.mcp_tool_name &&
      (option.server.mock_id === module.mcp_server ||
        option.server.server_name === module.mcp_server ||
        option.server.catalog_entry_name === module.mcp_server)
  );
  return match?.value ?? "";
}

function buildBuildNextAction({
  activeStep,
  reqId,
  designGatesReady,
  planReady,
  stubReady,
  stubApproved,
  onAdvance
}: {
  activeStep: BuildStepId;
  reqId: string;
  designGatesReady: boolean;
  planReady: boolean;
  stubReady: boolean;
  stubApproved: boolean;
  onAdvance: (id: BuildStepId) => void;
}): StageNextAction {
  if (activeStep === "run") {
    return {
      label: "검토로 →",
      onClick: () => onAdvance("review"),
      disabled: !stubReady,
      hint: stubReady
        ? "runtime-stub 이 생성됐습니다. ‘2. 검토’에서 파일과 handoff 를 확인하세요."
        : !designGatesReady
          ? "Design 단계에서 boundaries_approved · runtime_contracts_approved 를 먼저 통과하세요."
          : !planReady
            ? "scaffold-plan 을 생성·저장해 can_generate_source 를 통과시키세요."
            : "scaffold-plan 저장 후 runtime-stub 을 생성하세요."
    };
  }
  if (activeStep === "review") {
    return {
      label: "승인으로 →",
      onClick: () => onAdvance("approve"),
      disabled: !stubReady,
      hint: "stub 파일과 handoff 를 확인했다면 ‘3. 승인’에서 stub_ready_for_followup 게이트를 토글하세요."
    };
  }
  return {
    label: "검증 단계로 →",
    to: `/af/${reqId}/verify`,
    disabled: !stubApproved,
    hint: stubApproved
      ? "후속 인계 준비가 끝났습니다. 검증(Verify) 단계로 이동하세요."
      : "stub_ready_for_followup 게이트를 통과하면 다음 단계로 갈 수 있습니다."
  };
}

function formatProcessStreamLogLine(event: ProcessStreamEvent): string {
  const data = event.data;
  if (event.event === "stdout" || event.event === "stderr") {
    return `[${event.event}] ${withTrailingNewline(valueToString(data.chunk))}`;
  }
  if (event.event === "start") {
    return `[start] ${valueToString(data.command ?? data.command_key ?? "process")}\n`;
  }
  if (event.event === "done") {
    return `[done] exit ${valueToString(data.exit_code ?? 0)}\n`;
  }
  if (event.event === "error") {
    return `[error] ${valueToString(data.error ?? data.message ?? "실패")}\n`;
  }
  return `[${event.event}] ${JSON.stringify(data)}\n`;
}

function valueToString(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function withTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
