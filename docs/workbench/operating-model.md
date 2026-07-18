> 이 문서는 Agent Factory의 운영 모델(Operating Model) 단일 기준이다. 개념·분류는 [taxonomy.md](./taxonomy.md), Graph 표현은 [graph-ir.md](./graph-ir.md), 행동↔소스 위치는 [../handbook/README.md](../handbook/README.md)가 기준이다.

# Agent Factory 운영 모델(Operating Model)

## 1. 목적과 파이프라인

Agent Factory는 모호한 요구사항을 곧바로 코드로 바꾸는 도구가 아니라, 검토 가능한 artifact와 명시적 승인을 거쳐 Runtime Handoff를 준비하는 workbench다.

```text
raw requirement
  → reviewed artifact
  → 승인
  → Runtime Handoff
  → 검증
```

두 불변식을 모든 작업에 적용한다.

- raw requirement는 직접 코드를 생성하지 않는다. Runtime Handoff는 검토·승인된 artifact만 소비한다.
- Runtime Handoff는 후속 구현 또는 로컬 실행 검증을 위한 전달물이며 production deployment가 아니다.

이 문서에서 Agent, Workflow, Tool은 [Taxonomy](./taxonomy.md)의 Target Contract를 따르고, Node와 Edge는 [Graph IR](./graph-ir.md)를 따른다. 현재 코드의 `module_category`, `adapter`, `remote_a2a` 같은 이름은 Target Contract가 아니라 아래 Current Implementation 설명에서만 `legacy` 식별자로 다룬다.

## 2. 작업 단계

### Target Contract

| 단계 | 목적 | 입력 | 출력 | 승인 게이트 |
| --- | --- | --- | --- | --- |
| 분석 | 요구사항의 근거와 불확실성을 드러내고 Agent·Workflow·Tool 후보를 식별한다. | raw requirement, 참고 자료, 사용 가능한 Catalog 근거 | 정규화 요구사항, evidence, missing-information, 초기 자산 후보 | 요구사항 수준 missing-information을 검토하고 분석 결과를 명시적으로 승인한다. |
| 설계·검토 | 자산 책임, Graph IR, 입출력·runtime 계약, 재사용·도메인·Owner·risk 경계를 함께 검토한다. | 승인된 분석 artifact, Catalog 근거, 검토 의견 | 검토된 자산 후보, Graph IR, runtime/A2A 계약, 재사용·도메인 매핑, risk gates | 후보 수준 missing-information이 모두 해소되고 Graph 및 필수 계약이 승인 가능해야 한다. |
| 승인 | artifact가 Handoff의 입력으로 적합한지 사람이 명시적으로 결정한다. | 설계 artifact, diff, validation evidence, decision notes | gate별 승인 상태 또는 보완 요청 | gate 상태만이 다음 단계 진입 여부의 단일 소스다. artifact 생성이나 파일 존재는 승인을 대신하지 않는다. |
| Handoff/Build | 승인된 계약에서 scaffold plan과 Runtime Handoff bundle을 만든다. | 승인된 분석·설계 artifact와 scaffold plan | `runtime-stub/`, `implementation-handoff.md`, 생성 결과 목록 | 생성물 존재와 검토를 근거로 후속 진행 가능 여부를 별도로 승인한다. |
| 검증 | artifact·계약·handoff의 일관성과 실행 가능한 검증 결과를 기록한다. | canonical artifact root, Runtime Handoff, 검증 명령, Catalog 제안 | validation output, `validation-report.md`, `catalog-delta.yaml`, decision notes | 실패는 해당 소유 단계로 되돌린다. 검증 실행 자체가 앞 단계의 승인을 새로 만들지 않는다. |

### Current Implementation(`legacy`)

현재 web workbench는 다음 route와 Stage Runner 표면을 제공한다. 이 표의 route, skill 이름, manifest 필드는 현행 구현 사실이며 새 Target 직렬화가 이미 구현되었다는 뜻이 아니다.

