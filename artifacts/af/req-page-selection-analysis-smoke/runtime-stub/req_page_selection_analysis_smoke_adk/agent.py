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
    "mod-page-selection-workflow": {
        "module_category": "workflow",
        "catalog_binding": None,
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the design is approved.",
            "Map reviewed inputs, validate outputs, and keep business credentials out of generated code."
        ],
        "inputs": [
            {
                "name": "chat_query",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_design_purpose",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_target_business_domain",
                "type": "string",
                "required": True
            },
            {
                "name": "sql_text",
                "type": "text",
                "required": False
            }
        ],
        "outputs": [
            {
                "name": "workflow2_handoff",
                "type": "object",
                "required": True
            }
        ],
        "risk_signals": [
            "financial_data",
            "customer_impact",
            "audit_required"
        ],
        "runtime_mock": None,
        "instruction": None,
        "model": None,
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-behavior-classifier": {
        "module_category": "agent",
        "catalog_binding": None,
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the design is approved.",
            "Map reviewed inputs, validate outputs, and keep business credentials out of generated code."
        ],
        "inputs": [
            {
                "name": "scenario_design_purpose",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_target_business_domain",
                "type": "string",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "customer_behavior_classification",
                "type": "object",
                "required": True
            }
        ],
        "risk_signals": [
            "customer_impact",
            "audit_required"
        ],
        "runtime_mock": None,
        "instruction": "You are \"customer_behavior_type_classifier_agent\".\nResponsibility: The classification requires interpreting user intent and mapping it to known 대/중/소 behavior categories, which is an Agent reasoning responsibility.\nInputs you receive: scenario_design_purpose, scenario_target_business_domain.\nOutputs you must produce: customer_behavior_classification.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 자동이체 설정 전환율 개선 시나리오의 고객 행동 유형을 분류해줘.",
        "model": "gemini-2.5-flash",
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-page-rag-retrieval": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-page_candidate_rag_mock_adapter",
            "name": "page_candidate_rag_mock_adapter",
            "component_source": "mcp"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
        ],
        "inputs": [
            {
                "name": "query",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_design_purpose",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_target_business_domain",
                "type": "string",
                "required": True
            },
            {
                "name": "customer_behavior_classification",
                "type": "object",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "page_candidates",
                "type": "array<object>",
                "required": True
            },
            {
                "name": "retrieval_metadata",
                "type": "object",
                "required": True
            }
        ],
        "risk_signals": [
            "financial_data",
            "audit_required"
        ],
        "runtime_mock": {
            "synthetic": True,
            "source": "agent-factory-mock-lab",
            "page_candidates": [
                {
                    "page_id": "svc-savings-auto-transfer-setup",
                    "service_id": "savings",
                    "page_name": "적금 자동이체 설정",
                    "behavior_path": {
                        "large": "가입/전환",
                        "medium": "자동이체",
                        "small": "설정 이탈"
                    },
                    "score": 0.94,
                    "evidence": [
                        "synthetic-rag-page-catalog:autotransfer",
                        "behavior-taxonomy:auto-transfer-dropoff"
                    ]
                }
            ],
            "retrieval_metadata": {
                "query_id": "rag-page-demo-001",
                "corpus": "synthetic-page-catalog-v1",
                "effective_date": "2026-06-08"
            }
        },
        "instruction": None,
        "model": None,
        "access_protocol": "mcp",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool_name": "search_page_candidates",
        "connection_status": "mcp_connected"
    },
    "mod-page-decision-agent": {
        "module_category": "agent",
        "catalog_binding": None,
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the design is approved.",
            "Map reviewed inputs, validate outputs, and keep business credentials out of generated code."
        ],
        "inputs": [
            {
                "name": "page_candidates",
                "type": "array<object>",
                "required": True
            },
            {
                "name": "chat_query",
                "type": "text",
                "required": True
            },
            {
                "name": "customer_behavior_classification",
                "type": "object",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "selected_page_id",
                "type": "string",
                "required": True
            },
            {
                "name": "additional_analysis_required",
                "type": "boolean",
                "required": True
            },
            {
                "name": "selected_analysis_method",
                "type": "string",
                "required": False
            },
            {
                "name": "additional_info_request",
                "type": "text",
                "required": False
            }
        ],
        "risk_signals": [
            "customer_impact",
            "audit_required"
        ],
        "runtime_mock": None,
        "instruction": "You are \"page_selection_decision_agent\".\nResponsibility: The model must judge which page candidate best matches the user's intent and decide whether optional analysis is required.\nInputs you receive: page_candidates, chat_query, customer_behavior_classification.\nOutputs you must produce: selected_page_id, additional_analysis_required, selected_analysis_method, additional_info_request.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 후보 중 자동이체 설정 이탈 분석에 가장 맞는 페이지를 선택하고 추가 분석 여부를 판단해줘.",
        "model": "gemini-2.5-flash",
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    },
    "mod-user-flow-analysis": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-user_flow_analysis_mock_adapter",
            "name": "user_flow_analysis_mock_adapter",
            "component_source": "mcp"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
        ],
        "inputs": [
            {
                "name": "scenario_design_purpose",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_target",
                "type": "text",
                "required": True
            },
            {
                "name": "business_domain",
                "type": "string",
                "required": True
            },
            {
                "name": "page_id",
                "type": "string",
                "required": True
            },
            {
                "name": "additional_required_information",
                "type": "text",
                "required": False
            }
        ],
        "outputs": [
            {
                "name": "analysis_result",
                "type": "object",
                "required": True
            },
            {
                "name": "recommended_page_id",
                "type": "string",
                "required": True
            }
        ],
        "risk_signals": [
            "financial_data",
            "audit_required"
        ],
        "runtime_mock": {
            "synthetic": True,
            "source": "agent-factory-mock-lab",
            "analysis_result": {
                "method": "user_flow_analysis",
                "page_id": "svc-savings-auto-transfer-setup",
                "summary": "자동이체 금액 입력 이후 인증 진입 전 단계에서 synthetic 이탈이 높습니다.",
                "findings": [
                    {
                        "step": "amount_input",
                        "signal": "hesitation",
                        "synthetic_dropoff_rate": 0.31
                    },
                    {
                        "step": "auth_entry",
                        "signal": "retry",
                        "synthetic_dropoff_rate": 0.18
                    }
                ]
            },
            "recommended_page_id": "svc-savings-auto-transfer-setup"
        },
        "instruction": None,
        "model": None,
        "access_protocol": "mcp",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool_name": "analyze_user_flow",
        "connection_status": "mcp_connected"
    },
    "mod-behavior-scenario-analysis": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-behavior_scenario_recommendation_mock_adapter",
            "name": "behavior_scenario_recommendation_mock_adapter",
            "component_source": "mcp"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
        ],
        "inputs": [
            {
                "name": "scenario_design_purpose",
                "type": "text",
                "required": True
            },
            {
                "name": "scenario_target",
                "type": "text",
                "required": True
            },
            {
                "name": "business_domain",
                "type": "string",
                "required": True
            },
            {
                "name": "page_id",
                "type": "string",
                "required": True
            },
            {
                "name": "additional_required_information",
                "type": "text",
                "required": False
            }
        ],
        "outputs": [
            {
                "name": "analysis_result",
                "type": "object",
                "required": True
            },
            {
                "name": "scenario_recommendations",
                "type": "array<object>",
                "required": True
            },
            {
                "name": "recommended_page_id",
                "type": "string",
                "required": True
            }
        ],
        "risk_signals": [
            "customer_impact",
            "audit_required"
        ],
        "runtime_mock": {
            "synthetic": True,
            "source": "agent-factory-mock-lab",
            "analysis_result": {
                "method": "behavior_scenario_recommendation",
                "behavior_path": {
                    "large": "가입/전환",
                    "medium": "자동이체",
                    "small": "설정 이탈"
                },
                "summary": "자동이체 설정 이탈 사용자를 복귀시키는 synthetic scenario 후보를 추천합니다."
            },
            "scenario_recommendations": [
                {
                    "scenario_id": "auto_transfer_setup_recovery",
                    "title": "자동이체 설정 복귀 유도",
                    "trigger": "amount_input_abandonment",
                    "expected_page_id": "svc-savings-auto-transfer-setup"
                }
            ],
            "recommended_page_id": "svc-savings-auto-transfer-setup"
        },
        "instruction": None,
        "model": None,
        "access_protocol": "mcp",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool_name": "recommend_behavior_scenarios",
        "connection_status": "mcp_connected"
    },
    "mod-t2s-page-customer-analysis": {
        "module_category": "adapter",
        "catalog_binding": {
            "catalog_id": "seed-adapter-page_customer_sql_analysis_mock_adapter",
            "name": "page_customer_sql_analysis_mock_adapter",
            "component_source": "mcp"
        },
        "developer_todos": [
            "Review the catalog runtime contract and configure its runtime binding before invocation.",
            "Map reviewed inputs and outputs before wiring runtime behavior."
        ],
        "inputs": [
            {
                "name": "sql_text",
                "type": "text",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "analysis_result",
                "type": "object",
                "required": True
            },
            {
                "name": "recommended_page_id",
                "type": "string",
                "required": True
            },
            {
                "name": "query_summary",
                "type": "object",
                "required": True
            }
        ],
        "risk_signals": [
            "financial_data",
            "customer_impact",
            "audit_required"
        ],
        "runtime_mock": {
            "synthetic": True,
            "source": "agent-factory-mock-lab",
            "analysis_result": {
                "method": "text_to_sql_analysis",
                "summary": "synthetic SQL aggregation에서 자동이체 설정 페이지의 재방문 대비 완료율이 낮게 나타납니다.",
                "metrics": [
                    {
                        "name": "synthetic_visits",
                        "value": 1280
                    },
                    {
                        "name": "synthetic_completion_rate",
                        "value": 0.42
                    }
                ]
            },
            "recommended_page_id": "svc-savings-auto-transfer-setup",
            "query_summary": {
                "readonly": True,
                "tables": [
                    "synthetic_page_events"
                ],
                "row_count": 3,
                "sql_hash": "synthetic-sql-hash-001"
            }
        },
        "instruction": None,
        "model": None,
        "access_protocol": "mcp",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool_name": "execute_page_customer_sql",
        "connection_status": "mcp_connected"
    },
    "mod-workflow2-handoff-agent": {
        "module_category": "agent",
        "catalog_binding": None,
        "developer_todos": [
            "Implement this module in TODO_IMPLEMENT_HERE after the design is approved.",
            "Map reviewed inputs, validate outputs, and keep business credentials out of generated code."
        ],
        "inputs": [
            {
                "name": "selected_page_id",
                "type": "string",
                "required": True
            },
            {
                "name": "analysis_result",
                "type": "object",
                "required": False
            },
            {
                "name": "customer_behavior_classification",
                "type": "object",
                "required": True
            }
        ],
        "outputs": [
            {
                "name": "workflow2_handoff",
                "type": "object",
                "required": True
            },
            {
                "name": "selected_page_id",
                "type": "string",
                "required": True
            }
        ],
        "risk_signals": [
            "customer_impact",
            "audit_required"
        ],
        "runtime_mock": None,
        "instruction": "You are \"workflow2_page_handoff_agent\".\nResponsibility: The final step must reconcile the initial page choice and optional analysis result into the page id passed to workflow2.\nInputs you receive: selected_page_id, analysis_result, customer_behavior_classification.\nOutputs you must produce: workflow2_handoff, selected_page_id.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 선택 page_id와 분석 결과를 workflow2 입력으로 만들어줘.",
        "model": "gemini-2.5-flash",
        "access_protocol": None,
        "mcp_server": None,
        "mcp_tool_name": None,
        "connection_status": "n/a"
    }
}

