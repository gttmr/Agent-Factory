# Active Workbench Docs

## Scope

이 디렉터리는 Agent Factory의 활성 workbench 문서를 소유한다. 개념·Graph·운영·검토·검증의 canonical 역할을 분리하고, Target Contract와 Current Implementation을 명시적으로 구분한다.

## Where To Look

| 찾는 내용 | 기준 문서 |
| --- | --- |
| 문서 전체 진입점과 읽기 순서 | `../README.md` |
| 운영 단계, 승인 게이트, artifact 태도 | `operating-model.md` |
| Agent/Workflow/Tool 분류와 속성 | `taxonomy.md` |
| Graph Node·Edge, Binding, Invocation Control | `graph-ir.md` |
| 사람 검토 축과 승인 결정 | `review-board.md` |
| 문서·artifact·코드·evidence 검증 | `validation.md` |
| ADK `LlmAgent.mode` Current Implementation 정책 | `adk-agent-execution-modes.md` |
| 기존 harness 경로 호환 pointer | `agent-factory-harness.md` |
| 기존 process-flow 경로 호환 pointer | `process-flow.md` |
| 별도 후속 이슈와 상태 | `follow-ups/INDEX.md`, `follow-ups/STATUS.md` |

행동이 실제 source 어디에서 구현되는지 찾을 때는 `../handbook/README.md`에서 시작한다. Handbook locator는 탐색 지도이며 최신 source가 최종 권위다.

## Local Rules

- Target Contract의 최상위 자산 유형은 Agent, Workflow, Tool뿐이다. 역할, 프로토콜, Domain, Owner, 재사용 상태를 근거로 다른 최상위 유형을 추가하지 않는다.
- 자산 분류는 `taxonomy.md`, Graph 표현은 `graph-ir.md`, 작업 단계와 승인 관계는 `operating-model.md`에 링크한다. 다른 문서에서 독자 enum이나 변형 정의를 만들지 않는다.
- Target Contract와 Current Implementation을 절·표·문단 수준에서 구분한다. 현행 식별자는 backtick과 `legacy` 표지를 사용하고 명시적인 Current Implementation 문맥에서만 설명한다.
- legacy `adapter` 후보를 자동으로 Tool로 바꾸지 않는다. 문맥에 따라 Tool, Resource, Dependency를 판별하고 migration gap을 기록한다.
- Invocation Control의 사람 대상 표시는 Workflow 또는 Agent다. Model/LLM과 legacy `selected_by_llm`을 Target 호출 결정권으로 사용하지 않는다.
- A2A와 MCP는 자산 유형이 아니라 연결 프로토콜이다. A2A 경계는 독립 Owner와 auth·lifecycle·timeout·retry·fallback·audit 계약이 있을 때만 승인한다.
- Handbook의 path와 stable anchor는 인용하거나 갱신할 때마다 현재 checkout에서 재검증한다. 확인하지 못한 locator를 active로 단정하지 않는다.
- `docs/archive/**`와 handoff snapshot은 역사·근거 자료이지 활성 동작 계약이 아니다. 현재 규칙을 그 문서로 연결하지 않는다.
- Build, Verify, Run의 역할을 섞지 않는다. Runtime Handoff 생성, allow-list 검증, 로컬 runtime proof는 서로 다른 표면이며 production deployment가 아니다.
- 상세 follow-up이 canonical 문서, Handbook locator, current source와 충돌하면 최신 source를 확인하고 불일치를 명시한다.

## Anti-Patterns

- Archive, survey, review report, handoff note를 canonical 정의처럼 복사하지 않는다.
- Agent/Workflow/Tool과 Graph Node 종류를 하나의 taxonomy나 enum으로 합치지 않는다.
- Shared/Common/Domain/Coordinator 같은 말을 Agent 종류로 승인하지 않는다.
- legacy `adapter`, `remote_a2a`, subtype 이름을 Target Contract가 이미 지원하는 것처럼 쓰지 않는다.
- Function Node와 Function binding을 가진 Tool을 같은 것으로 설명하지 않는다.
- `catalog/*.yaml`을 일반 앱 작업의 직접 write 경로로 문서화하지 않는다. Current Implementation의 승인 publish는 `POST /api/catalog/publish`다.
- route, UI, API, validator, skill, source locator를 현재 source 확인 없이 단정하지 않는다.
- 문서 drafting을 schema·validator·UI·generator 변경 계획이나 코드 WBS로 확장하지 않는다.

## Verification

Docs-only 변경은 최소한 다음을 확인한다.

- `git diff --check`
- 변경 파일 목록과 허용 범위
- 상대 링크와 anchor 존재 여부
- canonical 정의 중복 여부
- Target Contract와 Current Implementation 분리
- legacy gap의 Migration Status 기록 여부
- Handbook path와 symbol 존재 여부

Current Implementation artifact 계약을 설명하거나 바꾼 경우 저장소 root에서 `node scripts/validate-artifacts.mjs`를 사용한다. 이 validator는 legacy 계약을 검증하며 Target 택소노미 지원 증거가 아니다.

TypeScript, React, analyzer, server 또는 보이는 web 행동을 바꾼 경우 `cd packages/web && npm run build`를 실행한다. Analyzer/schema/validator agreement가 관련되면 같은 디렉터리에서 `npm run test:analyzer`도 실행한다. 실행하지 못한 검증은 이유와 불확실성을 남긴다.
