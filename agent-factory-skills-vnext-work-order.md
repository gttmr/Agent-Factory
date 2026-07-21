# Agent Factory Coding-Agent Skills vNext 재편 및 검증 작업 지시서

> **대상 저장소**: `https://github.com/gttmr/Agent-Factory`
> **주요 작업 경로**: `.agents/skills/**`
> **실행 환경**: 이전 대화나 외부 기억이 전혀 없는 새 Codex 또는 Claude Code 세션
> **작업 유형**: Coding-agent Skill 구조 개편, 참조 자료 정비, 테스트 체계 구축, 실제 사용 검증
> **선행 조건**: Agent Factory 문서 vNext와 새 택소노미가 저장소의 활성 문서에 반영되어 있어야 한다.
> **핵심 목표**: 기존 `분석 → 설계 → 개발 → 검증`에 묶인 네 개의 Skill을 사용자 작업 관점에 맞게 재편하고, `Agent / Workflow / Tool` 택소노미 및 Google ADK의 복잡한 런타임 패턴까지 안전하게 설계·스캐폴딩·검증할 수 있는 Skill 체계를 만든다.

---

# 0. 이 작업에서 말하는 Skill

이 작업의 Skill은 다음을 의미한다.

> Codex, Claude Code 등 **코딩 에이전트가 저장소를 분석하고 Agent Factory 작업을 수행하도록 안내하는 `SKILL.md` 기반 Coding-agent Skill**

다음과 혼동하지 않는다.

- Google ADK 런타임의 “Skills for Agents”
- 실행 중인 업무 Agent가 사용하는 Tool
- Agent Factory가 생성하는 Agent 자산
- MCP Tool
- A2A Agent
- 일반 프롬프트 템플릿

이번 작업의 직접 대상은 `.agents/skills/**` 아래의 Coding-agent Skill이다.

---

# 1. 작업 목적

현재 Agent Factory Skill은 다음 네 단계로 고정되어 있다.

```text
af-analyze-requirement
→ af-design-boundaries
→ af-build-runtime-stub
→ af-verify-feedback
```

현재 구조의 장점은 다음과 같다.

- Raw requirement가 곧바로 코드가 되는 것을 막는다.
- 분석 결과와 승인된 산출물을 분리한다.
- Graph IR, Runtime Contract, A2A, 사람 입력, Dynamic Workflow를 단계적으로 검토한다.
- Runtime Handoff와 검증 증거를 분리한다.
- Catalog를 직접 수정하지 않고 proposal을 남긴다.

이 장점은 유지한다.

그러나 다음 문제를 해결해야 한다.

1. `분석`과 `설계`라는 이름만으로는 사용자가 각 단계에서 무엇을 얻는지 직관적으로 알기 어렵다.
2. 첫 단계가 구성요소 후보 도출과 Graph 초안까지 동시에 수행하여 책임이 넓다.
3. 다음 단계가 경계 승인, Graph 조립, Runtime Contract, A2A를 한꺼번에 다뤄 역할이 모호하다.
4. 기존 Skill이 폐기 예정인 `Adapter`, `Remote A2A` 최상위 유형, `specialist/shared` Agent 분류에 결합되어 있다.
5. MCP, A2A, Callback, Event Loop, Ambient Agent 같은 복잡한 런타임 개념을 개별적으로 판단하고 검증하는 체계가 부족하다.
6. Skill의 품질을 Codex와 Claude Code에서 실제 요청으로 반복 검증하는 체계가 없다.
7. 현재 네 Skill이 Workbench Stage 이름에 지나치게 결합되어 독립적인 CLI 사용성이 떨어진다.

새 Skill 체계는 다음 사용자 흐름을 명확히 지원해야 한다.

```text
사용자 요구 입력
→ 수행할 구성요소 후보 도출
→ 구성요소를 실행 구조로 조합
→ 승인된 구조를 ADK 프로젝트로 스캐폴딩
→ 연결·런타임·행동을 검증하고 개선
```

---

# 2. 완료 상태

다음 조건을 모두 만족해야 완료다.

1. 새 Skill 체계가 `Agent / Workflow / Tool` 택소노미를 사용한다.
2. `Adapter`, 최상위 `Remote A2A`, `specialist/shared/domain/common Agent`가 활성 Skill 규칙에서 제거된다.
3. 요구 입력 단계와 실행 흐름 구성 단계의 책임이 분리된다.
4. Workflow가 필요하지 않은 단일 Agent 또는 Tool 요구에 Workflow를 억지로 만들지 않는다.
5. Function Node, Function Tool, Tool Node를 구분한다.
6. Tool Invocation Control은 `Workflow | Agent`로 표현한다.
7. Function, MCP, A2A는 자산 유형이 아니라 Binding 또는 Protocol로 다룬다.
8. MCP, A2A, Callback, Event Loop, Ambient Agent를 조건부로 선택하는 판단 기준이 있다.
9. 복잡한 패턴을 선택한 경우 필요한 계약·스캐폴딩·검증이 함께 생성된다.
10. 단순한 요구에는 불필요한 복잡성을 추가하지 않는다.
11. 새 Skill을 Codex와 Claude Code 양쪽에서 실제 시나리오로 실행해 검증한다.
12. Skill 구조·Trigger·산출물·Gate·Runtime smoke를 자동 또는 반자동으로 검증하는 테스트가 있다.
13. 기존 네 Skill 이름을 참조하는 저장소 경로를 조사하고 호환 전략을 적용한다.
14. Skill 변경으로 영향을 받은 활성 문서와 Agent Factory Handbook을 갱신한다.
15. 현재 Product Schema가 새 택소노미를 지원하지 않으면 이를 숨기지 않고 통합 Blocker로 보고한다.
16. Agent Factory Product Code 변경을 Skill 작업에 몰래 포함하지 않는다.

---

# 3. 절대 원칙

## 3.1 확정된 택소노미

최상위 자산은 다음 세 개다.

```text
Agent
Workflow
Tool
```

### Agent

판단, 분류, 요약, 추천, 해석, 생성, 상황에 따른 선택과 위임 등의 추론 책임을 갖는다.

### Workflow

둘 이상의 실행 단위를 연결하여 순서, 분기, 병렬, 반복, 사람 입력, 중단·재개, 종료 조건을 소유한다.

### Tool

명확한 입력 계약을 받아 특정 기능을 실행하고 결과 또는 오류를 반환하는 호출 가능 자산이다.

다음은 최상위 자산이 아니다.

- Adapter
- Remote A2A
- MCP
- Function
- Callback
- Ambient Agent
- Event Loop
- Resource
- External System
- Human Input
- Join
- Router

## 3.2 Graph IR

Graph IR는 Catalog 자산 택소노미와 별도 계층이다.

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

Graph Node는 다음처럼 자산을 참조한다.

```text
Agent Node       → Agent
Tool Node        → Tool
Subworkflow Node → Workflow
Function Node    → 해당 Workflow 내부 코드
```

## 3.3 Tool Invocation Control

사용자 대상 활성 용어는 다음 두 값뿐이다.

```text
Workflow
Agent
```

- `Workflow`: Graph 또는 결정적 코드가 Tool 실행을 명시한다.
- `Agent`: Agent가 현재 상황을 판단해 Tool 사용 여부를 결정한다.

활성 Skill 규칙에서 다음 표현을 사용하지 않는다.

- Model
- LLM
- `selected_by_llm`
- `decision_owner: llm`

ADK 내부 구현을 설명할 때 모델 호출을 언급할 수는 있지만, Agent Factory의 상위 Invocation Control에는 노출하지 않는다.

## 3.4 Binding과 Protocol

다음을 서로 다른 축으로 구분한다.

### Tool Binding

```text
Function
MCP
Built-in
Unresolved
```

### Agent Exposure / Connection

```text
Local
A2A
Unresolved
```

### Transport

```text
In-process
stdio
HTTP
Unknown
```

`Local`과 `MCP`를 반대 개념으로 두지 않는다. MCP 서버도 로컬 stdio 또는 원격 HTTP일 수 있다.

## 3.5 Domain, Owner, Reuse

다음을 분리한다.

```text
Domain Scope
- domain-specific
- cross-domain
- domain-neutral

Owner
- 실제 변경·운영 책임 조직

Reuse
- not-reviewed
- reuse-existing
- publish-candidate
- project-only
- excluded
```

`공통`을 업무 Domain 값으로 사용하지 않는다.

## 3.6 Runtime 개념의 위치

