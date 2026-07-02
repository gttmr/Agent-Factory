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
      /yield RequestInput\(message="추가 분석을 수행할까요\? run_analysis 또는 skip_analysis 중 하나로 답하세요\.", payload=node_input, response_schema=str\)/
    );
    assert.match(source, /"previous": node_input/);
    assert.match(source, /"response": _hitl_response/);
    assert.match(source, /node_confirm = FunctionNode\(func=_hitl_confirm, name="confirm", rerun_on_resume=True\)/);
    assert.match(source, /def _route_analysis_router\(node_input=None\):/);
    assert.match(source, /for key in \("response", "choice", "value"\):/);
    assert.match(source, /text = _route_decision_text\(node_input\)/);
    assert.match(source, /if any\(alias and alias in text for alias in \["run_analysis", "run analysis", "담당자 승인"\]\):/);
    assert.match(source, /if any\(alias and alias in text for alias in \["skip_analysis", "skip analysis", "분석 생략"\]\):/);
    assert.match(source, /Event\(route="run_analysis", output=node_input\)/);
    assert.match(source, /return Event\(route="skip_analysis", output=node_input\)/);
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
    assert.match(source, /yield RequestInput\(message="추가 분석을 수행할까요\? run_analysis 또는 skip_analysis 중 하나로 답하세요\.\\n선택지: run_analysis, skip_analysis\\n기본값: skip_analysis\\nalias: run_analysis=1\/분석 실행; skip_analysis=2\/분석 없이 진행", payload=node_input\)/);
    assert.doesNotMatch(source, /RequestInput\([^)]*response_schema=str/s);
    assert.match(source, /for key in \("response", "choice", "value"\):/);
    assert.match(source, /return str\(value\)\.strip\(\)\.lower\(\)/);
    assert.match(source, /if any\(alias and alias in text for alias in \["run_analysis", "run analysis", "1", "분석 실행"\]\):/);
    assert.match(source, /if any\(alias and alias in text for alias in \["skip_analysis", "skip analysis", "2", "분석 없이 진행"\]\):/);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
