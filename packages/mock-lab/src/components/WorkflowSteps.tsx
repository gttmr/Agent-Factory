import StatusBadge from "./StatusBadge";

export type WorkflowStepId = "draft" | "edit" | "save" | "run" | "test";

const steps: Array<{ id: WorkflowStepId; label: string; hint: string }> = [
  { id: "draft", label: "Draft", hint: "Codex optional" },
  { id: "edit", label: "Edit", hint: "MockSpec" },
  { id: "save", label: "Save", hint: "canonical spec" },
  { id: "run", label: "Run", hint: "saved spec" },
  { id: "test", label: "Test", hint: "smoke + audit" }
];

export default function WorkflowSteps({ activeStep }: { activeStep: WorkflowStepId }) {
  return (
    <nav className="workflow-steps" aria-label="Mock Lab workflow">
      {steps.map((step, index) => (
        <div className={`workflow-step ${step.id === activeStep ? "active" : ""}`} key={step.id}>
          <span className="workflow-index">{index + 1}</span>
          <span className="workflow-copy">
            <strong>{step.label}</strong>
            <span>{step.hint}</span>
          </span>
          {step.id === activeStep ? <StatusBadge tone="purple">current</StatusBadge> : null}
        </div>
      ))}
    </nav>
  );
}