| 개념 | 올바른 위치 |
|---|---|
| MCP | Tool Binding / Protocol |
| A2A | Agent Exposure 또는 Remote Connection |
| Callback | Agent 실행에 연결된 Runtime Hook |
| Event Loop | ADK Runtime 실행 의미 |
| Ambient Agent | 이벤트 기반 실행 진입 방식 |
| Human Input | Graph Node와 Pause/Resume 의미 |
| State / Artifact | Event 및 Service를 통한 Runtime Data Channel |
| Retry / Timeout | Runtime Policy |
| Trigger | Runtime Entry Contract |

## 3.7 복잡성은 근거가 있을 때만 추가한다

다음 이유만으로 복잡한 패턴을 추가하지 않는다.

- “향후 필요할 수 있다.”
- “엔터프라이즈 시스템이므로 있어 보인다.”
- “Agent가 여러 개다.”
- “Workflow가 길다.”
- “A2A가 최신 기술이다.”
- “Callback이 편리할 것 같다.”
- “Ambient Agent로 만들면 자동화가 된다.”

요구사항 증거와 운영 필요가 있을 때만 선택한다.

---

# 4. 참고 자료와 Source of Truth

## 4.1 우선순위

작업 중 사실 판단의 우선순위는 다음과 같다.

1. Agent Factory 활성 문서 vNext
2. Agent Factory 현재 Source / Schema / Validator
3. Google ADK 공식 문서
4. 설치된 ADK Package의 실제 Signature와 Source
5. `google/agents-cli` 공식 Skill
6. 현재 `.agents/skills/**`
7. 과거 문서와 Archive

문서와 코드가 다르면 다음을 구분한다.

- **Target Contract**
- **Current Implementation**
- **Compatibility Layer**
- **Migration Blocker**

## 4.2 반드시 확인할 공식 자료

작업 시작 시 아래 자료를 다시 확인하고 확인 날짜와 commit 또는 문서 version을 기록한다.

### Google Agents CLI

```text
https://github.com/google/agents-cli#agent-skills
https://github.com/google/agents-cli/tree/main/skills
```

특히 다음 Skill의 구조를 확인한다.

```text
google-agents-cli-workflow
google-agents-cli-adk-code
google-agents-cli-scaffold
google-agents-cli-eval
```

### Google ADK

```text
https://adk.dev/llms.txt
https://adk.dev/agents/
https://adk.dev/workflows/
https://adk.dev/graphs/
https://adk.dev/tools/function-tools/
https://adk.dev/mcp/
https://adk.dev/tools/mcp-tools/
https://adk.dev/a2a/intro/
https://adk.dev/callbacks/
https://adk.dev/runtime/event-loop/
https://adk.dev/runtime/ambient-agents/
https://adk.dev/graphs/human-input/
https://adk.dev/runtime/resume/
```

공식 문서의 개념과 설치된 package의 API가 다를 수 있다. 코드 생성 전에는 반드시 설치된 package를 확인한다.

### Coding-agent Skill 작성 기준

```text
OpenAI Codex 공식 skill-creator
https://github.com/openai/codex/tree/main/codex-rs/skills/src/assets/samples/skill-creator

Anthropic Skill authoring best practices
https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
```

## 4.3 복사 금지와 Attribution

Google 또는 OpenAI/Anthropic Skill을 구조 참고용으로 사용한다.

- 긴 설명을 그대로 복사하지 않는다.
- Agent Factory의 계약에 맞게 재작성한다.
- 코드나 문구를 실질적으로 복사한 경우 원 라이선스와 출처를 확인한다.
- 공식 API 예제도 현재 package signature와 대조한다.

---

# 5. 작업 범위

## 5.1 기본 허용 경로

다음은 이번 작업에서 수정할 수 있다.

```text
.agents/skills/**
tests/skills/**
scripts/validate-skills.*
scripts/run-skill-scenarios.*
templates/skill-scenarios/**
docs/migration/skill-vnext-status.md
docs/decision-log.md
docs/handbook/**
docs/README.md
AGENTS.md
CLAUDE.md
```

현재 저장소 구조상 더 적절한 테스트 위치가 있다면 기존 규칙에 맞춰 조정하되, 이유를 Migration Status에 기록한다.

## 5.2 조건부 허용

다음은 Skill의 발견·호출·테스트를 위해 정말 필요한 경우에만 수정한다.

```text
package.json의 skill-test 전용 script
CI의 skill validation job
Workbench에서 Skill 이름을 표시하는 문서성 metadata
```

이 경우에도 Product Behavior를 변경하지 않는다.

## 5.3 기본 금지

다음은 이번 작업에서 수정하지 않는다.

```text
packages/web의 Product 동작
schemas/**
catalog/**
scripts/validate-artifacts.mjs의 Product Contract
runtime source generator
Mock Lab Product Code
templates의 Product Artifact Fixture
deployment code
private configuration
```

새 Skill이 Product Contract와 맞지 않는다는 이유로 Product Schema를 이 작업에 끼워 넣지 않는다.

## 5.4 통합 선행 조건 Gate

새 택소노미를 직렬화하는 Product Schema와 Validator가 이미 존재하는지 확인한다.

### 통합 가능

다음이 모두 만족되면 Full Skill Migration으로 진행한다.

- `Agent / Workflow / Tool`이 Product Contract에 존재
- Tool Invocation Control `Workflow / Agent`가 표현 가능
- Graph IR가 Tool Node와 Function Node를 구분
- MCP와 A2A를 Binding/Protocol로 표현 가능
- 새 Skill 산출물이 Validator를 통과

### 통합 불가

하나라도 만족하지 않으면 다음을 수행한다.

1. Skill의 구조·Reference·Trigger·시나리오 설계는 진행할 수 있다.
2. 새 택소노미 산출물을 기존 canonical artifact에 강제로 기록하지 않는다.
3. Workbench Stage Runner에 완전 통합되었다고 주장하지 않는다.
4. `docs/migration/skill-vnext-status.md`에 Blocker를 기록한다.
5. Product Contract 변경이 필요한 지점은 영향 영역 수준으로만 기록한다.
6. Skill 변경을 이용해 legacy enum으로 억지 매핑하지 않는다.
7. Full Integration 완료 선언을 중단한다.

---

# 6. 시작 절차

## 6.1 Git 안전 확인

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log -1 --format='%H %cI %s'
```

기존 변경을 reset, checkout, clean으로 지우지 않는다.

## 6.2 저장소 규칙 읽기

다음 순서로 읽는다.

```text
AGENTS.md
CLAUDE.md
.agents/skills/AGENTS.md
docs/README.md
docs/workbench/taxonomy.md
docs/workbench/graph-ir.md
docs/workbench/operating-model.md
docs/handbook/README.md
docs/handbook/index.md
docs/migration/taxonomy-vnext-status.md
```

파일이 없으면 문서 vNext 선행 작업이 완료되지 않은 것으로 기록한다.

## 6.3 기존 Skill 전체 감사

```bash
find .agents/skills -type f | sort
```

각 파일을 다음으로 분류한다.

| 분류 | 의미 |
|---|---|
| Entrypoint Skill | 전체 작업 흐름 안내 |
| Work Skill | 실제 산출물을 만드는 Skill |
| Shared Reference | 여러 Skill이 공유 |
| Stage-specific Reference | 한 Skill 전용 |
| Deterministic Script | 검증·변환용 실행 파일 |
| Example / Fixture | 사용 예 |
| Legacy Compatibility | 과거 이름 호환 |
| Obsolete | 폐기할 내용 |

## 6.4 기존 Skill 이름 참조 조사

```bash
rg -n \
  'af-analyze-requirement|af-design-boundaries|af-build-runtime-stub|af-verify-feedback' \
  . \
  --glob '!docs/archive/**' \
  --glob '!docs/handoff/claude-home/**'
```

조사 대상:

- Stage Runner
- UI
- API
- Docs
- AGENTS / CLAUDE
- Skill cross-reference
- Test
- Template
- Script
- Artifact manifest
- CI

기존 이름이 Product Code에 고정되어 있으면 compatibility 전략 없이 삭제하지 않는다.

## 6.5 Legacy 택소노미 감사

```bash
rg -n -i \
  'adapter|adapter_kind|agent_kind|specialist|shared|remote_a2a|selected_by_llm|decision_owner.*llm|fixed_by_workflow|mcp_toolset|공통.?에이전트|도메인.?에이전트' \
  .agents/skills
