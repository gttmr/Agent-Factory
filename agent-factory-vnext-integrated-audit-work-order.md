# Agent Factory 문서·Skills·Code 통합 적합성 점검 및 보완 작업 지시서

> **대상 저장소**: 로컬에서 문서 vNext, Skill vNext, 코드 변경이 진행된 `Agent-Factory` 작업 트리
> **실행 주체**: 현재 작업을 이어가고 있는 Codex 또는 Claude Code 세션
> **전제**: 변경 내용은 아직 Remote Git에 Push되지 않았을 수 있다. 반드시 현재 로컬 작업 트리를 기준으로 점검한다.
> **작업 성격**: 구현을 다시 처음부터 설계하는 작업이 아니라, 이미 변경한 **문서·Skills·Schema·UI·Generator·Runtime·Test·Handbook이 하나의 제품 계약으로 맞물리는지 검증하고 필요한 보완을 수행하는 작업**
> **핵심 산출물**: 근거가 포함된 통합 점검 보고서, 수정된 코드와 문서, 재실행 가능한 검증 증거

---

# 0. 이 지시서의 사용 방식

이 지시서는 모든 세부 구현을 미리 결정하지 않는다.

현재 세션의 모델은 저장소 전체와 실제 Diff를 읽고 다음을 스스로 판단할 수 있다.

- 어떤 파일이 현재 Source of Truth인지
- UI Stage 이름과 Skill 이름을 물리적으로 통일할지, 명시적 Mapping으로 유지할지
- 기존 Artifact의 Migration을 Import 시점에 할지, 별도 변환 절차로 둘지
- Runtime Pattern별 지원 범위를 어디까지 둘지
- 테스트를 어느 Package와 Command에 배치할지
- Compatibility Shim을 유지할지 제거할지
- Handbook의 L2 Stage를 현재 행동에 맞게 합치거나 나눌지

다만 아래에 적힌 **핵심 개념과 안전 불변조건**은 이미 합의된 기준이므로 다시 뒤집지 않는다.

이 작업은 다음 순서로 진행한다.

```text
현재 상태 고정
→ 의도와 구현의 Source of Truth 정리
→ 수정 없이 통합 점검
→ Finding 확정
→ 의존성 순서로 보완
→ End-to-End 재검증
→ Handbook 재동기화
→ 최종 보고
```

첫 번째 점검 Pass에서는 가능한 한 코드를 수정하지 않는다.
먼저 어떤 문제가 있는지 증거와 함께 고정한 뒤 수정한다.

---

# 1. 점검 목표

최종적으로 다음 질문에 답할 수 있어야 한다.

> 사용자가 자연어 요구를 입력했을 때, 새 Skill이 올바른 Agent·Workflow·Tool 후보를 도출하고, 실행 구조와 Runtime Pattern을 구성하며, Workbench가 이를 손실 없이 검토·저장하고, 승인된 계약만으로 ADK Scaffold를 생성하며, 생성 결과가 실제 Runtime에서 검증되고, 모든 행동이 문서와 Handbook에서 현재 Source에 연결되어 있는가?

단순히 다음 항목이 존재하는지만 확인하면 부족하다.

- 문서에 새 용어가 있음
- Skill 폴더가 있음
- Schema가 빌드됨
- UI가 렌더링됨
- Generator가 파일을 만듦
- 테스트 명령이 통과함

반드시 **계층 간 의미가 보존되는지**를 확인한다.

```text
사용자 요구
→ Skill Trigger
→ 구성요소 후보
→ Graph / Runtime Contract
→ Artifact 직렬화
→ UI Review / Edit
→ Approval
→ Scaffold Plan
→ Generated Source
→ Runtime Event
→ Verification Evidence
→ Catalog / Handbook Feedback
```

---

# 2. 검토자의 역할과 태도

## 2.1 역할

이 단계에서 당신은 세 역할을 수행한다.

### 통합 검토자

문서·Skills·Code를 각각 따로 보는 것이 아니라, 하나의 사용자 행동이 모든 계층에서 같은 의미를 갖는지 검토한다.

### 반대 관점의 검증자

자신이 앞에서 구현한 내용을 그대로 신뢰하지 않는다.

- 명칭이 맞아 보인다는 이유로 통과시키지 않는다.
- 자기 테스트가 자기 상수만 비교하는지 확인한다.
- Happy Path뿐 아니라 거부되어야 하는 경로를 실행한다.
- 문서를 근거로 코드를 추측하지 않고 실제 실행 결과를 확인한다.

### 보완 구현자

Finding을 먼저 고정한 후, 가장 작은 범위의 수정으로 계약을 맞춘다.

- 문제가 한 계층에 있다고 단정하지 않는다.
- Source of Truth가 잘못됐으면 중심 계약부터 고친다.
- Compatibility가 필요한 경우 이를 명시적 Layer로 둔다.
- Legacy 표현을 새 계약으로 위장하지 않는다.

## 2.2 자율적으로 판단할 부분

아래는 저장소 증거를 보고 판단한다.

- 파일명과 Directory 배치
- Stage ID 유지 여부
- Migration API 형태
- UI Interaction 상세
- Test Framework
- Code-generation 방식
- Pattern 지원 수준
- Compat 기간

결정할 때는 다음을 남긴다.

```text
Decision
Alternatives considered
Evidence
Why chosen
Impact
Residual risk
```

## 2.3 다시 결정하지 않을 부분

다음은 이미 확정된 개념이다.

- 최상위 자산은 Agent / Workflow / Tool
- Catalog Taxonomy와 Graph IR는 별도 계층
- Function Node와 Tool Node는 다름
- Tool Invocation Control은 Workflow / Agent
- MCP는 Tool Binding
- A2A는 Agent Connection 또는 Exposure
- Callback은 Runtime Hook
- Event Loop는 Runtime 실행 의미
- Ambient Agent는 Agent 종류가 아니라 Trigger Pattern
- Domain / Owner / Reuse는 별도 축
- `공통`은 Business Domain 값이 아님
- `unknown`은 정상 유형이 아니라 unresolved + needs-information
- Raw requirement에서 직접 Runtime Code를 만들지 않음
- 승인된 계약만 Scaffold가 소비
- Handbook은 위치 안내이며 Source가 구현의 최종 권위

---

# 3. 지식 인계: 목표 개념

## 3.1 Asset Taxonomy

```text
Agent
Workflow
Tool
```

### Agent

판단, 분류, 요약, 추천, 해석, 생성, Tool 사용 여부 결정, 다른 Agent에 대한 위임 등의 추론 책임을 갖는다.

### Workflow

둘 이상의 실행 단위를 연결해 순서, 분기, 병렬, 반복, 사람 입력, 중단·재개, 종료를 소유한다.

### Tool

명확한 입력 계약을 받아 특정 기능을 실행하고 결과 또는 오류를 반환한다.

다음은 Asset Type이 아니다.

```text
Adapter
Remote A2A
Function
MCP
Callback
Ambient Agent
Event Loop
Human Input
Join
Resource
External System
```

## 3.2 Graph IR

권장 의미는 다음과 같다.

```text
Input / Start
Agent Node
Tool Node
Function Node
Human Input Node
Subworkflow Node
Join Node
Output / End
```

