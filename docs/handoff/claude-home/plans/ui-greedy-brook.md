# Graph IR canvas polish + left-panel selection inspector

## Context

On the Design (`설계`) review step (`/af/:reqId/design`), the Graph IR canvas and its
left sidebar have three rough edges the user wants fixed:

1. **Join node off-center** — the `join_analysis_result` dot does not sit where its
   edges connect. Root cause: the join node box is `56×56` (`JOIN_SIZE`), React Flow
   anchors edges to handles at the box's vertical mid-line (`y=28`), but the visible
   `22×22` dot is centered as part of a `place-items:center` grid that *also* stacks a
   label below it (`margin-bottom` on the dot). The label pushes the dot's center
   *above* the mid-line, so edges arrive below the circle. The box is also far wider
   than the dot, so edges anchor ~17px to the side of the dot.
2. **Input/Output labels overflow + verbose** — `PillNode` renders an `INPUT`/`OUTPUT`
   eyebrow **plus** the variable name inside a fixed `140×56` box with no clipping, so a
   long variable name (`scenario_target_business_domain`) wraps and spills below the
   pill border. The user wants the eyebrow text removed (variable name only) and the
   text kept inside the block.
3. **Left panel ignores selection** — the left sidebar (`모듈 / Graph IR / Runtime 계약
   / Remote A2A / 경로 / Comments` tabs) never shows the currently selected node/edge.
   Selection state already flows canvas↔sidebar; only the *display* is missing. The
   user wants selected node/edge details at the **top** of the left panel, with the
   existing tabs/content moved **below** it.

All four artifacts already exist; this is a surgical UI/CSS change plus one reused
component. The right-pane inspector (`INSPECTOR_ENABLED=false`) is **not** touched.

Work happens in a **new branch + new git worktree**, merged back when verified.

## Files to change

All under `packages/web/`:

- `src/graph/layout.ts` — node sizing (`nodeSize`, ~L66-75).
- `src/graph/nodeTypes.tsx` — `PillNode` (~L163-178), `JoinNode` (~L129-144).
- `src/styles/features/graph.css` — `.graph-node-join*` (~L274-293), `.graph-node-pill`
  (~L308-318).
- `src/routes/DesignWorkbench.tsx` — sidebar markup (~L383-477) + selection derivation.
- `src/styles/router/design.css` — new `.af-design-sidebar-selection` wrapper + scoped
  override of the reused `.graph-inspector` card.
- Reused as-is: `src/components/GraphInspector.tsx` (rich node/edge detail — already
  built, currently only mounted inside `GraphCanvas` and suppressed by `hideInspector`).

Docs (lockstep, required by repo rules):
- `docs/visualization/design-system.md` — update the "화면 골격" 2-pane note (~L24) and
  the "Graph Inspector" section (~L206-209) to say the selected node/edge inspector now
  renders at the top of the **left** sidebar during Design review; note input/output
  pills show the variable name only and the join dot is centered on its handles.
- `CLAUDE.md` — the `/af/:reqId/design` bullet that describes the "2-pane … right
  Inspector parked" layout: add that the left sidebar now surfaces selected node/edge
  detail at its top.

## Change detail

### 1. Join node centered on its edges (`layout.ts`, `nodeTypes.tsx`, `graph.css`)
- `layout.ts nodeSize`: split `join` out of the shared `JOIN_SIZE` branch. `loop_control`
  keeps `56×56`; `join` gets a small box that hugs the dot (≈`30×30`) so the left/right
  handles sit at the dot's perimeter. Add a `JOIN_BOX` constant next to `JOIN_SIZE`.
- `graph.css .graph-node-join`: add `position: relative`; keep `display:grid;
  place-items:center` with the **dot as the only flow child** → dot center = box center =
  handle height (vertical fix).
- `.graph-node-join-dot`: remove `margin-bottom`.
- `.graph-node-join-label`: position absolutely below the box
  (`position:absolute; top:100%; left:50%; transform:translateX(-50%);
  text-align:center; max-width:140px; margin-top:3px`) so it no longer shifts the dot.
  `nodeTypes.tsx JoinNode` markup stays as-is (CSS-only).