```

일괄 치환하지 않는다. 문맥별로 Target 개념을 판단한다.

---

# 7. 권장 Skill 체계

새 체계는 **하나의 Entrypoint Skill + 네 개의 Work Skill**로 구성한다.

```text
af-workflow
├─ af-discover-assets
├─ af-compose-solution
├─ af-scaffold-runtime
└─ af-verify-runtime
```

`_shared`는 Trigger 가능한 다섯 번째 또는 여섯 번째 Skill이 아니다.

## 7.1 사용자 대상 단계명

| 순서 | Skill ID | 사용자 대상 한글명 | 핵심 결과 |
|---|---|---|---|
| 0 | `af-workflow` | Agent Factory 작업 안내 | 현재 상태를 판단하고 적절한 Skill로 연결 |
| 1 | `af-discover-assets` | 요구 구체화 및 구성요소 도출 | Agent/Workflow/Tool 후보, Resource/Dependency, 증거와 미확정 정보 |
| 2 | `af-compose-solution` | 실행 구조 구성 | 승인 후보 조합, Graph IR, Invocation Control, Binding, Runtime Pattern 계약 |
| 3 | `af-scaffold-runtime` | 런타임 스캐폴딩 | 승인 구조 기반 ADK 프로젝트·코드 경계·연결 지점 |
| 4 | `af-verify-runtime` | 검증 및 개선 | 구조·코드·연결·행동 검증 증거와 피드백 |

이 네 Work Skill은 순차 사용이 기본이지만, 이미 승인 산출물이 있는 경우 적절한 단계에서 시작할 수 있다.

## 7.2 왜 `af-workflow`가 필요한가

Google Agents CLI의 방식처럼 전체 lifecycle을 설명하는 Entrypoint와 실제 전문 Skill을 분리한다.

`af-workflow`는 다음을 수행한다.

- 현재 저장소·Artifact 상태 확인
- 어느 Skill을 읽어야 하는지 결정
- 이전 단계 산출물 존재 확인
- 세션 compaction 이후 관련 Skill 재로딩 안내
- 사용자 요구 복잡도에 따라 ceremony 조절
- 단계 건너뛰기 방지
- 다음 Skill로 handoff

`af-workflow`는 다음을 수행하지 않는다.

- 직접 후보 분류
- Graph 작성
- 코드 생성
- Validation Report 작성
- 승인 상태 변경

---

# 8. Skill 이름 Migration

## 8.1 기본 Mapping

| 기존 | 새 Canonical Skill |
|---|---|
| `af-analyze-requirement` | `af-discover-assets` |
| `af-design-boundaries` | `af-compose-solution` |
| `af-build-runtime-stub` | `af-scaffold-runtime` |
| `af-verify-feedback` | `af-verify-runtime` |
| 없음 | `af-workflow` |

## 8.2 Compatibility 전략

먼저 참조 조사를 수행한 후 다음 중 하나를 선택한다.

### 전략 A: 완전 Rename

사용 조건:

- Product Code가 기존 Skill ID를 참조하지 않음
- 모든 호출 지점을 이번 허용 범위 안에서 갱신 가능
- Codex와 Claude Code에서 중복 Trigger가 생기지 않음

처리:

- 새 디렉터리를 canonical로 사용
- 기존 디렉터리 제거
- 모든 문서와 Skill cross-reference 갱신

### 전략 B: 제한된 Compatibility Shim

사용 조건:

- Workbench Stage Runner 또는 Product Code가 기존 ID를 계속 요구
- Product Code 변경이 이번 범위 밖임

처리:

- 새 Skill을 canonical로 작성
- 기존 디렉터리에는 짧은 shim만 남김
- shim은 exact legacy invocation 또는 기존 Stage Runner 호출에만 반응
- shim은 독립된 절차나 Reference를 가지지 않음
- 즉시 새 Skill을 읽도록 안내
- shim이 별도 산출물을 만들지 않음
- Migration Status에 제거 조건을 기록

Legacy shim의 `description`을 넓게 작성하여 신규 Skill과 Trigger 경쟁을 만들지 않는다.

### 금지

- 기존 네 Skill과 신규 네 Skill에 동일한 전체 절차를 복제
- 두 체계를 동시에 canonical로 유지
- 신규 Skill이 legacy Skill을 읽고 legacy Skill이 다시 신규 Skill을 읽는 순환
- compatibility를 이유로 새 택소노미를 legacy `adapter`로 되돌림

---

# 9. Skill 작성 표준

## 9.1 Frontmatter

각 canonical `SKILL.md`는 최소 다음을 가진다.

```yaml
---
name: af-discover-assets
description: >-
  ...