현재 구현이 `router`, `loop_control`, `callback_wait` 같은 별도 Node를 사용하더라도 다음을 구분한다.

- Product Runtime에서 실제 독립 실행 의미가 필요한 Node인가
- 단순히 Function Node의 `role`, Edge 조건, Container semantics로 표현할 수 있는가
- 그것이 Asset Type으로 잘못 승격되지는 않았는가

## 3.3 Function Node / Function Tool / Tool Node

```text
Function Node
= 특정 Workflow 내부의 결정적 private 실행 단계

Function Tool
= Function Binding을 사용하는 Tool 자산

Tool Node
= Workflow가 Tool 자산을 명시적으로 실행하는 Graph Node
```

같은 Python 함수라도 등록·호출 방식에 따라 의미가 달라진다.

## 3.4 Tool Invocation Control

```text
Workflow
Agent
```

- Workflow: Graph 또는 결정적 코드가 Tool 실행을 명시
- Agent: Agent가 현재 상황을 판단해 Tool 실행 여부를 선택

사용자 대상 활성 용어로 `Model`, `LLM`, `selected_by_llm`을 사용하지 않는다.

내부 구현에서 모델이 Function Calling을 수행한다는 사실은 설명할 수 있다. 그러나 Product Contract의 선택 주체는 Agent다.

## 3.5 Binding / Transport / Backend

서로 다른 축이다.

```text
Binding
- Function
- MCP
- Built-in
- Unresolved

Transport
- In-process
- stdio
- HTTP
- Unknown

Backend / Dependency
- Database
- EAI
- Legacy API
- External Service
- Document AI
```

`Local`과 `MCP`를 반대값으로 만들지 않는다.

## 3.6 A2A

```text
Asset: Agent
Connection 또는 Exposure: A2A
```

A2A를 네 번째 Asset Type으로 만들지 않는다.

다음을 구분한다.

- A2A Exposing
- A2A Consuming
- Local Sub-agent
- Internal Workflow
- Tool 또는 MCP 호출

## 3.7 Domain / Owner / Reuse

```text
Domain Scope
- domain-specific
- cross-domain
- domain-neutral

Owner
- 변경·운영·품질 책임 조직

Reuse
- not-reviewed
- reuse-existing
- publish-candidate
- project-only
- excluded
```

예:

```text
일반 OCR Tool
- Domain Scope: domain-neutral
- Owner: AI 공통 플랫폼 조직

여신 문서검토 Workflow
- Domain Scope: domain-specific
- Business Domain: 여신
- Owner: 여신 담당 조직

여신 Workflow의 OCR Tool Node
- 여신 Workflow가 OCR Tool을 참조
- OCR Tool의 Owner와 Domain Scope를 덮어쓰지 않음
```

## 3.8 Advanced Runtime Pattern

| Pattern | 의미 |
|---|---|
| MCP | Tool 연결 방식 |
| A2A | Agent 원격 연결·노출 방식 |
| Callback | 실행 전후 Runtime Hook |
| Event Loop | Runner/Event/State/Artifact 처리 의미 |
| Ambient | Event Trigger를 통한 실행 진입 |
| Human Input | Graph Pause/Resume 경계 |
| Dynamic Workflow | 코드가 Runtime 경로를 결정하는 표현 |
| State/Artifact | 실행 간 데이터 전달과 Persistence |

---

# 4. 지식 인계: 목표 Skill 흐름

목표 Skill 체계는 다음이다.

```text
af-workflow
├─ af-discover-assets
├─ af-compose-solution
├─ af-scaffold-runtime
└─ af-verify-runtime
```

## 4.1 `af-workflow`

현재 Artifact와 요청 상태를 보고 필요한 Work Skill로 연결한다.

직접 후보 분류나 코드 생성을 수행하는 Skill이 아니다.

## 4.2 `af-discover-assets`

사용자 요구에서 다음을 도출한다.

```text
Evidence
Assumptions
Contradictions
Missing Information
Agent 후보
Workflow 후보
Tool 후보
Resource
Dependency
Domain Scope
Owner 후보
Reuse 후보
I/O
Risk / Side Effect
Runtime Pattern Hint
```

이 단계는 Graph를 확정하거나 코드를 생성하지 않는다.

## 4.3 `af-compose-solution`

승인 가능한 후보를 실행 구조로 조합한다.

```text
Standalone 여부
Workflow 필요성
Graph IR
Invocation Control
Binding
State / Artifact
Human Input
MCP
A2A
Callback
Ambient Trigger
Event Loop 의미
Runtime Policy
Scaffold Readiness
```

## 4.4 `af-scaffold-runtime`

승인된 Compose 결과만 사용한다.

```text
Approved Contract
→ Scaffold Plan
→ ADK Source / Runtime Handoff
```

Raw requirement를 직접 코드로 변환하지 않는다.

## 4.5 `af-verify-runtime`

다음을 구분해 검증한다.

```text
Skill 구조
Artifact Contract
Code correctness
Runtime smoke
Agent behavior evaluation
Catalog / Handbook feedback
```

## 4.6 Legacy Skill

기존 이름이 남아 있다면 다음 중 하나여야 한다.

- 완전 제거
- 명시적인 Compatibility Shim

두 Skill 체계가 동시에 독립적인 Canonical 절차를 갖고 있으면 안 된다.

---

# 5. 핵심 안전 불변조건

다음은 점검 전체에서 가장 먼저 확인한다.

## 5.1 Raw Requirement Gate

```text
raw requirement
≠ direct runtime code
```

반드시 검토된 Artifact와 Approval Gate를 거친다.

다음을 모두 확인한다.

- Skill
- API
- Stage Runner
- UI button
- Script
- Generator CLI
- Test helper
- Debug endpoint
- Fixture path

한 경로라도 Raw Requirement에서 Runtime Source를 만들 수 있으면 Blocker다.

## 5.2 Approval Source of Truth

다음을 확인한다.

- Approval을 누가 저장하는가
- Skill이 Approval을 직접 변경하지 않는가
- Manifest와 Candidate Status가 상호 모순되지 않는가
- UI가 상태를 다시 추론하여 덮어쓰지 않는가
- Generator가 Approval을 읽기만 하고 쓰지 않는가
- Approval 해제 후 Build가 계속 가능한 경로가 없는가

## 5.3 Private Data

다음이 Source, Fixture, Generated Bundle, Evidence에 들어가지 않아야 한다.

- Credential
- 실제 은행 Endpoint
- 실고객 데이터
- 사내 전용 Token
- 운영 Deployment Script
- 실제 인증 Header

## 5.4 Honest Support

지원되지 않는 Pattern은 다음처럼 처리한다.

- Unsupported로 명시
- Skill에서 Stop
- UI에서 선택 불가 또는 명확한 경고
- Generator가 추측으로 Placeholder를 실행 코드처럼 만들지 않음
- Verification에서 `unverified`를 `passed`로 바꾸지 않음

---

# 6. 점검을 시작하기 전 상태 고정

Remote Git은 현재 변경 내용을 포함하지 않을 수 있으므로 Local 상태를 고정한다.

