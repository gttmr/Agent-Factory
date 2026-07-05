---
name: feedback-generator-extensible-structure
description: generate-adk-source.mjs must be structured for extensibility — a large dynamic-workflow rewrite is coming
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6ef56522-fa2c-43be-9642-50cc4046a2a6
---

When modifying `scripts/generate-adk-source.mjs` (the ADK source generator), structure the lowering code to be **robust against change and additive feature growth** — prefer an edge-kind/node-kind **dispatch table** over scattered if/switch branches, separating: graph resolve/validate, per-edge data-passing strategy, per-node declaration emit, and text assembly.

**Why:** Right after the per-edge data-passing work (Phase 1 internal + Phase 2 A2A), the user plans a **large-scale generator rewrite for dynamic workflows**. Each new construct (route, remote_a2a, loop, dynamic) should plug in as "one handler added," not an invasive edit.

**How to apply:** Do a behavior-preserving structure pass first (PR-0) and prove it with diff-0 on all `templates/regression-scenarios/*` generated output before layering new lowering on top. Keep abstraction proportionate to the requested extension points (no speculative framework). Relates to [[feedback-codex-usage]] (delegate the bulk refactor to codex, verify/integrate yourself).
