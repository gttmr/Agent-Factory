import { Link } from "react-router-dom";
import type { AssetCandidate, ScaffoldPlan } from "../../analyzer/types";
import type { MockLabDiscoveryPayload, MockLabDiscoveryServer } from "../../state/useMockLabDiscovery";
import { buildMockLabRoute, isMcpBoundTool, mockLabToolBindingTargets } from "../../mock-lab/mockLabIntegration";

interface MockLabBindingPanelProps {
  readonly discovery: MockLabDiscoveryPayload | null;
  readonly discoveryError: unknown;
  readonly discoveryLoading: boolean;
  readonly onChange: (asset: AssetCandidate, value: string) => void;
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
  const tools = mockLabToolBindingTargets(plan);
  const options = mockLabToolOptions(discovery);
  return (
    <div className="af-mcp-binding-panel">
      <div className="af-mcp-binding-header">
        <div>
          <strong>Mock Lab MCP 바인딩</strong>
          <p>실행 중인 Mock Lab Tool을 명시적으로 선택해야 생성된 ADK Tool binding이 live MCP를 호출합니다.</p>
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
        {tools.map((asset) => (
          <MockLabBindingRow key={asset.asset_id} asset={asset} onChange={onChange} options={options} reqId={reqId} />
        ))}
      </div>
    </div>
  );
}

function MockLabBindingRow({
  asset,
  onChange,
  options,
  reqId
}: {
  readonly asset: AssetCandidate;
  readonly onChange: (asset: AssetCandidate, value: string) => void;
  readonly options: readonly MockLabToolOption[];
  readonly reqId: string;
}) {
  const binding = isMcpBoundTool(asset) ? asset.binding : null;
  return (
    <div className="af-mcp-binding-row">
      <div className="af-mcp-binding-asset">
        <strong>{asset.name}</strong>
        <code>{asset.asset_id}</code>
        {binding ? (
          <span>
            bound: {binding.server_ref} / {binding.tool_name}
          </span>
        ) : (
          <span>unconnected synthetic stub</span>
        )}
      </div>
      <select
        value={selectedMockLabValue(asset, options)}
        onChange={(event) => onChange(asset, event.currentTarget.value)}
        disabled={options.length === 0}
        aria-label={`${asset.name} Mock Lab MCP tool 선택`}
      >
        <option value="">선택 안 함</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Link className="ui-button ui-button-ghost" to={buildMockLabRoute({ toolName: asset.name, reqId })}>
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

function selectedMockLabValue(asset: AssetCandidate, options: readonly MockLabToolOption[]): string {
  const binding = asset.binding;
  if (binding?.kind !== "mcp" || !binding.server_ref || !binding.tool_name) return "";
  const match = options.find(
    (option) =>
      option.toolName === binding.tool_name &&
      (option.server.mock_id === binding.server_ref ||
        option.server.server_name === binding.server_ref ||
        option.server.catalog_entry_name === binding.server_ref)
  );
  return match?.value ?? "";
}
