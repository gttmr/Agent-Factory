import type { GraphElementGroup, GraphElementGroupId } from "../graphElementEditorModel";

interface GraphElementTabsProps {
  readonly activeGroup: GraphElementGroupId;
  readonly groups: readonly GraphElementGroup[];
  readonly ariaLabel: string;
  readonly onGroupChange: (group: GraphElementGroupId) => void;
}

export function GraphElementTabs({ activeGroup, groups, ariaLabel, onGroupChange }: GraphElementTabsProps) {
  return (
    <div className="graph-element-tabs" role="tablist" aria-label={ariaLabel}>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          role="tab"
          aria-selected={activeGroup === group.id}
          className={`graph-element-tab${activeGroup === group.id ? " is-active" : ""}`}
          onClick={() => onGroupChange(group.id)}
        >
          {group.label}
        </button>
      ))}
    </div>
  );
}
