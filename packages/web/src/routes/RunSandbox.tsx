import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useAnalysisArtifact } from "../state/useAnalysisArtifact";
import { useRecentRoots } from "../state/useRecentRoots";
import { useRuntimeStub } from "../state/useScaffoldPlan";
import {
  useRuntimeChatInputRequired,
  useRuntimeChatStatus,
  useStartRuntimeChat,
  useStopRuntimeChat
} from "../state/useRuntimeChat";
import { useRuntimeA2aStatus } from "../state/useRuntimeA2a";
import { MockLabPrerequisiteRows } from "./run/MockLabPrerequisiteRows";
import { RuntimeA2aProviderPanel } from "./run/RuntimeA2aProviderPanel";
import { runtimeA2aProviderTarget } from "./run/runtimeA2aProviderTarget";
import { remoteInputRequiredView } from "./run/runtimeInputRequiredView";

export default function RunSandbox() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: runtimeStub } = useRuntimeStub(reqId);
  const { data: analysisData } = useAnalysisArtifact(reqId);
  const stubReady = Boolean(runtimeStub?.exists) && (runtimeStub?.files?.length ?? 0) > 0;
  const statusReqId = reqId && stubReady ? reqId : undefined;
  const a2aProviderTarget = reqId && analysisData !== undefined ? runtimeA2aProviderTarget(analysisData?.data) : null;
  const a2aStatusReqId = stubReady ? a2aProviderTarget?.reqId : undefined;
  const chatStatus = useRuntimeChatStatus(statusReqId);
  const chatInputRequired = useRuntimeChatInputRequired(statusReqId);
  const a2aStatus = useRuntimeA2aStatus(a2aStatusReqId);
  const startRuntime = useStartRuntimeChat(reqId);
  const stopRuntime = useStopRuntimeChat(reqId);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!reqId) {
    return (
      <Panel>
        <EmptyState title="requirement_id가 없습니다" description="Landing 페이지에서 artifact root를 선택하세요." />
        <Link className="ui-button ui-button-secondary" to="/">
          Landing으로
        </Link>
      </Panel>
    );
  }

  function handleStart() {
    setActionMessage(null);
    startRuntime.mutate(undefined, {
      onSuccess: (result) => setActionMessage(`ADK runtime 시작: ${result.status.api_base_url}`),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK runtime 시작 실패")
    });
  }

  function handleStop() {
    setActionMessage(null);
    stopRuntime.mutate(undefined, {
      onSuccess: (result) => setActionMessage(result.ok ? "ADK runtime 중지 요청 완료" : result.message ?? "ADK runtime 중지 대상 없음"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK runtime 중지 실패")
    });
  }

  function handleRestart() {
    setActionMessage(null);
    stopRuntime.mutate(undefined, {
      onSuccess: () => {
        startRuntime.mutate(undefined, {
          onSuccess: (result) => setActionMessage(`ADK runtime 재시작: ${result.status.api_base_url}`),
          onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK runtime 재시작 실패")
        });
      },
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK runtime 중지 실패")
    });
  }

  const serverStatus = chatStatus.data?.server.status ?? "stopped";
  const isRunning = serverStatus === "running";
  const canStop = Boolean(chatStatus.data?.server.can_stop) || serverStatus === "failed";
  const isStale = Boolean(chatStatus.data?.server.stale);
  const webUrl = chatStatus.data?.web_url ?? null;
  const remoteInputRequired = a2aProviderTarget
    ? remoteInputRequiredView(chatInputRequired.data?.input_required, a2aStatus.data)
    : remoteInputRequiredView(null, null);

  return (
    <div className="af-run-shell">
      <Panel>
        <SectionHeader
          eyebrow={`실행 · ${reqId}`}
          title="ADK 런타임 실행"
          description="생성된 ADK 번들을 8765 포트에 띄우고, ADK 공식 dev UI(채팅·이벤트·트레이스)로 실제 동작을 확인합니다. 승인 게이트가 없는 도구 화면입니다."
        />
        {actionMessage ? <p className="af-landing-message">{actionMessage}</p> : null}

        {!stubReady ? (
          <>
            <EmptyState
              title="runtime-stub 이 필요합니다"
              description="개발(Build) 단계에서 runtime-stub 을 먼저 생성하면 공유 ADK runtime 으로 실행할 수 있습니다."
            />
            <Link className="ui-button ui-button-secondary" to={`/af/${reqId}/build`}>
              개발 단계로 이동
            </Link>
          </>
        ) : chatStatus.error ? (
          <p className="af-landing-error">{(chatStatus.error as Error).message}</p>
        ) : (
          <>
            <ul className="af-gate-summary">
              <li>app: {chatStatus.data?.app_name ?? "확인 중"}</li>
              <li>shared venv: {chatStatus.data?.installed ? "준비됨" : "미준비"}</li>
              <li>venv: {chatStatus.data?.paths.venv ?? "확인 중"}</li>
              <li>server: {serverStatus}</li>
              <li>port: {chatStatus.data?.port ?? 8765}</li>
              {chatStatus.data?.server.pid ? <li>pid: {chatStatus.data.server.pid}</li> : null}
              {!chatStatus.data?.server.pid && chatStatus.data?.server.port_owner_pid ? <li>port owner pid: {chatStatus.data.server.port_owner_pid}</li> : null}
            </ul>
            {chatStatus.data?.server.message ? <p className="af-landing-error">{chatStatus.data.server.message}</p> : null}
            {isStale ? (
              <p className="af-landing-error">
                runtime-stub 이 실행 이후 변경되었습니다. 현재 ADK runtime 은 이전 bundle 로 동작하므로 재시작해야 변경분이 반영됩니다.
              </p>
            ) : null}
            {!chatStatus.data?.installed && chatStatus.data?.setup_hint ? (
              <p className="af-landing-message">{chatStatus.data.setup_hint}</p>
            ) : null}
            <MockLabPrerequisiteRows
              prerequisites={chatStatus.data?.mock_lab_prerequisites}
              invalidateQueryKeys={[["af", reqId, "runtime-chat"]]}
              onActionMessage={setActionMessage}
            />
            <div className="af-action-row">
              <Button
                type="button"
                variant="primary"
                disabled={!chatStatus.data?.installed || startRuntime.isPending}
                onClick={handleStart}
              >
                {startRuntime.isPending ? "시작 중…" : "ADK runtime 시작"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!canStop || stopRuntime.isPending}
                onClick={handleStop}
              >
                {stopRuntime.isPending ? "중지 중…" : "중지"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!isStale || !canStop || stopRuntime.isPending || startRuntime.isPending}
                onClick={handleRestart}
              >
                {stopRuntime.isPending || startRuntime.isPending ? "재시작 중…" : "재시작"}
              </Button>
            </div>
            {chatStatus.data?.server.stderr_tail ? (
              <details className="af-blocker-list">
                <summary>ADK stderr</summary>
                <pre>{chatStatus.data.server.stderr_tail}</pre>
              </details>
            ) : null}
          </>
        )}
      </Panel>

      {stubReady ? (
        <Panel>
          <SectionHeader
            title="ADK 웹 UI"
            description={
              a2aProviderTarget
                ? "ADK 가 제공하는 공식 dev UI 입니다. 채팅·세션·이벤트·트레이스를 모두 지원합니다. Remote A2A input-required 는 ADK Web 텍스트 채팅이 아니라 아래 Workbench resume 으로 같은 task 에 응답합니다."
                : "ADK 가 제공하는 공식 dev UI 입니다. 채팅·세션·이벤트·트레이스로 현재 artifact runtime 을 확인합니다."
            }
          />
          {isRunning && webUrl ? (
            <div className="af-run-weblink">
              <a className="ui-button ui-button-primary" href={webUrl} target="_blank" rel="noreferrer">
                ADK 웹 UI 열기 ↗
              </a>
              <code className="af-run-weburl">{webUrl}</code>
            </div>
          ) : (
            <EmptyState
              title="ADK runtime 이 실행 중이 아닙니다"
              description="공유 ADK runtime venv 를 준비한 뒤 ‘ADK runtime 시작’ 을 누르면 dev UI 링크가 활성화됩니다."
            />
          )}
        </Panel>
      ) : null}

      {stubReady && a2aProviderTarget ? (
        <RuntimeA2aProviderPanel
          consumerReqId={reqId}
          target={a2aProviderTarget}
          status={a2aStatus.data}
          inputRequired={remoteInputRequired}
          error={a2aStatus.error}
          onActionMessage={setActionMessage}
        />
      ) : null}
    </div>
  );
}
