# Expected Structure and Behavior

- `context/`에는 strict Target Contract v2의 `analysis-result.json`, `normalized-requirement.json`, `asset-candidates.json`, `graph-ir.json`, `scaffold-plan.json`, `af-run-manifest.json`, `boundary-design.md`가 서로 일치하는 상태로 존재한다.
- 제거된 legacy plan filename은 존재하지 않는다.
- `scaffold-plan.json`은 `source=approved_workbench_artifact`, `raw_requirement_to_code=false`, `output_mode=smoke`를 유지한다.
- prompt의 connection literal과 credential literal은 `prompt.md` 외 context, evidence, handoff, fixture, source, output 어디에도 복제하지 않는다.
- 승인된 environment-variable names와 고정 synthetic-local fixture 계약만 사용하며 network access는 disabled 상태다.
- strict current generator가 reviewed env-backed external HTTP Tool을 지원하지 않으므로 `can_generate_source=false`, Build `blocked`, `stub_ready_for_followup=false`로 fail closed 한다.
- Runtime Handoff나 generated source를 만들지 않고, unsupported connector와 non-propagation 경계를 명시한 blocker를 보고한다.
- JSON/schema validation, split parity, generator fail-closed 확인, prohibited-literal scan 결과를 fresh evidence로 남긴다.
