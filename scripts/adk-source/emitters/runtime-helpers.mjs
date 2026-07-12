import { buildRuntimeConfigSection } from "./runtime-config.mjs";
import { buildRuntimeToolInputsSection } from "./runtime-tool-inputs.mjs";

export function buildRuntimeHelperSection({ componentContractLiteral, modules }) {
  return `${buildRuntimeConfigSection({ componentContractLiteral })}${buildRuntimeToolInputsSection({ modules })}`;
}
