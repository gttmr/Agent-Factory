# Agent Factory 검증(Validation)

> 문서의 Target Contract는 [Taxonomy](taxonomy.md), [Graph IR](graph-ir.md), [Operating Model](operating-model.md)이 소유한다. 이 문서는 정의를 다시 만들지 않고 문서, artifact, 코드와 실행 evidence가 각 기준에 맞는지 확인하는 방법을 정한다.

검증 성공은 승인과 다르다. 명령 통과, proposal 생성, artifact 저장 또는 Runtime Handoff 생성은 검토 근거를 제공하지만 승인 게이트를 자동으로 변경하지 않는다. 단계와 게이트의 단일 기준은 [Operating Model](operating-model.md#3-승인-게이트-모델)이다.

## 1. 문서 단계 검증

문서 변경은 다음 순서로 확인한다.

### 1.1 Canonical 정의 중복

- 자산 정의·업무 범위·Owner·재사용 상태는 [Taxonomy](taxonomy.md)로 연결하고 다른 문서에 독자 enum이나 변형 정의를 만들지 않는다.
- Node·Edge·Invocation Control·Binding 표시 규칙은 [Graph IR](graph-ir.md)로 연결한다.
- 작업 단계·승인·artifact 태도는 [Operating Model](operating-model.md)로 연결한다.
- 문서가 독자의 판단 방법을 설명할 수는 있지만 canonical 값을 복사해 별도 기준처럼 유지하지 않는다.

### 1.2 Legacy 표현 잔존

legacy 식별자는 다음 위치에서만 허용한다.

- Target과 구현 차이를 기록하는 Migration Status
- 기존 경로를 새 canonical 문서로 안내하는 compatibility pointer
- `Current Implementation`이라고 명시한 절

허용 위치에서도 literal은 backtick으로 감싸고 `legacy`임을 명시한다. `module_category`, `adapter_kind`, `remote_a2a`, `adapter_call`, `selected_by_llm` 같은 현행 값이 Target Contract 값처럼 보이면 실패다. 검색 결과는 문맥으로 판별하며 Archive의 역사 기록을 활성 계약으로 고치지 않는다.

### 1.3 Handbook locator 유효성

Handbook은 행동을 찾는 지도이고 최신 source가 실제 동작의 최종 권위다. 각 locator는 최소한 다음을 확인한다.

- 기록한 상대 경로가 현재 checkout에 존재한다.
- stable anchor로 적은 export, class, function, method 또는 section이 해당 파일에 존재한다.
- caller·callee, 입출력, read/write, 외부 경계 설명이 최신 source와 모순되지 않는다.
- 확인하지 못한 locator를 `active`로 두지 않고 `needs-review` 또는 `frozen`으로 표시한다.
- line range는 snapshot hint일 뿐 안정적 anchor를 대신하지 않는다.

Handbook 사용 순서와 유지 원칙은 [Handbook 안내](../handbook/README.md)를 따른다.

### 1.4 상대 링크

- 활성 문서의 상대 링크를 링크가 적힌 파일 위치에서 해석한다.
- 이동된 canonical 문서는 compatibility pointer를 통해 기존 활성 진입 경로를 보존한다.
- anchor가 있는 링크는 대상 heading이 실제로 생성하는 anchor와 일치하는지 확인한다.
- `docs/archive/**` 또는 handoff snapshot을 현재 규칙의 목적지로 사용하지 않는다.

### 1.5 Target와 Current 구분

- 목표 개념과 현재 UI·schema·validator·skill 행동을 같은 문단이나 표의 같은 값 집합으로 섞지 않는다.
- 구현된 사실에는 `Current Implementation` 또는 `legacy` 표지를 둔다.
- 계획되었거나 목표인 계약을 현재 지원, 현재 강제, 현재 저장한다고 서술하지 않는다.
- 현재 구현의 한계를 설명할 때 코드 변경 절차나 구현 WBS로 확장하지 않는다.

### 1.6 문서 외 파일 미수정

docs-only 작업은 시작 전후의 변경 파일 목록을 비교한다. 허용된 Markdown 이외의 source, schema, catalog, script, template, fixture, 생성물, package 설정이 이번 작업으로 바뀌지 않았는지 확인한다. 이미 존재하던 worktree 변경은 별도 노이즈로 구분하고 덮어쓰거나 정리하지 않는다.

### 1.7 Migration gap 기록

Target 문서가 Current Implementation과 다른데 Migration Status에 gap이 없으면 문서 검증 실패다. 기록은 영역, legacy identifier 예, 목표 개념, 위험, 후속 필요 여부까지만 포함하며 코드 patch나 변경 순서를 쓰지 않는다. 기준 문서는 [Migration Status](../migration/taxonomy-vnext-status.md)다.

### 1.8 문서 검증 최소 명령

```bash
git diff --check
git status --short --untracked-files=all
```

명령 결과만으로 canonical 중복, Target/Current 혼합, locator 의미, migration 누락을 판정할 수는 없다. 위 체크리스트의 직접 검토를 함께 남긴다.

## 2. Artifact·코드 검증

### Current Implementation(`legacy`)

현재 validator, analyzer, schema, UI는 legacy 택소노미와 Graph 직렬화 계약을 강제한다. `node scripts/validate-artifacts.mjs`가 통과해도 현재 코드가 Target Agent/Workflow/Tool 택소노미를 지원한다는 뜻은 아니다. 현행 값을 Target에서 어떻게 읽을지는 [Taxonomy의 Current Implementation 대응](taxonomy.md#current-implementation-대응legacy)과 [Graph IR의 Current Implementation 대응](graph-ir.md#current-implementation-대응legacy)을 따른다.

### 2.1 기본 검증 명령

저장소 root에서 artifact와 현행 계약을 검증한다.

```bash
node scripts/validate-artifacts.mjs
```

web TypeScript·React·server bundle의 정합성을 검증한다.

```bash
cd packages/web
npm run build
```

같은 `packages/web` 디렉터리에서 analyzer 단위 테스트와 analyzer/schema/validator enum agreement를 포함한 회귀를 검증한다.

```bash
npm run test:analyzer
```

실행하지 못한 명령은 통과로 추정하지 않는다. 미실행 이유, 영향 범위, 남은 불확실성을 validation evidence에 기록한다.

### 2.2 Verify 화면 allow-list

현재 Verify API는 임의 shell command를 받지 않고 다음 세 key만 허용한다.

| key | 실제 실행 형태 | 검증 대상 |
| --- | --- | --- |
| `validate_artifact_root` | `node scripts/validate-artifacts.mjs <artifact-root>` | 현재 requirement의 artifact root와 legacy 계약 |
| `build_web` | `npm run build --prefix packages/web` | TypeScript와 Vite build |
| `test_analyzer` | `npm run test:analyzer --prefix packages/web` | analyzer 회귀와 validator agreement |

명령 목록은 `GET /api/af/:reqId/verify/commands`, 실행은 `POST /api/af/:reqId/verify/run`으로 제공된다. 실행 결과는 현행 `af-run-manifest.json.validation`에 기록되지만 앞 단계 approval을 바꾸지 않는다.

## 3. Current Implementation: Artifact root 검증

Current Implementation의 기본 root는 `artifacts/af/<req-id>/`다. 검증자는 canonical artifact, projection, proposal, Runtime Handoff, 실행 evidence를 구분한다.

### 3.1 Manifest와 canonical artifact

- `af-run-manifest.json`의 requirement ID, artifact root, stage, approval, validation, optional `stage_runs`가 현재 validator의 legacy 계약을 만족하는지 확인한다.
- `analysis-result.json`은 현행 분석·후보·`processFlow`의 canonical source다. `module-candidates.json`과 `process-flow.json` 같은 split 파일이 있으면 canonical source와의 provenance와 동기화 상태를 확인한다.
- candidate 상태와 `missing_information`이 서로 모순되지 않는지 확인한다. 미해결 legacy `needs_info` 후보를 승인된 입력으로 취급하지 않는다.
- schema reference, object input/output, synthetic smoke input과 expected output shape가 검토 가능한지 확인한다.
- `legacy_recommended_type`은 migration metadata로만 읽고 primary classifier로 사용하지 않는다.

### 3.2 Graph artifact

Target 의미는 [Graph IR](graph-ir.md)이 소유한다. 현재 artifact 검증에서는 validator가 강제하는 legacy 직렬화와 다음 구조적 성질을 확인한다.

- Node·Edge·Container ID와 참조가 유효하고 고립된 실행 후보가 없다.
- 병렬 영역에 필요한 진입과 Join 경로, loop의 back/exit, Human Input의 downstream 경로가 존재한다.
- Agent execution mode가 [Current Implementation의 실행 모드 정책](adk-agent-execution-modes.md)과 일치한다.
- Tool 호출로 해석되는 legacy 노드가 Workflow 명시 호출인지 Agent 판단 관계인지 문맥상 일관된다.
- A2A legacy edge와 candidate·contract·remote endpoint linkage가 일관되고, 연결 계약의 승인 상태를 실행 가능성으로 과장하지 않는다.
- `side_effect`나 policy 요약이 runtime contract의 auth·timeout·retry·fallback·audit source of truth를 대신하지 않는다.

현재 Graph serializer가 쓰는 세부 legacy literal은 [Graph IR의 대응표](graph-ir.md#current-implementation-대응legacy)를 따른다. 이 문서에 별도 Node·Edge enum을 만들지 않는다.

## 4. Current Implementation: Stage Runner evidence 검증

각 실행은 `runs/<stage>/<run-id>/` 아래에서 추적 가능해야 한다.

| 항목 | 확인 내용 |
| --- | --- |
| `request.json` | 실행 입력, stage, base artifact provenance |
| `events.jsonl` | 실행 event 흐름; SDK 실행이면 `codex-events.jsonl`이 추가될 수 있음 |
| `diff-summary.json` | canonical 대비 proposal 또는 실행 결과 차이 |
| `result-summary.json` | 완료·실패·취소·적용 상태와 output 목록 |
| `proposed-artifacts/` | Analyze·Design·Verify의 적용 전 proposal; Build에는 canonical stub 생성 특성상 비어 있을 수 있음 |
| `diagnostics.md` | 실패·취소 등 진단이 필요한 경우의 근거 |

Analyze·Design·Verify proposal은 diff/preview와 명시적 apply 전까지 canonical artifact가 아니다. Apply는 base ETag와 현재 artifact가 어긋나면 충돌로 막혀야 한다. Build Stage Runner는 run evidence를 남기면서 canonical `runtime-stub/`을 직접 생성하는 현행 예외다.

`af-run-manifest.json.stage_runs`의 latest run metadata와 실제 run directory가 대응하는지 확인한다. Run ledger와 stage completion event는 approval gate를 대신하지 않으며, 검증 성공이 approval boolean을 자동으로 true로 만들지 않는다는 원칙은 [Operating Model](operating-model.md#3-승인-게이트-모델)을 따른다.

## 5. Scaffold와 Runtime Handoff 게이트 검증

### Target Contract

Runtime Handoff는 승인 artifact만 소비해야 한다. 검증자는 최소한 다음을 확인한다.

- source가 승인된 workbench artifact이고 raw requirement가 생성기의 직접 입력이 아니다.
- 승인된 후보만 scaffold plan과 Runtime Handoff에 포함된다.
- 필수 runtime/A2A 계약이 승인되었고 `needs_info`가 남은 계약을 실행 가능하다고 표시하지 않는다.
- Graph 참조와 scaffold 항목이 같은 후보·계약을 가리킨다.
- smoke 또는 runnable 출력의 의미가 검토된 `output_mode`와 일치한다.
- synthetic `runtime_mock`은 local test double로만 쓰며 private endpoint, credential, 실고객 데이터, 운영 business logic을 포함하지 않는다.
- 생성물이 Runtime Handoff 또는 로컬 검증 bundle임을 유지하고 production deployment 완료로 표현하지 않는다.

### Current Implementation(`legacy`)

현행 `source: approved_workbench_artifact`, `raw_requirement_to_code: false`, approval gate와 artifact provenance는 이 원칙의 구현 단서다. 필드 존재만 보지 말고 producer가 승인된 canonical artifact였는지 추적한다. 단계별 소유권은 [Operating Model](operating-model.md#2-작업-단계)을 따른다.

## 6. Current Implementation: Validation report와 Catalog 제안

- 실행한 명령, 대상 root, 시작·종료 시각, exit code, stdout/stderr 요약, 통과·실패를 `validation-report.md` 또는 동등한 evidence에 기록한다.
- 실패를 삭제하거나 성공으로 덮어쓰지 않고 어떤 소유 단계로 되돌릴지 기록한다.
- `catalog-delta.yaml`은 제안 artifact이며 Catalog 반영 자체가 아니다.
- Current Implementation의 앱 publish 경로는 `POST /api/catalog/publish`다. 이 경로는 active artifact root의 proposal source와 publish 계약을 검증하며 현행 manifest approval과는 별도 gate다.
- 일반 run에서 `catalog/*.yaml`을 직접 수정해 proposal review를 우회하지 않는다. bulk·seed 변경의 human PR은 별도 변경으로 다룬다.

## 7. 완료 체크리스트

- 문서가 canonical 정의를 중복하지 않고 유효한 상대 링크를 사용한다.
- legacy 표현이 migration, pointer 또는 명시적 Current Implementation 절에만 남았다.
- Handbook 경로와 stable anchor가 최신 source에 존재한다.
- Target와 Current Implementation이 분리되어 있다.
- 허용 문서 외 파일을 이번 작업에서 수정하지 않았다.
- Target와 Current 차이가 Migration Status에 기록되어 있다.
- 적용 가능한 artifact validator, web build, analyzer test 결과가 evidence로 남았다.
- Stage Runner proposal, canonical artifact, Runtime Handoff, approval gate를 구분했다.
- scaffold와 Runtime Handoff가 승인 artifact만 소비한다는 provenance를 확인했다.
- 남은 실패, 미검증 항목, migration gap을 공개했다.
