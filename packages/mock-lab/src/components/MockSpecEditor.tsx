import { useState } from "react";
import { createEmptyMockSpec, type CatalogPrefillEntry, type CatalogPrefillPayload, type MockSpec, type MockToolSpec, type ValidationResult } from "../types/mockSpec";
import JsonSchemaEditor from "./JsonSchemaEditor";
import StatusBadge from "./StatusBadge";

export default function MockSpecEditor({
  catalog,
  spec,
  validation,
  saveBlockedReason,
  onChange,
  onSave
}: {
  catalog: CatalogPrefillPayload;
  spec: MockSpec;
  validation: ValidationResult;
  saveBlockedReason?: string;
  onChange: (spec: MockSpec) => void;
  onSave: () => void;
}) {
  const [toolIndex, setToolIndex] = useState(0);
  const [catalogChooserOpen, setCatalogChooserOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogTargetIndex, setCatalogTargetIndex] = useState<number | null>(null);
  const [catalogPage, setCatalogPage] = useState(0);
  const tool = spec.tools[toolIndex] ?? spec.tools[0];
  const filteredCatalogEntries = catalog.entries.filter((entry) => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return true;
    return [entry.name, entry.adapter_kind, entry.owner_domain, entry.access_protocol, entry.contract_status, entry.notes]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const catalogPageSize = 9;
  const firstPageCatalogSlots = catalogPageSize - 1;
  const totalCatalogChoices = filteredCatalogEntries.length + 1;
  const totalCatalogPages = Math.max(1, Math.ceil(totalCatalogChoices / catalogPageSize));
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages - 1);
  const pagedCatalogEntries =
    safeCatalogPage === 0
      ? filteredCatalogEntries.slice(0, firstPageCatalogSlots)
      : filteredCatalogEntries.slice(firstPageCatalogSlots + (safeCatalogPage - 1) * catalogPageSize, firstPageCatalogSlots + safeCatalogPage * catalogPageSize);
  const visibleCatalogChoices = pagedCatalogEntries.length + (safeCatalogPage === 0 ? 1 : 0);
  const catalogPlaceholders = Array.from({ length: Math.max(0, catalogPageSize - visibleCatalogChoices) }, (_, index) => index);

  function updateTool(nextTool: MockToolSpec) {
    onChange({
      ...spec,
      tools: spec.tools.map((candidate, index) => (index === toolIndex ? nextTool : candidate))
    });
  }

  function handleAddTool() {
    const nextIndex = spec.tools.length;
    const blankTool = createBlankTool(nextIndex + 1);
    const nextTool = {
      ...blankTool,
      name: uniqueToolName(blankTool.name, spec.tools, -1)
    };
    onChange({ ...spec, tools: [...spec.tools, nextTool] });
    setToolIndex(nextIndex);
    setCatalogTargetIndex(nextIndex);
    setCatalogQuery("");
    setCatalogPage(0);
    setCatalogChooserOpen(true);
  }

  function handleDeleteTool(indexToDelete: number) {
    if (spec.tools.length <= 1) return;
    const nextTools = spec.tools.filter((_, index) => index !== indexToDelete);
    const nextIndex = Math.min(indexToDelete === toolIndex ? Math.max(0, toolIndex - 1) : toolIndex, nextTools.length - 1);
    onChange({ ...spec, tools: nextTools });
    setToolIndex(nextIndex);
    if (catalogTargetIndex === indexToDelete) {
      setCatalogChooserOpen(false);
      setCatalogTargetIndex(null);
    }
  }

  function handleCatalogToolSelect(entry: CatalogPrefillEntry) {
    const targetIndex = catalogTargetIndex ?? toolIndex;
    const sourceTool = entry.prefill.tools[0];
    const nextTool = {
      ...cloneTool(sourceTool),
      name: uniqueToolName(sourceTool.name, spec.tools, targetIndex)
    };
    onChange({
      ...spec,
      tools: spec.tools.map((candidate, index) => (index === targetIndex ? nextTool : candidate))
    });
    setToolIndex(targetIndex);
    setCatalogChooserOpen(false);
    setCatalogTargetIndex(null);
  }

  function handleNewToolSelect() {
    setCatalogChooserOpen(false);
    setCatalogTargetIndex(null);
  }

  return (
    <div className="panel-content">
      <div className="panel-heading">
        <div>
          <h2>Mock Spec Editor</h2>
          <p>{spec.protocol}</p>
        </div>
        <div className="button-row">
          <StatusBadge tone={validation.ok ? "success" : "error"}>{validation.ok ? "valid" : "blocked"}</StatusBadge>
          <button className="button primary" type="button" disabled={!validation.ok} onClick={onSave}>
            Save spec
          </button>
        </div>
      </div>
      {saveBlockedReason ? <p className="warning-line">{saveBlockedReason}</p> : null}

      <div className="form-grid three">
        <label className="field">
          <span>mock_id</span>
          <input value={spec.mock_id} onChange={(event) => onChange({ ...spec, mock_id: event.target.value })} />
        </label>
        <label className="field">
          <span>server_name</span>
          <input value={spec.server_name} onChange={(event) => onChange({ ...spec, server_name: event.target.value })} />
        </label>
        <label className="field">
          <span>source</span>
          <input value={spec.source?.catalog_entry_name ?? "manual"} readOnly />
        </label>
      </div>

      <label className="field">
        <span>description</span>
        <input value={spec.description ?? ""} onChange={(event) => onChange({ ...spec, description: event.target.value })} />
      </label>

      <div className="tool-tabs">
        {spec.tools.map((item, index) => (
          <span className={`tool-tab ${index === toolIndex ? "active" : ""}`} key={`${item.name}-${index}`}>
            <button className="tool-tab-button" type="button" onClick={() => setToolIndex(index)}>
              {item.name}
            </button>
            {spec.tools.length > 1 ? (
              <button className="tool-tab-remove" type="button" aria-label={`${item.name} 삭제`} onClick={() => handleDeleteTool(index)}>
                x
              </button>
            ) : null}
          </span>
        ))}
        <button className="tool-add-button" type="button" onClick={handleAddTool}>
          + tool
        </button>
      </div>

      {tool ? (
        <>
          <div className="form-grid three">
            <label className="field">
              <span>tool.name</span>
              <input value={tool.name} onChange={(event) => updateTool({ ...tool, name: event.target.value })} />
            </label>
            <label className="field">
              <span>latencyMs</span>
              <input
                type="number"
                min={0}
                max={10000}
                value={tool.latencyMs ?? 0}
                onChange={(event) => updateTool({ ...tool, latencyMs: Number(event.target.value) })}
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={tool.auditRequired ?? false}
                onChange={(event) => updateTool({ ...tool, auditRequired: event.target.checked })}
              />
              <span>auditRequired</span>
            </label>
          </div>
          <label className="field">
            <span>tool.description</span>
            <input value={tool.description} onChange={(event) => updateTool({ ...tool, description: event.target.value })} />
          </label>
          <label className="field">
            <span>riskSignals</span>
            <input
              value={(tool.riskSignals ?? []).join(", ")}
              onChange={(event) =>
                updateTool({
                  ...tool,
                  riskSignals: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                })
              }
            />
          </label>
          <div className="json-grid">
            <JsonSchemaEditor label="inputSchema" value={tool.inputSchema} onChange={(value) => updateTool({ ...tool, inputSchema: value as MockToolSpec["inputSchema"] })} />
            <JsonSchemaEditor label="outputSchema" value={tool.outputSchema} onChange={(value) => updateTool({ ...tool, outputSchema: value as MockToolSpec["outputSchema"] })} />
            <JsonSchemaEditor label="successResponse" value={tool.successResponse} onChange={(value) => updateTool({ ...tool, successResponse: value as Record<string, unknown> })} />
            <JsonSchemaEditor label="errorScenarios" value={tool.errorScenarios ?? []} onChange={(value) => updateTool({ ...tool, errorScenarios: Array.isArray(value) ? value : [] })} />
          </div>
        </>
      ) : null}

      {catalogChooserOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCatalogChooserOpen(false)}>
          <div className="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-tool-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2 id="catalog-tool-title">Catalog Tool Prefill</h2>
                <p>선택한 adapter 계약으로 새 tool을 채웁니다.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Catalog prefill 닫기" onClick={() => setCatalogChooserOpen(false)}>
                x
              </button>
            </div>
            <label className="field">
              <span>검색</span>
              <input
                value={catalogQuery}
                onChange={(event) => {
                  setCatalogQuery(event.target.value);
                  setCatalogPage(0);
                }}
                placeholder="adapter, domain, protocol"
              />
            </label>
            <div className="catalog-choice-grid">
              {safeCatalogPage === 0 ? (
                <button className="catalog-choice-card new-tool-card" type="button" onClick={handleNewToolSelect}>
                  <strong>new</strong>
                  <span>Catalog prefill 없이 새 tool을 직접 작성합니다.</span>
                  <span className="badge-row">
                    <StatusBadge>blank</StatusBadge>
                    <StatusBadge tone="warning">manual</StatusBadge>
                  </span>
                  <span className="compact-json">inputSchema, outputSchema, successResponse 직접 입력</span>
                </button>
              ) : null}
              {pagedCatalogEntries.map((entry) => (
                <button className="catalog-choice-card" key={entry.name} type="button" onClick={() => handleCatalogToolSelect(entry)}>
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.adapter_kind} · {entry.owner_domain} · {entry.access_protocol}
                  </span>
                  <span className="badge-row">
                    <StatusBadge tone={entry.has_runtime_mock ? "success" : "warning"}>
                      {entry.has_runtime_mock ? "runtime_mock" : "schema only"}
                    </StatusBadge>
                    <StatusBadge>{entry.contract_status}</StatusBadge>
                  </span>
                  <span className="compact-json">
                    in {entry.inputs.length} · out {entry.outputs.length} · risk {entry.risk_signals.length}
                  </span>
                </button>
              ))}
              {catalogPlaceholders.map((index) => (
                <span className="catalog-choice-placeholder" aria-hidden="true" key={`catalog-placeholder-${safeCatalogPage}-${index}`} />
              ))}
            </div>
            <div className="catalog-pagination">
              <button className="button secondary" type="button" disabled={safeCatalogPage === 0} onClick={() => setCatalogPage(Math.max(0, safeCatalogPage - 1))}>
                이전
              </button>
              <span>
                page {safeCatalogPage + 1} / {totalCatalogPages}
              </span>
              <button
                className="button secondary"
                type="button"
                disabled={safeCatalogPage >= totalCatalogPages - 1}
                onClick={() => setCatalogPage(Math.min(totalCatalogPages - 1, safeCatalogPage + 1))}
              >
                다음
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="validation-list">
        {validation.errors.map((issue) => (
          <p className="error-line" key={`${issue.path}-${issue.message}`}>
            {issue.path}: {issue.message}
          </p>
        ))}
        {validation.warnings.map((issue) => (
          <p className="warning-line" key={`${issue.path}-${issue.message}`}>
            {issue.path}: {issue.message}
          </p>
        ))}
      </div>
    </div>
  );
}

function createBlankTool(position: number): MockToolSpec {
  return {
    ...cloneTool(createEmptyMockSpec().tools[0]),
    name: `mock_tool_${position}`,
    title: `Mock tool ${position}`
  };
}

function cloneTool(tool: MockToolSpec): MockToolSpec {
  return JSON.parse(JSON.stringify(tool)) as MockToolSpec;
}

function uniqueToolName(baseName: string, tools: MockToolSpec[], targetIndex: number): string {
  const existing = new Set(tools.map((tool, index) => (index === targetIndex ? "" : tool.name)).filter(Boolean));
  if (!existing.has(baseName)) return baseName;
  const stem = baseName.slice(0, 74);
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${stem}_${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${stem}_${Date.now().toString(36).slice(-4)}`;
}
