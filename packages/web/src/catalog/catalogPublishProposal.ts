import type { ProposedAddition } from "./catalogDelta";

export type CatalogPublishProposal = ProposedAddition;

export function buildPublishProposal(proposal: ProposedAddition): CatalogPublishProposal {
  return { ...proposal };
}
