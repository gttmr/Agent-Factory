import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { assetTypes, type AssetType } from "../src/analyzer/types";
import { parseCatalogDocument } from "../src/catalog/catalogIndex";
import { parseCatalogDelta, type ProposedAddition } from "../src/catalog/catalogDelta";
import { REQ_ID_PATTERN } from "./artifactRootStore";

export type CatalogCategory = AssetType;

export interface PublishProposal {
  readonly asset_id?: unknown;
  readonly asset_type?: unknown;
  readonly name?: unknown;
  readonly domain_scope?: unknown;
  readonly business_domains?: unknown;
  readonly owner?: unknown;
  readonly reuse_status?: unknown;
  readonly capability_tags?: unknown;
  readonly binding?: unknown;
  readonly connection?: unknown;
  readonly workflow_profile?: unknown;
  readonly exposure?: unknown;
  readonly responsibility?: unknown;
  readonly inputs?: unknown;
  readonly outputs?: unknown;
  readonly composition?: unknown;
  readonly risk_signals?: unknown;
  readonly runtime_mock?: unknown;
  readonly required_before_approval?: unknown;
  readonly contract_status?: unknown;
  readonly notes?: unknown;
  readonly source_candidate_id?: unknown;
}

export interface PublishRequest {
  readonly req_id?: unknown;
  readonly proposal?: unknown;
}

export function validatePublishRequest(reqId: string, proposal: PublishProposal | null): string[] {
  const details: string[] = [];
  if (!reqId) details.push("req_id 는 필수입니다.");
  else if (!REQ_ID_PATTERN.test(reqId)) details.push("req_id 형식이 올바르지 않습니다.");
  if (!proposal) return [...details, "proposal 은 객체여야 합니다."];
  const assetType = typeof proposal.asset_type === "string" ? proposal.asset_type : "";
  if (!(assetTypes as readonly string[]).includes(assetType)) {
    details.push("asset_type 은 agent, workflow, tool 중 하나여야 합니다.");
    return details;
  }
  try {
    const key = assetType === "agent" ? "agents" : assetType === "workflow" ? "workflows" : "tools";
    parseCatalogDocument({ [key]: [proposal] }, key, assetType as AssetType);
  } catch (error) {
    details.push(error instanceof Error ? error.message : "Target Catalog proposal이 유효하지 않습니다.");
  }
  details.push(...validateAssetId(proposal.asset_id));
  details.push(...validateOptionalFieldSpecs("inputs", proposal.inputs));
  details.push(...validateOptionalFieldSpecs("outputs", proposal.outputs));
  details.push(...validateOptionalStringArray("composition", proposal.composition));
  details.push(...validateOptionalStringArray("risk_signals", proposal.risk_signals));
  details.push(...validateOptionalStringArray("required_before_approval", proposal.required_before_approval));
  details.push(...validatePublishReadiness(proposal));
  return details;
}

export async function validatePublishedProposalSource(
  repoRoot: string,
  reqId: string,
  assetType: AssetType,
  proposal: PublishProposal
): Promise<string[]> {
  const artifactsRoot = resolve(repoRoot, "artifacts/af");
  const rootDir = resolve(artifactsRoot, reqId);
  if (!rootDir.startsWith(artifactsRoot + sep) && rootDir !== artifactsRoot) return ["artifact root 경로가 허용되지 않습니다."];
  const rootStat = await stat(rootDir).catch((error) => {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  });
  if (!rootStat?.isDirectory()) return [`artifact root 를 찾을 수 없습니다: artifacts/af/${reqId}`];
  const deltaPath = resolve(rootDir, "catalog-delta.yaml");
  const deltaText = await readFile(deltaPath, "utf8").catch((error) => {
    if (isErrnoException(error) && error.code === "ENOENT") return null;
    throw error;
  });
  if (deltaText === null) return [`catalog-delta.yaml 을 찾을 수 없습니다: artifacts/af/${reqId}/catalog-delta.yaml`];
  const parsed = parseCatalogDelta(deltaText);
  if (parsed.error) return [`catalog-delta.yaml 파싱 실패: ${parsed.error}`];
  const assetId = readTrimmedString(proposal.asset_id);
  const reviewed = parsed.proposals.find((candidate) => candidate.asset_id === assetId && candidate.asset_type === assetType);
  if (!reviewed) return [`catalog-delta.yaml 에 ${assetType}/${assetId} 과 일치하는 proposed_additions 항목이 없습니다.`];
  return validateProposalMatchesDelta(proposal, reviewed);
}

function validateAssetId(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return ["asset_id 는 필수입니다."];
  return /^[a-z0-9][a-z0-9._-]*$/.test(value.trim()) ? [] : ["asset_id 형식이 올바르지 않습니다."];
}

function validateProposalMatchesDelta(proposal: PublishProposal, reviewed: ProposedAddition): string[] {
  const fields = [
    "asset_id",
    "asset_type",
    "name",
    "domain_scope",
    "business_domains",
    "owner",
    "reuse_status",
    "capability_tags",
    "binding",
    "connection",
    "workflow_profile",
    "exposure",
    "responsibility",
    "inputs",
    "outputs",
    "composition",
    "risk_signals",
    "runtime_mock",
    "required_before_approval",
    "contract_status",
    "notes",
    "source_candidate_id"
  ] as const;
  return fields.flatMap((field) =>
    isDeepStrictEqual(proposal[field], reviewed[field])
      ? []
      : [`catalog-delta.yaml 의 ${field} 값이 publish 요청과 일치해야 합니다.`]
  );
}

function validateOptionalFieldSpecs(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} 는 배열이어야 합니다.`];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [`${field}[${index}] 는 객체여야 합니다.`];
    const details: string[] = [];
    if (typeof item.name !== "string" || !item.name.trim()) details.push(`${field}[${index}].name 은 문자열이어야 합니다.`);
    if (typeof item.type !== "string" || !item.type.trim()) details.push(`${field}[${index}].type 은 문자열이어야 합니다.`);
    return details;
  });
}

function validateOptionalStringArray(field: string, value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${field} 는 문자열 배열이어야 합니다.`];
  return value.flatMap((item, index) =>
    typeof item === "string" && item.trim() ? [] : [`${field}[${index}] 는 문자열이어야 합니다.`]
  );
}

function validatePublishReadiness(proposal: PublishProposal): string[] {
  const details: string[] = [];
  if (isRecord(proposal.binding) && proposal.binding.kind === "unresolved") {
    details.push("binding.kind unresolved 자산은 Catalog에 publish할 수 없습니다.");
  }
  if (isRecord(proposal.connection) && proposal.connection.transport === "unknown") {
    details.push("connection.transport unknown 자산은 Catalog에 publish할 수 없습니다.");
  }
  if (isRecord(proposal.workflow_profile) && proposal.workflow_profile.representation === "unresolved") {
    details.push("workflow_profile.representation unresolved 자산은 Catalog에 publish할 수 없습니다.");
  }
  return details;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
