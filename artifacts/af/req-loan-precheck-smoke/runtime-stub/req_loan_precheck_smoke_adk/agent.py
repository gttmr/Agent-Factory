from __future__ import annotations

from typing import AsyncGenerator
from typing import Any

from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.genai import types


COMPONENT_CONTRACTS = {
    "mod-loan-precheck-workflow": {
        "catalog_binding": {
            "catalog_id": "seed-workflow-loan_application_precheck_mock_workflow",
            "name": "loan_application_precheck_mock_workflow",
            "component_source": "stub"
        },
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the reviewed handoff is accepted.",
            "Map reviewed inputs, validate outputs, and keep credentials, private endpoints, and business logic out of generated code."
        ],
        "inputs": [
            {
                "name": "loan_application",
                "type": "object",
                "required": True
            },
            {
                "name": "submitted_documents",
                "type": "array<object>",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "precheck_result",
                "type": "object",
                "required": True
            },
            {
                "name": "approval_required",
                "type": "boolean",
                "required": True
            },
            {
                "name": "next_actions",
                "type": "array<string>",
                "required": True
            }
        ],
        "risk_signals": [
            "personal_data",
            "financial_data",
            "credit_decision_support",
            "customer_impact",
            "external_message",
            "human_approval_required",
            "audit_required"
        ],
        "runtime_mock": {
            "precheck_result": {
                "case_id": "LOAN-DEMO-CASE-001",
                "outcome": "supplement_required_manual_review",
                "customer_id": "CUST-DEMO-001",
                "requested_amount": 30000000,
                "summary": "재직증명서 보완 및 담당자 검토가 필요한 synthetic 사전심사 결과입니다.",
                "evidence_refs": [
                    "LOAN-DOC-REQ-001",
                    "DSR_SOFT_LIMIT"
                ]
            },
            "approval_required": True,
            "next_actions": [
                "request_employment_certificate",
                "reconcile_income_mismatch",
                "route_to_manual_reviewer",
                "preview_customer_notice_only"
            ]
        }
    },
    "mod-common-document-intake": {
        "catalog_binding": {
            "catalog_id": "seed-workflow-common_document_intake_mock_workflow",
            "name": "common_document_intake_mock_workflow",
            "component_source": "stub"
        },
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the reviewed handoff is accepted.",
            "Map reviewed inputs, validate outputs, and keep credentials, private endpoints, and business logic out of generated code."
        ],
        "inputs": [
            {
                "name": "document_package",
                "type": "object",
                "required": True
            },
            {
                "name": "domain_context",
                "type": "object",
                "required": False
            }
        ],
        "outputs": [
            {
                "name": "document_context",
                "type": "object",
                "required": True
            },
            {
                "name": "intake_artifacts",
                "type": "array<object>",
                "required": True
            },
            {
                "name": "intake_warnings",
                "type": "array<string>",
                "required": True
            }
        ],
        "risk_signals": [
            "personal_data",
            "financial_data",
            "audit_required"
        ],
        "runtime_mock": {
            "document_context": {
                "document_package_id": "DOC-PKG-DEMO-001",
                "normalized_document_type": "loan_application_pack",
                "extracted_fields": {
                    "requested_amount": 30000000,
                    "stated_annual_income": 75000000,
                    "proof_annual_income": 72000000
                },
                "policy_basis": [
                    "LOAN-DOC-REQ-001",
                    "LOAN-RISK-DSR-002"
                ]
            },
            "intake_artifacts": [
                {
                    "artifact_id": "art-ocr-demo-001",
                    "kind": "ocr_text"
                },
                {
                    "artifact_id": "art-policy-demo-001",
                    "kind": "policy_citation_pack"
                }
            ],
            "intake_warnings": [
                "synthetic_document_context"
            ]
        }
    },
    "mod-customer-account-snapshot": {
        "catalog_binding": {
            "catalog_id": "seed-adapter-customer_account_snapshot_mock_adapter",
            "name": "customer_account_snapshot_mock_adapter",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its approved runtime binding before invocation.",
            "Map reviewed inputs and outputs before replacing the TODO boundary."
        ],
        "inputs": [
            {
                "name": "customer_identifier",
                "type": "string",
                "required": True
            },
            {
                "name": "snapshot_scope",
                "type": "array<string>",
                "required": False
            }
        ],
        "outputs": [
            {
                "name": "customer_snapshot",
                "type": "object",
                "required": True
            },
            {
                "name": "account_summary",
                "type": "object",
                "required": True
            },
            {
                "name": "data_freshness",
                "type": "object",
                "required": True
            }
        ],
        "risk_signals": [
            "personal_data",
            "financial_data",
            "audit_required"
        ],
        "runtime_mock": {
            "customer_snapshot": {
                "customer_id": "CUST-DEMO-001",
                "display_name": "김데모",
                "kyc_status": "verified",
                "relationship_years": 7,
                "masking": "synthetic"
            },
            "account_summary": {
                "deposit_balance": 18500000,
                "monthly_income_estimate": 6000000,
                "delinquency_count_12m": 0,
                "existing_loan_balance": 42000000
            },
            "data_freshness": {
                "as_of": "2026-05-01T09:00:00+09:00",
                "synthetic": True
            }
        }
    },
    "mod-loan-precheck-rule": {
        "catalog_binding": {
            "catalog_id": "seed-adapter-loan_precheck_rule_mock_adapter",
            "name": "loan_precheck_rule_mock_adapter",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its approved runtime binding before invocation.",
            "Map reviewed inputs and outputs before replacing the TODO boundary."
        ],
        "inputs": [
            {
                "name": "rule_set_key",
                "type": "string",
                "required": True
            },
            {
                "name": "case_features",
                "type": "object",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "rule_result",
                "type": "object",
                "required": True
            },
            {
                "name": "matched_rules",
                "type": "array<object>",
                "required": True
            },
            {
                "name": "required_actions",
                "type": "array<string>",
                "required": True
            }
        ],
        "risk_signals": [
            "customer_impact",
            "credit_decision_support",
            "audit_required"
        ],
        "runtime_mock": {
            "rule_result": {
                "rule_set_key": "loan_precheck_demo_v1",
                "outcome": "review_required",
                "score_band": "B",
                "hard_stop": False
            },
            "matched_rules": [
                {
                    "rule_id": "DSR_SOFT_LIMIT",
                    "result": "review_required",
                    "reason": "추정 DSR이 soft threshold 근처입니다."
                },
                {
                    "rule_id": "DOCUMENT_COMPLETENESS",
                    "result": "supplement_required",
                    "reason": "재직증명서가 누락되었습니다."
                }
            ],
            "required_actions": [
                "request_employment_certificate",
                "route_to_manual_reviewer"
            ]
        }
    },
    "mod-loan-document-review": {
        "catalog_binding": {
            "catalog_id": "seed-agent-loan_document_review_mock_agent",
            "name": "loan_document_review_mock_agent",
            "component_source": "stub"
        },
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the reviewed handoff is accepted.",
            "Map reviewed inputs, validate outputs, and keep credentials, private endpoints, and business logic out of generated code."
        ],
        "inputs": [
            {
                "name": "document_context",
                "type": "object",
                "required": True
            },
            {
                "name": "policy_matches",
                "type": "array<object>",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "document_review_result",
                "type": "object",
                "required": True
            },
            {
                "name": "missing_documents",
                "type": "array<string>",
                "required": True
            },
            {
                "name": "followup_questions",
                "type": "array<string>",
                "required": True
            }
        ],
        "risk_signals": [
            "financial_data",
            "audit_required"
        ],
        "runtime_mock": {
            "document_review_result": {
                "decision": "supplement_required",
                "checked_items": [
                    "loan_application_form",
                    "income_certificate",
                    "identity_document"
                ],
                "mismatches": [
                    {
                        "field": "annual_income",
                        "document_value": 72000000,
                        "application_value": 75000000,
                        "severity": "medium"
                    }
                ],
                "confidence": 0.94
            },
            "missing_documents": [
                "employment_certificate"
            ],
            "followup_questions": [
                "재직증명서 최신본을 추가 제출해야 합니다.",
                "신청서 소득 금액과 소득증빙 금액 차이를 확인해야 합니다."
            ]
        }
    },
    "mod-credit-risk-reasoning": {
        "catalog_binding": {
            "catalog_id": "seed-agent-credit_risk_reasoning_mock_agent",
            "name": "credit_risk_reasoning_mock_agent",
            "component_source": "stub"
        },
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the reviewed handoff is accepted.",
            "Map reviewed inputs, validate outputs, and keep credentials, private endpoints, and business logic out of generated code."
        ],
        "inputs": [
            {
                "name": "customer_snapshot",
                "type": "object",
                "required": True
            },
            {
                "name": "rule_result",
                "type": "object",
                "required": True
            },
            {
                "name": "document_review_result",
                "type": "object",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "risk_reasoning",
                "type": "object",
                "required": True
            },
            {
                "name": "approval_required",
                "type": "boolean",
                "required": True
            },
            {
                "name": "reviewer_notes",
                "type": "array<string>",
                "required": True
            }
        ],
        "risk_signals": [
            "credit_decision_support",
            "customer_impact",
            "human_approval_required",
            "audit_required"
        ],
        "runtime_mock": {
            "risk_reasoning": {
                "summary": "소득 증빙 불일치와 최근 DSR 경고로 담당자 확인이 필요합니다.",
                "risk_flags": [
                    "income_document_mismatch",
                    "dsr_watch"
                ],
                "evidence": [
                    {
                        "rule": "DSR_SOFT_LIMIT",
                        "result": "review_required"
                    },
                    {
                        "rule": "DOCUMENT_COMPLETENESS",
                        "result": "supplement_required"
                    }
                ],
                "recommendation": "request_supplement_then_manual_review"
            },
            "approval_required": True,
            "reviewer_notes": [
                "자동 승인/거절이 아니라 담당자 검토 큐로 전달합니다.",
                "synthetic demo 데이터이며 실제 신용 판단에 사용할 수 없습니다."
            ]
        }
    },
    "mod-customer-notice-template": {
        "catalog_binding": {
            "catalog_id": "seed-adapter-customer_notice_template_mock_adapter",
            "name": "customer_notice_template_mock_adapter",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its approved runtime binding before invocation.",
            "Map reviewed inputs and outputs before replacing the TODO boundary."
        ],
        "inputs": [
            {
                "name": "template_key",
                "type": "string",
                "required": True
            },
            {
                "name": "locale",
                "type": "string",
                "required": False
            },
            {
                "name": "channel",
                "type": "string",
                "required": False
            }
        ],
        "outputs": [
            {
                "name": "template",
                "type": "object",
                "required": True
            },
            {
                "name": "required_variables",
                "type": "array<string>",
                "required": True
            },
            {
                "name": "approval_constraints",
                "type": "object",
                "required": True
            }
        ],
        "risk_signals": [
            "external_message",
            "audit_required"
        ],
        "runtime_mock": {
            "template": {
                "template_key": "loan_supplement_request_demo",
                "locale": "ko-KR",
                "channel": "internal_preview",
                "body": "[데모] 대출 사전심사를 위해 {missing_documents} 보완 제출이 필요합니다. 담당자 검토 후 다음 단계를 안내드립니다."
            },
            "required_variables": [
                "missing_documents",
                "reviewer_contact"
            ],
            "approval_constraints": {
                "external_send_allowed": False,
                "requires_human_approval": True,
                "synthetic": True
            }
        }
    }
}
GRAPH_EDGES = [
    ("START", "node_mod_loan_precheck_workflow"),
    ("node_mod_loan_precheck_workflow", "node_mod_common_document_intake"),
    ("node_mod_loan_precheck_workflow", "node_mod_customer_account_snapshot"),
    ("node_mod_common_document_intake", "node_mod_loan_document_review"),
    ("node_mod_customer_account_snapshot", "node_mod_loan_precheck_rule"),
    ("node_mod_loan_document_review", "node_mod_credit_risk_reasoning"),
    ("node_mod_loan_precheck_rule", "node_mod_credit_risk_reasoning"),
    ("node_mod_credit_risk_reasoning", "node_mod_customer_notice_template"),
    ("node_mod_customer_notice_template", "emit_workflow_result"),
    ("node_mod_credit_risk_reasoning", "emit_workflow_result")
]
TERMINAL_OUTPUTS = [
    "precheck_result",
    "approval_required",
    "next_actions"
]


