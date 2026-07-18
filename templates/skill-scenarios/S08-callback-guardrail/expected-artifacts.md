# Expected Structure and Behavior

- approved output root 아래에 before-tool guardrail seam을 생성한다.
- Runner-wide 정책에는 Plugin을 우선 검토하고 선택 근거를 handoff에 남긴다.
- Continue는 default Tool 실행을 유지하고 Override는 차단 결과로 대체한다.
- state write와 audit output을 redacted synthetic 값으로 검증한다.
- baseline, allow, block, exception과 duplicate-side-effect test를 포함한다.