---
```

Codex와 Claude Code의 공통 호환성을 우선한다.

- `name`: 소문자, 숫자, 하이픈
- 폴더명과 정확히 일치
- 64자 이내
- `description`: 무엇을 하는지와 언제 Trigger되는지를 모두 포함
- 모호한 “Agent Factory 작업을 돕는다” 금지
- 사용자 표현 예를 자연스럽게 포함
- description은 3인칭 또는 명령형 관점이 섞이지 않게 작성
- UTF-8 BOM 없이 저장

추가 metadata는 Codex와 Claude Code 양쪽의 실제 loader 호환성을 검증한 후에만 사용한다.

## 9.2 SKILL.md 본문

SKILL.md는 다음 내용만 담는다.

1. 목적
2. 선행 조건
3. 핵심 Workflow
4. 읽어야 할 Reference 선택표
5. 허용 Write
6. Stop Conditions
7. 검증 명령
8. 다음 Skill Handoff

세부 API 설명과 긴 예시는 `references/`로 이동한다.

권장 제한:

- 500줄 이하
- 가능하면 150–300줄
- 핵심 절차는 첫 화면에서 보이게 작성
- Reference는 SKILL.md에서 한 단계로 직접 링크
- 깊은 reference chain 금지

## 9.3 Reference

긴 Reference는 상단에 목차를 둔다.

각 Reference는 다음을 포함한다.

```text
Purpose
When to read
Decision criteria
Required evidence
Artifact implications
Scaffold implications
Verification
Stop conditions
Official sources checked
Checked date
```

## 9.4 자유도 조절

| 작업 | 자유도 |
|---|---|
| Requirement 해석과 후보 제안 | 중간 |
| 자산 경계 판단 | 중간 |
| 보안·승인 Gate | 낮음 |
| Artifact path와 schema write | 낮음 |
| ADK API 선택 | 낮음: 공식 문서와 package 확인 |
| Prompt 문구 | 중간 |
| 설계 대안 설명 | 높음 |
| Validation command | 낮음 |
| Runtime Pattern 선택 | 중간, evidence 필수 |

## 9.5 각 Skill을 작은 Transaction으로 작성

각 Skill은 다음 계약을 갖는다.

```text
Preconditions
Inputs
Read Set
Decision Procedure
Allowed Writes
Forbidden Writes
Stop Conditions
Observable Verification
Outputs
Next Handoff
```

“적절히 처리한다” 같은 비검증 표현을 피한다.

---

# 10. `af-workflow`

## 10.1 Trigger

다음 요청에서 Trigger되어야 한다.

- Agent Factory로 Agent 또는 Workflow를 만들고 싶다.
- 요구사항부터 스캐폴딩까지 진행하고 싶다.
- 현재 Artifact 상태에서 다음 단계를 알고 싶다.
- Agent Factory Skill을 이용해 작업하고 싶다.
- 중단한 Agent Factory 작업을 이어서 진행하고 싶다.

다음 요청에서는 단독으로 끝내지 않는다.

- 구체적인 구성요소 도출 요청 → `af-discover-assets`
- Graph 조합 요청 → `af-compose-solution`
- 코드 스캐폴딩 요청 → `af-scaffold-runtime`
- 검증 요청 → `af-verify-runtime`

## 10.2 Workflow

```text
0. 현재 저장소와 Artifact root 확인
1. 활성 문서와 Handbook 확인
2. 기존 산출물 단계 확인
3. 사용자 요청의 현재 목적 확인
4. 필요한 Work Skill 선택
5. 해당 Skill을 다시 읽고 실행
6. 결과 Gate 확인
7. 다음 Skill을 제안 또는 실행
```

## 10.3 Complexity Scaling

### 단순 요구

예:

```text
단일 Agent
Function Tool 하나
사람 입력 없음
원격 연결 없음
```

짧은 확인과 최소 Artifact로 진행한다.

### 복잡 요구

예:

```text
여러 Agent
MCP
A2A
Callback
Ambient Trigger
Long-running
사람 입력
상태·Artifact
```

다음을 요구한다.

- 명시적 Missing Information
- Runtime Pattern decision
- Failure / retry / timeout
- Auth / data policy
- 검증 시나리오
- 복잡도 축소 대안

## 10.4 Session Continuity

각 단계 시작 전에 관련 Skill을 다시 읽도록 한다.

```text
Discover 전 → af-discover-assets
Compose 전  → af-compose-solution
Scaffold 전 → af-scaffold-runtime
Verify 전   → af-verify-runtime
```

이전 Skill 내용이 context에 남아 있을 것이라고 가정하지 않는다.

---

# 11. `af-discover-assets`

## 11.1 목적

사용자 프롬프트와 제공 자료를 근거로 **무엇을 만들어야 하는지**를 구성요소 단위로 도출한다.

이 단계의 주 결과는 Graph가 아니라 다음이다.

```text
Evidence
Assumptions
Contradictions
Missing Information
Agent 후보
Workflow 후보
Tool 후보
Resource
External Dependency
Domain Scope
Owner 후보
Reuse 후보
입력과 출력
Side Effect / Risk
관계 Hint
```

## 11.2 판별 순서

### 질문 1: 독립적인 판단 책임이 있는가

있으면 Agent 후보를 검토한다.

### 질문 2: 둘 이상의 실행 단위 흐름을 소유하는가

있으면 Workflow 후보를 검토한다.

### 질문 3: 구조화된 호출 기능인가

있으면 Tool 후보를 검토한다.

### 질문 4: 호출 기능이 아닌 데이터·문서·시스템인가

Resource 또는 Dependency로 기록한다.

### 질문 5: 한 Workflow 내부의 private 결정 단계인가

독립 자산으로 만들지 않고 Function Node 후보 Hint로 남긴다.

## 11.3 Workflow를 억지로 만들지 않는다

다음은 Workflow 없이 끝날 수 있다.

- 단일 Agent
- 단일 Tool
- Agent와 Agent-selected Tool
- 독립 Tool Catalog 등록

구성요소가 둘 이상이라는 이유만으로 Workflow를 만들지 않는다. 실행 순서와 제어 책임이 있을 때만 Workflow 후보로 만든다.

## 11.4 고급 Runtime Pattern Hint

이 단계에서는 복잡한 패턴을 구현하지 않는다.

다만 다음 증거를 발견하면 Hint를 남긴다.

| 증거 | Hint |
|---|---|
| 외부 이벤트로 시작 | Ambient Trigger 후보 |
| 독립 Agent 서비스 호출 | A2A 후보 |
| 실행 전후 정책 개입 | Callback 후보 |
| 상태·Artifact commit timing 중요 | Event Loop 검토 |
| 외부 Tool server | MCP Binding 후보 |
| 사람 승인 후 재개 | Human Input / Resume 후보 |

Hint를 확정 계약으로 만들지 않는다.

## 11.5 금지

- Graph topology 확정
- ADK class 선택
- A2A Agent Card 생성
- MCP endpoint 추측
- Callback 위치 추측
- 코드 생성
- Approval toggle
- Catalog 직접 write

## 11.6 출력 검증

- 모든 후보가 Evidence를 가진다.
- Evidence와 Assumption이 분리된다.
- `Agent / Workflow / Tool` 이외의 자산 유형이 없다.
- Resource와 Dependency가 Tool로 오인되지 않는다.
- Missing Information이 승인된 사실처럼 쓰이지 않는다.
- 구성요소 간 관계 Hint가 실행 순서로 과도하게 확정되지 않는다.

---

# 12. `af-compose-solution`

## 12.1 목적

검토 가능한 구성요소 후보를 **어떻게 실행할지** 조합한다.

이 단계의 핵심 결과는 다음이다.

```text
Standalone asset 또는 Workflow 결정
Graph IR
Node / Edge
Tool Invocation Control
Tool Binding
Agent A2A Connection
State / Artifact channel
Human Input / Resume
Callback Hook
Ambient Trigger Contract
Runtime Policy
Missing Information
Scaffold Readiness
```

## 12.2 시작 조건

- Discover 산출물이 존재
- 후보의 책임과 I/O가 검토 가능
- Required Missing Information이 정리됨
- Target Contract와 Current Schema 상태 확인

## 12.3 Standalone 여부 우선 판단

먼저 다음을 결정한다.

```text
A. 독립 Agent/Tool만 필요한가
B. 명시적 Workflow가 필요한가
C. Agent delegation으로 충분한가
D. Graph와 Agent delegation이 혼합되는가
```

Workflow가 불필요하면 Graph를 억지로 만들지 않는다.

## 12.4 Graph 조합

Graph가 필요한 경우 다음을 사용한다.

```text
Input
Agent Node
Tool Node
Function Node
Human Input Node
Subworkflow Node
Join Node
Output
```

### Function Node

- Workflow 내부 private code
- 결정적 실행
- 부모 Workflow의 Domain / Owner 상속
- Transform, Validate, Route, Merge 등의 role 가능

### Tool Node

- Catalog Tool 참조
- 독립 Contract와 Owner
- Workflow가 명시적으로 호출
- Binding은 Tool 자산에서 읽음

### Agent-selected Tool

고정 control-flow Node로 넣지 않는다.

```text
Agent ── capability relation ──> Tool
Invocation Control: Agent
```

## 12.5 Runtime Pattern Selection

다음 Pattern Card를 조건부로 읽는다.

```text
MCP
A2A
Callbacks
Event Loop
Ambient Agents
Human Input / Resume
Dynamic Workflow
State / Artifact
```

모든 Pattern을 매번 읽거나 적용하지 않는다.

## 12.6 계약 완성도

Pattern을 선택하면 최소 계약을 작성한다.

### MCP

- Tool ID
- MCP server reference
- Tool name 또는 discovery policy
- Transport
- Auth source
- Tool filter
- Timeout
- Error mapping
- Local mock strategy
- Invocation Control

### A2A

- Agent reference
- Exposing 또는 Consuming
- 독립 Owner와 lifecycle
- Agent Card / discovery
- Auth
- Input / output / task semantics
- Timeout
- Retry / fallback
- Artifact
- Audit / data policy
- Local sub-agent 대안 검토

### Callback

- Hook point
- 목적
- Continue 또는 Override 가능성
- 읽고 쓰는 State
- Side effect
- 오류 정책
- 순서
- Audit / privacy
- Plugin이 더 적절한지 검토

### Ambient Trigger

- Trigger source
- `/run` 또는 trigger endpoint
- Event schema
- Payload normalization
- Session policy
- Idempotency / deduplication
- Concurrency
- Retry / backoff
- DLQ
- Timeout
- Output sink
- Auth
- Observability

### Event Loop

- Event producer
- State / Artifact action
- Commit 시점
- Pause / resume
- Partial / final event
- Session scope
- Failure event
- Callback / Tool event 관계

## 12.7 Scaffold Readiness

다음이 모두 충족될 때만 Ready다.

- 자산 책임
- I/O
- Graph 또는 Standalone 구조
- Binding
- Invocation Control
- Runtime Pattern 계약
- Required auth 변수 이름
- Missing Information 해소
- 테스트 가능한 Scenario
- 승인 상태

Skill은 readiness를 보고할 수 있지만, Workbench approval을 직접 변경하지 않는다.

---

# 13. `af-scaffold-runtime`

## 13.1 목적

승인된 실행 구조를 기반으로 ADK 프로젝트 또는 Runtime Handoff Bundle을 만든다.

핵심 원칙:

```text
Approved Contract → Scaffold
Raw Requirement → Code 금지
```

## 13.2 시작 조건

- 승인된 Compose 결과
- Scaffold Plan
- Required Runtime Contract
- Product Contract 호환
- Output mode 확인
- 실행에 필요한 dependency 확인

## 13.3 Output Mode

문서와 현재 Product Contract를 확인해 실제 지원 값으로 정한다. 개념적으로는 다음을 구분한다.

| Mode | 의미 |
|---|---|
| Skeleton | 파일 구조, interface, TODO 경계 |
| Smoke | synthetic data와 local mock으로 실행 가능 |
| Runnable Prototype | 승인된 구조의 local runtime wiring |
| Production | 이번 Skill 기본 범위 아님 |

Production endpoint, credential, 업무 로직을 생성하지 않는다.

## 13.4 기본 Scaffold 구성

필요한 범위에서 다음을 생성한다.

```text
Agent definitions
Workflow definitions
Tool contracts
Function Tool wiring
Function Node implementation boundary
MCP client/toolset registration boundary
A2A exposing/consuming boundary
Callback module
Ambient trigger entrypoint/config boundary
Session/State/Artifact wiring
Human input/resume boundary
Local mock
Unit/contract tests
Runtime smoke scenario
Eval scenario skeleton
Environment variable template
Implementation handoff
```

요구에 없는 파일을 모두 빈 형태로 생성하지 않는다.

## 13.5 공식 API 확인

코드 생성 전에 다음 순서를 따른다.

1. 공식 ADK 문서 확인
2. 설치된 package version 확인
3. 실제 import와 signature 확인
4. 공식 sample 또는 temporary reference scaffold 확인
5. 최소 코드 생성
6. Compile/import test
7. Local smoke

기억으로 A2A, Callback, Trigger API를 작성하지 않는다.

## 13.6 MCP와 실행 연결

Skill은 다음을 고려한 코드를 생성할 수 있다.

- Function Tool
- MCP Tool
- Agent-selected Toolset
- Workflow-controlled Tool Node
- Local stdio MCP
- Remote HTTP MCP
- Mock Lab 또는 synthetic mock

그러나 다음을 하지 않는다.

- 실제 credential 값 작성
- private endpoint 작성
- 운영 server를 자동 연결
- 승인되지 않은 Tool discovery 허용
- 모든 Tool을 Agent에게 무제한 노출

Workbench 화면에서 연결 설정을 별도로 수행하는 경우에도 Scaffold에는 다음 seam을 남긴다.

```text
binding configuration
env var name
server/tool reference
input/output schema
timeout/error boundary
mock replacement point
implementation handoff
```

## 13.7 Callback Scaffold

Callback은 독립 Tool로 만들지 않는다.

파일 구조 예시는 실제 project convention에 맞추되 역할을 분리한다.

```text
callbacks/
- before_agent
- after_agent
- before_model
- after_model
- before_tool
- after_tool
```

실제로 필요한 Hook만 생성한다.

Callback 테스트는 최소 다음을 다룬다.

- Continue path
- Override / short-circuit path
- State read/write
- Error behavior
- Side effect 중복 방지

## 13.8 Event Loop 안전성

다음을 지킨다.

- State와 Artifact 변경은 ADK Event/Context/Service 의미에 맞게 처리
- Event가 Runner에 의해 처리되기 전 persistence를 가정하지 않음
- yield/pause/resume 이후 state commit을 검증
- partial event와 final event 구분
- callback/tool 결과가 event 흐름에 반영되는지 검증
- 직접 Session 내부를 임의 mutation하여 persistence를 우회하지 않음

## 13.9 Ambient Scaffold

Ambient Trigger가 선택된 경우:

- `/run`과 trigger endpoint 중 승인된 방식을 생성
- trigger endpoint는 지원 source만 사용
- event normalization
- one-session-per-event 기본 의미
- idempotency key 처리 seam
- retry와 DLQ는 외부 source 책임까지 구분
- output sink 필요
- human response를 기다리는 흐름 금지 또는 별도 callback workflow로 분리
- 장시간 실행은 trigger endpoint timeout 적합성 검토
- 로컬 curl fixture 제공

## 13.10 A2A Scaffold

A2A가 선택된 경우 Exposing과 Consuming을 분리한다.

### Exposing

- 기존 Agent를 A2A surface에 노출
- Agent Card
- auth
- task lifecycle
- Artifact support
- local server smoke

### Consuming

- `RemoteA2aAgent` 또는 현재 공식 component
- Agent Card URL 또는 discovery
- timeout
- auth interceptor
- error/fallback handoff
- mock remote server

A2A code는 현재 공식 API와 package source를 확인한 뒤 작성한다.

---

# 14. `af-verify-runtime`

## 14.1 목적

산출물이 존재한다는 사실이 아니라 **주장한 동작이 증거로 확인됐는지** 검증한다.

## 14.2 검증 계층

### Level 1: Skill 구조

- Frontmatter
- 이름과 폴더
- 링크
- Reference
- Trigger description
- BOM
- 중복 canonical 정의

### Level 2: Artifact Contract

- JSON/YAML parse
- Schema
- Gate
- Missing Information
- Target taxonomy
- Allowed writes

### Level 3: Code Correctness

- import
- compile
- type/lint
- deterministic unit test
- contract test

### Level 4: Runtime Smoke

- Agent load
- Workflow route
- Tool call
- MCP mock
- Callback
- State / Artifact
- Human input
- A2A mock
- Ambient trigger

### Level 5: Behavior Evaluation

- 사용자 목표 달성
- Tool 사용 품질
- 불필요 Tool 호출
- route 품질
- 안전
- grounding
- failure / retry
- multi-turn 또는 event-driven 시나리오

## 14.3 Unit Test와 Eval 구분

다음은 deterministic test로 검증한다.

- import
- schema
- exact Tool input/output
- Callback Continue/Override
- Event state_delta
- HTTP status
- retry count
- idempotency
- Graph reachability

다음은 behavior eval로 검증한다.

- 응답 품질
- Tool 선택 품질
- Agent 판단 품질
- 목표 완수
- 자연어 설명
- 복수 가능 답안

LLM 응답 문자열을 exact pytest assertion으로 고정하지 않는다.

## 14.4 Feedback Loop

```text
Run
→ Capture evidence
→ Classify failure
→ Fix Skill / Reference / Scaffold
→ Re-run
→ Compare
```

검증 실패를 threshold 완화로 숨기지 않는다.

## 14.5 결과 기록

최소 다음을 기록한다.

```text
Command
Environment
Input scenario
Selected Skill
Files read
Artifacts written
Exit code
Observed output
Failure
Residual uncertainty
Baseline comparison
```

완료·통과 주장은 fresh output이 있어야 한다.

---

# 15. Shared Reference 재구성

권장 구조는 다음과 같다.

```text
.agents/skills/
├── AGENTS.md
├── af-workflow/
├── af-discover-assets/
├── af-compose-solution/
├── af-scaffold-runtime/
├── af-verify-runtime/
├── <legacy shims if required>/
└── _shared/
    ├── source-of-truth.md
    ├── lifecycle-invariants.md
    ├── artifact-root-and-stage-runner.md
    ├── taxonomy.md
    ├── graph-ir.md
    ├── missing-information.md
    ├── security-and-data.md
    ├── catalog-and-reuse.md
    ├── runtime-pattern-selection.md
    ├── testing-contract.md
    └── adk/
        ├── agents-workflows-tools.md
        ├── function-and-mcp-tools.md
        ├── a2a.md
        ├── callbacks.md
        ├── event-loop.md
        ├── ambient-agents.md
        ├── state-and-artifacts.md
        ├── human-input-and-resume.md
        └── graph-and-dynamic-workflows.md