# Shared secrets live in <repo>/.agent-factory/runtime.env, or in the file
# pointed to by AF_RUNTIME_ENV_FILE. agents.config.yaml stays per-bundle and
# contains behavior overrides only.
_BUNDLE_DIR = Path(__file__).resolve().parent.parent
_CONFIG_PATH = _BUNDLE_DIR / "agents.config.yaml"
_DEFAULT_RUNTIME_ENV_RELATIVE_PATH = ".agent-factory/runtime.env"


def _parse_runtime_env(source: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in source.lstrip("\ufeff").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key.replace("_", "A").isalnum() or key[0].isdigit():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] == '"':
            value = (
                value[1:-1]
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t")
                .replace('\\"', '"')
                .replace("\\\\", "\\")
            )
        elif len(value) >= 2 and value[0] == value[-1] == "'":
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        values[key] = value
    return values


def _central_runtime_env_path() -> Path:
    configured = os.environ.get("AF_RUNTIME_ENV_FILE")
    if configured:
        path = Path(configured).expanduser()
        return path if path.is_absolute() else (Path.cwd() / path).resolve()
    for root in (_BUNDLE_DIR, *_BUNDLE_DIR.parents):
        candidate = root / _DEFAULT_RUNTIME_ENV_RELATIVE_PATH
        if candidate.exists():
            return candidate
    return _BUNDLE_DIR / _DEFAULT_RUNTIME_ENV_RELATIVE_PATH


