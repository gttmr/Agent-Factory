import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


def test_agent_source_declares_runnable_workflow():
    source = (ROOT / "req_page_selection_analysis_smoke_adk" / "agent.py").read_text(encoding="utf-8")
    assert "from google.adk.workflow import" in source
    assert "from google.adk.agents import LlmAgent" in source
    assert "root_agent = Workflow(" in source
    assert "SyntheticRuntimeSmokeAgent" not in source
    assert 'mode="single_turn"' in source


def test_manifest_declares_runnable_mode():
    manifest = (ROOT / "req_page_selection_analysis_smoke_adk" / "workflow_manifest.json").read_text(encoding="utf-8")
    assert '"output_mode": "runnable"' in manifest
    assert '"raw_requirement_to_code": false' in manifest
    assert '"private_data_or_endpoints": false' in manifest
    assert '"runtime"' in manifest


def test_runtime_chat_smoke_contract_is_present():
    smoke = (ROOT / "runtime-chat-smoke.json").read_text(encoding="utf-8")
    assert '"appName": "req_page_selection_analysis_smoke_adk"' in smoke
    assert '"port": 8765' in smoke


@pytest.mark.skipif(importlib.util.find_spec("google.adk") is None, reason="google-adk not installed")
def test_root_agent_is_a_workflow():
    from google.adk.workflow import Workflow

    module = importlib.import_module("req_page_selection_analysis_smoke_adk.agent")
    assert isinstance(module.root_agent, Workflow)
