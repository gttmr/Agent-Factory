# Delivered prompt

context의 완전한 합성 승인 artifact 세트를 검증한 뒤, 중요한 합성 변경을 적용하기 전에 사람의 확인을 받고 같은 invocation을 API로 재개하는 runnable 로컬 프로토타입을 `${SCENARIO_OUTPUT_ROOT}/runtime`에 만들어줘. 중복 응답이나 재시작 때 동일한 합성 변경이 두 번 실행되지 않는지도 시험할 수 있어야 해.

`SCENARIO_OUTPUT_ROOT`는 `/tmp/af-codex-s11-20260720-c3GvG7/project/scenario-output`이다. 공개 입력은 `scenario-input/prompt.md`와 `scenario-input/context/`뿐이며, 현재 저장소 지침과 발견한 canonical Agent Factory Skill을 따르도록 안내했다.

## Public context inventory

- `af-run-manifest.json`
- `analysis-result.json`
- `asset-candidates.json`
- `boundary-design.md`
- `graph-ir.json`
- `normalized-requirement.json`
- `scaffold-plan.json`
