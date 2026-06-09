# Boundary Design: Page Selection Analysis

## Boundary Decisions

The workflow is a local `graph` workflow. Customer behavior classification, page decision, and workflow2 handoff are Agent responsibilities because they require judgment over user intent, page candidates, and branch results.

The following capabilities are Adapters because they are callable tools and do not own independent reasoning:

- `page_candidate_rag_mock_adapter`: retrieval Adapter over a synthetic page catalog.
- `user_flow_analysis_mock_adapter`: computation Adapter over synthetic funnel data.
- `behavior_scenario_recommendation_mock_adapter`: computation Adapter over synthetic behavior taxonomy examples.
- `page_customer_sql_analysis_mock_adapter`: data query Adapter that consumes reviewed SQL text.

All four Adapters bind to one Mock Lab MCP server, `page-analysis-mcp`, with separate tools. This satisfies the requirement that one MCP server can be started and the Agent can use every scenario tool from that server.

## Runtime Contract Notes

All Adapter contracts are read-only and synthetic. They require audit summaries but no credentials, no private endpoint, no callback broker, and no Context Manager. The Text to SQL branch explicitly does not generate SQL; it consumes reviewed SQL text from an external T2S solution.

## Out Of Scope

- Production RAG corpus.
- Production customer behavior taxonomy source.
- Production SQL execution or parser allow-list.
- `workflow2` exact runtime schema.
- Remote A2A, because no independent remote agent owner or protocol contract was supplied.
