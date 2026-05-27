# 09 — Skill Runner Workbench 상위 브리프

> 새 세션에서 이 브리프를 시작한다면 먼저 `docs/workbench/follow-ups/STATUS.md`를 읽고, 그 다음 이 파일을 실행 계약으로 사용한다.

작성일: 2026-05-27 (KST)

## 목적

현재 Workbench는 artifact-root-first 라우터 셸과 일부 직접 실행 경로(`/api/analyze-requirement`)를 갖고 있지만, `.agents/skills`의 4단계 DLC 스킬과 화면이 아직 강하게 결합되어 있지는 않다.

이 브리프는 다음 단계의 상위 작업이다.

- 각 stage 화면에서 해당 스킬 실행을 서버에 요청한다.
- 서버는 stage별 Skill Runner를 통해 Codex/CLI 실행, 진행 이벤트, 산출물 후보, validation 결과를 생성한다.
- canonical artifact는 바로 덮어쓰지 않고 파일별 preview/diff 후 사용자가 적용한다.
- approval gate는 스킬이 자동으로 켜지 않고 사람이 직접 토글한다.
- 새 세션이 같은 결정을 반복 질문하지 않도록 질문/답변 원문과 확정 정책을 이 파일에 보존한다.

1차 구현 범위는 **Analyze + Design**이다. Build/Verify runner는 같은 패턴을 적용할 로드맵으로만 다룬다.

## 기존 follow-up과의 관계

이 브리프는 기존 브리프 일부를 상위에서 재정렬한다.

- `05-sse-streaming.md`: 09의 공통 Stage Runner SSE 설계에 흡수된다. 기존 `verify/run`, `runtime-stub/build` SSE 전환은 후속 세부 작업으로 남긴다.
- `06-analyze-pipeline.md`: 옵션 B가 이미 채택되어 Analyze 화면에서 Codex CLI 호출이 가능하다. 09는 이를 공통 Skill Runner 모델로 일반화한다.
- `04-a2a-contract-review-surface.md`: Design runner가 생성/제안할 수 있는 A2A contract patch와 연결된다. 04 자체는 별도 UI 브리프로 남긴다.
- `07-onboarding-html-refresh.md`: Skill Runner 모델이 구현된 뒤 onboarding 문서를 새 흐름에 맞춰 갱신한다.

## 질문/답변 원문

아래 결정은 사용자가 Plan Mode 질문에 답한 내용이다. 다음 세션에서 다시 묻지 않는다.

### 문서와 1차 범위

| 질문 | 선택 |
|---|---|
| 새 세션 진입점 문서는 어디에 어떤 방식으로 남길까요? | `09 브리프 (Recommended)` — `docs/workbench/follow-ups/09-skill-runner-workbench.md`를 만들고 INDEX/STATUS에서 링크한다. |
| 웹 화면과 스킬의 강한 연동은 어느 수준까지 목표로 할까요? | `서버 실행 (Recommended)` — 웹 버튼이 서버 API를 호출하고 서버가 스킬/Codex CLI를 실행해 artifact를 갱신한다. |
| 첫 구현 브리프의 범위는 어디까지 잡을까요? | `Analyze+Design (Recommended)` — 요구사항 분석과 경계 설계 실행/검토 흐름부터 강하게 연결한다. |

### Gate, artifact 적용, 로그

| 질문 | 선택 |
|---|---|
| 스킬 실행 성공 후 approval gate는 어떻게 처리할까요? | `사람 승인 (Recommended)` — 스킬은 artifact와 검토 가능 상태만 만들고 approval gate는 사용자가 직접 토글한다. |
| 스킬 실행 결과가 기존 artifact와 충돌할 때 기본 정책은 무엇이 좋습니까? | `Diff 후 적용 (Recommended)` — 스킬 결과를 바로 덮지 않고 preview/diff를 보여준 뒤 사용자가 적용한다. |
| 스킬 실행 로그와 이벤트는 어디까지 artifact로 남길까요? | `요약+상세 (Recommended)` — manifest에는 요약, `runs/<run-id>/events.jsonl`에는 상세 이벤트를 남긴다. |

### 실행 안정성