### 2. Input/Output pills — variable name only, fits in the block
- `nodeTypes.tsx PillNode`: delete the `<span className="graph-node-eyebrow">{kind}</span>`
  line; keep only `.graph-node-label`. (in/out stay distinguishable by the existing
  `--cat-input`/`--cat-output` colors + lane position.)
- `layout.ts`: bump input/output box from `140×56` to give the centered name room
  (start `148×64`; tune in verification against `scenario_target_business_domain`).
- `graph.css .graph-node-pill`: tighten padding (`var(--space-xs) var(--space-sm)`),
  add `overflow:hidden` as a safety net; center the label. Verify the longest sample
  name renders fully inside the box; raise height a step if it still clips.

### 3. Left-panel selection inspector (`DesignWorkbench.tsx`, `design.css`)
- In `DesignWorkbench`, derive `selectedNode / selectedEdge / selectedCandidate /
  nodeLabel` from the existing `selection` + `graphIR` + `analysis.moduleCandidates`
  (mirror the logic already in `GraphCanvas.tsx:110-138`, via `useMemo`).
- Render `<GraphInspector>` at the **top** of `<aside className="af-design-sidebar">`,
  above `<nav className="af-design-tabs">`, **only when a node or edge is selected**
  (no empty card when nothing is selected). Wrap it in
  `<div className="af-design-sidebar-selection">`. Wire:
  `onClose={() => setSelection({ nodeId:null, edgeId:null })}`,
  `a2aContracts={a2aContracts}`,
  `onNavigateToA2AContracts={() => setActiveTab("a2a")}`.
- Existing tabs + `af-design-sidebar-body` stay unchanged, now rendered below the
  selection block (satisfies "기존 내용은 하단으로").
- `design.css`: add `.af-design-sidebar-selection` (bottom divider, scrollable,
  `max-height` so it never crowds the tabs) and scope-override the reused card —
  `.af-design-sidebar-selection .graph-inspector { position:static; border:0;
  padding:0 0 12px; max-height:none; }` — so it sits flush in the narrow sidebar
  instead of as a sticky right-rail card.
- `GraphCanvas` keeps `hideInspector` (its internal inspector stays off — no duplicate).
  No new selection plumbing needed; `selection`/`setSelection` already shared.

## Execution workflow (per user request)

1. **Worktree**: `EnterWorktree` on a new branch (e.g.
   `feat/graph-canvas-selection-inspector`) off the current branch HEAD.
2. **Test data**: the `req-page-selection-analysis-smoke` artifact root is *untracked*,
   so it won't exist in the fresh worktree. Re-seed it there for verification using the
   CLAUDE.md smoke pattern (`POST /api/af` then `PUT …/analysis-result.json` with the
   existing root's `analysis-result.json` as the body — it has the join + multiple
   input/output nodes needed to exercise all three fixes). Remove the seeded root before
   finishing.
3. **Implement**: delegate the edits to a `frontend-dev` subagent (`model: opus`) with
   the file/line detail above, or implement directly — kept surgical, Korean UI copy
   preserved.
4. **Codex review**: run the `/code-review` (codex) skill on the diff; address findings,
   iterate until clean. (Re-run freely after any "session limit" message — that is this
   agent's own cap, not Codex's.)
5. **Merge**: confirm a clean merge back to the working branch, then `ExitWorktree`.

## Verification

- `cd packages/web && npm run build` (`tsc --noEmit && vite build`) — required, must pass.
- Dev server on the fixed port: `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`
  (check `lsof -iTCP:5173 -sTCP:LISTEN` first). Confirm `curl -I http://127.0.0.1:5173/`.
- chrome-devtools MCP screenshots to `/tmp/af-screens/`, on
  `/af/<smoke-id>/design` review step:
  - **Join**: dot sits exactly where its fan-in/fan-out edges meet (vertical + lateral).
  - **Input/Output**: only the variable name shows; longest name
    (`scenario_target_business_domain`) stays inside the pill border.
  - **Left panel**: clicking a node shows its detail (kind/module/lane/risk…) at the top
    of the sidebar; clicking an edge shows edge detail; tabs remain below; `닫기` clears it.
  - Check console for errors; confirm no regression to the canvas/tabs.
- Run `node scripts/validate-artifacts.mjs` from repo root (no artifact-shape change
  expected; sanity only).
- Delete the seeded smoke artifact root.
