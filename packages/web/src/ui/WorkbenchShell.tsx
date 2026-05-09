import type { ReactNode } from "react";
import type { StepDefinition, StepGroup, StepId } from "../workbench/useWorkbenchState";
import { stepGroupLabels } from "../workbench/useWorkbenchState";

interface StatusItem {
  label: string;
  value: ReactNode;
}

interface WorkbenchShellProps {
  activeStep: StepId;
  steps: StepDefinition[];
  canOpenStep: (step: StepDefinition) => boolean;
  onStepChange: (step: StepId) => void;
  statusItems: StatusItem[];
  context?: ReactNode;
  children: ReactNode;
}

const groupOrder: StepGroup[] = ["input", "review", "assets", "generate"];

export function WorkbenchShell({
  activeStep,
  steps,
  canOpenStep,
  onStepChange,
  statusItems,
  context,
  children
}: WorkbenchShellProps) {
  return (
    <main className="app-shell ops-shell">
      <header className="ops-topbar">
        <div>
          <p className="eyebrow">은행 요구사항 분석 워크벤치</p>
          <h1>Agent Factory</h1>
        </div>
        <StatusSummary items={statusItems} />
      </header>

      <div className={context ? "ops-layout" : "ops-layout ops-layout-no-context"}>
        <WorkflowRail activeStep={activeStep} steps={steps} canOpenStep={canOpenStep} onStepChange={onStepChange} />
        <section className="ops-workspace" aria-label="현재 작업">
          {children}
        </section>
        {context ? (
          <aside className="ops-context" aria-label="작업 컨텍스트">
            {context}
          </aside>
        ) : null}
      </div>
    </main>
  );
}

function StatusSummary({ items }: { items: StatusItem[] }) {
  return (
    <dl className="status-summary" aria-label="워크벤치 상태">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface WorkflowRailProps {
  activeStep: StepId;
  steps: StepDefinition[];
  canOpenStep: (step: StepDefinition) => boolean;
  onStepChange: (step: StepId) => void;
}

function WorkflowRail({ activeStep, steps, canOpenStep, onStepChange }: WorkflowRailProps) {
  return (
    <nav className="workflow-rail" aria-label="워크벤치 단계">
      {groupOrder.map((group) => {
        const groupedSteps = steps.filter((step) => step.group === group);
        if (!groupedSteps.length) return null;
        return (
          <div className="workflow-rail-group" key={group}>
            <p>{stepGroupLabels[group]}</p>
            {groupedSteps.map((step) => {
              const disabled = !canOpenStep(step);
              return (
                <button
                  key={step.id}
                  type="button"
                  className={activeStep === step.id ? "rail-step active" : "rail-step"}
                  onClick={() => onStepChange(step.id)}
                  disabled={disabled}
                >
                  <span className="rail-step-dot" aria-hidden="true" />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