| 질문 | 선택 |
|---|---|
| 같은 artifact root에서 스킬 실행 동시성은 어떻게 제한할까요? | `Root 단위 lock (Recommended)` — 같은 `reqId`에서는 한 번에 하나의 stage run만 허용한다. |
| 스킬 실행이 실패하거나 schema validation이 깨진 결과는 어떻게 남길까요? | `Run 폴더 보존 (Recommended)` — canonical artifact는 덮지 않고 실패 출력과 diagnostics를 `runs/<run-id>/`에 남긴다. |
| 로그와 실행 입력의 보안 정책은 어느 수준으로 문서화할까요? | `로컬 신뢰` — 로컬 개발 도구로 본다. 단, env/token 전체 덤프는 저장하지 않는 최소 안전선은 둔다. |

### Design 권한과 모델 선택

| 질문 | 선택 |
|---|---|
| `af-design-boundaries` 실행 결과는 analysis artifact를 어느 정도까지 바꿀 수 있어야 합니까? | `Patch 제안 (Recommended)` — 후보 승인, missing info 해결, Graph/contract 변경을 diff로 제안하고 사용자가 적용한다. |
| 스킬이 module candidate의 `status: approved`를 만들 수 있습니까? | `제안만 (Recommended)` — 스킬은 approved 후보를 제안하지만 최종 status 변경은 사용자가 diff 적용 또는 UI 조작으로 확정한다. |
| 서버 Skill Runner의 모델 선택은 어떻게 둘까요? | `화면 선택 (Recommended)` — 기본값은 `gpt-5.5`로 두되 stage run 패널에서 모델을 선택할 수 있게 한다. |

### 서버/API/progress

| 질문 | 선택 |
|---|---|
| 서버 Skill Runner는 어떤 실행 계약으로 설계할까요? | `Codex exec (Recommended)` — 서버가 stage별 prompt와 SKILL.md를 묶어 `codex exec` 계열 명령을 실행한다. |
| Stage Runner API는 어떤 형태가 좋습니까? | `공통 API (Recommended)` — `POST /api/af/:id/stages/:stage/run` 하나로 stage별 실행을 통합한다. |
| 실행 진행 상황은 어떤 방식으로 화면에 전달할까요? | `SSE 통일 (Recommended)` — 모든 stage run progress를 SSE 이벤트로 통일한다. |

### Follow-up 문서 체계

| 질문 | 선택 |
|---|---|
| 새 09 브리프는 기존 follow-up 브리프들과 어떤 관계로 기록할까요? | `상위 브리프 (Recommended)` — 09를 Skill Runner 상위 브리프로 두고 05/06 일부를 흡수하거나 선행 조건으로 표시한다. |
| `STATUS.md`에는 어느 정도까지 반영할까요? | `진입점 갱신 (Recommended)` — 09를 다음 최우선 작업으로 추가하고 이번 질문 답변 요약만 넣는다. |
| 이번 질문과 답변은 새 문서에 어떻게 남길까요? | `원문 전체` — 모든 질문과 답변을 원문에 가깝게 기록한다. |

### UI 구조

| 질문 | 선택 |
|---|---|
| 각 stage 화면의 Skill Runner 패널은 어디에 배치할까요? | `상단 고정 (Recommended)` — 각 stage 본문 첫 Panel로 배치한다. |
| 스킬 결과 diff/preview는 어떤 UI로 시작할까요? | `파일별 preview (Recommended)` — 변경 artifact 목록과 파일별 before/after summary를 보여주고 적용 버튼을 둔다. |
| 실행 이력은 화면에서 어떻게 보여줄까요? | `최근 이력 (Recommended)` — 현재 stage 패널에서 최근 run 5개와 상태/시간/결과를 보여준다. |

### 호환성과 검증

| 질문 | 선택 |
|---|---|
| manifest에 run 기록을 추가할 때 기존 artifact root와의 호환성은 어떻게 처리할까요? | `Optional 추가 (Recommended)` — 새 필드는 모두 optional로 두고 기존 manifest는 그대로 읽히게 한다. |
| 1차 검증에서 실제 Codex CLI 스킬 실행까지 smoke에 포함할까요? | `실제 Codex 포함` — 실제 `codex exec` 호출을 포함한다. |
| 09 브리프 완료 기준의 필수 검증 명령은 어떻게 둘까요? | `기본+시나리오 (Recommended)` — `npm run build`, `npm run test:analyzer`, `validate-artifacts templates`, UI smoke를 요구한다. |

### Codex 실패와 run 파일명

