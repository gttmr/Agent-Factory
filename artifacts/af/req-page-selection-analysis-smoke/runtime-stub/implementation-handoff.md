# Implementation Handoff (runnable mode)

Generated from reviewed scaffold-plan.json for Synthetic page selection and analysis workflow.

## What runs today

- Agent nodes call Gemini; connected adapter nodes call live Mock Lab MCP tools.
- Everything runs over synthetic inputs only.

## Boundaries that still must hold

- Do not add private endpoints, credentials, customer data, or deployment scripts.
- Keep adapter calls pointed at synthetic Mock Lab servers, not real systems.
- Individualize behavior via agents.config.yaml and shared secrets via .agent-factory/runtime.env, not by hard-coding secrets.

## Unconnected adapters (synthetic stub until a Mock Lab server is bound)

- none

## Reviewed TODO notes

- page_selection_analysis_workflow: Implement this module in TODO_IMPLEMENT_HERE after the design is approved.
- page_selection_analysis_workflow: Map reviewed inputs, validate outputs, and keep business credentials out of generated code.
- customer_behavior_type_classifier_agent: Implement this module in TODO_IMPLEMENT_HERE after the design is approved.
- customer_behavior_type_classifier_agent: Map reviewed inputs, validate outputs, and keep business credentials out of generated code.
- page_candidate_rag_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- page_candidate_rag_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
- page_selection_decision_agent: Implement this module in TODO_IMPLEMENT_HERE after the design is approved.
- page_selection_decision_agent: Map reviewed inputs, validate outputs, and keep business credentials out of generated code.
- user_flow_analysis_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- user_flow_analysis_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
- behavior_scenario_recommendation_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- behavior_scenario_recommendation_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
- page_customer_sql_analysis_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- page_customer_sql_analysis_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
- workflow2_page_handoff_agent: Implement this module in TODO_IMPLEMENT_HERE after the design is approved.
- workflow2_page_handoff_agent: Map reviewed inputs, validate outputs, and keep business credentials out of generated code.
