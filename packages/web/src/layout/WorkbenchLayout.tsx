import type { ReactNode } from "react";
import { NavLink, useParams } from "react-router-dom";
import { afRunStageIds, type AfRunStageId } from "../analyzer/afRunManifest";
import { useArtifactRoot } from "../state/useArtifactRoot";
import { ApprovalChip } from "./ApprovalChip";
import { ArtifactRootSwitcher } from "./ArtifactRootSwitcher";

const stageLabels: Record<AfRunStageId, string> = {
  analyze: "분석",
  design: "설계",
  build: "개발",
  verify: "검증"
};

interface WorkbenchLayoutProps {
  children: ReactNode;
}

export function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
  const params = useParams<{ reqId?: string }>();
  const reqId = params.reqId;
  const { data, error, isLoading } = useArtifactRoot(reqId);
  const manifest = data?.manifest;

  return (
    <div className="af-shell">
      <header className="af-topbar">
        <div className="af-topbar-brand">
          <NavLink to="/" className="af-brand-link">
            <span className="eyebrow">Agent Factory</span>
            <strong>Workbench</strong>
          </NavLink>
          <ArtifactRootSwitcher />
        </div>
        <nav className="af-stage-nav" aria-label="Skill stages">
          {afRunStageIds.map((stage) => (
            <NavLink
              key={stage}
              to={reqId ? `/af/${reqId}/${stage}` : "/"}
              className={({ isActive }) => `af-stage-link${isActive ? " af-stage-link-active" : ""}`}
              aria-disabled={!reqId}
            >
              {stageLabels[stage]}
            </NavLink>
          ))}
          <span className="af-stage-nav-divider" aria-hidden="true" />
          <NavLink
            to={reqId ? `/af/${reqId}/run` : "/"}
            className={({ isActive }) =>
              `af-stage-link af-stage-link-tool${isActive ? " af-stage-link-active" : ""}`
            }
            aria-disabled={!reqId}
            title="ADK 런타임 실행 — 승인 게이트가 없는 도구 화면"
          >
            실행
          </NavLink>
          <NavLink
            to="/catalog"
            className={({ isActive }) => `af-stage-link af-stage-link-aux${isActive ? " af-stage-link-active" : ""}`}
          >
            Reuse Hub
          </NavLink>
          <NavLink
            to="/mock-lab"
            className={({ isActive }) => `af-stage-link af-stage-link-lab${isActive ? " af-stage-link-active" : ""}`}
          >
            Mock Lab
          </NavLink>
        </nav>
        <div className="af-gate-row" aria-label="승인 게이트">
          {manifest ? (
            <>
              <ApprovalChip gate="analysis_reviewed" value={manifest.approvals.analysis_reviewed} />
              <ApprovalChip gate="boundaries_approved" value={manifest.approvals.boundaries_approved} />
              <ApprovalChip gate="runtime_contracts_approved" value={manifest.approvals.runtime_contracts_approved} />
              <ApprovalChip gate="stub_ready_for_followup" value={manifest.approvals.stub_ready_for_followup} />
            </>
          ) : reqId ? (
            <span className="af-gate-placeholder">{isLoading ? "manifest 불러오는 중…" : error ? "manifest 없음" : ""}</span>
          ) : null}
        </div>
      </header>
      <main className="af-workspace">{children}</main>
    </div>
  );
}