| 질문 | 선택 |
|---|---|
| 실제 Codex smoke가 환경 문제로 실패하면 브리프 완료 판단은 어떻게 할까요? | `분리 보고 (Recommended)` — API/UI/fake는 통과, 실제 Codex는 host-verified 실패 원인을 기록하면 완료 가능하다. |
| 상세 run artifact 경로는 어떤 형식으로 정할까요? | `runs/stage/id (Recommended)` — `artifacts/af/<req-id>/runs/<stage>/<run-id>/` 아래 events/output/diff를 저장한다. |
| run_id 형식은 무엇으로 고정할까요? | `시간+slug (Recommended)` — `20260527T130000Z-analyze-abc123`처럼 정렬 가능하고 사람이 읽을 수 있게 둔다. |

### Analyze/Design 입력

| 질문 | 선택 |
|---|---|
| Analyze Skill Runner의 입력은 무엇을 canonical로 삼을까요? | `현재 textarea (Recommended)` — 화면의 raw requirement textarea/domain/model/catalog를 입력으로 실행한다. |
| Design Skill Runner는 어떤 입력 상태에서 실행 가능해야 합니까? | `reviewed 분석 (Recommended)` — `analysis_reviewed=true`인 `analysis-result.json`이 있어야 실행 가능하다. |
| Design에서 candidate-level missing information 해결은 어떤 방식으로 연결할까요? | `Patch 제안 (Recommended)` — 스킬이 resolution/status/contract patch를 제안하고 사용자가 적용한다. |

### Build/Verify와 docs 범위

| 질문 | 선택 |
|---|---|
| 09 브리프에서 Build/Verify Skill Runner는 어느 정도까지 다룰까요? | `로드맵만 (Recommended)` — 1차 구현은 Analyze+Design이고 Build/Verify는 동일 패턴 적용 계획만 명시한다. |
| 기존 `/api/analyze-requirement`, `/runtime-stub/build`, `/verify/run`은 어떻게 다룰까요? | `감싸서 재사용 (Recommended)` — 공통 Stage Runner가 기존 API/함수를 내부에서 호출하거나 점진적으로 감싼다. |
| 09 브리프 작성 시 active docs 정합화는 어디까지 포함할까요? | `브리프만 (Recommended)` — 이번 문서화는 follow-ups/09, INDEX, STATUS만 다루고 active docs 수정은 구현 브리프에 맡긴다. |

## 확정 구현 방향

### 1차 목표

1차 작업은 Workbench의 Analyze와 Design 화면에 Skill Runner 패널을 붙이는 것이다.

- Analyze: 화면의 요구사항 textarea, domain, model, catalog payload를 입력으로 `af-analyze-requirement` 실행을 요청한다.
- Design: `analysis_reviewed=true` 상태의 `analysis-result.json`을 입력으로 `af-design-boundaries` 실행을 요청한다.
- 두 화면 모두 스킬 결과를 canonical artifact에 바로 쓰지 않고 run output과 diff/preview로 보여준다.
- 사용자가 적용을 누른 뒤에만 `analysis-result.json` 등 canonical artifact가 갱신된다.
- approval gate 토글은 자동화하지 않는다.

### 서버 실행 계약

공통 Stage Runner API를 둔다.

```text
POST /api/af/:reqId/stages/:stage/run
POST /api/af/:reqId/stages/:stage/cancel
GET  /api/af/:reqId/stages/:stage/runs
GET  /api/af/:reqId/stages/:stage/runs/:runId
POST /api/af/:reqId/stages/:stage/runs/:runId/apply
```

1차 구현에서 반드시 필요한 것은 `run`, `runs`, `run detail`, `apply`다. `cancel`은 SSE와 child process 구조가 준비되면 함께 구현하되, 어렵다면 명시적으로 후속으로 분리한다.

Stage 값은 1차에서 `analyze | design`만 허용한다. `build | verify`는 타입/문서상 로드맵으로만 남긴다.

### Run artifact 구조

Run 상세는 artifact root 아래에 저장한다.

```text
artifacts/af/<req-id>/runs/<stage>/<run-id>/
  events.jsonl
  request.json
  result-summary.json
  proposed-artifacts/
    analysis-result.json
    boundary-design.md
  diff-summary.json
  diagnostics.md
```

`run-id`는 시간 정렬이 가능하고 사람이 읽을 수 있는 형식이다.

```text
20260527T130000Z-analyze-a1b2c3
20260527T131500Z-design-d4e5f6
```

### Manifest 확장