def _load_central_runtime_env() -> None:
    path = _central_runtime_env_path()
    if not path.exists():
        return
    for key, value in _parse_runtime_env(path.read_text(encoding="utf-8")).items():
        os.environ[key] = value


_load_central_runtime_env()


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
    base = os.environ.get("AF_MOCK_LAB_MCP_URL", "http://127.0.0.1:5173/api/mock-lab/mcp").rstrip("/")
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


async def _fn_mod_page_selection_workflow(ctx: Context) -> dict:
    """TODO_IMPLEMENT_HERE: page_selection_analysis_workflow — deterministic workflow coordinator placeholder.

    Returns reviewed synthetic test-double output only; no real business logic.
    """
    contract = COMPONENT_CONTRACTS["mod-page-selection-workflow"]
    payload = {
        "module_id": "mod-page-selection-workflow",
        "module_name": "page_selection_analysis_workflow",
        "connection_status": "coordinator",
        "status": "runtime_mock_smoke" if contract.get("runtime_mock") is not None else "todo_implementation_required",
        "runtime_mock": contract.get("runtime_mock"),
        "developer_todos": contract.get("developer_todos", []),
    }
    ctx.state["mod_page_selection_workflow_output"] = payload
    return payload

async def _fn_mod_page_rag_retrieval(ctx: Context) -> dict:
    """Calls the live Mock Lab MCP tool "search_page_candidates" (synthetic Mock Lab only).

    Deterministic adapter: opens an MCP session and calls the named tool directly
    so a real tools/call happens (verifiable in audit), instead of relying on a
    model to choose the tool.
    """
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url("mod-page-rag-retrieval", "page-analysis-mcp")
    arguments = _collect_tool_inputs(
        ctx, "mod-page-rag-retrieval", [
    "query",
    "scenario_design_purpose",
    "scenario_target_business_domain",
    "customer_behavior_classification"
], [
    "query",
    "scenario_design_purpose",
    "scenario_target_business_domain",
    "customer_behavior_classification"
]
    )
    async with streamablehttp_client(url) as (read_stream, write_stream, _close):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool("search_page_candidates", arguments=arguments)
    content = getattr(tool_result, "content", None) or []
    payload = {
        "module_id": "mod-page-rag-retrieval",
        "module_name": "page_candidate_rag_mock_adapter",
        "connection_status": "mcp_connected",
        "status": "mcp_tool_called",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool": "search_page_candidates",
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    ctx.state["mod_page_rag_retrieval_output"] = payload
    return payload

async def _fn_mod_user_flow_analysis(ctx: Context) -> dict:
    """Calls the live Mock Lab MCP tool "analyze_user_flow" (synthetic Mock Lab only).

    Deterministic adapter: opens an MCP session and calls the named tool directly
    so a real tools/call happens (verifiable in audit), instead of relying on a
    model to choose the tool.
    """
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url("mod-user-flow-analysis", "page-analysis-mcp")
    arguments = _collect_tool_inputs(
        ctx, "mod-user-flow-analysis", [
    "scenario_design_purpose",
    "scenario_target",
    "business_domain",
    "page_id",
    "additional_required_information"
], [
    "scenario_design_purpose",
    "scenario_target",
    "business_domain",
    "page_id"
]
    )
    async with streamablehttp_client(url) as (read_stream, write_stream, _close):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool("analyze_user_flow", arguments=arguments)
    content = getattr(tool_result, "content", None) or []
    payload = {
        "module_id": "mod-user-flow-analysis",
        "module_name": "user_flow_analysis_mock_adapter",
        "connection_status": "mcp_connected",
        "status": "mcp_tool_called",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool": "analyze_user_flow",
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    ctx.state["mod_user_flow_analysis_output"] = payload
    return payload

async def _fn_mod_behavior_scenario_analysis(ctx: Context) -> dict:
    """Calls the live Mock Lab MCP tool "recommend_behavior_scenarios" (synthetic Mock Lab only).

    Deterministic adapter: opens an MCP session and calls the named tool directly
    so a real tools/call happens (verifiable in audit), instead of relying on a
    model to choose the tool.
    """
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url("mod-behavior-scenario-analysis", "page-analysis-mcp")
    arguments = _collect_tool_inputs(
        ctx, "mod-behavior-scenario-analysis", [
    "scenario_design_purpose",
    "scenario_target",
    "business_domain",
    "page_id",
    "additional_required_information"
], [
    "scenario_design_purpose",
    "scenario_target",
    "business_domain",
    "page_id"
]
    )
    async with streamablehttp_client(url) as (read_stream, write_stream, _close):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool("recommend_behavior_scenarios", arguments=arguments)
    content = getattr(tool_result, "content", None) or []
    payload = {
        "module_id": "mod-behavior-scenario-analysis",
        "module_name": "behavior_scenario_recommendation_mock_adapter",
        "connection_status": "mcp_connected",
        "status": "mcp_tool_called",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool": "recommend_behavior_scenarios",
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    ctx.state["mod_behavior_scenario_analysis_output"] = payload
    return payload

async def _fn_mod_t2s_page_customer_analysis(ctx: Context) -> dict:
    """Calls the live Mock Lab MCP tool "execute_page_customer_sql" (synthetic Mock Lab only).

    Deterministic adapter: opens an MCP session and calls the named tool directly
    so a real tools/call happens (verifiable in audit), instead of relying on a
    model to choose the tool.
    """
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    url = _mcp_url("mod-t2s-page-customer-analysis", "page-analysis-mcp")
    arguments = _collect_tool_inputs(
        ctx, "mod-t2s-page-customer-analysis", [
    "sql_text"
], [
    "sql_text"
]
    )
    async with streamablehttp_client(url) as (read_stream, write_stream, _close):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.call_tool("execute_page_customer_sql", arguments=arguments)
    content = getattr(tool_result, "content", None) or []
    payload = {
        "module_id": "mod-t2s-page-customer-analysis",
        "module_name": "page_customer_sql_analysis_mock_adapter",
        "connection_status": "mcp_connected",
        "status": "mcp_tool_called",
        "mcp_server": "page-analysis-mcp",
        "mcp_tool": "execute_page_customer_sql",
        "result": [getattr(part, "text", str(part)) for part in content],
    }
    ctx.state["mod_t2s_page_customer_analysis_output"] = payload
    return payload


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

node_mod_page_selection_workflow = FunctionNode(func=_fn_mod_page_selection_workflow, name="mod_page_selection_workflow")

agent_mod_behavior_classifier = LlmAgent(
    name="mod_behavior_classifier",
    model=_model_for("mod-behavior-classifier", "gemini-2.5-flash"),
    instruction=_agent_cfg("mod-behavior-classifier", "instruction", "You are \"customer_behavior_type_classifier_agent\".\nResponsibility: The classification requires interpreting user intent and mapping it to known 대/중/소 behavior categories, which is an Agent reasoning responsibility.\nInputs you receive: scenario_design_purpose, scenario_target_business_domain.\nOutputs you must produce: customer_behavior_classification.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 자동이체 설정 전환율 개선 시나리오의 고객 행동 유형을 분류해줘."),
    description="customer_behavior_type_classifier_agent",
    output_key="mod_behavior_classifier_output",
    mode="single_turn",
)

node_mod_page_rag_retrieval = FunctionNode(func=_fn_mod_page_rag_retrieval, name="mod_page_rag_retrieval")

agent_mod_page_decision_agent = LlmAgent(
    name="mod_page_decision_agent",
    model=_model_for("mod-page-decision-agent", "gemini-2.5-flash"),
    instruction=_agent_cfg("mod-page-decision-agent", "instruction", "You are \"page_selection_decision_agent\".\nResponsibility: The model must judge which page candidate best matches the user's intent and decide whether optional analysis is required.\nInputs you receive: page_candidates, chat_query, customer_behavior_classification.\nOutputs you must produce: selected_page_id, additional_analysis_required, selected_analysis_method, additional_info_request.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 후보 중 자동이체 설정 이탈 분석에 가장 맞는 페이지를 선택하고 추가 분석 여부를 판단해줘."),
    description="page_selection_decision_agent",
    output_key="mod_page_decision_agent_output",
    mode="single_turn",
)

node_mod_user_flow_analysis = FunctionNode(func=_fn_mod_user_flow_analysis, name="mod_user_flow_analysis")

node_mod_behavior_scenario_analysis = FunctionNode(func=_fn_mod_behavior_scenario_analysis, name="mod_behavior_scenario_analysis")

node_mod_t2s_page_customer_analysis = FunctionNode(func=_fn_mod_t2s_page_customer_analysis, name="mod_t2s_page_customer_analysis")

agent_mod_workflow2_handoff_agent = LlmAgent(
    name="mod_workflow2_handoff_agent",
    model=_model_for("mod-workflow2-handoff-agent", "gemini-2.5-flash"),
    instruction=_agent_cfg("mod-workflow2-handoff-agent", "instruction", "You are \"workflow2_page_handoff_agent\".\nResponsibility: The final step must reconcile the initial page choice and optional analysis result into the page id passed to workflow2.\nInputs you receive: selected_page_id, analysis_result, customer_behavior_classification.\nOutputs you must produce: workflow2_handoff, selected_page_id.\nOperate only on the synthetic inputs provided in session state. Never invent private data, real endpoints, or credentials.\nExample user message: 선택 page_id와 분석 결과를 workflow2 입력으로 만들어줘."),
    description="workflow2_page_handoff_agent",
    output_key="mod_workflow2_handoff_agent_output",
    mode="single_turn",
)

join_1 = JoinNode(name="join_1")
join_2 = JoinNode(name="join_2")


root_agent = Workflow(
    name="req_page_selection_analysis_smoke_adk",
    description="Runnable ADK 2.1 workflow generated from reviewed Agent Factory artifacts for Synthetic page selection and analysis workflow.",
    edges=[
        (agent_mod_page_decision_agent, join_1),
        (node_mod_user_flow_analysis, join_1),
        (node_mod_behavior_scenario_analysis, join_1),
        (node_mod_t2s_page_customer_analysis, join_1),
        (join_1, agent_mod_workflow2_handoff_agent),
        (agent_mod_page_decision_agent, join_2),
        (START, join_2),
        (join_2, node_mod_t2s_page_customer_analysis),
        (START, node_mod_page_selection_workflow),
        (node_mod_page_selection_workflow, agent_mod_behavior_classifier),
        (agent_mod_behavior_classifier, node_mod_page_rag_retrieval),
        (node_mod_page_rag_retrieval, agent_mod_page_decision_agent),
        (agent_mod_page_decision_agent, node_mod_user_flow_analysis),
        (agent_mod_page_decision_agent, node_mod_behavior_scenario_analysis),
    ],
)
