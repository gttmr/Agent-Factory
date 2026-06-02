import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Field, Panel, SectionHeader } from "../ui/primitives";
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
import { useSaveTextArtifact, useTextArtifact } from "../state/useTextArtifact";
import {
  useCreateRuntimeChatSession,
  useInstallRuntimeChat,
  useRuntimeChatStatus,
  useSendRuntimeChatMessage,
  useStartRuntimeChat,
  useStopRuntimeChat
} from "../state/useRuntimeChat";
import { buildScaffoldPlan } from "../analyzer/scaffoldPlan";
import type { ScaffoldOutputMode } from "../analyzer/types";
import type { CatalogEntry } from "../catalog/types";
import { loadSeedCatalog } from "../catalog/seed";
import type { ProcessStreamEvent } from "../state/useStreamingProcess";

interface StreamLogEntry {
  id: number;
  text: string;
}

interface ChatLogEntry {
  id: number;
  role: "user" | "assistant" | "system";
  text: string;
}

export default function BuildWorkbench() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const navigate = useNavigate();
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: manifestData } = useArtifactRoot(reqId);
  const { data: analysisData } = useAnalysisArtifact(reqId);
  const { data: scaffoldPlan, isLoading: scaffoldLoading } = useScaffoldPlan(reqId);
  const { data: runtimeStub } = useRuntimeStub(reqId);
  const runtimeChatReqId = reqId && runtimeStub?.exists ? reqId : undefined;
  const runtimeChatStatus = useRuntimeChatStatus(runtimeChatReqId);
  const installRuntimeChat = useInstallRuntimeChat(reqId);
  const startRuntimeChat = useStartRuntimeChat(reqId);
  const stopRuntimeChat = useStopRuntimeChat(reqId);
  const createRuntimeSession = useCreateRuntimeChatSession(reqId);
  const sendRuntimeMessage = useSendRuntimeChatMessage(reqId);
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
  const [runtimeUserId, setRuntimeUserId] = useState("af-reviewer");
  const [runtimeSessionId, setRuntimeSessionId] = useState("");
  const [runtimeMessage, setRuntimeMessage] = useState("대출 사전심사 synthetic demo 결과를 요약해줘.");
  const [chatLog, setChatLog] = useState<ChatLogEntry[]>([]);
  const buildStreamLogRef = useRef<HTMLPreElement | null>(null);
  const buildStreamSeq = useRef(0);
  const chatLogSeq = useRef(0);

  const manifest = manifestData?.manifest;
  const manifestEtag = manifestData?.etag ?? null;
  const analysis = analysisData?.data ?? null;

  // catalog for buildScaffoldPlan
  const catalog = useQuery<CatalogEntry[]>({
    queryKey: ["af", "catalog-seed"] as const,
    queryFn: async () => loadSeedCatalog()
  });
  const catalogEntries = catalog.data ?? [];

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

  // Adapter connection summary (mirrors the generator: a complete MCP binding
  // is connected, otherwise the adapter degrades to a synthetic stub).
  const adapterConnections = useMemo(() => {
    const adapters = (generatedPlan?.modules ?? []).filter((module) => module.module_category === "adapter");
    const isConnected = (module: (typeof adapters)[number]) =>
      module.access_protocol === "mcp" && Boolean(module.mcp_server) && Boolean(module.mcp_tool_name);
    return {
      connected: adapters.filter(isConnected),
      unconnected: adapters.filter((module) => !isConnected(module))
    };
  }, [generatedPlan]);

  // The toggle drives the in-memory generatedPlan, but build consumes the saved
  // scaffold-plan.json. Reflect the persisted mode on load and flag unsaved drift.
  const savedMode: ScaffoldOutputMode | null = scaffoldPlan
    ? scaffoldPlan.output_mode === "runnable"
      ? "runnable"
      : "smoke"
    : null;
  const modeDirty = savedMode !== null && savedMode !== outputMode;

  // Reflect the persisted plan's mode in the toggle when it loads/changes.
  // (Only changes when the saved file changes, so it never fights a user toggle.)
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

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id 가 없습니다" description="Landing 에서 artifact root 를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">Landing 으로</Link>
      </Panel>
    );
  }

  const boundariesApproved = manifest?.approvals.boundaries_approved ?? false;
  const runtimeApproved = manifest?.approvals.runtime_contracts_approved ?? false;
  const designGatesReady = boundariesApproved && runtimeApproved;
  const planReady = scaffoldPlan?.validation?.can_generate_source === true;
  const stubReady = (runtimeStub?.files?.length ?? 0) > 0;

  function handleSavePlan() {
    if (!generatedPlan) return;
    saveScaffold.mutate(generatedPlan, {
      onSuccess: () => setActionMessage("scaffold-plan.json 저장 완료"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "저장 실패")
    });
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

  function handleInstallRuntimeChat() {
    setActionMessage(null);
    installRuntimeChat.mutate(undefined, {
      onSuccess: (result) =>
        setActionMessage(result.ok ? "ADK dependency 설치 완료" : "ADK dependency 설치 실패"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK dependency 설치 실패")
    });
  }

  function handleStartRuntimeChat() {
    setActionMessage(null);
    startRuntimeChat.mutate(undefined, {
      onSuccess: (result) => setActionMessage(`ADK runtime 시작: ${result.status.api_base_url}`),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK runtime 시작 실패")
    });
  }

  function handleStopRuntimeChat() {
    setActionMessage(null);
    stopRuntimeChat.mutate(undefined, {
      onSuccess: () => setActionMessage("ADK runtime 중지 요청 완료"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK runtime 중지 실패")
    });
  }

  function handleCreateRuntimeSession() {
    setActionMessage(null);
    createRuntimeSession.mutate(
      { user_id: runtimeUserId, session_id: runtimeSessionId || undefined },
      {
        onSuccess: (result) => {
          setRuntimeUserId(result.user_id);
          setRuntimeSessionId(result.session_id);
          appendChatLog("system", `session ready: ${result.session_id}`);
        },
        onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK session 생성 실패")
      }
    );
  }

  function handleSendRuntimeMessage() {
    const text = runtimeMessage.trim();
    if (!text || !runtimeSessionId.trim()) return;
    appendChatLog("user", text);
    sendRuntimeMessage.mutate(
      { user_id: runtimeUserId, session_id: runtimeSessionId, text },
      {
        onSuccess: (result) => {
          appendChatLog(
            "assistant",
            result.final_text || `ADK events ${result.events.length}건 수신 (text 응답 없음)`
          );
        },
        onError: (error) => appendChatLog("system", error instanceof Error ? error.message : "ADK message 전송 실패")
      }
    );
  }

  function appendChatLog(role: ChatLogEntry["role"], text: string) {
    chatLogSeq.current += 1;
    setChatLog((entries) => [
      ...entries.slice(-49),
      { id: chatLogSeq.current, role, text }
    ]);
  }

  const blockers = scaffoldPlan?.validation?.blockers ?? generatedPlan?.validation?.blockers ?? [];
  const warnings = scaffoldPlan?.validation?.warnings ?? generatedPlan?.validation?.warnings ?? [];

  return (
    <div className="af-stage-workspace">
      <Panel>
        <SectionHeader
          eyebrow={`af-build-runtime-stub · ${reqId}`}
          title="Runtime stub 생성"
          description="boundaries_approved 와 runtime_contracts_approved 가 모두 켜져 있어야 scaffold-plan 생성과 stub build 가 활성화됩니다. 원문 요구사항에서 직접 코드를 만들지 않습니다 — 승인된 scaffold-plan 만 입력으로 사용합니다."
          action={
            <div className="af-action-row">
              <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/design`}>Design 으로</Link>
              <Link className="ui-button ui-button-ghost" to={`/af/${reqId}/verify`}>Verify 로</Link>
            </div>
          }
        />
        {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}
        {!designGatesReady ? (
          <p className="af-landing-error">
            게이트 미충족: boundaries_approved={boundariesApproved ? "예" : "아니오"}, runtime_contracts_approved={runtimeApproved ? "예" : "아니오"}.
            Design 단계에서 게이트를 먼저 통과시키세요.
          </p>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeader
          title="ADK Chat 연결"
          description="runtime-stub 안에 ADK dependency 를 설치하고, workbench 와 분리된 8765 포트의 ADK API/Web UI 로 실제 chat smoke 를 실행합니다."
          action={
            runtimeChatStatus.data ? (
              <a className="ui-button ui-button-ghost" href={runtimeChatStatus.data.web_url} target="_blank" rel="noreferrer">
                ADK Web 열기
              </a>
            ) : null
          }
        />
        {!stubReady ? (
          <EmptyState title="runtime-stub 이 필요합니다" description="stub 을 생성한 뒤 ADK dependency 설치와 chat smoke 를 실행할 수 있습니다." />
        ) : runtimeChatStatus.error ? (
          <p className="af-landing-error">{(runtimeChatStatus.error as Error).message}</p>
        ) : (
          <>
            <ul className="af-gate-summary">
              <li>app: {runtimeChatStatus.data?.app_name ?? "확인 중"}</li>
              <li>ADK dependency: {runtimeChatStatus.data?.installed ? "설치됨" : "미설치"}</li>
              <li>server: {runtimeChatStatus.data?.server.status ?? "확인 중"}</li>
              <li>port: {runtimeChatStatus.data?.port ?? 8765}</li>
            </ul>
            <div className="af-action-row">
              <Button
                type="button"
                variant="primary"
                disabled={installRuntimeChat.isPending}
                onClick={handleInstallRuntimeChat}
              >
                {installRuntimeChat.isPending ? "설치 중…" : "ADK dependency 설치"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!runtimeChatStatus.data?.installed || startRuntimeChat.isPending}
                onClick={handleStartRuntimeChat}
              >
                {startRuntimeChat.isPending ? "시작 중…" : "ADK runtime 시작"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={runtimeChatStatus.data?.server.status !== "running" || stopRuntimeChat.isPending}
                onClick={handleStopRuntimeChat}
              >
                {stopRuntimeChat.isPending ? "중지 중…" : "중지"}
              </Button>
            </div>
            {installRuntimeChat.data?.stdout ? (
              <details className="af-blocker-list">
                <summary>pip install stdout</summary>
                <pre>{installRuntimeChat.data.stdout}</pre>
              </details>
            ) : null}
            {runtimeChatStatus.data?.server.stderr_tail ? (
              <details className="af-blocker-list">
                <summary>ADK stderr</summary>
                <pre>{runtimeChatStatus.data.server.stderr_tail}</pre>
              </details>
            ) : null}
            <div className="af-runtime-chat-grid">
              <div className="af-runtime-chat-controls">
                <Field label="user_id">
                  <input value={runtimeUserId} onChange={(event) => setRuntimeUserId(event.target.value)} />
                </Field>
                <Field label="session_id">
                  <input
                    value={runtimeSessionId}
                    onChange={(event) => setRuntimeSessionId(event.target.value)}
                    placeholder="비우면 자동 생성"
                  />
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={runtimeChatStatus.data?.server.status !== "running" || createRuntimeSession.isPending}
                  onClick={handleCreateRuntimeSession}
                >
                  {createRuntimeSession.isPending ? "생성 중…" : "session 생성"}
                </Button>
              </div>
              <div className="af-runtime-chat-surface">
                <div className="af-runtime-chat-log" aria-live="polite">
                  {chatLog.length === 0 ? (
                    <p className="af-landing-message">session 을 만든 뒤 smoke 메시지를 전송하세요.</p>
                  ) : (
                    chatLog.map((entry) => (
                      <div key={entry.id} className={`af-chat-message af-chat-message-${entry.role}`}>
                        <span>{entry.role}</span>
                        <p>{entry.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="af-runtime-chat-compose">
                  <textarea
                    value={runtimeMessage}
                    onChange={(event) => setRuntimeMessage(event.target.value)}
                    rows={3}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    disabled={
                      runtimeChatStatus.data?.server.status !== "running" ||
                      !runtimeSessionId.trim() ||
                      !runtimeMessage.trim() ||
                      sendRuntimeMessage.isPending
                    }
                    onClick={handleSendRuntimeMessage}
                  >
                    {sendRuntimeMessage.isPending ? "전송 중…" : "전송"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          title="Scaffold plan"
          description="approved 상태 모듈과 승인된 runtime contract 만 포함됩니다. blockers 가 비어 있어야 runtime-stub 생성이 가능합니다."
          action={
            <Button
              type="button"
              variant="primary"
              disabled={!generatedPlan || !designGatesReady || saveScaffold.isPending}
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
              ? "Gemini LlmAgent 그래프 + Mock Lab MCP 어댑터를 실행합니다. runtime-stub/.env 에 GOOGLE_API_KEY 가 필요합니다."
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
        {!generatedPlan ? (
          <EmptyState
            title="분석 결과가 없습니다"
            description="Analyze 단계에서 analysis-result.json 을 먼저 import 하세요."
          />
        ) : (
          <ul className="af-gate-summary">
            <li>모듈 후보 → 승인된 모듈 {generatedPlan.modules.length}개 / 제외 {generatedPlan.excluded_modules.length}개</li>
            <li>런타임 계약 {generatedPlan.runtime_contracts.length}개</li>
            <li>can_generate_source: {generatedPlan.validation.can_generate_source ? "예" : "아니오"}</li>
            <li>blockers: {generatedPlan.validation.blockers.length}건, warnings: {generatedPlan.validation.warnings.length}건</li>
            {outputMode === "runnable" ? (
              <li>
                어댑터 MCP 연결: connected {adapterConnections.connected.length} · unconnected{" "}
                {adapterConnections.unconnected.length}
                {adapterConnections.unconnected.length > 0
                  ? ` (미연결: ${adapterConnections.unconnected.map((module) => module.name).join(", ")})`
                  : ""}
              </li>
            ) : null}
          </ul>
        )}
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
          title="Runtime stub"
          description="scripts/generate-adk-source.mjs 를 spawn 하여 artifacts/af/<id>/runtime-stub/ 에 ADK 2.0 stub 을 생성합니다. business logic 은 TODO 로만 남습니다."
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
        {!stubReady ? (
          <EmptyState title="아직 runtime-stub 이 없습니다" description="scaffold-plan 을 저장한 뒤 위 버튼으로 생성하세요." />
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
          rows={10}
          className="af-markdown-editor"
          placeholder="# Implementation handoff&#10;&#10;- [ ] 모듈 A 의 runtime wiring …"
        />
      </Panel>

      {manifest ? (
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
          <div className="af-action-row">
            <Button type="button" variant="ghost" onClick={() => navigate(`/af/${reqId}/verify`)}>
              Verify 워크벤치로 이동
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
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
