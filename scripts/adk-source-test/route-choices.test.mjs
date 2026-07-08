import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { channelModules, generator, writeChannelFixture } from "./fixtures.mjs";

test("runnable lowers a user-confirmation route without joining branch convergence", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "초기_선택_Agent" },
    { ...unconnectedAdapter, id: "mod-analysis", name: "분석_실행_Adapter" },
    { ...unconnectedAdapter, id: "mod-final", name: "최종_선택_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-route-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        {
          id: "confirm",
          node_kind: "human_input",
          module_id: null,
          label: "Legacy HITL label",
          human_input_contract: {
            message: "추가 분석을 수행할까요? run_analysis 또는 skip_analysis 중 하나로 답하세요.",
            payload_schema_ref: null,
            response_schema_ref: "str",
            response_mapping: null
          }
        },
        { id: "analysis-router", node_kind: "router", module_id: null, label: "분석 실행 여부 route" },
        { id: "analysis", node_kind: "adapter", module_id: "mod-analysis" },
        { id: "final", node_kind: "adapter", module_id: "mod-final" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "confirm" },
        { from: "confirm", to: "analysis-router" },
        {
          from: "analysis-router",
          to: "analysis",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "choice == run_analysis",
          route_aliases: ["담당자 승인", "run analysis"],
          is_default_route: false
        },
        {
          from: "analysis-router",
          to: "final",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "choice == skip_analysis",
          route_aliases: ["분석 생략"],
          is_default_route: true
        },
        { from: "analysis", to: "final" },
        { from: "final", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    const sampleInputs = readFileSync(join(outputRoot, "req_ch_adk", "sample_inputs.yaml"), "utf8");
    assert.match(source, /from google\.adk\.events import Event, RequestInput/);
    assert.match(source, /def _hitl_confirm\(ctx: Context, node_input=None\):/);
    assert.match(source, /_hitl_response = _first_resume_input\(ctx\)/);
    assert.match(
      source,
      /yield RequestInput\(message="추가 분석을 수행할까요\? run_analysis 또는 skip_analysis 중 하나로 답하세요\.", payload=_json_safe_node_value\(node_input\), response_schema=str\)/
    );
    assert.doesNotMatch(source, /"previous": node_input/);
    assert.match(source, /"response": _hitl_response/);
    assert.match(source, /node_confirm = FunctionNode\(func=_hitl_confirm, name="confirm", rerun_on_resume=True\)/);
    assert.match(source, /def _route_analysis_router\(ctx: Context, node_input=None\):/);
    assert.match(source, /for key in \("route_decision", "route_type", "action", "route", "decision", "choice", "value", "response"\):/);
    assert.match(source, /text = _route_decision_text\(node_input\)/);
    assert.match(source, /if _route_text_matches\(text, \["run_analysis", "run analysis", "run-analysis", "담당자 승인"\]\):/);
    assert.match(source, /if _route_text_matches\(text, \["skip_analysis", "skip analysis", "skip-analysis", "분석 생략"\]\):/);
    assert.match(source, /Event\(route="run_analysis", output=_json_safe_node_value\(node_input\)\)/);
    assert.match(source, /return Event\(route="skip_analysis", output=_json_safe_node_value\(node_input\)\)/);
    assert.doesNotMatch(source, /"분석 실행"/);
    assert.doesNotMatch(source, /"분석 없이 진행"/);
    assert.match(source, /\(node_analysis_router,\s*\{\s*"run_analysis": node_mod_analysis,\s*"skip_analysis": node_mod_final,\s*\}\s*\)/s);
    assert.doesNotMatch(source, /join_1 = JoinNode\(name="join_1"\)/);
    assert.match(sampleInputs, /workflow_chat_smoke:/);
    assert.match(sampleInputs, /conversation:/);
    assert.match(sampleInputs, /추가 분석을 수행할까요\? run_analysis 또는 skip_analysis 중 하나로 답하세요\./);
    assert.doesNotMatch(sampleInputs, /"1"/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable leaves numeric route-choice input untyped so ADK Web accepts number replies", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "초기_선택_Agent" },
    { ...unconnectedAdapter, id: "mod-analysis", name: "분석_실행_Adapter" },
    { ...unconnectedAdapter, id: "mod-final", name: "최종_선택_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-route-numeric-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "a", node_kind: "agent", module_id: "mod-a" },
        {
          id: "confirm",
          node_kind: "human_input",
          module_id: null,
          label: "분석 실행 여부 확인",
          human_input_contract: {
            message: "추가 분석을 수행할까요? run_analysis 또는 skip_analysis 중 하나로 답하세요.",
            payload_schema_ref: null,
            response_schema_ref: "str",
            response_mapping: null,
            choice_options: ["run_analysis", "skip_analysis"],
            accepted_aliases: {
              run_analysis: ["1", "분석 실행"],
              skip_analysis: ["2", "분석 없이 진행"]
            },
            default_choice: "skip_analysis"
          }
        },
        { id: "analysis-router", node_kind: "router", module_id: null, label: "분석 실행 여부 route" },
        { id: "analysis", node_kind: "adapter", module_id: "mod-analysis" },
        { id: "final", node_kind: "adapter", module_id: "mod-final" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "a" },
        { from: "a", to: "confirm" },
        { from: "confirm", to: "analysis-router" },
        {
          from: "analysis-router",
          to: "analysis",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "choice == run_analysis",
          route_aliases: ["1", "분석 실행"],
          is_default_route: false
        },
        {
          from: "analysis-router",
          to: "final",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "choice == skip_analysis",
          route_aliases: ["2", "분석 없이 진행"],
          is_default_route: true
        },
        { from: "analysis", to: "final" },
        { from: "final", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /def _hitl_confirm\(ctx: Context, node_input=None\):/);
    assert.match(source, /yield RequestInput\(message="추가 분석을 수행할까요\? run_analysis 또는 skip_analysis 중 하나로 답하세요\.\\n선택지: run_analysis, skip_analysis\\n기본값: skip_analysis\\nalias: run_analysis=1\/분석 실행; skip_analysis=2\/분석 없이 진행", payload=_json_safe_node_value\(node_input\)\)/);
    assert.doesNotMatch(source, /RequestInput\([^)]*response_schema=str/s);
    assert.match(source, /for key in \("route_decision", "route_type", "action", "route", "decision", "choice", "value", "response"\):/);
    assert.match(source, /return str\(value\)\.strip\(\)\.lower\(\)/);
    assert.match(source, /if _route_text_matches\(text, \["run_analysis", "run analysis", "run-analysis", "1", "분석 실행"\]\):/);
    assert.match(source, /if _route_text_matches\(text, \["skip_analysis", "skip analysis", "skip-analysis", "2", "분석 없이 진행"\]\):/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("runnable lowers state-key route edges as ADK session-state ownership checks", () => {
  const { agentBase, unconnectedAdapter } = channelModules();
  const modules = [
    { ...unconnectedAdapter, id: "mod-registry", name: "Registry_Adapter" },
    { ...agentBase, id: "mod-super", name: "Super_Agent" },
    { ...unconnectedAdapter, id: "mod-task", name: "Task_State_Adapter" }
  ];
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-state-route-"));
  try {
    writeChannelFixture(artifactRoot, {
      modules,
      nodes: [
        { id: "in1", node_kind: "input" },
        { id: "registry", node_kind: "adapter", module_id: "mod-registry" },
        { id: "owner-route", node_kind: "router", module_id: null, label: "active owner route" },
        { id: "super", node_kind: "agent", module_id: "mod-super" },
        { id: "task", node_kind: "adapter", module_id: "mod-task" },
        { id: "out1", node_kind: "output" }
      ],
      edges: [
        { from: "in1", to: "registry" },
        { from: "registry", to: "owner-route" },
        {
          from: "owner-route",
          to: "task",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "session_state.active_a2a_task is active",
          route_aliases: ["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_WORKING"],
          state_key: "active_a2a_task",
          is_default_route: false
        },
        {
          from: "owner-route",
          to: "super",
          edge_kind: "route",
          execution_semantics: "conditional",
          route_condition: "session_state.active_a2a_task missing_or_complete",
          route_aliases: ["super_agent_turn"],
          is_default_route: true
        },
        { from: "task", to: "out1" },
        { from: "super", to: "out1" }
      ]
    });
    const outputRoot = join(artifactRoot, "out");
    execFileSync(process.execPath, [generator, artifactRoot, outputRoot], { stdio: "pipe" });
    const source = readFileSync(join(outputRoot, "req_ch_adk", "agent.py"), "utf8");
    assert.match(source, /def _route_owner_route\(ctx: Context, node_input=None\):/);
    assert.match(source, /def _route_state_text\(ctx: Context, state_key: str\) -> str:/);
    assert.match(source, /ctx\.state\.get\(state_key\)/);
    assert.match(source, /_state_text_session_state_active_a2a_task_is_active = _route_state_text\(ctx, "active_a2a_task"\)/);
    assert.match(source, /if _route_state_matches\(_state_text_session_state_active_a2a_task_is_active, \["session_state_active_a2a_task_is_active", "session state active a2a task is active", "session-state.active-a2a-task-is-active", "task_state_input_required", "task_state_working"\]\):/);
    assert.match(source, /return Event\(route="session_state_active_a2a_task_is_active", output=_json_safe_node_value\(_route_output_value\(ctx, node_input, "active_a2a_task"\)\)\)/);
    assert.match(source, /\(node_owner_route,\s*\{\s*"session_state_active_a2a_task_is_active": node_mod_task,\s*"session_state_active_a2a_task_missing_or_complete": agent_mod_super,\s*\}\s*\)/s);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
