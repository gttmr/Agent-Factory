> **Target Contract** — 자산 정의는 [Taxonomy](../../workbench/taxonomy.md), Workflow 실행 표현은 [Graph IR](../../workbench/graph-ir.md)가 기준이다. 이 문서는 Function·MCP·A2A의 연결 위치를 설명하며 Current Implementation의 `legacy` 직렬화를 Target 값으로 선언하지 않는다.

# 프로토콜 프로파일

## 프로파일 원칙

프로토콜과 실행 경계는 자산 유형, Binding, Transport를 분리해 기록한다. Agent/Workflow/Tool의 책임은 어디서 실행되는지가 아니라 [Taxonomy](../../workbench/taxonomy.md)의 판단 기준으로 정하고, 연결 위치는 아래 프로파일로 보완한다.

| 사례 | 자산 또는 Graph 위치 | Binding·프로토콜 위치 | 대표 Transport | 경계 해석 |
| --- | --- | --- | --- | --- |
| Workflow 내부 결정적 함수 | Function Node | 부모 Workflow 내부 구현 | `in_process` | Workflow 안의 로컬 실행 단계이며 독립 Catalog 자산이 아니다. |
| Function Tool | Tool 자산 | `function` Binding | `in_process` | 구조화된 Tool 계약을 로컬 함수에 연결한다. |
| 로컬 MCP Tool | Tool 자산 | `mcp` Binding | `stdio` | 로컬 MCP server process를 통해 Tool을 소비한다. |
| 원격 MCP Tool | Tool 자산 | `mcp` Binding | `http` | 원격 MCP server를 통해 Tool을 소비한다. |
| 원격 A2A Agent | Agent 자산 | `a2a` Binding 또는 Exposure | 원격 HTTP 경계 | Agent Card로 발견되는 독립 Agent 경계를 호출하거나 노출한다. |

Function Node와 Function Tool은 같은 개념이 아니다. Function Node는 한 Workflow의 내부 실행 단계이고, Function Tool은 Tool 자산에 Function Binding을 적용한 경우다. 자세한 구분은 [Graph IR의 Function Node, Tool Node, Function Tool](../../workbench/graph-ir.md#function-node-tool-node-function-tool-구분)을 따른다.

## Binding과 Transport 분리

| 축 | 답하는 질문 | 이 프로파일의 예 |
| --- | --- | --- |
| Binding | 자산 계약을 어떤 방식으로 연결하는가? | Function, MCP, A2A |
| Transport | 호출이 실제로 어디에서 실행되거나 어떤 경로로 이동하는가? | in-process, stdio, HTTP |

Binding이 같아도 Transport는 달라질 수 있다. MCP Tool은 로컬 `stdio` 또는 원격 `http`로 연결할 수 있으므로 “Local Tool”과 “MCP Tool”을 반대 유형으로 두지 않는다. 반대로 `http`만으로 Tool인지 Agent인지 결정할 수 없으며, 자산 책임과 프로토콜 계약을 함께 확인해야 한다.

Binding과 Transport의 Target 값과 Backend/Dependency 분리 원칙은 [Taxonomy의 Binding, Transport, Backend 분리](../../workbench/taxonomy.md#binding-transport-backend-분리)가 소유한다. 이 문서의 표는 대표 조합을 설명할 뿐 별도 enum을 정의하지 않는다.

## Local ADK 실행 경계

Local ADK 경계는 검토·승인된 artifact를 같은 runtime 안에서 실행하고 smoke 검증하는 경계다. Workflow 내부 Function Node와 Function Tool은 `in_process`, 로컬 MCP server는 `stdio`로 연결할 수 있다. 이 실행 위치만으로 새 자산 유형이나 원격 계약이 생기지 않는다.

여러 단계, 분기, 병렬 실행, Join, Human Input, callback wait가 있다는 사실도 그 자체로 A2A 경계를 만들지 않는다. 이 동작은 [Graph IR](../../workbench/graph-ir.md)의 Workflow 실행 의미로 먼저 표현한다.

## 원격 A2A 경계

2026-07-18에 확인한 ADK 공식 문서는 A2A 지원을 **Experimental**로 표시한다. 기존 ADK Agent를 A2A server로 노출할 수 있고, 소비 측에서는 `RemoteA2aAgent`가 Agent Card URL을 사용해 원격 Agent의 proxy 역할을 한다. 확인한 공식 문서 범위에서는 Workflow 자체의 A2A 노출을 직접 일반화할 근거를 찾지 못했으므로 Agent 경계를 넘어 추론하지 않는다.

원격 A2A 경계는 로컬 ADK 구성보다 독립 소유·발견·lifecycle·auth·timeout·audit 계약이 필요한 Agent 상호운용 경계다. 따라서 A2A를 MCP Tool 호출과 혼합하지 않고, Graph에서는 Agent Node와 protocol boundary로 표현한다. 공식 근거와 확인 날짜는 [Public Source Links](source-links.md)에 정리한다.

## Current Implementation(`legacy`)

현재 구현은 `module_category: remote_a2a`를 최상위 `legacy` category로 직렬화한다. 이 값은 현행 schema·analyzer·validator·UI 계약을 읽을 때 보존하지만, Target Contract에서는 Agent 자산과 A2A Binding/Exposure 또는 protocol boundary로 해석한다. 구체적인 영향 영역과 migration gap은 `docs/migration/taxonomy-vnext-status.md`가 기록한다.