## 6.1 기본 정보

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --format='%H %cI %s'
git remote -v
```

## 6.2 비교 기준 결정

현재 세션이 알고 있는 문서·Skill 개편 전 Commit이 있으면 이를 `BASE_REF`로 사용한다.

없으면 다음을 조사한다.

```bash
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
git merge-base HEAD '@{u}'
```

Upstream이 없거나 최신이 아니면 무리하게 Remote를 기준으로 삼지 않는다.

최종 보고에는 다음을 기록한다.

```text
BASE_REF
WORKTREE_HEAD
Committed local changes
Staged changes
Unstaged changes
Untracked files
```

## 6.3 Diff 보존

작업 전 상태를 Evidence로 저장한다.

```bash
git diff --stat
git diff --cached --stat
git diff --name-status
git diff --cached --name-status
```

필요하면 Patch를 로컬 Evidence 경로에 저장한다.

```bash
git diff > <audit-evidence>/unstaged.patch
git diff --cached > <audit-evidence>/staged.patch
```

Patch에는 Secret이 없는지 확인한다.

## 6.4 Audit 경로

저장소의 기존 Review/Audit 관례를 우선한다.

관례가 없으면 다음을 고려할 수 있다.

```text
artifacts/af-audit/<timestamp>/    # 실행 로그와 임시 증거
docs/reviews/<date>-vnext-audit.md # 영속적인 최종 보고
```

정확한 경로는 현재 저장소 구조에 맞게 선택한다.

---

# 7. Source of Truth 지도 만들기

수정 전에 다음 표를 작성한다.

| 개념 | 목표 정의 문서 | Skill 기준 | 직렬화 기준 | UI 기준 | Runtime 기준 | Test 기준 | Handbook |
|---|---|---|---|---|---|---|---|
| Asset Type | | | | | | | |
| Graph Node | | | | | | | |
| Invocation Control | | | | | | | |
| Tool Binding | | | | | | | |
| Domain Scope | | | | | | | |
| Owner | | | | | | | |
| Reuse | | | | | | | |
| Approval | | | | | | | |
| MCP | | | | | | | |
| A2A | | | | | | | |
| Callback | | | | | | | |
| Ambient | | | | | | | |
| Event Loop | | | | | | | |
| Human Input | | | | | | | |

이 표에서 다음을 찾는다.

- 한 개념에 Canonical Source가 둘 이상
- 어떤 계층에도 Source of Truth가 없음
- 문서와 Code의 이름이 다르지만 Mapping이 없음
- Schema와 TypeScript enum이 다름
- UI가 별도 로컬 상수를 사용
- Generator가 String Literal로 독자 해석
- Test가 실제 Source가 아닌 자체 복제 enum을 검증
- Handbook이 이전 파일과 Symbol을 가리킴

---

# 8. 점검 관점

각 관점은 독립 Pass로 수행한다.

## 8.1 의도 충실성

질문:

- 사용자가 요구한 작업 흐름이 실제 Product 흐름과 같은가
- 첫 단계가 “모듈 후보 도출”에 집중하는가
- 다음 단계가 “실행 구조 구성”에 집중하는가
- Scaffold가 승인 구조를 실제 코드로 연결하는가
- 검증이 단순 build가 아니라 행동을 확인하는가
- Workflow가 필요 없는 요구에 Workflow를 강제하지 않는가

## 8.2 개념 정합성

질문:

- Agent/Workflow/Tool이 같은 의미로 사용되는가
- Graph Node와 Asset Type이 섞이지 않는가
- Function Node/Tool Node/Function Tool이 구분되는가
- Agent-selected Tool이 고정 Tool Node로 저장되지 않는가
- A2A/Callback/Ambient/Event Loop가 잘못된 Asset Type이 아닌가
- `unknown`이 정상 subtype으로 남아 있지 않은가

## 8.3 계약 정합성

질문:

- Skill 산출물을 Schema가 표현할 수 있는가
- Schema를 TypeScript/Python이 손실 없이 읽는가
- UI 편집 후 새 필드가 보존되는가
- API round-trip 후 값이 사라지지 않는가
- Scaffold Plan이 필요한 필드를 전달하는가
- Generator가 같은 의미로 해석하는가

## 8.4 사용자 경험

질문:

- 단계명과 결과가 사용자가 이해하기 쉬운가
- “분석”, “설계”처럼 모호한 이름이 남아 있더라도 구체적인 결과 설명이 있는가
- Tool Invocation Control이 Workflow/Agent로 보이는가
- Legacy identifier가 사용자 화면에 노출되지 않는가
- Unsupported Pattern이 사용 가능한 것처럼 보이지 않는가
- Missing Information을 어디서 해결해야 하는지 명확한가

## 8.5 Runtime 실행성

질문:

- 생성된 Source가 import/compile되는가
- Artifact 의미가 실제 ADK API와 맞는가
- MCP/A2A/Callback/Ambient 경계가 Runtime에서 실행 가능한가
- State와 Artifact의 Commit 시점이 맞는가
- Human Input이 Pause/Resume되는가
- Dynamic Workflow가 bounded하게 종료하는가

## 8.6 유지보수성

질문:

- 동일 enum과 Mapping이 여러 곳에 수동 복제되어 있는가
- Legacy compatibility가 중심 로직에 흩어져 있는가
- Migration 경계가 명시적이며 제거 가능한가
- 새 Runtime Pattern을 추가할 수 있는 Generic Contract인가
- Handbook이 변경 행동의 모든 Source site를 찾도록 돕는가

## 8.7 검증 신뢰성

질문:

- Test가 실제 사용자 경로를 통과하는가
- Negative Test가 있는가
- Test가 hard-coded fixture를 자기 자신과 비교하는 데 그치지 않는가
- Runtime Evidence가 fresh command 결과인가
- Codex/Claude fresh-session에서 Skill이 실제 Trigger되는가

---

# 9. 문서 점검

## 9.1 Canonical 문서

먼저 다음의 실제 경로와 역할을 확인한다.

```text
Taxonomy
Graph IR
Operating Model
Skill Lifecycle
Migration Status
Handbook Overview
Handbook Index
Handbook Registers
Runtime Pattern References
```

경로명은 구현에 따라 달라도 된다. 역할이 중복되면 안 된다.

## 9.2 문서 간 일관성

다음 표현을 전체 활성 문서에서 검색한다.

```bash
rg -n -i \
  'adapter|adapter_kind|agent_kind|specialist|shared agent|domain agent|common agent|remote_a2a|selected_by_llm|decision_owner.*llm|fixed_by_workflow|공통' \
  --glob '*.md' \
  --glob '!docs/archive/**' \
  --glob '!docs/handoff/**'