기존 manifest 호환성을 깨지 않는다. 새 필드는 optional이다.

예시:

```json
{
  "stage_runs": {
    "analyze": {
      "latest_run_id": "20260527T130000Z-analyze-a1b2c3",
      "status": "completed",
      "started_at": "2026-05-27T13:00:00Z",
      "finished_at": "2026-05-27T13:02:00Z",
      "skill_name": "af-analyze-requirement",
      "model": "gpt-5.5",
      "output_artifacts": ["runs/analyze/20260527T130000Z-analyze-a1b2c3/proposed-artifacts/analysis-result.json"],
      "last_error": null
    }
  }
}
```

Approval source of truth는 계속 `manifest.approvals.*`다. `stage_runs.*.status`는 실행 상태일 뿐 approval을 대체하지 않는다.

### UI 배치

각 stage 화면의 첫 Panel에 Skill Runner 패널을 둔다.

패널에 필요한 최소 요소:

- 현재 stage skill 이름
- 모델 선택
- 실행 버튼
- 현재 run 상태
- 최근 run 5개
- run detail 열기
- 실패 시 diagnostics 보기
- proposed artifact 파일별 preview/diff
- 적용 버튼

작업 화면의 기존 검토 UI는 유지한다. Runner 패널은 검토 UI를 대체하지 않고 앞단에 붙는다.

### Diff/apply 정책

- 스킬 결과는 `runs/<stage>/<run-id>/proposed-artifacts/`에 먼저 저장한다.
- 서버는 proposed artifact를 schema/validator로 검증한다.
- 검증 실패 시 canonical artifact에 적용할 수 없다.
- 검증 성공 시 파일별 preview/diff를 보여준다.
- 사용자가 적용하면 서버가 canonical artifact를 PUT하고 react-query cache를 invalidate한다.
- 적용 시점에 ETag 또는 artifact revision이 달라졌으면 conflict로 막고 새 diff를 요구한다.

### 실패와 보안

- 실패 run도 `runs/<stage>/<run-id>/`에 남긴다.
- 실패 diagnostics에는 command, cwd, stage, model, elapsed time, exit code, validation errors를 기록한다.
- 로컬 신뢰 모델을 따른다. 다만 env 전체, token, credential, private key, auth header 전체 덤프는 저장하지 않는다.
- 실제 Codex smoke가 환경 문제로 실패하면 API/UI/fake runner 검증 결과와 host-verified 실패 원인을 분리해서 보고한다.

## 1차 구현 상세

### Analyze Runner

입력:

- 현재 `AnalyzeWorkbench` textarea의 raw requirement
- domain
- selected model
- seed catalog payload

동작:

- 기존 `/api/analyze-requirement` 또는 내부 `codexAnalyzer` 실행 로직을 공통 Stage Runner가 감싼다.
- 결과는 proposed `analysis-result.json`으로 저장한다.
- 사용자가 적용하면 현재 root의 canonical `analysis-result.json`으로 반영한다.
- `analysis_reviewed`는 자동 토글하지 않는다.

주의:

- 기존 Analyze 화면의 직접 Codex CLI 분석 기능은 제거하지 말고 Stage Runner 흐름으로 점진 흡수한다.
- 외부 `af-analyze-requirement` skill이 만든 `analysis-result.json` import 경로는 유지한다.

### Design Runner

입력 조건:

- `analysis-result.json` 존재
- `manifest.approvals.analysis_reviewed === true`

입력:

- canonical `analysis-result.json`
- current Graph IR
- runtimeContracts
- a2aContracts
- catalog index
- 사용자 선택 model

동작:

- `af-design-boundaries`를 기준으로 boundary design patch를 생성한다.
- proposed `analysis-result.json`와 `boundary-design.md`를 run 폴더에 저장한다.
- candidate status, missing information resolution, Graph IR, runtimeContracts, a2aContracts 변경은 모두 patch 제안으로만 둔다.
- 사용자가 적용해야 canonical artifact가 바뀐다.
- `boundaries_approved`와 `runtime_contracts_approved`는 자동 토글하지 않는다.

주의:

- 스킬이 `approved` status를 제안할 수는 있지만, 최종 승인 행위는 사용자가 diff 적용 또는 UI 조작으로 확정한다.
- candidate-level `missing_information`은 hard gate다. unresolved candidate가 있으면 Build로 넘어갈 수 없어야 한다.

## 제외 범위

