export const DESIGN_BOTTOM_TABS = [
  { id: "assets", label: "Assets" },
  { id: "runtime", label: "Runtime 계약" },
  { id: "a2a", label: "A2A 계약" },
  { id: "reviewNotes", label: "검토 메모" }
] as const;

export type DesignBottomTab = (typeof DESIGN_BOTTOM_TABS)[number]["id"];

export function nextDesignBottomTabAfterAssetSelect(currentTab: DesignBottomTab): DesignBottomTab {
  return currentTab;
}