def _event_output(module_id: str, module_name: str, node_input: Any = None):
    contract = COMPONENT_CONTRACTS[module_id]
    return {
        "module_id": module_id,
        "module_name": module_name,
        "input": node_input,
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
    }


def TODO_IMPLEMENT_HERE_mod_loan_precheck_workflow(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("loan_application_precheck_mock_workflow requires developer implementation")


def node_mod_loan_precheck_workflow(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-loan-precheck-workflow"]
    output = _event_output("mod-loan-precheck-workflow", "loan_application_precheck_mock_workflow", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_loan_precheck_workflow"
    return output

def TODO_IMPLEMENT_HERE_mod_common_document_intake(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("common_document_intake_mock_workflow requires developer implementation")


def node_mod_common_document_intake(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-common-document-intake"]
    output = _event_output("mod-common-document-intake", "common_document_intake_mock_workflow", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_common_document_intake"
    return output

def TODO_IMPLEMENT_HERE_mod_customer_account_snapshot(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("customer_account_snapshot_mock_adapter requires developer implementation")


def node_mod_customer_account_snapshot(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-customer-account-snapshot"]
    output = _event_output("mod-customer-account-snapshot", "customer_account_snapshot_mock_adapter", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_customer_account_snapshot"
    return output

def TODO_IMPLEMENT_HERE_mod_loan_precheck_rule(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("loan_precheck_rule_mock_adapter requires developer implementation")


def node_mod_loan_precheck_rule(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-loan-precheck-rule"]
    output = _event_output("mod-loan-precheck-rule", "loan_precheck_rule_mock_adapter", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_loan_precheck_rule"
    return output

def TODO_IMPLEMENT_HERE_mod_loan_document_review(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("loan_document_review_mock_agent requires developer implementation")


def node_mod_loan_document_review(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-loan-document-review"]
    output = _event_output("mod-loan-document-review", "loan_document_review_mock_agent", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_loan_document_review"
    return output

def TODO_IMPLEMENT_HERE_mod_credit_risk_reasoning(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("credit_risk_reasoning_mock_agent requires developer implementation")


def node_mod_credit_risk_reasoning(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-credit-risk-reasoning"]
    output = _event_output("mod-credit-risk-reasoning", "credit_risk_reasoning_mock_agent", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_credit_risk_reasoning"
    return output

def TODO_IMPLEMENT_HERE_mod_customer_notice_template(node_input: Any = None):
    """TODO_IMPLEMENT_HERE: implement this approved module after filling the reviewed handoff."""
    raise NotImplementedError("customer_notice_template_mock_adapter requires developer implementation")


def node_mod_customer_notice_template(node_input: Any = None):
    contract = COMPONENT_CONTRACTS["mod-customer-notice-template"]
    output = _event_output("mod-customer-notice-template", "customer_notice_template_mock_adapter", node_input)
    output["developer_todos"] = contract["developer_todos"]
    output["todo_function"] = "TODO_IMPLEMENT_HERE_mod_customer_notice_template"
    return output


def emit_workflow_result(node_input: Any = None):
    return {
        "node_id": "workflow_result",
        "terminal_outputs": TERMINAL_OUTPUTS,
        "input": node_input,
        "status": "runtime_mock_smoke",
    }


def _synthetic_module_outputs():
    return {
        module_id: {
            "module_name": contract["catalog_binding"]["name"] if contract.get("catalog_binding") else module_id,
            "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
            "runtime_mock": contract.get("runtime_mock"),
            "developer_todos": contract["developer_todos"],
        }
        for module_id, contract in COMPONENT_CONTRACTS.items()
    }


def _build_smoke_text(user_text: str = ""):
    mock_count = sum(1 for contract in COMPONENT_CONTRACTS.values() if contract.get("runtime_mock") is not None)
    terminal_outputs = ", ".join(TERMINAL_OUTPUTS) if TERMINAL_OUTPUTS else "none"
    user_note = f" Received message: {user_text[:160]}" if user_text else ""
    return (
        "ADK runtime smoke for req_loan_precheck_smoke_adk: "
        f"{len(COMPONENT_CONTRACTS)} approved modules loaded, "
        f"{mock_count} synthetic runtime mocks available. "
        f"Terminal outputs: {terminal_outputs}. "
        "This response uses reviewed synthetic test doubles only; it is not real business logic."
        f"{user_note}"
    )


def _latest_user_text(ctx: InvocationContext):
    try:
        events = list(getattr(ctx.session, "events", []) or [])
    except Exception:
        return ""
    for event in reversed(events):
        content = getattr(event, "content", None)
        if not content or getattr(content, "role", None) != "user":
            continue
        parts = getattr(content, "parts", []) or []
        text = "".join(getattr(part, "text", "") or "" for part in parts)
        if text.strip():
            return text.strip()
    return ""


class SyntheticRuntimeSmokeAgent(BaseAgent):
    async def _run_async_impl(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]:
        yield Event(
            invocation_id=ctx.invocation_id,
            author=self.name,
            branch=ctx.branch,
            content=types.Content(
                role="model",
                parts=[types.Part(text=_build_smoke_text(_latest_user_text(ctx)))],
            ),
            output={
                "status": "runtime_mock_smoke",
                "guardrails": {
                    "raw_requirement_to_code": False,
                    "generated_business_logic": False,
                    "private_data_or_endpoints": False,
                },
                "graph_edges": GRAPH_EDGES,
                "terminal_outputs": TERMINAL_OUTPUTS,
                "module_outputs": _synthetic_module_outputs(),
            },
        )


root_agent = SyntheticRuntimeSmokeAgent(
    name="req_loan_precheck_smoke_adk",
    description="Synthetic ADK runtime smoke bridge for reviewed Agent Factory handoff artifacts.",
)
