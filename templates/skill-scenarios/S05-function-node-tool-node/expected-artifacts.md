# Expected Structure and Behavior

- OCR 실행을 독립 Tool과 Tool Node로 표현한다.
- 텍스트 정규화를 Workflow-private Function Node로 표현한다.
- 정규화 단계는 부모 Workflow의 Domain과 Owner를 상속한다.
- 두 Node의 input/output channel과 오류 경계를 구분한다.
- 정규화 helper를 Catalog Tool 후보로 승격하지 않는다.
