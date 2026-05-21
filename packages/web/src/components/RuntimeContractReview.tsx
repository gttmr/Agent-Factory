import { useEffect, useMemo, useState } from "react";
import type { ModuleCandidate, RuntimeContract, RuntimeContractStatus } from "../analyzer/types";
import { runtimeContractReadinessIssues } from "../analyzer/runtimeContracts";
import { EmptyState, SectionHeader } from "../ui/primitives";
import { ReadinessList } from "../ui/review";
import { CategoryBadge, SubtypeBadge } from "./CategoryBadge";

interface RuntimeContractReviewProps {
  contracts: RuntimeContract[];
  moduleCandidates: ModuleCandidate[];
  onContractsChange: (contracts: RuntimeContract[]) => void;
  onContinue: () => void;
}

const statusLabels: Record<RuntimeContractStatus, string> = {
  draft: "초안",
  needs_info: "정보 필요",
  approved: "승인",
  rejected: "반려"
};

const kindLabels: Record<RuntimeContract["contract_kind"], string> = {
  mcp_legacy_adapter: "MCP Legacy Adapter",
  eai_legacy_adapter: "EAI Legacy Adapter",
  context_manager: "Context Manager",
  callback_broker: "Callback Broker",
  adk_callback: "ADK Callback",
  async_resume: "Async Resume"
};