```

검색 결과는 문맥별로 판단한다.

허용:

- Migration 표
- Current Implementation 설명
- Compatibility Shim 설명
- 실제 Legacy Path 이름

금지:

- 활성 Asset Type
- 활성 Invocation Control
- 새 Artifact 출력 값
- 사용자 대상 UI 용어
- 새 Skill의 분류 규칙

## 9.3 Target와 Current

문서가 다음을 정직하게 구분하는지 확인한다.

```text
Target Contract
Current Implementation
Legacy Compatibility
Unsupported
Migration Complete
```

코드가 이미 변경되었다면 Migration Status도 실제 상태로 갱신되어야 한다.

## 9.4 문서가 구현을 과장하지 않는지

다음 표현은 실제 End-to-End Test가 있을 때만 허용한다.

- “지원한다”
- “생성한다”
- “실행된다”
- “검증되었다”
- “Codex와 Claude Code에서 동작한다”
- “A2A를 지원한다”
- “Ambient Agent를 지원한다”

설계 Artifact만 만들 수 있다면 `design-only`로 표현한다.

---

# 10. Skill 점검

## 10.1 Skill Inventory

```bash
find .agents/skills -type f | sort
```

각 Skill에 대해 기록한다.

```text
Name
Description
Trigger
Precondition
Read Set
Allowed Write
Forbidden Write
Stop Condition
Verification
Output
Next Handoff
References
Scripts
```

## 10.2 Entrypoint와 Work Skill

확인할 사항:

- `af-workflow`가 실제 Entrypoint인가
- Entrypoint가 모든 작업을 직접 수행하지 않는가
- 네 Work Skill의 책임이 중복되지 않는가
- 각 Skill이 세션 compaction 이후 독립적으로 읽혀도 이해되는가
- Skill 간 Handoff가 파일과 상태로 명확한가
- 이전 단계가 없을 때 무리하게 진행하지 않는가

## 10.3 Trigger 충돌

다음을 검증한다.

- Natural language trigger
- Explicit invocation
- Legacy Skill invocation
- 비관련 요청
- 모호한 요청
- 이미 Artifact가 있는 이어하기 요청

특히 확인한다.

```text
af-discover-assets와 af-compose-solution이 동시에 Trigger되지 않는가
af-scaffold-runtime이 “만들어줘”라는 말만 보고 Raw Requirement에서 실행되지 않는가
af-verify-runtime이 코드 작성 요청을 가로채지 않는가
Legacy Shim이 Canonical Skill과 경쟁하지 않는가
```

## 10.4 Progressive Disclosure

확인한다.

- `SKILL.md`가 지나치게 길지 않은가
- 필요한 Runtime Pattern Reference만 읽는가
- MCP 요구가 없는데 MCP/A2A/Ambient 문서를 모두 읽지 않는가
- Reference가 다시 다른 Reference를 연쇄적으로 강제하지 않는가
- 긴 API 설명이 SKILL.md에 중복되어 있지 않은가

## 10.5 Skill Output와 Product Contract

각 Skill 출력 필드를 실제 Schema와 비교한다.

다음 중 하나라도 있으면 Finding이다.

- Skill은 필드를 요구하지만 Schema가 없음
- Schema는 필수인데 Skill은 만들지 않음
- Skill 용어와 UI label이 다름
- Skill은 Agent Invocation Control을 쓰지만 Code는 LLM 값만 허용
- Skill은 A2A Binding을 쓰지만 Code는 Remote Asset을 요구
- Skill은 Function Node를 만들지만 Generator가 Legacy Adapter로 처리
- Skill은 Unsupported Pattern을 Ready로 표시

## 10.6 Stop Condition

최소 다음 거부 경로를 실제로 실행한다.

- Missing Information
- Approval 없음
- Runtime Contract 없음
- A2A Owner/Auth 없음
- MCP Tool schema 없음
- Ambient Output Sink 없음
- Callback Hook 불명확
- Raw Requirement Direct Scaffold
- Private Endpoint 포함
- Unsupported ADK API

---

# 11. Schema·Type·Validator 점검

## 11.1 전체 정의 위치 찾기

다음을 검색한다.

```bash
rg -n \
  'module_category|asset_type|node_kind|invocation_control|call_control|decision_owner|binding|transport|domain_scope|owner|reuse|workflow_profile' \
  schemas packages scripts templates tests .agents/skills docs
