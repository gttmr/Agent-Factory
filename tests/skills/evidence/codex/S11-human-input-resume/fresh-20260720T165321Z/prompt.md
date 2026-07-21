# Delivered prompt

The agent received the public `scenario-input/prompt.md` request:

> context의 완전한 합성 승인 artifact 세트를 검증한 뒤, 중요한 합성 변경을 적용하기 전에 사람의 확인을 받고 같은 invocation을 API로 재개하는 runnable 로컬 프로토타입을 `${SCENARIO_OUTPUT_ROOT}/runtime`에 만들어줘. 중복 응답이나 재시작 때 동일한 합성 변경이 두 번 실행되지 않는지도 시험할 수 있어야 해.

Additional harness instructions fixed `SCENARIO_OUTPUT_ROOT` to `/tmp/af-codex-s11-final-RzBPK4/project/scenario-output`, identified `scenario-input/prompt.md` and `scenario-input/context/` as the only public scenario inputs, prohibited source/approval edits, and limited generated artifacts to the output root.

## Public context inventory

- `af-run-manifest.json`
- `analysis-result.json`
- `asset-candidates.json`
- `boundary-design.md`
- `graph-ir.json`
- `normalized-requirement.json`
- `scaffold-plan.json`
