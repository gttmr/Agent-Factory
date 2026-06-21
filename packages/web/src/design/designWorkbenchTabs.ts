export const DESIGN_BOTTOM_TABS = [
  { id: "modules", label: "모듈" },
  { id: "runtime", label: "Runtime 계약" },
  { id: "a2a", label: "Remote A2A" },
  { id: "reviewNotes", label: "검토 메모" }
] as const;

export type DesignBottomTab = (typeof DESIGN_BOTTOM_TABS)[number]["id"];

export function nextDesignBottomTabAfterModuleSelect(currentTab: DesignBottomTab): DesignBottomTab {
  return currentTab;
}
