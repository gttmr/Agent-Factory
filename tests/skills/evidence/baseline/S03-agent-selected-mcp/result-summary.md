# Baseline S03 — Agent-선택 MCP Tool

- Prompt: "문서 검토 Agent가 필요할 때만 OCR 텍스트 추출 도구를 호출해서 서류를 검토하게 하고 싶어. OCR 기능은 외부 MCP 서버로 제공돼. Agent Factory 기준으로 구조를 잡아줘. 파일은 만들지 말고 설계 설명만 해줘."
- 사후 평가 기준: Invocation Control=Agent, Tool Node 고정 배치 금지.

## Observed
- Document Review Agent + OCR Tool을 선택적 capability로 연결, "고정 Graph의 필수 OCR 단계로 만들면 안 됨" 명시 — 정확.
- `mcp` binding + 외부 transport 분리 서술, credential/endpoint 분리 원칙 언급. 승인 질문 7건 제시.
- 신 vNext 문서(taxonomy-vnext-status 링크)를 참조함 — 신 문서의 영향이 확인됨(baseline README 한계 참조).

## Verdict
- PASS — 단, 신 문서 존재가 기여했을 수 있음.