```

실제 파일 수는 중복을 줄이는 방향으로 조정할 수 있다.

## 15.1 Version-neutral 파일명

기존 `adk-2.3-*`처럼 버전을 파일명에 박지 않는다.

대신 문서 안에 다음을 기록한다.

```text
Checked date
Official source
Installed package version
Supported language
Known compatibility note
```

API가 바뀌면 파일 이름을 바꾸지 않고 내용을 갱신한다.

## 15.2 중복 제거

다음 정보는 한 곳만 canonical로 둔다.

| 정보 | Canonical Reference |
|---|---|
| Taxonomy | `_shared/taxonomy.md` 또는 활성 docs 링크 |
| Graph IR | `_shared/graph-ir.md` 또는 활성 docs 링크 |
| Missing Information | `_shared/missing-information.md` |
| Runtime Pattern 선택 | `_shared/runtime-pattern-selection.md` |
| ADK API | `_shared/adk/*` |
| Testing | `_shared/testing-contract.md` |

Skill 전용 Reference에는 절차만 둔다.

---

# 16. 고급 Runtime Pattern Card

각 Pattern Reference는 같은 템플릿을 사용한다.

```markdown
# Pattern Name

## 이 Pattern이 해결하는 문제
## 사용 증거
## 사용하지 말아야 할 경우
## 필수 질문
## Agent Factory 표현
## Compose Artifact
## Scaffold Output
## Verification Scenarios
## Failure / Retry / Timeout
## Security / Audit
## 공식 자료
## 확인 날짜와 Package Version
```

---

# 17. MCP Pattern

## 17.1 표현

```text
Asset: Tool
Binding: MCP
Invocation Control: Workflow | Agent
Transport: stdio | HTTP
```

## 17.2 Workflow Control

```text
Tool Node
→ 단일 Tool 계약을 명시 호출
```

## 17.3 Agent Control

```text
Agent
→ 승인된 MCP Tool 또는 Toolset 중 필요 시 선택
```

## 17.4 필수 검토

- server lifecycle
- Tool discovery
- allow-list / filter
- auth
- schema
- timeout
- cancellation
- error mapping
- connection cleanup
- local mock
- side effect
- audit

## 17.5 검증

- discovery
- Tool schema
- successful call
- invalid argument
- timeout
- server unavailable
- auth missing
- duplicate side effect
- Agent-selected Tool trajectory
- Workflow fixed call

---

# 18. A2A Pattern

## 18.1 표현

```text
Asset: Agent
Connection / Exposure: A2A
```

A2A를 네 번째 자산 유형으로 만들지 않는다.

## 18.2 사용할 근거

- 독립 서비스
- 다른 Owner
- 다른 배포 lifecycle
- 다른 언어 또는 framework
- Network boundary
- Formal contract 필요

## 18.3 사용하지 않을 경우

- 내부 코드 정리
- 단순 helper
- low-latency 내부 호출
- shared in-memory state 필요
- 같은 process의 재사용

이 경우 local Agent 또는 Function/Tool을 우선 검토한다.

## 18.4 Exposing / Consuming

두 흐름을 별도로 문서화하고 테스트한다.

- Exposing: Agent → A2A Server
- Consuming: Local Agent/Workflow → Remote A2A Agent

## 18.5 필수 계약

- Owner
- Agent Card / discovery
- auth
- request/message/task
- task lifecycle
- long-running semantics
- artifact
- streaming
- timeout
- retry
- fallback
- audit
- data policy
- version compatibility

---

# 19. Callback Pattern

## 19.1 표현

Callback은 Runtime Hook이다.

```text
before_agent
after_agent
before_model
after_model
before_tool
after_tool
```

Callback 자체가 독립적으로 호출·재사용되는 capability가 아니라면 Tool로 등록하지 않는다.

## 19.2 목적 분류

```text
observe
validate
mutate
guard
short-circuit
replace
cache
audit
notify
state-update
```

## 19.3 핵심 계약

- Hook point
- 입력 context
- 읽는 state
- 쓰는 state
- Continue behavior
- Override behavior
- error policy
- ordering
- side effect
- idempotency
- privacy
- audit

## 19.4 Plugin 검토

여러 Agent에 일관되게 적용하는 보안·정책 기능은 Callback 복제보다 Plugin이 적합한지 공식 문서를 확인한다.

## 19.5 검증

- Callback 미등록 기본 흐름
- Continue
- Break / Override
- state update
- Tool block
- cached response
- callback exception
- callback ordering
- duplicate side effect

---

# 20. Event Loop Pattern

## 20.1 표현

Event Loop는 자산 또는 Graph Node가 아니다.

> Runner와 Agent/Tool/Callback 사이에서 Event를 주고받고 State/Artifact action을 commit하는 Runtime 실행 의미

## 20.2 Compose에서 확인할 내용

- 어떤 실행 주체가 Event를 생성하는가
- 어떤 Event action이 state/artifact를 변경하는가
- 언제 실행이 pause되는가
- Runner 처리 후 어디서 resume되는가
- partial/final event 구분
- invocation/session scope
- failure event
- callback/tool event

## 20.3 Scaffold 원칙

- Event 처리 전 persisted state를 가정하지 않는다.
- state_delta가 Runner/SessionService에 의해 처리된 이후의 값을 사용한다.
- Artifact save/load 경계를 명확히 한다.
- Session과 Invocation scope를 혼동하지 않는다.
- Temp state를 장기 persistence로 사용하지 않는다.
- streaming partial output을 final output으로 오인하지 않는다.

## 20.4 검증

- state before yield
- yielded event
- commit
- resumed state
- event history
- partial/final
- callback state action
- Tool result event
- artifact action
- cancellation/error

---

# 21. Ambient Agent Pattern

## 21.1 표현

Ambient Agent는 새로운 Agent 종류가 아니다.

```text
Agent 또는 Workflow
+ Runtime Trigger Contract
```

## 21.2 진입 방식

### `/run`

적합:

- custom webhook
- non-GCP source
- custom session/concurrency/retry 제어

### Trigger Endpoint

적합:

- Pub/Sub
- Eventarc
- 자동 payload parsing
- one-session-per-event
- built-in concurrency
- transient retry

현재 공식 지원 source를 다시 확인한다.

## 21.3 필수 계약

- trigger source
- endpoint mode
- event identity
- schema
- normalization
- session lifecycle
- user identity mapping
- idempotency
- deduplication
- concurrency
- retry/backoff
- DLQ
- timeout
- output sink
- auth
- observability
- replay policy

## 21.4 출력 경로

Ambient 실행은 사용자가 채팅 화면에서 기다리는 전제를 두지 않는다.

다음 중 하나를 설계한다.

- structured log
- Pub/Sub output
- email/ticket/notification integration
- downstream Tool
- Artifact store

## 21.5 검증

- 정상 event
- malformed event
- Base64 decode
- duplicate delivery
- transient error
- retry exhaustion
- DLQ handoff
- concurrency burst
- timeout
- output sink failure
- session isolation
- event replay

---

# 22. Skill 테스트 체계

Skill은 Markdown 검토만으로 완료되지 않는다.

## 22.1 구조 검증기

가능하면 deterministic script를 추가한다.

예:

```text
scripts/validate-skills.mjs
```

검증 항목:

- canonical Skill directory
- `SKILL.md`
- YAML frontmatter
- name-folder match
- name rules
- description length
- UTF-8 BOM
- broken relative link
- missing reference
- duplicate Skill name
- circular reference
- forbidden legacy vocabulary
- SKILL.md line budget
- deep reference chain
- orphan reference
- legacy shim rule
- source URL and checked date

## 22.2 Trigger Matrix

각 Skill에 대해 다음을 만든다.

```text
should-trigger
should-not-trigger
ambiguous
explicit invocation
continuation after compaction
```

예:

| Prompt | Expected |
|---|---|
| “이 요구에서 만들 구성요소를 나눠줘” | `af-discover-assets` |
| “승인된 Agent와 Tool을 Graph로 연결해줘” | `af-compose-solution` |
| “이 승인 설계로 ADK 프로젝트를 만들어줘” | `af-scaffold-runtime` |
| “생성된 MCP 연결과 callback을 검증해줘” | `af-verify-runtime` |
| “현재 어디까지 했고 다음 단계가 뭐야?” | `af-workflow` |
| “README 맞춤법 수정” | 어떤 AF Skill도 자동 Trigger하지 않음 |

## 22.3 Scenario Suite

최소 다음 시나리오를 만든다.

### S01 단일 Agent

- 분류 Agent
- Tool 없음
- Workflow 생성 금지

### S02 Function Tool + Workflow Control

- 날짜 계산 Tool
- Tool Node
- Binding Function
- Invocation Control Workflow

### S03 Agent-selected MCP Tool

- 문서 검토 Agent
- OCR MCP Tool
- Invocation Control Agent
- Tool Node 고정 배치 금지

### S04 Domain-neutral OCR

- OCR Tool Owner는 공통 플랫폼
- 여신 Workflow에서 참조
- Tool Domain을 `공통`으로 쓰지 않음

### S05 Function Node와 Tool Node

- OCR 결과 정규화는 Function Node
- OCR 실행은 Tool Node

### S06 Standalone Agent + A2A Exposure

- Agent 자산
- A2A exposure
- Remote A2A 자산 생성 금지

### S07 A2A Consuming

- 외부 Owner Agent
- Remote connection
- Local sub-agent 대안 비교
- mock A2A server

### S08 Callback Guardrail

- before_tool
- 허용/차단
- Continue/Override
- state/audit

### S09 Event Loop State Commit

- state_delta event
- yield
- Runner commit
- resume
- state 검증

### S10 Ambient Pub/Sub

- event normalization
- one-session-per-event
- idempotency
- retry/DLQ
- output sink

### S11 Human Input / Resume

- 사용자 승인
- pause
- response mapping
- resume
- rerun semantics

### S12 Dynamic Workflow

- 명시 Graph로 표현하기 어려운 반복
- bounded loop
- exit
- failure

### S13 Raw Requirement Direct Scaffold 거부

- 승인 Artifact 없음
- Scaffold Skill 중단

### S14 Missing Information Gate

- MCP auth와 schema 미확정
- Compose Ready 금지

### S15 Private Data 안전

- Prompt에 private endpoint와 credential 포함
- Artifact와 fixture에 값 복제 금지

### S16 Legacy Skill Shim

- 기존 ID explicit call
- 신규 canonical Skill로 handoff
- 중복 실행 없음

## 22.4 Scenario Contract

각 시나리오는 다음을 가진다.

```text
prompt.md
context/
expected-skill.json
expected-artifacts.md
forbidden-outcomes.md
verification-commands.txt
rubric.md
```

Exact prose를 Golden으로 고정하지 않는다. 구조와 행동을 평가한다.

## 22.5 Baseline 비교

기존 Skill을 제거하기 전에 동일 시나리오를 실행한다.

비교 지표:

- 올바른 Skill 선택
- 올바른 자산 유형
- Workflow 과잉 생성
- Missing Information 발견
- Graph Node 정확성
- Invocation Control 정확성
- MCP/A2A/Callback/Ambient 인식
- Gate 준수
- 불필요 파일 생성
- 검증 완료율
- Token / Tool call 수는 참고 지표

Baseline 결과는 sanitized evidence로 남긴다.

---

# 23. Codex와 Claude Code 실제 검증

## 23.1 공통 원칙

같은 Git commit과 같은 Scenario를 사용한다.

각 실행은 새 세션 또는 격리된 작업 환경에서 수행한다.

테스트 Agent에게 다음을 미리 알려 주지 않는다.

- 기대 정답
- 기존 Skill의 문제
- 의도한 수정
- 평가 Rubric의 점수 기준

자연스러운 사용자 요청만 제공한다.

## 23.2 Codex 검증

Codex가 Skill을 실제로 발견하는 경로와 방법을 현재 버전에서 확인한다.

- 저장소 local Skill discovery
- explicit `$skill-name`
- `/skills` 또는 현재 지원 명령
- `SKILL.md` frontmatter load
- reference 접근
- scripts 실행
- UTF-8/BOM
- symlink 사용 여부

공식 Codex skill-creator와 현재 Codex 버전을 우선한다.

## 23.3 Claude Code 검증

Claude Code가 Skill을 실제로 발견하는 경로와 방법을 현재 버전에서 확인한다.

- Project Skill 위치
- explicit Skill invocation
- natural language trigger
- reference progressive disclosure
- scripts 실행
- permissions
- fresh context

`.agents/skills`가 직접 로드되지 않는다면 복제본을 수동 관리하지 않는다.

다음 중 저장소에 가장 적합한 adapter를 검토한다.

- 설치 script
- generated mirror
- supported plugin packaging
- test-only copy

Canonical source는 `.agents/skills` 하나로 유지한다.

## 23.4 증거 저장

권장 경로:

```text
tests/skills/evidence/
├── codex/
└── claude-code/
```

각 실행에 다음을 저장한다.

```text
environment.md
prompt.md
selected-skills.md
commands.log
artifact-tree.txt
validation.txt
result-summary.md
```

다음을 저장하지 않는다.

- auth token
- API key
- private endpoint
- raw customer data
- 전체 private terminal history

## 23.5 최소 통과 기준

각 canonical Skill당 다음을 만족한다.

- Codex should-trigger 2개 이상
- Codex should-not-trigger 2개 이상
- Claude should-trigger 2개 이상
- Claude should-not-trigger 2개 이상
- 한 개 이상의 복합 Scenario
- Stop Condition 1개 이상
- Artifact validation
- Reference가 필요할 때만 로드되는 증거

---

# 24. Workbench와 독립 CLI 사용의 관계

새 Skill은 두 환경을 모두 지원해야 한다.

## 24.1 Stage Runner Mode

- Workbench run context 존재
- proposal-first
- allowed proposed-artifacts만 write
- approval 직접 변경 금지

## 24.2 Standalone Mode

- Codex/Claude가 Artifact root 또는 새 project에서 직접 실행
- 동일한 Target Contract 사용
- 명확한 output path
- canonical write 여부를 사용자·문서 Gate로 판단

## 24.3 Skill 책임과 화면 책임

화면이 담당하기 적합한 항목:

- 실제 MCP server 선택
- endpoint 입력
- credential 연결
- Catalog 승인
- Graph 시각 편집
- Runtime 시작/중지

Skill이 담당할 항목:

- 필요한 계약 도출
- 입력·출력 schema
- binding seam
- env var 이름
- mock 전략
- scaffold code
- verification command
- handoff TODO

화면이 있다는 이유로 Skill이 Runtime Contract를 무시하지 않는다.

---

# 25. Handbook 적용

이 Skill 재편 작업 자체도 Agent Factory Handbook을 사용한다.

## 25.1 작업 전

```text
docs/handbook/README.md
→ overview.md
→ index.md
→ 관련 Register
→ Skill/Stage 관련 L2/L3
→ 실제 Source
```

## 25.2 작업 후

Skill 변경은 Agent Factory 행동을 바꾸므로 다음을 갱신한다.

- Skill lifecycle stage
- skill invocation/register
- Stage Runner 관계
- Artifact producer/consumer
- Handbook L3 locator
- coverage
- source snapshot
- migration status

Handbook은 위치 안내이고 실제 Source가 최종 권위다.

---

# 26. 단계별 실행 계획

## Phase 0. Safety and Baseline

- Git 상태 확인
- 현재 commit 기록
- 기존 Skill tree snapshot
- 기존 네 Skill Scenario baseline
- 기존 validator 결과 기록

## Phase 1. Official Source Study

- Google Agents CLI Skill 구조 분석
- OpenAI Codex skill-creator 분석
- Anthropic Skill best practices 분석
- ADK Agent/Workflow/Tool 확인
- MCP/A2A/Callback/Event Loop/Ambient 확인
- 설치된 ADK package 확인
- Source note 작성

## Phase 2. Contract Preflight

- 문서 vNext 존재 확인
- Product Schema 호환 확인
- Stage Runner hardcode 확인
- Skill rename 영향 확인
- Full / Partial migration mode 결정
- Blocker 기록

## Phase 3. Skill Information Architecture

- 새 다섯 Skill의 Trigger 경계
- Read/write/gate
- Shared reference 구조
- Legacy compatibility
- Scenario matrix
- 사용자 흐름
- 사용자 승인 없이 이미 확정된 택소노미를 다시 논의하지 않음

## Phase 4. Shared References

먼저 `_shared`를 정비한다.

순서:

1. source of truth
2. lifecycle
3. taxonomy
4. Graph IR
5. missing information
6. security
7. runtime pattern matrix
8. ADK pattern cards
9. testing contract

## Phase 5. Canonical Skills

다음 순서로 작성한다.

1. `af-discover-assets`
2. `af-compose-solution`
3. `af-scaffold-runtime`
4. `af-verify-runtime`
5. `af-workflow`

Entrypoint를 마지막에 작성하여 실제 Work Skill 계약을 정확히 참조하게 한다.

## Phase 6. Compatibility

- 참조 조사 결과에 따라 rename 또는 shim
- 순환 제거
- 중복 Trigger 검사
- Legacy removal criteria 작성

## Phase 7. Deterministic Validation

- Skill validator
- link checker
- frontmatter
- forbidden term
- reference graph
- scenario fixture validation
- artifact contract validation

## Phase 8. Forward Testing

- Codex fresh session
- Claude Code fresh session
- 단순 시나리오
- 복합 시나리오
- stop/gate 시나리오
- 결과 비교
- Skill 수정
- 재실행

## Phase 9. Runtime Smoke

지원 가능한 시나리오에 대해:

- generated source compile
- import
- local mock
- MCP
- A2A
- Callback
- Event Loop state
- Ambient curl
- Human Input

실제 외부 서비스는 synthetic mock으로 대체한다.

## Phase 10. Documentation and Handbook

- `.agents/skills/AGENTS.md`
- root AGENTS/CLAUDE
- docs index
- decision log
- Skill Migration Status
- Handbook resync

## Phase 11. Final Audit

- 모든 acceptance criteria
- git diff
- secret scan
- legacy term audit
- Skill trigger test
- Product code 변경 여부
- unresolved blocker

---

# 27. 검증 명령

저장소의 실제 command와 package manager를 확인한 후 조정한다.

## 27.1 기본

```bash
git diff --check
git diff --name-only
```

## 27.2 Skill 구조

```bash
node scripts/validate-skills.mjs
```

또는 실제 구현 언어에 맞는 동등 command.

## 27.3 Legacy 용어

```bash
rg -n -i \
  'module_category: adapter|adapter_kind|agent_kind|selected_by_llm|decision_owner: llm|domain agent|common agent|shared agent|specialist agent' \
  .agents/skills \
  --glob '!**/legacy-compatibility*'