| 단계 | 현행 route·표면 | 현행 DLC skill 및 Stage Runner 행동 |
| --- | --- | --- |
| Analyze | `/af/:reqId/analyze` | `af-analyze-requirement`가 proposal을 만들고 명시적 apply 뒤 canonical `analysis-result.json`을 바꾼다. |
| Design | `/af/:reqId/design` | `af-design-boundaries`가 `analysis-result.json`과 `boundary-design.md` proposal을 만들며, `legacy` `analysis_reviewed` gate 뒤 실행된다. |
| Build | `/af/:reqId/build` | DLC 운영 계약은 `af-build-runtime-stub`이다. 현행 Stage Runner registry는 `runtime-stub/build` server primitive를 감싸 canonical `runtime-stub/`을 직접 생성하며 apply proposal은 없다. |
| Verify | `/af/:reqId/verify` | `af-verify-feedback`과 Verify allow-list 표면이 validation evidence, `validation-report.md`, `catalog-delta.yaml` 검토를 지원한다. |
| Run | `/af/:reqId/run` | 승인 stage가 아닌 gate-less 로컬 실행 표면이다. Runtime Handoff 이후 ADK runtime과 A2A proof를 다루며 운영 pipeline의 production deployment 단계가 아니다. |

Stage Runner 실행 근거와 canonical artifact apply 규칙은 [Handbook](../handbook/README.md)에서 해당 stage의 최신 source locator를 따라 확인한다.

## 3. 승인 게이트 모델

### Target Contract

missing-information은 두 층으로 다룬다.

- 요구사항 수준 missing-information은 soft gate다. 분석자가 사실을 꾸며 채우지 않고 reviewer가 각 항목을 확인·수용해야 분석 승인이 가능하지만, 그 자체가 후보 계약의 확정을 뜻하지는 않는다.
- 후보 수준 missing-information과 `status: needs_info`는 hard gate다. Agent·Workflow·Tool 후보의 책임, Graph 연결, 필수 계약에 남은 미결 정보는 해당 후보 승인과 Runtime Handoff를 막는다.

승인 gate는 진행 상태의 단일 소스다. proposal 생성, artifact 저장, validation 성공, Runtime Handoff 생성은 근거를 제공할 뿐 gate를 자동으로 바꾸지 않는다. gate를 우회하는 보조 상태나 파일 존재 여부를 별도 승인 신호로 사용하지 않는다.

### Current Implementation(`legacy`)

현행 `af-run-manifest.json`은 다음 네 boolean을 `manifest.approvals.*`에 저장한다.

| `legacy` 필드 | 현행 의미 |
| --- | --- |
| `manifest.approvals.analysis_reviewed` | 요구사항 수준 missing-information 수용과 분석 검토 승인 |
| `manifest.approvals.boundaries_approved` | 모든 후보 승인과 Graph IR error 해소 뒤 경계 승인 |
| `manifest.approvals.runtime_contracts_approved` | 필요한 runtime/A2A 계약 readiness 승인 |
| `manifest.approvals.stub_ready_for_followup` | 비어 있지 않은 Runtime Handoff 결과를 후속 작업 대상으로 승인 |

오직 `PATCH /api/af/:reqId/manifest/approvals`가 이 gate와 `stages.<stage>.status`를 함께 projection한다. Analyze는 `analysis_reviewed`, Design은 `boundaries_approved && runtime_contracts_approved`, Build는 `stub_ready_for_followup`에 따라 `complete` 또는 `pending`이 되며 Verify status는 이 projection이 보존한다. Stage Runner 실행·apply, artifact sync, generator, validator는 이 approval boolean을 자동으로 true로 만들지 않는다.

현행 요구사항 soft gate는 `evidence.missing_information`과 `evidence.accepted_missing_information`을 사용한다. 후보 hard gate는 `ModuleCandidate.missing_information`과 `status: needs_info`를 사용하며, 미해결 후보는 scaffold plan과 Runtime Handoff 생성을 막는다. 이 식별자들은 모두 Current Implementation의 `legacy` 계약이다.

## 4. Artifact 태도

Agent Factory 작업은 설명만 남기거나 생성물만 전달하지 않는다. 판단의 입력, 미결 정보, 승인 근거, 검증 결과를 reviewable artifact로 보존한다.

필수 artifact family는 다음과 같다.

- 정규화 요구사항
- evidence와 assumptions
- missing-information 기록과 수용·해결 근거
- Agent·Workflow·Tool 자산 후보와 현행 `legacy` module candidates
- Graph IR
- runtime contracts와 필요한 A2A 연결 계약
- 재사용·도메인·Owner 매핑
- risk gates
- validation output
- decision notes

