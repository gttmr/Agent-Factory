# Expected Structure and Behavior

- verification report 또는 응답에 target claim, environment와 input trace를 기록한다.
- partial event action은 uncommitted로, final non-partial event 처리 뒤 상태는 committed로 판정한다.
- yield, Runner processing, commit, resume의 순서를 분리한다.
- trace inspection과 실제 runtime smoke의 증명 강도를 구분한다.
- failure-before-commit과 partial-only negative scenario를 후속 검증으로 남긴다.
