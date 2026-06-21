import assert from "node:assert/strict";
import { DESIGN_BOTTOM_TABS, nextDesignBottomTabAfterModuleSelect } from "./designWorkbenchTabs.ts";

assert.deepEqual(
  DESIGN_BOTTOM_TABS.map((tab) => [tab.id, tab.label]),
  [
    ["modules", "모듈"],
    ["runtime", "Runtime 계약"],
    ["a2a", "Remote A2A"],
    ["reviewNotes", "검토 메모"]
  ],
  "design bottom tabs should expose only the user-facing review tabs"
);

assert.equal(
  nextDesignBottomTabAfterModuleSelect("modules"),
  "modules",
  "selecting another module from the module list should keep the Modules tab active"
);
assert.equal(
  nextDesignBottomTabAfterModuleSelect("runtime"),
  "runtime",
  "module selection should not force the bottom panel away from the user's current tab"
);
assert.equal(
  nextDesignBottomTabAfterModuleSelect("reviewNotes"),
  "reviewNotes",
  "module selection should preserve the review notes tab when it is active"
);

console.log("designWorkbenchTabs tests passed");
