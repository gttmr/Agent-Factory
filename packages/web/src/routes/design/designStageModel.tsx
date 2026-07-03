export {
  DESIGN_STEP_IDS,
  GRAPH_IR_SAVE_SUCCESS_MESSAGE,
  INSPECTOR_ENABLED,
  buildDesignNextAction,
  buildDesignSteps,
  statusLabel,
  type DesignStepId,
  type SidebarTab
} from "./designStageModelCore";

export function DesignSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="af-stage-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
