# Synthetic Reviewed Candidates

- `agent-quality-review`: 현재 합성 결과가 통과 기준을 만족하는지 판단하는 reviewed Agent.
- `tool-normalize-output`: 입력을 deterministic하게 보정하는 reviewed Tool이며 side effect가 없다.
- 반복 횟수는 실행 중 결과에 따라 결정되며 최대 4회다.
- 통과, 재시도, 최대 횟수 소진과 Tool 실패 경로가 모두 필요하다.
- candidate-level missing information은 없고 code generation approval은 아직 없다.
