import { Link } from "react-router-dom";
import type { ScaffoldPlan, ScaffoldPlanModule } from "../../analyzer/types";
import type { MockLabDiscoveryPayload, MockLabDiscoveryServer } from "../../state/useMockLabDiscovery";
import { buildMockLabRoute, isMcpBoundAdapter } from "../../mock-lab/mockLabIntegration";

interface MockLabBindingPanelProps {
  readonly discovery: MockLabDiscoveryPayload | null;
  readonly discoveryError: unknown;
  readonly discoveryLoading: boolean;
  readonly onChange: (module: ScaffoldPlanModule, value: string) => void;
  readonly plan: ScaffoldPlan;
  readonly reqId: string;
}

interface MockLabToolOption {
  readonly value: string;
  readonly label: string;
  readonly server: MockLabDiscoveryServer;
  readonly toolName: string;
}

export function MockLabBindingPanel({
  discovery,
  discoveryError,
  discoveryLoading,
  onChange,
  plan,
  reqId
}: MockLabBindingPanelProps) {
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
        <p className="af-landing-error">
          {discoveryError instanceof Error ? discoveryError.message : "Mock Lab discovery 조회 실패"}
        </p>
      ) : null}
      {!discoveryLoading && options.length === 0 ? (
        <p className="af-landing-message">실행 중인 Mock Lab tool이 없습니다. Mock Lab에서 server를 start한 뒤 다시 선택하세요.</p>
      ) : null}
      <div className="af-mcp-binding-list">
        {adapters.map((module) => (
          <MockLabBindingRow key={module.id} module={module} onChange={onChange} options={options} reqId={reqId} />
        ))}
      </div>
    </div>
  );
}

function MockLabBindingRow({
  module,
  onChange,
  options,
  reqId
}: {
  readonly module: ScaffoldPlanModule;
  readonly onChange: (module: ScaffoldPlanModule, value: string) => void;
  readonly options: readonly MockLabToolOption[];
  readonly reqId: string;
}) {
  return (
    <div className="af-mcp-binding-row">
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
        value={selectedMockLabValue(module, options)}
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
}

function mockLabToolOptions(discovery: MockLabDiscoveryPayload | null): readonly MockLabToolOption[] {
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

function selectedMockLabValue(module: ScaffoldPlanModule, options: readonly MockLabToolOption[]): string {
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
