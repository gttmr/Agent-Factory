import { buildRuntimeConfigSection } from "./runtime-config.mjs";
import { buildRuntimeToolInputsSection } from "./runtime-tool-inputs.mjs";

export function buildRuntimeHelperSection({ componentContractLiteral, assets }) {
  return `${buildRuntimeConfigSection({ componentContractLiteral })}${buildRuntimeToolInputsSection({ assets })}`;
}
