from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from google.adk import Context
from google.adk.agents import LlmAgent
from google.adk.workflow import FunctionNode, JoinNode, START, Workflow


# Reviewed contract data for each approved module (synthetic test doubles only).
COMPONENT_CONTRACTS: dict[str, dict] = {
    "mod-loan-precheck-workflow": {
        "module_category": "workflow",
        "catalog_binding": {
            "catalog_id": "seed-workflow-loan_application_precheck_mock_workflow",
            "name": "loan_application_precheck_mock_workflow",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": None,
        "model": None,
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-common-document-intake": {
        "module_category": "workflow",
        "catalog_binding": {
            "catalog_id": "seed-workflow-common_document_intake_mock_workflow",
            "name": "common_document_intake_mock_workflow",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": None,
        "model": None,
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-customer-account-snapshot": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-customer_account_snapshot_mock_adapter",
            "name": "customer_account_snapshot_mock_adapter",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": None,
        "model": None,
        "access_protocol": "local",
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "unconnected"
    },
    "mod-loan-precheck-rule": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-loan_precheck_rule_mock_adapter",
            "name": "loan_precheck_rule_mock_adapter",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": None,
        "model": None,
        "access_protocol": "local",
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "unconnected"
    },
    "mod-loan-document-review": {
        "module_category": "agent",
        "catalog_binding": {
            "catalog_id": "seed-agent-loan_document_review_mock_agent",
            "name": "loan_document_review_mock_agent",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": "You are \"loan_document_review_mock_agent\".\nResponsibility: OCR와 정책 조회 결과를 바탕으로 대출 신청 서류의 누락, 불일치, 보완 필요 사항을 synthetic rule로 정리한다.\nInputs you receive: document_context, policy_matches.\nOutputs you must produce: document_review_result, missing_documents, followup_questions.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 문서 누락과 불일치를 synthetic evidence 기반으로 설명한다.",
        "model": "gemini-2.5-flash",
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-credit-risk-reasoning": {
        "module_category": "agent",
        "catalog_binding": {
            "catalog_id": "seed-agent-credit_risk_reasoning_mock_agent",
            "name": "credit_risk_reasoning_mock_agent",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": "You are \"credit_risk_reasoning_mock_agent\".\nResponsibility: 고객 snapshot, rule result, 문서 검토 결과를 모아 사람이 확인할 위험 근거와 다음 조치를 설명한다.\nInputs you receive: customer_snapshot, rule_result, document_review_result.\nOutputs you must produce: risk_reasoning, approval_required, reviewer_notes.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 담당자가 확인할 위험 근거와 다음 조치를 설명한다.",
        "model": "gemini-2.5-flash",
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-customer-notice-template": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-customer_notice_template_mock_adapter",
            "name": "customer_notice_template_mock_adapter",
            "component_source": "stub"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
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
        },
        "instruction": None,
        "model": None,
        "access_protocol": "local",
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "unconnected"
    }
}

# Per-developer overrides live in agents.config.yaml (sibling of this package).
# This is how each developer individualizes the bundle; agent.py applies the
# overrides at import time so editing the YAML actually changes behavior.
_CONFIG_PATH = Path(__file__).resolve().parent.parent / "agents.config.yaml"


def _load_config() -> dict:
    if not _CONFIG_PATH.exists():
        return {}
    try:
        return yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8")) or {}
    except Exception as exc:  # malformed YAML, permissions, etc.
        import sys

        print(
            f"[agent.py] WARNING: could not load {_CONFIG_PATH.name} ({exc}); "
            "using seeded defaults.",
            file=sys.stderr,
        )
        return {}


_CONFIG = _load_config()


def _override(section: str, module_id: str, key: str, default: Any) -> Any:
    for entry in _CONFIG.get(section, []) or []:
        if isinstance(entry, dict) and entry.get("id") == module_id:
            value = entry.get(key)
            if value is not None:
                return value
    return default


def _agent_cfg(module_id: str, key: str, default: Any) -> Any:
    return _override("agents", module_id, key, default)


def _model_for(module_id: str, seed: str) -> str:
    # Per-agent override wins; then the top-level default_model knob; then the seed.
    per_agent = _override("agents", module_id, "model", None)
    if per_agent:
        return str(per_agent)
    default_model = _CONFIG.get("default_model")
    return str(default_model) if default_model else seed


def _adapter_cfg(module_id: str, key: str, default: Any) -> Any:
    return _override("adapters", module_id, key, default)


def _mcp_url(module_id: str, mcp_server: str) -> str:
    configured = _adapter_cfg(module_id, "mcp_url", None)
    if configured:
        return str(configured)
    base = os.environ.get("AF_MOCK_LAB_MCP_URL", "http://127.0.0.1:5176/api/mock-lab/mcp").rstrip("/")
    return f"{base}/{mcp_server}"


def _collect_tool_inputs(
    ctx: Context, module_id: str, input_names: list[str], required_names: list[str]
) -> dict:
    # Resolve each reviewed tool input from (1) an explicit agents.config.yaml
    # input_map (tool_input -> state/output key), (2) a top-level session-state
    # value, or (3) a matching field inside an upstream node's *_output payload.
    overrides = _adapter_cfg(module_id, "input_map", {}) or {}
    args: dict = {}
    for name in input_names:
        source_key = overrides.get(name, name)
        if ctx.state.get(source_key) is not None:
            args[name] = ctx.state.get(source_key)
            continue
        # Fall back to a field named source_key inside any upstream *_output dict.
        for key, value in ctx.state.items():
            if key.endswith("_output") and isinstance(value, dict) and value.get(source_key) is not None:
                args[name] = value.get(source_key)
                break
    missing = [name for name in required_names if name not in args]
    if missing:
        raise RuntimeError(
            f"{module_id}: required MCP tool inputs missing from session state / upstream outputs: {missing}. "
            "Set an input_map for this adapter in agents.config.yaml."
        )
    return args


async def _fn_mod_loan_precheck_workflow(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: loan_application_precheck_mock_workflow — deterministic workflow coordinator placeholder.

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS["mod-loan-precheck-workflow"]
    payload = {
        "module_id": "mod-loan-precheck-workflow",
        "module_name": "loan_application_precheck_mock_workflow",
        "connection_status": "coordinator",
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state["mod_loan_precheck_workflow_output"] = payload
    return payload

async def _fn_mod_common_document_intake(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: common_document_intake_mock_workflow — deterministic workflow coordinator placeholder.

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS["mod-common-document-intake"]
    payload = {
        "module_id": "mod-common-document-intake",
        "module_name": "common_document_intake_mock_workflow",
        "connection_status": "coordinator",
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state["mod_common_document_intake_output"] = payload
    return payload

async def _fn_mod_customer_account_snapshot(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: customer_account_snapshot_mock_adapter — unconnected adapter (no Mock Lab MCP server bound).

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS["mod-customer-account-snapshot"]
    payload = {
        "module_id": "mod-customer-account-snapshot",
        "module_name": "customer_account_snapshot_mock_adapter",
        "connection_status": "unconnected",
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state["mod_customer_account_snapshot_output"] = payload
    return payload

async def _fn_mod_loan_precheck_rule(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: loan_precheck_rule_mock_adapter — unconnected adapter (no Mock Lab MCP server bound).

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS["mod-loan-precheck-rule"]
    payload = {
        "module_id": "mod-loan-precheck-rule",
        "module_name": "loan_precheck_rule_mock_adapter",
        "connection_status": "unconnected",
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state["mod_loan_precheck_rule_output"] = payload
    return payload

async def _fn_mod_customer_notice_template(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: customer_notice_template_mock_adapter — unconnected adapter (no Mock Lab MCP server bound).

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS["mod-customer-notice-template"]
    payload = {
        "module_id": "mod-customer-notice-template",
        "module_name": "customer_notice_template_mock_adapter",
        "connection_status": "unconnected",
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state["mod_customer_notice_template_output"] = payload
    return payload


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

node_mod_loan_precheck_workflow = FunctionNode(func=_fn_mod_loan_precheck_workflow, name="mod_loan_precheck_workflow")

node_mod_common_document_intake = FunctionNode(func=_fn_mod_common_document_intake, name="mod_common_document_intake")

node_mod_customer_account_snapshot = FunctionNode(func=_fn_mod_customer_account_snapshot, name="mod_customer_account_snapshot")

node_mod_loan_precheck_rule = FunctionNode(func=_fn_mod_loan_precheck_rule, name="mod_loan_precheck_rule")

agent_mod_loan_document_review = LlmAgent(
    name="mod_loan_document_review",
    model=_model_for("mod-loan-document-review", "gemini-2.5-flash"),
    instruction=_agent_cfg("mod-loan-document-review", "instruction", "You are \"loan_document_review_mock_agent\".\nResponsibility: OCR와 정책 조회 결과를 바탕으로 대출 신청 서류의 누락, 불일치, 보완 필요 사항을 synthetic rule로 정리한다.\nInputs you receive: document_context, policy_matches.\nOutputs you must produce: document_review_result, missing_documents, followup_questions.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 문서 누락과 불일치를 synthetic evidence 기반으로 설명한다."),
    description="loan_document_review_mock_agent",
    output_key="mod_loan_document_review_output",
    mode="single_turn",
)

agent_mod_credit_risk_reasoning = LlmAgent(
    name="mod_credit_risk_reasoning",
    model=_model_for("mod-credit-risk-reasoning", "gemini-2.5-flash"),
    instruction=_agent_cfg("mod-credit-risk-reasoning", "instruction", "You are \"credit_risk_reasoning_mock_agent\".\nResponsibility: 고객 snapshot, rule result, 문서 검토 결과를 모아 사람이 확인할 위험 근거와 다음 조치를 설명한다.\nInputs you receive: customer_snapshot, rule_result, document_review_result.\nOutputs you must produce: risk_reasoning, approval_required, reviewer_notes.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 담당자가 확인할 위험 근거와 다음 조치를 설명한다."),
    description="credit_risk_reasoning_mock_agent",
    output_key="mod_credit_risk_reasoning_output",
    mode="single_turn",
)

node_mod_customer_notice_template = FunctionNode(func=_fn_mod_customer_notice_template, name="mod_customer_notice_template")

join_1 = JoinNode(name="join_1")


root_agent = Workflow(
    name="req_loan_precheck_smoke_adk",
    description="Runnable ADK 2.1 workflow generated from reviewed Agent Factory artifacts for Synthetic loan precheck graph runtime handoff.",
    edges=[
        (agent_mod_loan_document_review, join_1),
        (node_mod_loan_precheck_rule, join_1),
        (join_1, agent_mod_credit_risk_reasoning),
        (START, node_mod_loan_precheck_workflow),
        (node_mod_loan_precheck_workflow, node_mod_common_document_intake),
        (node_mod_loan_precheck_workflow, node_mod_customer_account_snapshot),
        (node_mod_common_document_intake, agent_mod_loan_document_review),
        (node_mod_customer_account_snapshot, node_mod_loan_precheck_rule),
        (agent_mod_credit_risk_reasoning, node_mod_customer_notice_template),
    ],
)
