# Page Selection Analysis Smoke

## Summary

This artifact models a data-analysis workflow whose first output is page selection.
The user chat query is classified into a customer behavior type, used to retrieve page candidates through a RAG MCP Adapter, and then routed either directly to workflow2 or through one optional analysis method before handoff.

## Modules

- `mod-page-selection-workflow`: local Graph IR workflow.
- `mod-behavior-classifier`: Agent that emits 대/중/소 customer behavior classification.
- `mod-page-rag-retrieval`: MCP retrieval Adapter for page candidates.
- `mod-page-decision-agent`: Agent that chooses `selected_page_id` and optional analysis route.
- `mod-user-flow-analysis`: MCP computation Adapter.
- `mod-behavior-scenario-analysis`: MCP computation Adapter.
- `mod-t2s-page-customer-analysis`: MCP data query Adapter that consumes reviewed SQL text.
- `mod-workflow2-handoff-agent`: Agent that emits the final `workflow2_handoff`.

## Assumptions

- All page, customer, and SQL data is synthetic.
- Text to SQL generation is out of scope; this workflow consumes SQL text already produced by a T2S solution.
- `workflow2` exact schema is not supplied, so the final handoff payload is synthetic and marked for later contract review.
- No Remote A2A boundary is inferred.
