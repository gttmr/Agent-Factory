# Boundary Design

`loan_application_precheck_mock_workflow` 는 로컬 graph Workflow 경계다. 모든 하위 모듈은 catalog에 있는 synthetic runtime contract를 재사용한다.

## Module Boundaries

- Workflow: `loan_application_precheck_mock_workflow`, `common_document_intake_mock_workflow`
- Agents: `loan_document_review_mock_agent`, `credit_risk_reasoning_mock_agent`
- Adapters: `customer_account_snapshot_mock_adapter`, `loan_precheck_rule_mock_adapter`, `customer_notice_template_mock_adapter`

## Runtime Posture

Generated source is a TODO-only handoff. The example is suitable for web Build/Verify smoke and structural ADK stub checks, but it is not production business logic.
