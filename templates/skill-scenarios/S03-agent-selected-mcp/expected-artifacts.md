# Expected Structure and Behavior

- 설명-only Compose 결과로 Agent와 OCR Tool의 책임을 분리한다.
- OCR Tool에 MCP Binding, server/tool reference, schema, auth reference와 local mock 필요성을 둔다.
- OCR 사용 여부의 Invocation Control을 Agent로 판정한다.
- main fixed-control Graph에 OCR Tool Node를 필수 단계로 배치하지 않는다.
- endpoint, credential, Tool 이름이 없으면 Missing Information으로 남긴다.