09의 1차 구현에서 제외한다.

- Build/Verify 실제 Stage Runner 패널 구현
- `runtime-stub/build`와 `verify/run`의 SSE 전환
- onboarding HTML 전면 갱신
- active `docs/workbench/*.md` 정책 문서 전면 갱신
- 실제 catalog yaml 직접 수정
- approval gate 자동 토글
- production business logic 생성
- raw requirement에서 runtime code 직접 생성

## 위험과 고려사항

### Artifact 충돌

UI 편집과 스킬 실행 결과가 동시에 존재할 수 있다. ETag 또는 artifact revision을 비교해서 적용 시점 충돌을 막아야 한다.

### Gate 무력화

스킬 성공을 approval로 취급하면 Agent Factory의 review-gated 모델이 깨진다. 스킬은 제안과 evidence만 만든다.

### 장시간 실행

Codex 실행은 길어질 수 있다. SSE event와 run folder를 같이 사용해 브라우저 새로고침 후에도 상태를 복구할 수 있어야 한다.

### Codex 환경 차이

서버 프로세스의 Codex auth, model availability, MCP config, network 접근은 사용자의 터미널과 다를 수 있다. 실패 보고는 sandbox/local/host 구분을 포함해야 한다.

### 로그 민감정보

로컬 신뢰 모델이지만 env/token 전체 출력은 저장하지 않는다. 실행 command도 secret-bearing env inline 사용을 피한다.

### 기존 브리프 drift

`INDEX.md`에는 아직 “`/api/analyze-requirement` 현재 UI에서 호출하지 않음” 같은 stale 문장이 있었다. 09 문서화 이후 INDEX/STATUS에서 06 채택 사실과 09 상위 브리프 관계를 기준으로 정리해야 한다.

## Acceptance criteria

1차 구현 완료 조건:

- Analyze 화면에 Skill Runner 패널이 있고 raw requirement textarea 입력으로 run을 시작할 수 있다.
- Design 화면에 Skill Runner 패널이 있고 `analysis_reviewed=true`일 때 run을 시작할 수 있다.
- 각 run은 `runs/<stage>/<run-id>/`에 events, request, summary, proposed artifact를 남긴다.
- manifest는 optional `stage_runs` 요약을 읽고 써도 기존 root를 깨지 않는다.
- proposed artifact는 diff/preview 후 사용자 적용으로만 canonical artifact를 갱신한다.
- approval gate는 자동으로 토글되지 않는다.
- 같은 root에서 동시 run이 차단된다.
- 실패 run은 canonical artifact를 덮지 않고 diagnostics를 보존한다.
- 실제 Codex smoke 결과를 보고한다. 환경 실패라면 host-verified 원인을 분리 보고한다.

## 검증 계획

필수:

```bash
cd packages/web
npm run build
npm run test:analyzer
```

```bash
node scripts/validate-artifacts.mjs templates
```

UI smoke:

1. `req-001` 또는 전용 smoke root를 생성한다.
2. Analyze runner로 단순 요구사항을 실행한다.
3. proposed `analysis-result.json`을 preview/diff 후 적용한다.
4. `analysis_reviewed`를 수동 토글한다.
5. Design runner를 실행한다.
6. proposed patch를 preview/diff 후 적용한다.
7. gate가 자동 토글되지 않았음을 확인한다.
8. smoke root와 임시 파일을 정리한다.

실제 Codex smoke:

- 성공하면 command, model, elapsed time, output artifact를 기록한다.
- 실패하면 Codex auth/network/model/MCP/sandbox 여부를 분리해서 기록한다.
- 환경 실패는 제품 기능 실패로 단정하지 않는다.

## 새 세션 시작 명령

```bash
cd /home/ilmaswsl/work/Agent-Factory
git fetch origin
git status --short
sed -n '1,220p' docs/workbench/follow-ups/STATUS.md
sed -n '1,260p' docs/workbench/follow-ups/09-skill-runner-workbench.md
```

구현 시작 전 확인할 코드 진입점:

```bash
sed -n '1,220p' packages/web/src/routes/AnalyzeWorkbench.tsx
sed -n '1,180p' packages/web/src/routes/DesignWorkbench.tsx
sed -n '1,260p' packages/web/server/afArtifactsApi.ts
sed -n '1,180p' packages/web/src/state/useAnalyze.ts
```

문서 변경만 하는 세션에서는 코드 파일을 수정하지 않는다.
