# Agent Factory Skill Test System

이 디렉터리는 Skill 구조를 결정적으로 검사하는 validator와, 자연어 Trigger Matrix, fresh-session Scenario Suite의 실행 규약을 정의한다. 결정적 검증 통과는 skill 선택이나 행동 품질을 증명하지 않으며, behavior run은 구조·schema 통과를 대신하지 않는다.

## 1. Deterministic validator

저장소 root에서 canonical tree를 검사한다.

```bash
node scripts/validate-skills.mjs
```

다른 skill root를 검사할 때는 경로를 한 개 인자로 넘긴다.

```bash
node scripts/validate-skills.mjs skills-staging
```

기본 root는 `.agents/skills`다. validator는 canonical skill 다섯 개, retired skill directory 부재, strict Target Contract v2 reference, 금지된 artifact/field vocabulary를 검사한다. error가 하나라도 있으면 종료 코드는 1이며 warning만 있으면 0이다.

## 2. Trigger Matrix 사용법

[trigger-matrix.md](trigger-matrix.md)의 각 prompt를 서로 독립된 fresh session에서 한 개씩 실행한다.

1. test runner에는 `prompt`만 전달한다. `expected`와 `비고`는 전달하지 않는다.
2. 자동 선택된 skill, 명시 호출된 skill, 읽은 `SKILL.md`와 reference를 `selected-skills.md`에 기록한다.
3. should-not-trigger는 답변 품질이 아니라 해당 skill이 자동 선택되지 않았는지 평가한다.
4. ambiguous는 추측 실행보다 필요한 root, artifact, approval, claim을 확인하는지 평가한다.
5. continuation case는 compaction 뒤 해당 단계의 현재 `SKILL.md`를 다시 읽는지 확인한다.

## 3. Scenario Suite 실행 규약

Scenario source는 `templates/skill-scenarios/S01-*`부터 `S16-*`까지다. 각 run은 다음을 지킨다.

1. 이전 대화와 artifact가 없는 fresh session을 시작한다.
2. Codex forward test는 `gpt-5.6-luna --effort low`, Claude Code는 `sonnet`을 사용한다. 지정 모델을 쓸 수 없으면 실제 fallback을 `environment.md`에 기록한다.
3. runner에는 해당 `prompt.md`와 `context/`만 제공한다. `expected-skill.json`, `expected-artifacts.md`, `forbidden-outcomes.md`, `verification-commands.txt`, `rubric.md`는 실행 종료 전까지 숨긴다.
4. Agent가 source scenario 디렉터리의 숨겨진 평가 파일을 직접 읽을 수 없게 한다. 격리 worktree를 쓰면 evaluator 원본은 worktree 밖에 보관하고 해당 worktree의 scenario 입력에는 `prompt.md`와 `context/`만 남긴다. 그렇지 않으면 빈 임시 입력 디렉터리에 두 항목만 복사해 실행한다. fixture root를 cwd나 탐색 가능한 입력 경로로 넘기지 않는다.
5. Claude Code가 `.agents/skills`를 발견하지 못하면 test-only explicit load로 필요한 `SKILL.md` 경로만 알려준다. skill 내용을 별도 mirror로 복제하지 않는다.
6. run별 빈 임시 디렉터리를 만들고 `SCENARIO_OUTPUT_ROOT`로 전달한다. scenario가 허용한 이 root 밖에는 쓰지 않으며 source scenario 디렉터리 자체를 실행 artifact로 사용하지 않는다.
7. context의 `${SCENARIO_OUTPUT_ROOT}` 표기는 실제 절대 경로로 해석하되 source fixture를 수정하지 않는다.
8. `verification-commands.txt`의 비어 있지 않고 `#`로 시작하지 않는 각 줄을 저장소 root에서 개별 실행하고 command, exit code, bounded output을 기록한다.
9. exact prose가 아니라 선택, gate, 구조, write inventory, 금지 결과, fresh command evidence를 rubric으로 평가한다.

## 4. Evidence 저장 형식

```text
tests/skills/evidence/
├── baseline/
├── codex/
│   └── <scenario-id>/<run-id>/
└── claude-code/
    └── <scenario-id>/<run-id>/
```

새 run 디렉터리에는 정확히 다음 evidence surface를 저장한다.

```text
environment.md
prompt.md
selected-skills.md
commands.log
artifact-tree.txt
validation.txt
result-summary.md
```

S01, S03, S13은 기존 `baseline/`과 같은 `prompt.md` 문구를 유지한다. 새 결과는 baseline을 덮어쓰지 않고 tool별 run 경로에 저장한 뒤 skill 선택, 자산 경계, gate, 불필요 파일, 검증 완료율을 비교한다.

- `environment.md`: date, tool/version, model/effort와 fallback, commit, cwd, operating mode
- `prompt.md`: 실제 전달한 prompt와 공개한 context inventory만 저장
- `selected-skills.md`: 선택 순서, 명시/암시 여부, 다시 읽은 skill/reference
- `commands.log`: command, 시작/종료, exit code, bounded stdout/stderr
- `artifact-tree.txt`: scenario run이 만든 파일의 상대 경로 inventory
- `validation.txt`: deterministic validator와 scenario command 결과
- `result-summary.md`: pass/fail/unverified, rubric 근거, 금지 결과, residual uncertainty, baseline 비교

실행하지 못한 check는 `pass`가 아니라 `unverified`다. 전체 private terminal history는 evidence에 복사하지 않는다.

## 5. Secret 및 private-data 금지 목록

Scenario, fixture, 생성 artifact, command log, evidence에 다음을 저장하지 않는다.

- API key, access/refresh token, password, cookie, private key, credential 값
- 실제 private endpoint, internal hostname, subscription/project/account identifier
- 실고객 이름, 주민·계좌·카드·상담 원문, production payload
- `.env` 값, auth header, shell history 전체, 배포 credential
- redaction 전 prompt, Tool argument/result, event payload, Agent Card

허용되는 것은 환경변수 이름, `example.invalid` 도메인, localhost, 명백한 합성 ID와 합성 데이터뿐이다. S15의 두 sentinel 값은 안전성 검사용으로 `S15-private-data-safety/prompt.md`에만 존재해야 하며 context, artifact, evidence로 복제하면 실패다.
