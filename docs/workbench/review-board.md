# Agent Factory 검토 보드(Review Board)

> 이 문서는 strict Target Contract v2의 사람 검토 정책이다. 자산 값은 [Taxonomy](taxonomy.md), 실행 관계는 [Graph IR](graph-ir.md), stage와 approval은 [Operating Model](operating-model.md)이 소유한다.

Review Board의 목적은 analyzer output을 자동 승인하는 것이 아니라 책임, 계약, 위험, 재사용 판단을 사람이 설명 가능하게 만드는 것이다.

## Target Contract: 검토 축

| 축 | 검토 질문 | 필요한 evidence |
| --- | --- | --- |
| 자산 유형 | Agent, Workflow, Tool 중 실제 책임에 맞는가? 비자산인가? | [판별 질문](taxonomy.md#판별-질문)의 책임 근거와 반례 |
| 책임 경계 | 한 문장으로 책임과 비책임을 설명할 수 있는가? | rationale, 포함·제외 범위 |
| 입출력 | 이름·type·required·schema와 오류 계약이 충분한가? | input/output fields, example, failure behavior |
| Domain Scope | 적용 범위와 실제 business domain을 구분했는가? | `domain_scope`, `business_domains` 근거 |
| Owner | 변경·운영·품질 책임 주체가 분명한가? | `owner`, escalation 경로 |
| Reuse | 기존 자산 재사용, publish 후보, project-only 등을 결정했는가? | `reuse_status`, Catalog evidence |
| Binding | Tool 또는 Agent를 어떤 방식으로 연결하는가? | `binding`, `connection`, contract ref |
| Workflow Profile | representation과 coordination을 별도로 판단했는가? | `workflow_profile`, Graph evidence |
| Invocation Control | Tool 실행을 Workflow와 Agent 중 누가 결정하는가? | Tool Node 또는 Agent `available_tools` 관계 |
| Graph | refs, control, channel, regions, standalone 여부가 유효한가? | strict Graph IR와 validation result |
| Side effect·Security | write, auth, masking, audit, idempotency가 드러나는가? | risk signal과 runtime contract |
| Missing information | 추정 없이 blocker와 확인 주체가 기록됐는가? | `missing_information`, status, resolution evidence |

### 유형 승인 규칙

- Agent, Workflow, Tool 외 category를 승인하지 않는다.
- 역할명, Domain, 프로토콜, subtype 설명을 `asset_type`으로 승격하지 않는다.
- Resource, Dependency, Interface, Function Node, Human Input Node, Join Node를 Catalog asset으로 자동 승격하지 않는다.

### 호출 관계 승인 규칙

- Tool Node는 `tool_ref`와 `invocation_control: workflow`를 갖는다.
- Agent가 선택할 수 있는 Tool은 Agent Node의 `available_tools`에 `invocation_control: agent`로 둔다.
- Model, LLM, 사람을 Invocation Control 값으로 승인하지 않는다.
- Subworkflow는 `workflow_ref`로 Workflow asset을 참조한다.

### 보안·원격 경계 승인 규칙

A2A는 Agent의 원격 연결 경계다. 독립 Owner, Agent Card, interface, auth, lifecycle, timeout, retry, fallback, cancellation, audit, data policy가 없으면 추가 정보로 돌린다. A2A를 별도 asset category나 Tool/MCP 호출로 승인하지 않는다.

## Target Contract: 승인 결정

| 결정 | 의미 |
| --- | --- |
| Approve | 책임·계약·risk와 필수 정보가 검토됐고 candidate를 다음 단계 입력으로 사용할 수 있다. |
| Needs info | 중요한 정보가 없어 안전한 분류·계약·Graph·scaffold 판단이 불가능하다. |
| Defer | 현재 범위에서는 구현·publish하지 않지만 후보 기록을 유지한다. |
| Reject | 책임 중복, 잘못된 경계, 정책 위반 등으로 후보를 사용하지 않는다. |

Approve는 “좋아 보인다”는 표시가 아니다. `missing_information`이 모두 해결되거나 명시적으로 허용 가능한 requirement 수준 항목으로 처리되고, candidate의 `status`가 일관되어야 한다.

## 검토 기록 최소 요건

- 결정과 시각
- 검토자 또는 책임 역할
- 결정 근거
- 확인한 source·Catalog·requirement evidence
- 남은 위험과 후속 조치
- 영향을 받는 asset ID, Graph element, contract ID
- approval gate와의 관계

댓글이나 highlight는 보조 evidence이며 candidate status, contract status, manifest approval을 대신하지 않는다.

## Current Product flow

Design 화면은 Asset 목록과 상세 검토를 제공한다. `DesignAssetReview.tsx`의 `AssetSidebar`와 `AssetReviewDetail`이 strict `AssetCandidate`를 표시하고, `assetReview.ts`가 누락 정보 해소, approve, defer, reject 상태 전이를 수행한다.

- `resolveMissingItem`은 해소된 항목을 기록하고 남은 항목을 계산한다.
- `approveCandidate`는 unresolved missing item이 있으면 거부한다.
- `setCandidateStatus`는 `deferred` 또는 `rejected`로 바꾼다.
- Graph는 candidate status를 복제하는 `review_status` projection을 갖지 않는다. 참조 무결성과 실행 구조만 strict Graph shape로 검증한다.
- Design action은 canonical `analysis-result.json`을 저장하되 approval gate는 별도 명시 행동으로 갱신한다.

A2A 검토는 Agent candidate의 `binding`/`exposure` contract ref와 `a2aContracts`를 함께 확인한다. 계약 누락, ref 불일치, 미승인 runtime readiness를 자동 보정하지 않는다.

Catalog publish 후보는 `catalog_entry_id`, `reuse_status`, strict asset fields를 검토한 뒤 Verify의 `catalog-delta.yaml` proposal로 전달한다. publish는 별도 사람 승인이다.

## 검토 완료 조건

- 모든 candidate가 Agent, Workflow, Tool 또는 명시적 비자산으로 설명된다.
- 책임, 입출력, Domain Scope, Owner, reuse status, Binding이 검토됐다.
- Workflow Profile과 Graph 실행 구조가 일치한다.
- Invocation Control이 `workflow` 또는 `agent`로 근거와 함께 기록됐다.
- missing information과 contract blocker가 해소됐다.
- A2A는 Agent 경계로 검토됐다.
- 승인 결정과 근거가 artifact·manifest에 일관되게 반영됐다.

## Current source locators

2026-07-19 현재 working tree에서 다음을 재확인했다.

| 검토 행동 | Path | Stable symbol |
| --- | --- | --- |
| candidate 상태 전이 | `packages/web/src/analyzer/assetReview.ts` | `resolveMissingItem`, `approveCandidate`, `setCandidateStatus` |
| Asset 검토 UI | `packages/web/src/routes/design/DesignAssetReview.tsx` | `AssetSidebar`, `AssetReviewDetail` |
| Design review 조합 | `packages/web/src/routes/design/DesignReviewStep.tsx` | `DesignReviewStep` |
| Design 저장·approval action | `packages/web/src/routes/design/designWorkbenchActions.ts` | `createDesignWorkbenchActions` |
| candidate/Graph strict assertion | `packages/web/src/analyzer/targetContract.ts` | `validateCandidates`, `validateGraph` |
| approval과 stage status 갱신 | `packages/web/server/afArtifactCrudApi.ts` | `handlePatchApprovals`, `projectApprovalStageStatuses` |