```

## 11.2 단일 의미 확인

각 필드에 대해 확인한다.

```text
Name
Allowed Values
Required Conditions
Default
Null / unresolved behavior
Migration behavior
UI label
Generator behavior
Validation error
```

## 11.3 Unknown 처리

다음을 확인한다.

- `unknown`이 새 Artifact의 정상값으로 남아 있지 않은가
- 불명확한 값은 `unresolved`와 `needs_information`으로 남는가
- UI가 unresolved를 임의 Default로 바꾸지 않는가
- Generator가 unresolved를 임의 구현하지 않는가
- Approval이 unresolved 상태에서 가능하지 않은가

## 11.4 Round-trip

다음 경로를 실제로 검증한다.

```text
Skill output
→ JSON parse
→ Server read
→ UI load
→ UI edit
→ Server save
→ reload
→ Artifact sync
→ Scaffold Plan
→ Generator
```

새 필드가 중간에서 사라지거나 Legacy 값으로 바뀌지 않아야 한다.

특히 Optional nested object와 array를 확인한다.

## 11.5 Backward Compatibility

Legacy Artifact에 대해 정책을 확인한다.

가능한 정책:

- 명시적 Migration
- Read-only Compatibility
- Clear rejection
- Temporary importer

확인한다.

- Legacy Artifact를 열었을 때 새 값으로 오인하지 않는가
- 새 Artifact 저장 시 Legacy 값으로 Downgrade되지 않는가
- Migration이 원본을 몰래 파괴하지 않는가
- Version 또는 provenance가 남는가

---

# 12. UI·Workbench 점검

## 12.1 사용자 Journey

실제 화면에서 다음 흐름을 수행한다.

```text
Artifact root 생성
→ 요구 입력
→ 구성요소 후보 검토
→ 실행 구조 구성
→ Missing Information 해결
→ Runtime Pattern 검토
→ Approval
→ Scaffold
→ Run
→ Verify
→ Catalog feedback
```

현재 Product가 일부만 지원하면 실제 지원 범위를 기록한다.

## 12.2 Label과 Inspector

확인한다.

- Agent / Workflow / Tool
- Function Node / Tool Node
- Workflow / Agent Invocation Control
- Function / MCP Binding
- Domain Scope
- Owner
- Reuse
- A2A Connection
- Callback / Ambient Runtime Pattern

Legacy 내부값을 사용자 label로 노출하지 않는다.

## 12.3 편집 후 보존

각 필드를 UI에서 수정하고 reload한다.

확인할 대상:

- Asset Type
- Node Type
- Tool reference
- Invocation Control
- Binding
- Transport
- Owner
- Domain Scope
- Missing Information
- Runtime Pattern Contract
- Approval

## 12.4 Gate UI

다음을 검증한다.

- 아직 Ready가 아닌 Candidate를 승인할 수 없는가
- Approval 상태와 Button 상태가 일치하는가
- Approval 취소 후 Build가 차단되는가
- Runtime Contract가 빠진 Pattern이 경고되는가
- UI가 “지원됨”과 “설계만 가능”을 구분하는가

## 12.5 Legacy 표시

기존 파일명이나 API 이름이 `adapter`를 포함하더라도 사용자에게 목표 개념이 Tool임을 명확히 해야 한다.

그러나 내부 경로를 감추기 위해 존재하지 않는 새 기능을 주장하지 않는다.

---

# 13. Stage Runner·Persistence 점검

## 13.1 Skill 이름과 Product Stage 이름

두 이름이 같을 필요는 없다.

하지만 다음 중 하나여야 한다.

### 같은 이름을 사용

- Skill ID와 Product Stage가 일치
- 모든 API와 Manifest가 갱신됨

### 명시적 Mapping 사용

- Product Stage는 내부 lifecycle ID
- Skill은 사용자 작업 단위
- Mapping이 한 곳에 정의
- Docs와 UI에 혼동 없음

다음은 금지다.

- 일부 화면은 Analyze, 일부 Skill은 Discover, 일부 Manifest는 Design인데 Mapping이 없음
- Stage 순서가 Skill Handoff와 다름
- Legacy 이름으로 인해 잘못된 Skill이 호출됨

## 13.2 Proposed-first

확인한다.

- Stage Runner는 허용된 proposed artifact만 작성하는가
- Apply 전 Canonical Artifact가 바뀌지 않는가
- Diff preview가 실제 변경과 일치하는가
- Apply 실패 시 partial write가 남지 않는가
- Skill이 manifest approval을 직접 변경하지 않는가

## 13.3 Concurrent / Re-run

검증한다.

- 동일 Stage 재실행
- 이전 proposal 존재
- Apply 후 다시 실행
- 취소
- 실패
- stale run
- 두 Browser 또는 두 Session의 충돌

최소한 데이터 손실이나 잘못된 Approval 전파가 없어야 한다.

---

# 14. Scaffold Plan·Generator 점검

## 14.1 입력 계약

Generator가 읽는 모든 값의 Source를 추적한다.

```text
Approved candidate
Graph IR
Runtime Contract
Tool Binding
A2A Contract
Callback Contract
Ambient Trigger
State / Artifact
Human Input
Output Mode
```

Raw Requirement Text가 구현 결정을 직접 내리는 경로가 없어야 한다.

## 14.2 Node lowering

각 Node가 실제 Runtime 구조로 어떻게 변환되는지 확인한다.

| Graph 의미 | Generated 의미 |
|---|---|
| Agent Node | Agent 실행 |
| Tool Node | Workflow-controlled Tool 호출 |
| Function Node | Workflow private function |
| Human Input | Pause / resume |
| Subworkflow | Workflow call |
| Join | fan-in |
| Agent-selected Tool | Agent tool capability, 고정 Node 아님 |

Legacy Generator branch가 새 의미를 왜곡하지 않는지 확인한다.

## 14.3 Binding lowering

확인한다.

### Function Tool

- schema
- docstring/description
- import
- error shape
- Agent-selected 또는 Workflow-controlled 관계

### MCP Tool

- server/tool reference
- transport
- auth env
- filter
- timeout
- lifecycle cleanup
- mock
- unavailable server error

### A2A

- Exposing / Consuming
- Agent Card
- auth
- timeout
- task/artifact
- mock server

## 14.4 Output Mode

실제 지원 범위를 확인한다.

```text
Skeleton
Smoke
Runnable Prototype
Production
```

Production을 지원하지 않으면 이름과 문서가 이를 분명히 해야 한다.

## 14.5 생성 결과 품질

확인한다.

- deterministic file tree
- import/compile
- TODO가 명확
- private data 없음
- 환경 변수 이름 문서화
- mock 교체 seam
- implementation handoff
- tests
- README
- Generated code가 Artifact 의미를 주석으로 덮어쓰지 않음

---

# 15. Runtime Pattern End-to-End 점검

각 Pattern을 다음 Support Level 중 하나로 분류한다.

```text
Unsupported
Design-only
Scaffold-only
Smoke-tested
End-to-end verified
```

Pattern마다 근거를 기록한다.

## 15.1 MCP

확인 체인:

```text
Discover Hint
→ Compose Contract
→ Schema
→ UI
→ Scaffold
→ MCP Server/Client
→ Mock
→ Verify
→ Docs/Handbook
```

필수 질문:

- Tool Asset으로 표현되는가
- Invocation Control이 Workflow/Agent인가
- stdio/HTTP가 분리되는가
- Agent Toolset과 고정 Tool Node가 구분되는가
- Tool allow-list가 있는가
- timeout/auth/error가 검증되는가

## 15.2 A2A

확인 체인:

```text
Agent 후보
→ A2A 필요성 판단
→ Connection/Exposure Contract
→ UI
→ Scaffold
→ Local mock remote agent
→ Verify
```

필수 질문:

- Remote A2A Asset을 다시 만들지 않는가
- Local Sub-agent 대안을 검토하는가
- Owner/lifecycle/network evidence가 있는가
- Exposing과 Consuming이 구분되는가
- Agent Card와 auth가 검증되는가

## 15.3 Callback

확인 체인:

```text
Runtime need
→ Hook selection
→ Contract
→ Scaffold
→ Continue/Override test
→ State/Audit verification
```

필수 질문:

- Callback을 Tool로 분류하지 않는가
- hook 위치가 맞는가
- return/override semantics가 현재 ADK와 맞는가
- side effect가 재실행 시 중복되지 않는가
- 여러 Agent 공통 정책이면 Plugin 대안을 검토하는가

## 15.4 Event Loop

확인 체인:

```text
Graph/Agent/Tool
→ Event
→ Runner
→ State/Artifact action
→ Commit
→ Resume
→ Verification
```

필수 질문:

- Event 처리 전 persisted state를 가정하지 않는가
- partial/final event를 구분하는가
- Callback과 Tool result가 Event history에 남는가
- Session scope와 Invocation scope가 구분되는가
- Handbook Register가 실제 read/write와 일치하는가

## 15.5 Ambient

확인 체인:

```text
Event source
→ Trigger Contract
→ Payload normalization
→ Session
→ Agent/Workflow
→ Output sink
→ Retry/DLQ
→ Verify
```

필수 질문:

- Ambient Agent를 Asset Type으로 만들지 않는가
- `/run`과 trigger endpoint 선택 근거가 있는가
- idempotency와 duplicate delivery를 다루는가
- output sink가 있는가
- 사람의 실시간 응답을 기다리는 구조를 잘못 넣지 않는가
- timeout과 long-running 적합성을 검토하는가

## 15.6 Human Input / Resume

확인한다.

- Prompt
- response schema
- choice mapping
- pause event
- resume input
- rerun semantics
- completed child replay
- approval audit
- session recovery

## 15.7 Dynamic Workflow

확인한다.

- Graph로 충분한데 Dynamic을 과용하지 않는가
- bounded loop인가
- exit 조건이 승인 Artifact에 있는가
- recursion/cycle가 검증되는가
- pause/resume 시 replay 의미가 안전한가
- Generator가 hard-coded business route를 만들지 않는가

---

# 16. Vertical Slice 점검

각 시나리오는 문서부터 Runtime까지 한 번에 추적한다.

모든 시나리오를 동일하게 구현할 필요는 없다.
지원하지 않는 경우에는 지원 수준과 Stop behavior가 일관되어야 한다.

## VS-01 단일 Agent

요구:

```text
고객 문의를 분류하는 Agent
Tool 없음
```

기대:

- Agent 후보 하나
- Workflow 불필요
- Graph 강제 생성 없음
- Scaffold 가능
- Behavior eval 가능

## VS-02 Workflow-controlled Function Tool

요구:

```text
입력 검증 후 날짜 계산 Tool을 반드시 실행
```

기대:

- Workflow
- Function Node 또는 검증 단계
- Tool Node
- Tool Binding Function
- Invocation Control Workflow

## VS-03 Agent-selected MCP Tool

요구:

```text
문서에 이미지가 있을 때만 Agent가 OCR Tool을 사용
```

기대:

- OCR은 Tool
- Binding MCP
- Invocation Control Agent
- OCR을 고정 control-flow Tool Node로 만들지 않음
- MCP mock trajectory 검증

## VS-04 Domain-neutral OCR

요구:

```text
여신 문서 검토 Workflow에서 공통 OCR 사용
```

기대:

- OCR Tool: domain-neutral
- OCR Owner 유지
- Workflow: 여신 domain-specific
- Node 사용 맥락과 Asset Owner가 분리

## VS-05 Function Node와 Tool Node

요구:

```text
OCR 실행 후 결과 JSON을 정규화
```

기대:

- OCR: Tool Node
- 정규화: Function Node 또는 작은 helper
- 두 개념을 모두 Tool로 만들지 않음

## VS-06 A2A Exposure

요구:

```text
독립 배포 Agent를 다른 팀이 A2A로 호출
```

기대:

- Asset Agent
- Exposure A2A
- Owner/lifecycle/auth
- Agent Card
- Remote A2A Asset 없음

## VS-07 A2A Consuming

요구:

```text
외부 팀 Agent를 호출하고 실패 시 handoff
```

기대:

- Remote Agent reference
- A2A connection
- timeout/fallback contract
- mock server
- local sub-agent와의 차이 설명

## VS-08 Callback Guard

요구:

```text
민감한 Tool 호출 전에 정책 검사
```

기대:

- before_tool Callback
- Continue/Override
- audit
- state
- forbidden Tool call test

## VS-09 Event State Commit

요구:

```text
Tool 결과가 State에 기록되고 다음 Node가 읽음
```

기대:

- Event action
- commit 후 read
- state channel
- session persistence
- Handbook Register read/write 정확

## VS-10 Ambient Trigger

요구:

```text
Pub/Sub 이벤트로 Agent를 실행하고 결과를 알림 채널로 전달
```

기대:

- Agent/Workflow + trigger
- event schema
- session/idempotency
- retry/DLQ
- output sink
- malformed/duplicate test

## VS-11 Human Input

요구:

```text
위험 거래는 사용자 승인 후 재개
```

기대:

- Human Input Node
- pause
- response mapping
- resume
- approval evidence

## VS-12 Dynamic Workflow

요구:

```text
검증 점수가 기준 미달인 동안 제한 횟수만 반복
```

기대:

- Dynamic 필요성 근거
- bounded loop
- exit
- max iteration
- runtime test

## VS-13 Missing Information

요구:

```text
MCP로 고객 조회
```

하지만 endpoint/auth/schema가 없음.

기대:

- MCP Hint
- Missing Information
- Compose Ready 금지
- Scaffold 중단

## VS-14 Catalog Reuse

요구:

```text
기존 OCR Tool을 재사용
```

기대:

- 새로운 OCR Tool 중복 생성 없음
- Catalog reference
- Version/Owner 유지
- Node usage만 추가

## VS-15 Legacy Artifact

기대:

- 정책에 따라 migrate/read-only/reject
- 새 Artifact로 저장할 때 Target Contract
- Legacy 값이 사용자 화면에 활성값처럼 노출되지 않음

## VS-16 Raw Requirement Direct Build

기대:

- 모든 경로에서 차단
- 명확한 오류
- 승인 Artifact로 이동 안내

---

# 17. 계층 조합 점검

## 17.1 문서 ↔ Skill

확인한다.

- Skill이 Canonical 문서를 올바르게 참조하는가
- Skill 자체에 다른 enum이 복제되지 않는가
- 문서가 지원한다고 한 기능을 Skill이 누락하지 않는가
- Skill이 Unsupported 기능을 지원한다고 주장하지 않는가

## 17.2 Skill ↔ Schema

확인한다.

- Skill 출력이 Schema-valid인가
- Schema 필수값을 Skill이 묻는가
- Missing Information이 임의 Default로 채워지지 않는가
- Agent/Workflow/Tool이 그대로 저장되는가

## 17.3 Schema ↔ Types

확인한다.

- 허용값
- Optionality
- Default
- Nested field
- Migration
- Naming

불일치가 있으면 generated type 또는 parity test를 고려한다.

## 17.4 Types ↔ UI

확인한다.

- 모든 값이 표시·편집 가능한가
- UI local state에서 필드 손실이 없는가
- user-facing label이 목표 용어인가
- Unsupported 값이 선택 가능하지 않은가

## 17.5 UI ↔ Persistence

확인한다.

- Save/reload round-trip
- concurrent edit
- missing field
- null/unresolved
- approval
- stage proposal apply

## 17.6 Artifact ↔ Scaffold Plan

확인한다.

- 필요한 Runtime Contract가 전달되는가
- 참조 ID가 유지되는가
- Domain/Owner가 잘못 복제되지 않는가
- Binding/Invocation Control이 보존되는가

## 17.7 Scaffold Plan ↔ Generator

확인한다.

- String Literal 추측이 없는가
- Unsupported combination이 명확히 reject되는가
- Generic contract로 lowering하는가
- business-specific fallback이 없는가

## 17.8 Generator ↔ Runtime

확인한다.

- compile/import
- route
- Tool call
- callback
- event
- state
- resume
- MCP/A2A
- error

## 17.9 Runtime ↔ Verify

확인한다.

- Verify가 실제 generated bundle을 실행하는가
- compile만 하고 행동 통과라고 주장하지 않는가
- exact command/output를 저장하는가
- unavailable dependency를 `unverified`로 남기는가

## 17.10 Code ↔ Handbook

확인한다.

- 변경된 행동 Stage가 갱신됐는가
- Register producer/consumer가 맞는가
- L3 locator가 현재 Path/Symbol에 resolve되는가
- stale locator가 frozen 또는 needs-review인가

---

# 18. Test Architecture 점검

## 18.1 Test Pyramid

다음을 구분한다.

### Static / Structural

- Skill frontmatter
- relative links
- enum parity
- schema
- docs legacy term
- Handbook locator

### Unit

- pure mapping
- migration
- validation rule
- function node
- callback return
- event action
- Tool contract

### Integration

- Stage Runner
- persistence round-trip
- artifact sync
- catalog reference
- generator

### Runtime Smoke

- ADK load
- Tool
- MCP
- A2A
- Human input
- Ambient endpoint
- callback
- state

### Behavior Eval

- 목표 달성
- Agent Tool 선택
- 불필요 Tool 호출
- response quality
- safety
- grounding

## 18.2 Negative Test

최소 다음이 실패해야 한다.

- Legacy Asset Type 신규 생성
- `selected_by_llm` 신규 Artifact
- unresolved Candidate Approval
- A2A 계약 없는 A2A scaffold
- MCP auth/schema 미확정 scaffold
- Raw Requirement direct build
- private credential fixture
- Event commit 이전 state read 가정
- Ambient output sink 없음
- Human input response schema 불일치
- infinite dynamic loop

## 18.3 Independent Assertion

다음을 피한다.

```text
production enum과 같은 constants 파일을 import해
그 enum이 자기 자신과 같다고 검사
```

가능하면 다음처럼 독립적으로 검증한다.

- Schema parse
- 실제 UI round-trip
- generated file compile
- runtime event
- fixture expected behavior
- separate Scenario rubric

---

# 19. Codex·Claude Code Fresh-session 점검

현재 세션의 Context에 의존해 Skill이 작동하는지 착각하지 않는다.

## 19.1 격리 환경

가능한 방법:

- clean worktree
- temporary clone
- 별도 terminal session
- context가 없는 새 conversation

같은 Local Commit을 사용한다.

## 19.2 확인 사항

### Skill Discovery

- `.agents/skills` 발견
- explicit invocation
- natural language trigger
- Legacy Shim
- `_shared` 비노출

### Progressive Disclosure

- 관련 Skill만 로드
- 필요한 Runtime Pattern Reference만 로드
- Handbook을 필요할 때 사용
- 불필요 전체 Repo 탐색 감소

### Output

- 올바른 단계
- 올바른 Asset
- Stop Condition
- 허용 파일만 write
- Evidence 기록

## 19.3 테스트 Prompt

최소 다음을 사용한다.

```text
이 요구에서 만들 Agent, Workflow, Tool 후보를 나눠줘.
승인된 후보를 실행 Graph로 연결해줘.
승인 설계로 ADK Runtime Scaffold를 만들어줘.
생성된 MCP 연결과 Callback 동작을 검증해줘.
현재 Artifact 상태를 보고 다음 단계를 진행해줘.
README의 오탈자만 수정해줘.
```

마지막 Prompt에서 Agent Factory Skill이 불필요하게 Trigger되지 않아야 한다.

## 19.4 미사용 환경

Codex 또는 Claude Code 중 하나를 실행할 수 없다면 다음을 한다.

- 이유 기록
- Loader 구조 정적 검증
- 실행하지 않은 환경을 Passed로 표시하지 않음
- 남은 검증 Command를 제공

---

# 20. Handbook 점검과 재동기화

Handbook은 문서 목록이 아니라 행동에서 Source로 이동하는 지도다.

## 20.1 읽기 순서

```text
L1 Overview
→ L2 Stage
→ Register
→ L3 Locator
→ Current Source
```

## 20.2 변경 영향

이번 코드 변경으로 최소 다음을 다시 확인한다.

- Skill lifecycle
- Stage Runner
- Artifact production
- Candidate classification
- Graph composition
- Approval
- Scaffold
- Runtime execution
- Verification
- Catalog feedback
- Mock integration

## 20.3 Locator

각 active locator에 대해 확인한다.

```text
Path exists
Symbol exists
Behavior description matches
Caller/callee is current
Register read/write is current
External boundary is current
Commit snapshot is current
```

확인하지 못하면 다음 중 하나다.

```text
needs-review
frozen
unmapped
```

추측으로 active를 유지하지 않는다.

## 20.4 Register

특히 다음을 추적한다.

- artifact root
- analysis/discovery output
- composition/Graph output
- manifest
- approval
- scaffold plan
- runtime bundle
- validation report
- catalog delta
- stage run evidence
- collaboration state

이름은 실제 구현에 맞게 변경한다.

---

# 21. Finding 작성 규칙

점검 중 즉시 수정하지 말고 Finding을 먼저 기록한다.

## 21.1 Severity

### Blocker

- 핵심 사용자 흐름 불가
- Raw Requirement direct code
- Approval 우회
- 데이터 손실
- 새 택소노미와 Runtime 의미가 반대
- Security 위반
- 지원한다고 주장하지만 실행 불가

### Major

- 특정 중요 Scenario 실패
- Skill/Schema/UI/Generator 간 필드 손실
- 잘못된 Asset 또는 Node 생성
- Migration이 Artifact를 손상
- Handbook이 잘못된 edit site 안내

### Moderate

- 일부 Pattern 미검증
- UI 용어 혼동
- Test gap
- Compatibility 제거 조건 없음
- 문서 중복

### Minor

- Link
- wording
- formatting
- 낮은 위험의 stale example

## 21.2 Finding 형식

```markdown
## <ID> <Title>

