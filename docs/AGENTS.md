# docs 트리 작업 규칙

## 범위

`docs/`는 Agent Factory의 활성 개념·운영·행동 지도와 역사 기록을 함께 보관한다. 문서를 수정하는 coding agent는 활성 기준, 현재 구현 설명, 역사 자료를 구분하고 사용자에게 허용받은 파일 범위를 넘지 않는다.

## Source priority

충돌하거나 어디서부터 읽을지 불분명할 때 다음 순서를 따른다.

1. `docs/README.md`: 사람과 coding agent의 기본 읽기 경로
2. `docs/workbench/taxonomy.md`, `docs/workbench/graph-ir.md`, `docs/workbench/operating-model.md`: 자산 분류, Graph 표현, 작업 단계의 canonical 문서
3. `docs/handbook/**`: 저장소 행동과 최신 source locator를 연결하는 지도
4. `docs/migration/taxonomy-vnext-status.md`: Target Contract와 Current Implementation의 차이
5. review, validation, Mock Lab, visualization, architecture reference 같은 보조 문서

보조 문서는 canonical 정의를 반복하거나 별도 enum을 만들지 않는다. Handbook locator가 가리키는 행동은 현재 저장소 소스에서 다시 확인하며, 문서의 locator만으로 구현 사실을 단정하지 않는다.

## Historical material과 pointer

- `docs/archive/**`는 역사 자료다. 현재 동작을 맞추기 위해 수정하지 않고, 과거 택소노미나 구현 가정을 활성 기준으로 되살리지 않는다.
- `docs/handoff/**`는 전달 시점의 동결 자료다. 수정하지 않으며 일반 doc sweep과 현재성 정비 범위에서 제외한다.
- `docs/workbench/process-flow.md`는 `graph-ir.md`로 연결하는 compatibility pointer다. 새 Graph 규칙을 소유하지 않는다.
- `docs/workbench/agent-factory-harness.md`는 `operating-model.md`로 연결하는 compatibility pointer다. 새 운영 규칙을 소유하지 않는다.
- `docs/workbench/follow-ups/**`는 backlog와 상태 기록이다. 현재 계약으로 인용하기 전에 canonical 문서와 현재 소스를 확인한다.

## Local rules

- 문서 전용 수정은 코드, schema, validator, UI, runtime 행동이 함께 바뀐 것처럼 암시하지 않는다. 구현되지 않은 목표는 Target Contract로, 실제 동작은 Current Implementation으로 명시한다.
- interface, schema, gate, UX contract 또는 운영 정책의 설계 결정이 바뀌면 `docs/decision-log.md`에 날짜 · PR · 결정 · 근거 · 영향을 추가한다. 단순 문구 정렬은 새 결정을 꾸며 만들지 않고, 과거 항목을 현재 설명에 맞춰 고치지 않는다.
- Target Contract와 Current Implementation을 같은 표나 문단에서 무표시로 혼합하지 않는다. 현행 식별자는 반드시 backtick으로 감싸고 `legacy`라고 표시한다. 예: legacy `module_category`, legacy `workflow_kind: orchestration`.
- Agent·Workflow·Tool 정의는 `taxonomy.md`, Node·Edge와 Invocation Control은 `graph-ir.md`, 단계와 승인 gate는 `operating-model.md`에 링크한다. 보조 문서에서 이를 다시 정의하지 않는다.
- 화면을 설명하는 한국어 UI 카피는 실제 Workbench 문구와 일관되게 쓴다. Agent, Workflow, Tool, Graph IR, Runtime Handoff처럼 영어 기술 용어가 더 명확한 경우에는 그대로 사용한다.
- archive, handoff, source code, schema, catalog, script를 문서 작업의 편의 때문에 함께 수정하지 않는다. 허용 범위 밖의 불일치는 Migration Status나 별도 후속으로만 드러낸다.

## Verification

- 문서 전용 변경은 저장소 root에서 `git diff --check`를 실행한다.
- 변경한 Markdown의 모든 상대 링크가 실제 파일·디렉터리와 올바른 anchor를 가리키는지 확인한다. 새 문서가 다른 작업에서 생성될 예정이라는 가정만으로 링크 성공을 보고하지 않는다.
- 마지막으로 diff와 status를 확인해 허용된 문서 밖의 기존 작업을 건드리지 않았는지 구분한다.