```

검색 결과를 하나씩 검토한다.

## 27.4 링크

변경된 Markdown의 상대 링크가 존재하는지 검증한다.

## 27.5 Artifact

Product Contract가 vNext를 지원하는 경우:

```bash
node scripts/validate-artifacts.mjs <scenario-artifact-root>
```

지원하지 않으면 통과한 것처럼 우회하지 않는다.

## 27.6 Generated Python

```bash
python3 -m compileall <generated-project>
```

필요하면 import test를 추가한다.

## 27.7 Test

```bash
<repository skill test command>
```

테스트 command를 package script로 추가한 경우 최종 보고에 적는다.

## 27.8 Secret Scan

Fixture와 Evidence에 credential/private endpoint가 없는지 검색한다.

---

# 28. Acceptance Criteria

## Skill 구조

- [ ] `af-workflow`가 Entrypoint다.
- [ ] 네 Work Skill의 책임이 겹치지 않는다.
- [ ] 각 Skill description이 Trigger를 충분히 설명한다.
- [ ] SKILL.md가 간결하고 Reference로 progressive disclosure한다.
- [ ] `_shared`는 Trigger되지 않는다.
- [ ] Reference chain이 깊지 않다.
- [ ] deterministic task는 script로 검증한다.

## Taxonomy

- [ ] Agent / Workflow / Tool만 최상위 자산이다.
- [ ] Adapter가 활성 유형이 아니다.
- [ ] A2A가 자산 유형이 아니다.
- [ ] Domain/Owner/Reuse가 분리된다.
- [ ] Workflow를 불필요하게 생성하지 않는다.
- [ ] Function Node와 Tool Node를 구분한다.
- [ ] Tool Invocation Control은 Workflow / Agent다.

## Runtime Pattern

- [ ] MCP Pattern Card가 있다.
- [ ] A2A Pattern Card가 있다.
- [ ] Callback Pattern Card가 있다.
- [ ] Event Loop Pattern Card가 있다.
- [ ] Ambient Agent Pattern Card가 있다.
- [ ] Human Input/Resume가 있다.
- [ ] Pattern은 evidence에 따라 조건부 적용된다.
- [ ] Pattern 선택 시 Scaffold와 Test까지 연결된다.

## Scaffold

- [ ] Raw requirement에서 직접 코드가 생성되지 않는다.
- [ ] 승인된 Compose 결과만 소비한다.
- [ ] 공식 API와 installed package를 확인한다.
- [ ] MCP seam이 있다.
- [ ] A2A exposing/consuming이 구분된다.
- [ ] Callback Continue/Override가 고려된다.
- [ ] Event state commit timing이 고려된다.
- [ ] Ambient trigger의 output sink가 고려된다.
- [ ] private endpoint/credential이 없다.
- [ ] production business logic을 생성하지 않는다.

## Verification

- [ ] Structural validator가 있다.
- [ ] Trigger matrix가 있다.
- [ ] Scenario suite가 있다.
- [ ] Baseline 비교가 있다.
- [ ] Codex 실제 실행 증거가 있다.
- [ ] Claude Code 실제 실행 증거가 있다.
- [ ] Runtime smoke가 있다.
- [ ] Behavior eval과 deterministic test가 구분된다.
- [ ] 실패를 숨기지 않는다.

## Integration

- [ ] 기존 Skill ID 참조를 조사했다.
- [ ] Rename 또는 shim 전략이 적용됐다.
- [ ] 중복 Trigger가 없다.
- [ ] Product Schema compatibility가 확인됐다.
- [ ] 미지원 시 Blocker가 명시됐다.
- [ ] Handbook이 갱신됐다.

---

# 29. 산출물

최소 산출물은 다음과 같다.

```text
.agents/skills/af-workflow/**
.agents/skills/af-discover-assets/**
.agents/skills/af-compose-solution/**
.agents/skills/af-scaffold-runtime/**
.agents/skills/af-verify-runtime/**
.agents/skills/_shared/**
tests/skills/**
scripts/validate-skills.*
docs/migration/skill-vnext-status.md
docs/decision-log.md update
docs/handbook/** update
```

Compatibility가 필요한 경우:

```text
.agents/skills/af-analyze-requirement/SKILL.md
.agents/skills/af-design-boundaries/SKILL.md
.agents/skills/af-build-runtime-stub/SKILL.md
.agents/skills/af-verify-feedback/SKILL.md
```

는 짧은 shim으로만 남긴다.

---

# 30. `skill-vnext-status.md` 요구사항

다음을 기록한다.

## Source Snapshot

- repository
- branch
- commit
- date
- Codex version
- Claude Code version
- ADK version
- Google Agents CLI reference commit

## Old → New Mapping

- Skill
- Reference
- Artifact
- Stage Runner
- Trigger
- Compatibility

## Product Contract Compatibility

- supported
- unsupported
- partial
- blocker

## Scenario Results

- baseline
- new
- Codex
- Claude
- runtime smoke

## Remaining Gap

- Product migration
- UI integration
- schema
- runtime pattern
- loader compatibility
- unverified API

## Legacy Removal Criteria

Shim을 언제 삭제할 수 있는지 명시한다.

---

# 31. 최종 보고 형식

```markdown
# 완료 보고

## 기준
- Repository:
- Branch:
- Source commit:
- Google Agents CLI reference commit:
- ADK checked date/version:
- Codex version:
- Claude Code version:
- Migration mode: Full | Partial | Blocked

## 새 Skill
- af-workflow:
- af-discover-assets:
- af-compose-solution:
- af-scaffold-runtime:
- af-verify-runtime:

## Legacy 처리
- Rename:
- Shim:
- Remaining references:

## Shared Reference
- Added:
- Rewritten:
- Removed:

## Runtime Pattern 지원
- MCP:
- A2A:
- Callback:
- Event Loop:
- Ambient:
- Human Input/Resume:
- Dynamic:

## 테스트
- Structural:
- Trigger:
- Scenario:
- Artifact:
- Runtime smoke:
- Codex:
- Claude:
- Baseline comparison:

## Integration
- Product Contract compatibility:
- Stage Runner compatibility:
- Workbench compatibility:
- Blockers:

## Handbook
- Updated stages:
- Updated registers:
- Updated locators:
- Needs-review/frozen:

## 변경 파일
<git diff --name-only>

## 검증 명령과 결과
<command and exit result>

## 명시적 확인
- Private data added: No
- Credentials added: No
- Production endpoints added: No
- Raw requirement to code enabled: No
- Product schema changed inside skill task: No
- Unverified completion claim: No
```

---

# 32. 금지 사항

1. 기존 Skill 파일의 용어만 일괄 치환하고 완료하지 않는다.
2. 새 Skill 이름만 바꾸고 책임 구조를 그대로 두지 않는다.
3. `af-discover-assets`에서 Graph를 확정하지 않는다.
4. `af-compose-solution`에서 코드를 생성하지 않는다.
5. `af-scaffold-runtime`이 Raw requirement를 직접 읽어 코드를 만들지 않는다.
6. `af-verify-runtime`이 명령을 실행하지 않고 통과를 주장하지 않는다.
7. Adapter를 Tool로 단순 문자열 치환하지 않는다.
8. A2A를 Agent 종류로 만들지 않는다.
9. Ambient Agent를 Agent 종류로 만들지 않는다.
10. Callback을 무조건 Tool로 만들지 않는다.
11. Event Loop를 Graph Node로 만들지 않는다.
12. 모든 요구에 Workflow를 강제하지 않는다.
13. 모든 Agent에 MCP Toolset을 무제한 제공하지 않는다.
14. 공식 API를 기억으로 작성하지 않는다.
15. 테스트 Agent에게 기대 정답을 누설하지 않는다.
16. Codex에서만 성공하고 Claude Code 검증을 생략하지 않는다.
17. Claude Code에서만 성공하고 Codex 검증을 생략하지 않는다.
18. Product Contract가 legacy인데 Full Integration 완료라고 쓰지 않는다.
19. Skill 변경을 이유로 Product Code를 무단 수정하지 않는다.
20. Archive 또는 private handoff 자료를 현재 기준으로 사용하지 않는다.

---

# 33. 실행 지시

이제 위 지시를 기준으로 작업을 수행한다.

1. 먼저 기존 Skill과 호출 지점을 감사한다.
2. 문서 vNext와 Product Contract compatibility를 확인한다.
3. 공식 Google Agents CLI와 ADK 자료를 현재 시점에서 다시 확인한다.
4. 새 Skill 정보 구조와 Scenario Matrix를 확정한다.
5. Shared Reference를 먼저 정비한다.
6. 네 Work Skill을 작성한다.
7. 마지막에 `af-workflow` Entrypoint를 작성한다.
8. 필요한 경우에만 legacy shim을 만든다.
9. deterministic validator와 Scenario test를 만든다.
10. Codex와 Claude Code에서 fresh-session forward test를 수행한다.
11. Runtime pattern smoke를 수행한다.
12. 실패를 기반으로 Skill을 수정하고 다시 테스트한다.
13. 활성 문서와 Handbook을 갱신한다.
14. 모든 검증을 수행한 뒤 지정된 완료 보고 형식으로 제출한다.

확정된 택소노미와 Skill 구조에 대해서는 추가 승인을 요청하지 않는다.
구현 사실이나 Product Contract가 불명확하면 추측하지 말고 Blocker 또는 `needs-review`로 기록한다.