- Severity:
- Behavior:
- Layer:
- Expected:
- Actual:
- Evidence:
- Files / Symbols:
- User impact:
- Root cause hypothesis:
- Recommended direction:
- Verification after fix:
- Status:
```

Root cause는 증거가 없으면 hypothesis로 표시한다.

## 21.3 중복 Finding

하나의 근본 원인이 여러 증상으로 보이면 다음처럼 처리한다.

```text
Root Finding
├─ UI symptom
├─ Generator symptom
└─ Test symptom
```

단순 파일별 Finding으로 쪼개 전체 행동을 놓치지 않는다.

---

# 22. 보완 순서

Finding이 고정된 후 수정한다.

권장 의존성 순서는 다음과 같다.

```text
1. Canonical Contract
2. Schema / Shared Types / Migration
3. Skill Output
4. Persistence / API
5. UI
6. Scaffold Plan
7. Generator / Runtime
8. Verification
9. Docs / Handbook
```

현재 저장소 구조상 다른 순서가 합리적이면 바꿀 수 있다.
그 경우 이유를 기록한다.

## 22.1 수정 Batch

한 번에 모든 파일을 바꾸지 않는다.

권장 Batch:

- Taxonomy / serialization
- Graph semantics
- Skill lifecycle
- UI round-trip
- Tool binding
- A2A
- Callback/Event/Ambient
- Generator
- Test
- Handbook

각 Batch 후 관련 Test를 실행한다.

## 22.2 Scope Control

다음을 하지 않는다.

- Finding과 무관한 전면 Refactor
- 새 Framework 도입
- 모든 Future Pattern을 미리 일반화
- 사용하지 않는 abstraction
- Compatibility와 Canonical path를 동시에 복잡하게 유지
- Test 통과를 위한 의미 약화

---

# 23. 최종 End-to-End 실행

보완 후 최소 다음 세 경로를 실제로 수행한다.

## Path A: 단순 경로

```text
단일 Agent
→ Discover
→ Standalone 결정
→ Scaffold
→ Runtime smoke
→ Verify
```

## Path B: Tool 경로

```text
Agent + MCP Tool
→ Invocation Control Agent
→ Compose
→ Approval
→ Scaffold
→ MCP mock
→ Behavior verify
```

## Path C: 복합 경로

다음 중 실제 지원 수준이 가장 높은 Pattern을 선택한다.

```text
A2A
Callback
Ambient
Human Input
Dynamic
```

다음까지 수행한다.

```text
Requirement
→ Skill
→ Artifact
→ UI review
→ Approval
→ Generate
→ Runtime
→ Failure case
→ Verify
→ Handbook check
```

복합 경로가 지원되지 않는다면 Unsupported Gate를 실제로 확인한다.

---

# 24. 완료 기준

다음을 모두 만족해야 최종 완료를 주장할 수 있다.

## Concept

- [ ] Agent / Workflow / Tool이 모든 활성 계층에서 같은 의미다.
- [ ] Graph Node와 Asset Type이 분리된다.
- [ ] Function Node / Function Tool / Tool Node가 구분된다.
- [ ] Invocation Control은 Workflow / Agent다.
- [ ] MCP/A2A/Callback/Ambient/Event Loop의 위치가 올바르다.
- [ ] Domain / Owner / Reuse가 분리된다.
- [ ] unresolved가 임의 Default로 바뀌지 않는다.

## Skill

- [ ] Entrypoint와 Work Skill 책임이 분명하다.
- [ ] Trigger 충돌이 없다.
- [ ] Fresh-session에서 작동한다.
- [ ] Raw Requirement direct scaffold가 차단된다.
- [ ] Runtime Pattern Reference가 조건부로 로드된다.
- [ ] Legacy Skill은 제거 또는 Shim이다.

## Contract

- [ ] Skill Output이 Schema-valid다.
- [ ] Schema/Type/Validator가 일치한다.
- [ ] UI round-trip에서 필드 손실이 없다.
- [ ] Legacy Artifact 정책이 명확하다.
- [ ] Approval Gate가 모든 경로에 적용된다.

## Runtime

- [ ] Generated Source가 compile/import된다.
- [ ] 지원한다고 한 Pattern이 runtime smoke를 통과한다.
- [ ] Unsupported Pattern은 명확히 차단된다.
- [ ] State/Event/Resume 의미가 실제 ADK와 맞는다.
- [ ] Security invariant가 유지된다.

## Verification

- [ ] Static, unit, integration, runtime, behavior test가 구분된다.
- [ ] Negative Test가 있다.
- [ ] fresh command output이 저장된다.
- [ ] Codex/Claude 결과를 과장하지 않는다.
- [ ] Finding이 모두 disposition을 가진다.

## Documentation

- [ ] Canonical 문서가 하나씩 존재한다.
- [ ] Migration Status가 실제 상태와 맞다.
- [ ] Handbook locator가 current source에 resolve된다.
- [ ] stale locator는 frozen/needs-review다.
- [ ] 활성 문서에 Legacy가 Canonical로 남지 않는다.

---

# 25. 최종 보고 형식

```markdown
# Agent Factory vNext 통합 점검 완료 보고