`artifacts/af/<req-id>/`는 한 requirement run의 canonical store다. 그 안에서 `analysis-result.json`은 현행 분석·후보·`processFlow`의 canonical source이고, `af-run-manifest.json`은 현행 gate와 stage projection을 보존한다. split artifact, scaffold plan, Runtime Handoff, validation report, Catalog delta, collaboration record, Stage Runner evidence도 같은 root의 provenance를 유지해야 한다.

Browser cache나 화면의 임시 상태는 canonical artifact를 대체하지 않는다. proposal은 명시적 검토와 apply 전까지 canonical artifact가 아니다.

## 5. Catalog·재사용 거버넌스

재사용 판단은 자산 유형과 분리한다. 상태 의미는 [Taxonomy의 `reuse_status`](./taxonomy.md#reuse-governance)를 따르고, 기존 자산 참조와 신규 publish 후보를 같은 의미로 취급하지 않는다.

`catalog/*.yaml`은 직접 편집하지 않는다. 앱의 유효한 write 경로는 active artifact root의 검토된 `catalog-delta.yaml` proposal을 소비하는 승인 게이트 publish 경로뿐이다. Human PR merge는 bulk 변경이나 seed 정비에 사용할 수 있지만, 일반 run의 Catalog 제안을 우회하는 경로로 사용하지 않는다.

Current Implementation에서 Reuse Hub의 `등록 승인`은 `POST /api/catalog/publish`를 호출한다. 이 endpoint는 proposal source와 publish 계약을 검증해 versioned entry를 기록하며, `legacy` `manifest.approvals.*`를 직접 읽는 gate와는 별개다. 따라서 publish 승인 근거와 workbench stage 승인을 혼동하지 않는다.

## 6. 원격 경계(A2A) 고마찰 원칙

A2A는 [Taxonomy](./taxonomy.md#a2a-경계)가 정한 Agent 노출·호출 프로토콜이다. 로컬 다단계 흐름, 여러 Agent·Tool의 조합, 재사용 가능성만으로 원격 경계를 만들지 않는다.

원격 경계는 최소한 다음 계약을 확인한 뒤에만 승인한다.

- 독립 Owner와 책임 경계
- Agent Card 또는 동등한 discovery metadata
- auth model
- task lifecycle
- timeout policy
- retry policy
- fallback behavior
- audit requirements

필수 정보가 없으면 추정하지 않고 `needs_info`로 남긴다. Current Implementation의 `module_category: remote_a2a`, `node_kind: remote_a2a`, `remote_agent_call`은 `legacy` 표현이며, Target Contract에서는 Agent 자산과 A2A Binding/Exposure 또는 protocol boundary로 해석한다.

## 7. 보안·비공개 경계

Agent Factory artifact, Catalog proposal, Mock Lab, Runtime Handoff, local runtime proof에는 private endpoint, credential, 실고객 데이터, 사내 배포 스크립트, 조직 전용 runtime code를 넣지 않는다. 예시·mock·smoke input은 합성 데이터만 사용한다.

Workbench, Mock Lab, generated Runtime Handoff와 `/af/:reqId/run`은 로컬 전용 검토·검증 표면이다. 이 표면의 성공을 production 접근 권한, 배포 준비, 운영 안정성의 증거로 해석하지 않는다.

## 8. 문서 영향 규율

소스 변경 전에는 taxonomy, Catalog 의미, schema·validator, analyzer output, Graph IR, UI flow, validation command, 운영 정책에 대한 active `docs/` 영향을 확인한다. 사용자나 후속 coding agent가 의존하는 행동이 바뀌면 관련 active 문서를 같은 change set에서 갱신한다.

interface, schema, gate, UX contract 같은 설계 결정이 바뀌면 `docs/decision-log.md`에 날짜 · PR · 결정 · 근거 · 영향을 기록한다. decision log는 이력을 보존하고, 현재 규칙은 각 canonical 문서가 소유한다. 현재 행동을 설명하기 위해 `docs/archive/**`를 수정하거나 과거 규칙을 활성 기준으로 되살리지 않는다.

## 9. 검증 기대

문서 변경은 최소한 `git diff --check`와 상대 링크 검증을 통과해야 한다. Target Contract와 Current Implementation이 섞이지 않았는지, 수정 범위가 허용된 Markdown에 한정되었는지도 확인한다.

Current Implementation에서 artifact·schema·validator 계약을 다루는 변경은 저장소 root에서 다음 검증을 사용한다.

```bash
node scripts/validate-artifacts.mjs
node scripts/validate-artifacts.mjs path/to/artifacts
```

TypeScript, React, analyzer 또는 web UI 행동을 다루는 변경은 다음 build를 사용하며, 보이는 UI 변경은 실제 화면에서도 확인한다.

```bash
cd packages/web
npm run build
```

검증하지 못한 항목은 성공으로 추정하지 않고 미검증 이유와 남은 불확실성을 기록한다.

## 10. Done 기준

Agent Factory 작업은 다음 조건을 모두 만족할 때 완료다.

- raw requirement가 Runtime Handoff나 생성기의 직접 입력으로 사용되지 않았다.
- Agent·Workflow·Tool 분류와 Graph 표현이 각각 [Taxonomy](./taxonomy.md)와 [Graph IR](./graph-ir.md)를 따른다.
- 요구사항 수준 soft gate와 후보 수준 hard gate가 닫혔거나, 미결 상태와 차단 영향이 명시되었다.
- 승인된 artifact만 scaffold plan과 Runtime Handoff의 입력이 되었다.
- A2A 경계가 독립 소유와 필수 원격 계약을 갖추고 승인되었다.
- schema, validator, analyzer artifact, UI label, runtime contract 사이의 관련 계약이 서로 일관된다.
- 보존 대상 artifact와 validation evidence가 검토 가능하며 적용한 검증이 통과했다.
- 변경된 UI 행동이 있으면 실제 화면에서 확인했다.
- private endpoint, credential, 실고객 데이터, 사내 배포 스크립트, 조직 전용 runtime code가 추가되지 않았다.
- Runtime Handoff를 production deployment 완료로 보고하지 않았고, 남은 위험과 미검증 항목을 공개했다.

## 11. Current Implementation 부록(`legacy`)

이 부록은 구 harness가 강제하던 로드베어링 구현 계약의 요약이다. Target Contract의 새 직렬화로 읽지 않으며, 행동과 최신 source locator는 [Handbook](../handbook/README.md)의 해당 stage에서 재확인한다.

### 서버 소유 artifact-sync 순서

`POST /api/af/:reqId/artifact-sync/run`은 Analyze·Design·import·edit 표면에서 `processFlow`가 이미 저장된 canonical `analysis-result.json`을 읽고 `normalized-requirement.json`, `module-candidates.json`, `process-flow.json`을 동기화한 뒤 `scaffold-plan.json`을 파생·저장하고, 선택에 따라 `runtime-stub/` 재생성과 `validate-artifacts.mjs`를 실행한다. Graph IR payload를 별도로 받아 저장하지 않으며 승인 gate는 바꾸지 않는다. 세부 위치는 Handbook 해당 stage 참조.

### Generator와 manifest 소유권

`scripts/generate-adk-source.mjs`는 bundle 파일 생성기이며 `af-run-manifest.json`을 쓰지 않는다. 성공한 server caller가 `current_stage: "build"`와 `stages.build.outputs`를 기록할 수 있지만, 생성은 `stages.build.status`나 approval gate를 완료로 만들지 않는다. 세부 위치는 Handbook 해당 stage 참조.

### Verify allow-list

Verify command API는 임의 shell command를 받지 않고 `validate-artifacts.mjs <root>`, `npm run build --prefix packages/web`, `npm run test:analyzer --prefix packages/web` 세 명령만 허용한다. 실행 결과는 현행 manifest validation에 기록된다. 세부 위치는 Handbook 해당 stage 참조.

### Stage Runner evidence

Stage Runner는 `runs/<stage>/<run-id>/` 아래에 `request.json`, `events.jsonl`, `diff-summary.json`, `result-summary.json`, `proposed-artifacts/`와 필요 시 diagnostics를 보존한다. 이 run ledger와 `af-run-manifest.json.stage_runs` metadata는 approval gate를 대체하지 않는다. 세부 위치는 Handbook 해당 stage 참조.

### A2A runtime task ID

A2A task·context·interrupt ID는 runtime event, local runtime registry, API transcript에만 존재하는 runtime 전용 상태다. `analysis-result.json`, Graph IR, scaffold plan, Catalog row, generated source에 저장하지 않는다. 세부 위치는 Handbook 해당 stage 참조.
