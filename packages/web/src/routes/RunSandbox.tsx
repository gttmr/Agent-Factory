import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, Panel, SectionHeader } from "../ui/primitives";
import { useRecentRoots } from "../state/useRecentRoots";
import { useRuntimeStub } from "../state/useScaffoldPlan";
import {
  useInstallRuntimeChat,
  useRuntimeChatStatus,
  useStartRuntimeChat,
  useStopRuntimeChat
} from "../state/useRuntimeChat";

/**
 * ADK 런타임 실행 화면 — 승인 게이트가 없는 도구 화면.
 *
 * 생성된 ADK 번들의 dependency 를 설치하고 `adk api_server … --with_ui` 를
 * 8765 포트에 띄운 뒤, ADK 공식 dev UI(채팅·이벤트·트레이스) 로 링크한다.
 * AF 자체 간이 챗은 ADK dev UI 와 중복이라 제공하지 않는다.
 */
export default function RunSandbox() {
  const params = useParams<{ reqId: string }>();
  const reqId = params.reqId;
  const { touch } = useRecentRoots();
  useEffect(() => {
    if (reqId) touch(reqId);
  }, [reqId, touch]);

  const { data: runtimeStub } = useRuntimeStub(reqId);
  const stubReady = Boolean(runtimeStub?.exists) && (runtimeStub?.files?.length ?? 0) > 0;
  const statusReqId = reqId && stubReady ? reqId : undefined;
  const status = useRuntimeChatStatus(statusReqId);
  const installRuntime = useInstallRuntimeChat(reqId);
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

  function handleInstall() {
    setActionMessage(null);
    installRuntime.mutate(undefined, {
      onSuccess: (result) => setActionMessage(result.ok ? "ADK dependency 설치 완료" : "ADK dependency 설치 실패"),
      onError: (error) => setActionMessage(error instanceof Error ? error.message : "ADK dependency 설치 실패")
    });
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

  const serverStatus = status.data?.server.status ?? "stopped";
  const isRunning = serverStatus === "running";
  const canStop = Boolean(status.data?.server.can_stop) || serverStatus === "failed";
  const webUrl = status.data?.web_url ?? null;

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
              description="개발(Build) 단계에서 runtime-stub 을 먼저 생성하면 ADK dependency 설치와 실행이 가능합니다."
            />
            <Link className="ui-button ui-button-secondary" to={`/af/${reqId}/build`}>
              개발 단계로 이동
            </Link>
          </>
        ) : status.error ? (
          <p className="af-landing-error">{(status.error as Error).message}</p>
        ) : (
          <>
            <ul className="af-gate-summary">
              <li>app: {status.data?.app_name ?? "확인 중"}</li>
              <li>ADK dependency: {status.data?.installed ? "설치됨" : "미설치"}</li>
              <li>server: {serverStatus}</li>
              <li>port: {status.data?.port ?? 8765}</li>
              {status.data?.server.pid ? <li>pid: {status.data.server.pid}</li> : null}
              {!status.data?.server.pid && status.data?.server.port_owner_pid ? <li>port owner pid: {status.data.server.port_owner_pid}</li> : null}
            </ul>
            {status.data?.server.message ? <p className="af-landing-error">{status.data.server.message}</p> : null}
            <div className="af-action-row">
              <Button type="button" variant="primary" disabled={installRuntime.isPending} onClick={handleInstall}>
                {installRuntime.isPending ? "설치 중…" : "ADK dependency 설치"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!status.data?.installed || startRuntime.isPending}
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
            </div>
            {installRuntime.data?.stdout ? (
              <details className="af-blocker-list">
                <summary>pip install stdout</summary>
                <pre>{installRuntime.data.stdout}</pre>
              </details>
            ) : null}
            {status.data?.server.stderr_tail ? (
              <details className="af-blocker-list">
                <summary>ADK stderr</summary>
                <pre>{status.data.server.stderr_tail}</pre>
              </details>
            ) : null}
          </>
        )}
      </Panel>

      {stubReady ? (
        <Panel>
          <SectionHeader
            title="ADK 웹 UI"
            description="ADK 가 제공하는 공식 dev UI 입니다. 채팅·세션·이벤트·트레이스를 모두 지원합니다. 새 탭에서 전체 화면으로 엽니다."
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
              description="위에서 ADK dependency 를 설치하고 ‘ADK runtime 시작’ 을 누르면 dev UI 링크가 활성화됩니다."
            />
          )}
        </Panel>
      ) : null}
    </div>
  );
}