## 1. Snapshot
- Repository:
- Branch:
- BASE_REF:
- Worktree HEAD:
- Staged / unstaged:
- Audit date:
- Reviewer environment:

## 2. Review scope
- Documents:
- Skills:
- Schemas/types:
- UI/API:
- Scaffold/generator:
- Runtime patterns:
- Tests:
- Handbook:
- Excluded:

## 3. Source of Truth
| Concept | Canonical source | Compatibility source | Status |
|---|---|---|---|

## 4. Support matrix
| Pattern | Unsupported | Design-only | Scaffold-only | Smoke-tested | E2E |
|---|---:|---:|---:|---:|---:|
| MCP | | | | | |
| A2A | | | | | |
| Callback | | | | | |
| Event Loop | | | | | |
| Ambient | | | | | |
| Human Input | | | | | |
| Dynamic | | | | | |

## 5. Findings
- Blocker:
- Major:
- Moderate:
- Minor:
- Resolved:
- Deferred:
- Accepted risk:

## 6. Vertical slice results
| Slice | Skill | Artifact | UI | Generator | Runtime | Verify | Result |
|---|---|---|---|---|---|---|---|

## 7. Fresh-session Skill results
### Codex
- Version:
- Trigger:
- Non-trigger:
- Outputs:
- Remaining issue:

### Claude Code
- Version:
- Trigger:
- Non-trigger:
- Outputs:
- Remaining issue:

## 8. Commands and evidence
| Command | Exit | Evidence path | Claim supported |
|---|---:|---|---|

## 9. Handbook
- Snapshot:
- Updated stages:
- Updated registers:
- Active locators:
- Needs-review:
- Frozen:
- Unmapped:

## 10. Remaining gaps
- Product:
- Skill:
- Runtime:
- Migration:
- Verification:
- Documentation:

## 11. Changed files
<git diff --name-status>

## 12. Explicit confirmations
- Raw requirement direct code path: None / Finding ID
- Approval bypass: None / Finding ID
- Private endpoint or credential added: No / Finding ID
- Unsupported feature claimed as supported: No / Finding ID
- Fresh runtime evidence available: Yes / Partial / No
- Handbook source verification complete: Yes / Partial / No
- Remote push performed: No, unless user explicitly requested
```

---

# 26. 작업 종료 전 질문

최종 보고 전에 스스로 다음을 질문한다.

1. 문서만 맞고 실제 Artifact가 다른 것은 없는가?
2. Skill만 새 용어를 쓰고 Schema가 Legacy를 요구하지 않는가?
3. UI에서 보이는 값과 저장되는 값이 같은가?
4. Generator가 새로운 의미를 Legacy branch로 억지 해석하지 않는가?
5. compile 통과를 Runtime 행동 통과라고 부르지 않았는가?
6. MCP/A2A/Callback/Ambient 중 지원한다고 쓴 기능을 실제로 실행했는가?
7. Agent-selected Tool을 Workflow 고정 Tool Node로 잘못 만들지 않았는가?
8. OCR Tool의 Owner와 Domain이 사용 Workflow에 의해 덮어써지지 않는가?
9. Raw Requirement에서 우회 Build할 수 있는 CLI/API가 남지 않았는가?
10. Legacy Artifact가 새 Artifact를 오염시키지 않는가?
11. Codex와 Claude Code가 현재 세션의 숨은 지식 없이 Skill을 사용할 수 있는가?
12. Handbook이 현재 변경된 코드 위치를 실제로 찾는가?
13. 미확인 항목을 Passed라고 쓰지 않았는가?
14. 지금 추가한 추상화가 실제 요구를 해결하는가?
15. 사용자가 처음 접했을 때 단계별 결과를 이해할 수 있는가?

---

# 27. 실행 지시

이제 이 순서로 진행한다.

1. Local 작업 트리의 Snapshot과 Diff를 고정한다.
2. 현재 문서·Skill·Code의 Source of Truth 지도를 만든다.
3. 첫 Pass에서는 수정하지 않고 Finding을 작성한다.
4. 문서, Skill, Contract, UI, Generator, Runtime, Test, Handbook 순으로 각각 점검한다.
5. Vertical Slice를 통해 계층 조합을 확인한다.
6. Finding의 Severity와 Root Cause를 확정한다.
7. 의존성 순서로 작은 Batch를 수정한다.
8. 각 Batch 후 관련 Test를 실행한다.
9. Codex와 Claude Code의 Fresh-session Skill 검증을 수행한다.
10. 최소 세 개 End-to-End 경로를 실행한다.
11. Handbook의 Stage/Register/Locator를 현재 Source에 맞춰 갱신한다.
12. 완료 기준을 다시 점검한다.
13. 지정된 최종 보고 형식으로 결과를 제출한다.
14. 사용자가 명시적으로 요청하지 않았다면 Remote Push는 수행하지 않는다.

현재 저장소의 실제 구조가 이 지시서의 예시와 다르면, 예시를 기계적으로 따르지 말고 같은 의도를 만족하는 방식으로 조정한다.
조정한 결정은 Evidence와 함께 보고한다.