export function RuntimeContractReview({
  contracts,
  moduleCandidates,
  onContractsChange,
  onContinue
}: RuntimeContractReviewProps) {
  const candidatesById = useMemo(() => new Map(moduleCandidates.map((candidate) => [candidate.id, candidate])), [moduleCandidates]);
  const [selectedId, setSelectedId] = useState<string | null>(contracts[0]?.contract_id ?? null);

  useEffect(() => {
    if (contracts.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !contracts.some((contract) => contract.contract_id === selectedId)) {
      setSelectedId(contracts[0].contract_id);
    }
  }, [contracts, selectedId]);

  const selected = contracts.find((contract) => contract.contract_id === selectedId) ?? contracts[0] ?? null;
  const selectedCandidate = selected?.module_id ? candidatesById.get(selected.module_id) ?? null : null;
  const issueCount = contracts.reduce((count, contract) => count + runtimeContractReadinessIssues(contract).length, 0);

  function updateContract(contractId: string, changes: Partial<RuntimeContract>) {
    onContractsChange(contracts.map((contract) => (contract.contract_id === contractId ? { ...contract, ...changes } : contract)));
  }

  function updatePolicies(contractId: string, changes: Partial<RuntimeContract["policies"]>) {
    const target = contracts.find((contract) => contract.contract_id === contractId);
    if (!target) return;
    updateContract(contractId, { policies: { ...target.policies, ...changes } });
  }

  function updateReviewerNotes(contractId: string, reviewer_notes: string) {
    updateContract(contractId, { reviewer_notes });
  }

  return (
    <section className="panel runtime-contract-review">
      <SectionHeader
        eyebrow="Runtime Contract 검토"
        title="Callback / Legacy / Context 계약 승인"
        description="EAI, Legacy, Context Manager, Callback Broker, ADK callback 계약은 승인 전까지 Runtime Handoff 생성을 막습니다."
      />

      {issueCount > 0 ? (
        <div className="a2a-banner needs-info" role="status">
          Runtime 계약 {issueCount}개 항목이 아직 승인 또는 보강되지 않았습니다.
        </div>
      ) : null}

      {contracts.length === 0 ? (
        <EmptyState title="검토할 Runtime 계약이 없습니다." description="Legacy, callback, async resume 신호가 있는 후보가 생기면 자동으로 계약 초안이 생성됩니다." />
      ) : (
        <div className="runtime-contract-console">
          <aside className="runtime-contract-list" aria-label="Runtime 계약 목록">
            {contracts.map((contract) => {
              const issues = runtimeContractReadinessIssues(contract);
              const candidate = contract.module_id ? candidatesById.get(contract.module_id) : null;
              return (
                <button
                  type="button"
                  key={contract.contract_id}
                  className={`runtime-contract-item ${selected?.contract_id === contract.contract_id ? "is-selected" : ""}`}
                  onClick={() => setSelectedId(contract.contract_id)}
                >
                  <span className="runtime-contract-item-title">
                    <SubtypeBadge value={contract.contract_kind} />
                    <strong>{contract.title}</strong>
                  </span>
                  <span className="runtime-contract-item-meta">
                    <span>{contract.contract_id}</span>
                    <span>{candidate?.name ?? "공통 runtime support"}</span>
                  </span>
                  <span className={`runtime-contract-status status-${contract.contract_status}`}>
                    {statusLabels[contract.contract_status]}
                  </span>
                  <span className={issues.length ? "runtime-contract-issue" : "runtime-contract-issue is-clear"}>
                    {issues.length ? `${issues.length}개 issue` : "ready"}
                  </span>
                </button>
              );
            })}
          </aside>

          <article className="runtime-contract-detail">
            {selected ? (
              <>
                <header className="runtime-contract-detail-header">
                  <div>
                    <div className="candidate-cat-row">
                      {selectedCandidate ? <CategoryBadge category={selectedCandidate.module_category} /> : null}
                      <SubtypeBadge value={selected.contract_kind} />
                    </div>
                    <h3>{selected.title}</h3>
                    <p>{selected.summary}</p>
                  </div>
                  <label className="runtime-contract-status-select">
                    <span>검토 상태</span>
                    <select
                      value={selected.contract_status}
                      onChange={(event) =>
                        updateContract(selected.contract_id, {
                          contract_status: event.target.value as RuntimeContractStatus
                        })
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </header>

                <ReadinessList title="승인 전 확인" issues={runtimeContractReadinessIssues(selected)} tone="warning" />

                <div className="runtime-contract-grid">
                  <ReviewBlock title="계약 유형" value={kindLabels[selected.contract_kind]} />
                  <ReviewBlock title="operation_type" value={selected.operation.operation_type} />
                  <ReviewBlock title="side_effect_level" value={selected.operation.side_effect_level} />
                  <ReviewBlock title="callback_expected" value={String(selected.operation.callback_expected)} />
                  <ReviewBlock title="async_resume_required" value={String(selected.operation.async_resume_required)} />
                  <ReviewBlock title="context_manager_required" value={String(selected.runtime_support.context_manager_required)} />
                  <ReviewBlock title="callback_broker_required" value={String(selected.runtime_support.callback_broker_required)} />
                  <ReviewBlock title="human_approval_required" value={String(selected.runtime_support.human_approval_required)} />
                </div>

                <section className="runtime-contract-section">
                  <h4>정책</h4>
                  <div className="runtime-contract-policy-grid">
                    {Object.entries(selected.policies).map(([key, value]) => (
                      <label key={key}>
                        <span>{key}</span>
                        <textarea
                          value={value}
                          onChange={(event) => updatePolicies(selected.contract_id, { [key]: event.target.value } as Partial<RuntimeContract["policies"]>)}
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="runtime-contract-section">
                  <h4>식별자 / Graph IR annotation</h4>
                  <div className="runtime-contract-columns">
                    <div>
                      <strong>identifiers</strong>
                      <ul>
                        {selected.identifiers.map((identifier) => (
                          <li key={identifier}>{identifier}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>graph_ir_annotations</strong>
                      <pre>{JSON.stringify(selected.graph_ir_annotations, null, 2)}</pre>
                    </div>
                  </div>
                </section>

                <section className="runtime-contract-section">
                  <h4>TODO Runtime Wiring</h4>
                  <ul>
                    {selected.developer_todos.map((todo) => (
                      <li key={todo}>{todo}</li>
                    ))}
                  </ul>
                </section>

                <label className="runtime-contract-notes">
                  <span>검토자 메모</span>
                  <textarea
                    value={selected.reviewer_notes}
                    onChange={(event) => updateReviewerNotes(selected.contract_id, event.target.value)}
                    placeholder="승인 근거, 보류 사유, runtime endpoint 제공 조건 등을 기록하세요."
                  />
                </label>
              </>
            ) : null}
          </article>
        </div>
      )}

      <div className="actions align-end">
        <button type="button" className="primary" onClick={onContinue}>
          다음 검토 단계로 이동
        </button>
      </div>
    </section>
  );
}

function ReviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="runtime-contract-review-block">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
