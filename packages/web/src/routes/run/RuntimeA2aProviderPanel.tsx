import { Button, EmptyState, Panel, SectionHeader } from "../../ui/primitives";
import {
  type RuntimeA2aStatus,
  useStartRuntimeA2a,
  useStopRuntimeA2a
} from "../../state/useRuntimeA2a";
import type { RuntimeA2aProviderTarget } from "./runtimeA2aProviderTarget";
import { remoteInputRequiredView } from "./runtimeInputRequiredView";

interface RuntimeA2aProviderPanelProps {
  target: RuntimeA2aProviderTarget | null;
  status: RuntimeA2aStatus | null | undefined;
  error: Error | null;
  onActionMessage: (message: string | null) => void;
}

export function RuntimeA2aProviderPanel({ target, status, error, onActionMessage }: RuntimeA2aProviderPanelProps) {
  const startA2a = useStartRuntimeA2a(target?.reqId);
  const stopA2a = useStopRuntimeA2a(target?.reqId);
  const providerStatus = status?.server.status ?? "stopped";
  const providerCanStop = Boolean(status?.server.can_stop) || providerStatus === "failed";
  const agentCardReady = Boolean(status?.server.agent_card_ready);
  const remoteInputRequired = remoteInputRequiredView(status);
  const targetSource =
    target?.source === "remote_a2a_contract" ? "linked Remote A2A provider" : target ? "current artifact" : "확인 중";

  function handleStartA2a() {
    onActionMessage(null);
    startA2a.mutate(undefined, {
      onSuccess: (result) => onActionMessage(`ADK A2A provider 시작: ${result.status.rpc_url}`),
      onError: (error) => onActionMessage(error instanceof Error ? error.message : "ADK A2A provider 시작 실패")
    });
  }

  function handleStopA2a() {
    onActionMessage(null);
    stopA2a.mutate(undefined, {
      onSuccess: (result) =>
        onActionMessage(result.ok ? "ADK A2A provider 중지 요청 완료" : result.message ?? "ADK A2A provider 중지 대상 없음"),
      onError: (error) => onActionMessage(error instanceof Error ? error.message : "ADK A2A provider 중지 실패")
    });
  }

  return (
    <Panel>
      <SectionHeader
        title="ADK A2A provider"
        description="현재 Run artifact 가 호출할 ADK A2A endpoint 상태입니다. Remote A2A 계약이 local artifact 를 가리키면 그 provider artifact 를 대상으로 시작·중지합니다."
      />
      {error ? <p className="af-landing-error">{error.message}</p> : null}
      <ul className="af-gate-summary">
        <li>provider artifact: {target?.reqId ?? "확인 중"}</li>
        <li>provider source: {targetSource}</li>
        <li>app: {status?.app_name ?? "확인 중"}</li>
        <li>shared venv: {status?.installed ? "준비됨" : "미준비"}</li>
        <li>server: {providerStatus}</li>
        <li>agent card: {status?.server.agent_card_ready ? "ready" : "not ready"}</li>
        <li>message/send: {status?.server.message_send_status ?? "not_checked"}</li>
        <li>port: {status?.port ?? 8001}</li>
        {status?.server.pid ? <li>pid: {status.server.pid}</li> : null}
      </ul>
      {remoteInputRequired.visible ? (
        <div className="af-run-input-required" role="status" aria-live="polite">
          <strong>{remoteInputRequired.title}</strong>
          <p>{remoteInputRequired.prompt}</p>
          <small>{remoteInputRequired.detail}</small>
          {remoteInputRequired.taskState ? <code>task state: {remoteInputRequired.taskState}</code> : null}
        </div>
      ) : status?.server.message ? (
        <p className="af-landing-error">{status.server.message}</p>
      ) : null}
      {!status?.installed && status?.setup_hint ? (
        <p className="af-landing-message">{status.setup_hint}</p>
      ) : null}
      <div className="af-action-row">
        <Button type="button" variant="primary" disabled={!status?.installed || startA2a.isPending} onClick={handleStartA2a}>
          {startA2a.isPending ? "시작 중…" : "A2A provider 시작"}
        </Button>
        <Button type="button" variant="ghost" disabled={!providerCanStop || stopA2a.isPending} onClick={handleStopA2a}>
          {stopA2a.isPending ? "중지 중…" : "중지"}
        </Button>
      </div>
      {agentCardReady && status ? (
        <div className="af-run-weblink">
          <a className="ui-button ui-button-secondary" href={status.agent_card_url} target="_blank" rel="noreferrer">
            Agent Card 열기 ↗
          </a>
          <code className="af-run-weburl">{status.agent_card_url}</code>
          <code className="af-run-weburl">{status.rpc_url}</code>
        </div>
      ) : !status ? (
        <EmptyState title="A2A provider 상태 확인 중" description="provider artifact 와 Agent Card 상태를 불러오는 중입니다." />
      ) : providerStatus === "stopped" ? (
        <EmptyState
          title="A2A provider 가 실행 중이 아닙니다"
          description="Agent Card 파일은 Design import 시에도 생성되지만, 실제 A2A 호출은 provider 시작 후 확인합니다."
        />
      ) : (
        <EmptyState
          title="A2A provider 상태 확인 필요"
          description="프로세스 또는 Agent Card health, semantic message/send 상태 메시지를 확인하세요."
        />
      )}
      {status?.server.stderr_tail ? (
        <details className="af-blocker-list">
          <summary>ADK A2A stderr</summary>
          <pre>{status.server.stderr_tail}</pre>
        </details>
      ) : null}
    </Panel>
  );
}
