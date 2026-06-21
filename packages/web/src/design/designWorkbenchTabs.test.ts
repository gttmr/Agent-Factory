import assert from "node:assert/strict";
import { nextDesignBottomTabAfterModuleSelect } from "./designWorkbenchTabs.ts";

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

console.log("designWorkbenchTabs tests passed");
