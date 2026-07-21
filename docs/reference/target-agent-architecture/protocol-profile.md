# A2A 프로토콜 프로파일

> 자산 정의는 [Taxonomy](../../workbench/taxonomy.md), Workflow 실행 표현은 [Graph IR](../../workbench/graph-ir.md)가 기준이다. 이 문서는 Agent와 A2A Binding·Exposure의 Current Implementation 연결만 설명한다.

## 계약 경계

A2A는 Agent가 다른 Agent를 호출하거나 자신의 Agent interface를 노출하는 프로토콜 경계다. A2A 자체는 자산 category가 아니며 Agent·Workflow·Tool 외의 별도 Catalog 자산을 만들지 않는다.

| 방향 | Agent 필드 | 의미 |
| --- | --- | --- |
| 원격 Agent 소비 | `binding: { kind: "a2a", contract_ref }` | 이 Agent 자산을 Agent Card로 발견되는 원격 Agent에 연결한다. |
| Agent 제공자 노출 | `exposure: { protocol: "a2a", contract_ref }` | 이 Agent 자산을 A2A provider로 노출한다. |

`contract_ref`는 `a2aContracts[].contract_id`를 가리키며 해당 계약의 `agent_ref`는 같은 Agent 자산을 가리켜야 한다. Agent 외 자산에는 A2A Exposure를 허용하지 않고 Workflow에는 Binding이나 Exposure를 두지 않는다.

```json
{
  "asset_id": "agent.remote-reviewer",
  "asset_type": "agent",
  "binding": {
    "kind": "a2a",
    "contract_ref": "a2a-001"
  },
  "connection": {
    "transport": "http"
  },
  "workflow_profile": null,
  "exposure": null
}
```

Provider Agent는 `binding`이 `null`이어도 A2A `exposure`를 가질 수 있다. 한 Agent가 소비와 노출을 모두 담당하면 두 필드가 같은 검토 계약을 참조할 수 있지만, 호출 방향과 노출 방향의 의미는 섞지 않는다.

## Graph 위치

A2A Agent는 Graph에서 `node_kind: agent`와 `agent_ref`로 표시한다. Node가 참조한 Agent 자산의 `binding.kind: a2a` 또는 `exposure.protocol: a2a`가 A2A 경계 여부를 결정한다.

- A2A 전용 Node kind를 추가하지 않는다.
- Edge `control.kind`나 `channel`에 A2A 값을 넣지 않는다.
- Agent Node의 자산 badge와 A2A protocol badge를 분리해 표시한다.
- 여러 단계·분기·병렬·반복이 있다는 이유만으로 Workflow를 A2A Agent로 취급하지 않는다.

자세한 Node와 경계 표현은 [Graph IR의 A2A 경계](../../workbench/graph-ir.md#a2a-경계)를 따른다.

## A2A 계약

`A2AContract`는 다음 원격 경계 정보를 소유한다.

- Agent Card discovery와 `agent_card_url`
- supported interface, protocol version, input/output mode
- security scheme과 requirement
- message part와 role
- task lifecycle, terminal state, input/auth-required follow-up
- streaming, operation, HTTP path
- timeout, auth, retry handoff, fallback handoff, cancellation
- audit와 data policy

Design의 A2A 계약 검토와 validator는 Binding·Exposure의 `contract_ref`와 `A2AContract.agent_ref`를 함께 확인한다. 승인된 계약과 유효한 Agent Card URL이 없는 원격 Agent는 runnable lowering 대상이 아니다.

## 원격 Agent 소비

generator는 `asset_type: agent`와 `binding.kind: a2a`를 모두 만족하는 자산만 원격 A2A 소비 대상으로 수집한다. 승인된 A2A 계약의 `agent_card.agent_card_url`과 runtime policy를 읽어 실제 ADK `RemoteA2aAgent`를 생성한다.

```python
remote_agent = RemoteA2aAgent(
    name="remote_agent",
    description="Remote review Agent",
    agent_card="https://example.invalid/.well-known/agent-card.json",
    use_legacy=False,
)
```

`use_legacy=False`는 현재 generator가 사용하는 upstream `RemoteA2aAgent` API 인자다. 이름에 포함된 문자열은 제거된 artifact 입력이나 projection을 다시 지원한다는 뜻이 아니다. 계약에 timeout이나 auth policy가 있으면 `timeout`과 `A2aRemoteAgentConfig` request interceptor를 추가한다.

## Agent 제공자 노출

생성된 A2A launcher는 ADK `get_fast_api_app(..., a2a=True, ...)`로 검토된 Agent app을 provider로 노출한다. Workbench runtime은 provider process와 Agent Card readiness를 관리하고, 명시적인 `message/send` probe로 semantic readiness를 확인한다.

Agent Card, RPC URL, task ID는 runtime 경계의 값이다. provider 노출이 Workflow 자산의 A2A Exposure를 만들거나 별도 자산 category를 추가하지 않는다.

## 지원하지 않는 역사 입력

legacy `module_category: remote_a2a`와 별도 원격 A2A 자산 root는 strict v2 입력이 아니다. 현재 reader와 generator는 이를 Agent + A2A Binding·Exposure로 projection하지 않으며, 현재 Analyze·Design 경로에서 Target v2 artifact를 다시 생성해야 한다.

## Current source locators

| 행동 | Path | Stable anchor |
| --- | --- | --- |
| Agent Binding·Exposure shape | [types.ts](../../../packages/web/src/analyzer/types.ts) | `AssetBinding`, `AssetExposure`, `AssetCandidate`, `A2AContract` |
| Agent 전용 A2A validation | [targetContract.ts](../../../packages/web/src/analyzer/targetContract.ts) | `validateBindingAndConnection`, `validateExposure`, `validateA2AReferences` |
| A2A 계약 생성 | [a2aContracts.ts](../../../packages/web/src/analyzer/a2aContracts.ts) | `createA2AContractForCandidate`, `buildContract` |
| Graph A2A 경계 판정 | [graphElementEditorModel.ts](../../../packages/web/src/components/graphElementEditorModel.ts) | `isA2AProtocolBoundary` |
| 승인·계약 drift generation gate | [context.mjs](../../../scripts/adk-source/context.mjs) | `validateRunInputs` |
| 원격 Agent runnable 생성 | [remote-a2a.mjs](../../../scripts/adk-source/remote-a2a.mjs) | `usesRemoteA2a`, `emitRemoteA2aNode`, `assertRemoteA2aSupported` |
| A2A provider launcher | [a2a-launcher.mjs](../../../scripts/adk-source/support/a2a-launcher.mjs) | `buildA2aLauncherPy` |
| generator 행동 검증 | [target-behavior-matrix.test.mjs](../../../scripts/adk-source-test/target-behavior-matrix.test.mjs) | `Target A2A Agent binding emits the actual ADK RemoteA2aAgent runtime` |

외부 ADK 근거와 확인 날짜는 [Public Source Links](source-links.md)에 기록한다. 저장소 행동은 위 current source locator를 최종 권위로 사용한다.
