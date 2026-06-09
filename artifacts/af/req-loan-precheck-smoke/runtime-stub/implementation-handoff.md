# Implementation Handoff (runnable mode)

Generated from reviewed scaffold-plan.json for Synthetic loan precheck graph runtime handoff.

## What runs today

- Agent nodes call Gemini; connected adapter nodes call live Mock Lab MCP tools.
- Everything runs over synthetic inputs only.

## Boundaries that still must hold

- Do not add private endpoints, credentials, customer data, or deployment scripts.
- Keep adapter calls pointed at synthetic Mock Lab servers, not real systems.
- Individualize behavior via agents.config.yaml and shared secrets via .agent-factory/runtime.env, not by hard-coding secrets.

## Unconnected adapters (synthetic stub until a Mock Lab server is bound)

- customer_account_snapshot_mock_adapter: bind a Mock Lab MCP server or keep the synthetic stub.
- loan_precheck_rule_mock_adapter: bind a Mock Lab MCP server or keep the synthetic stub.
- customer_notice_template_mock_adapter: bind a Mock Lab MCP server or keep the synthetic stub.

## Reviewed TODO notes

- loan_application_precheck_mock_workflow: Review the catalog runtime contract and configure its runtime binding before invocation.
- loan_application_precheck_mock_workflow: Map reviewed inputs and outputs before wiring runtime behavior.
- common_document_intake_mock_workflow: Review the catalog runtime contract and configure its runtime binding before invocation.
- common_document_intake_mock_workflow: Map reviewed inputs and outputs before wiring runtime behavior.
- customer_account_snapshot_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- customer_account_snapshot_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
- loan_precheck_rule_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- loan_precheck_rule_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
- loan_document_review_mock_agent: Review the catalog runtime contract and configure its runtime binding before invocation.
- loan_document_review_mock_agent: Map reviewed inputs and outputs before wiring runtime behavior.
- credit_risk_reasoning_mock_agent: Review the catalog runtime contract and configure its runtime binding before invocation.
- credit_risk_reasoning_mock_agent: Map reviewed inputs and outputs before wiring runtime behavior.
- customer_notice_template_mock_adapter: Review the catalog runtime contract and configure its runtime binding before invocation.
- customer_notice_template_mock_adapter: Map reviewed inputs and outputs before wiring runtime behavior.
