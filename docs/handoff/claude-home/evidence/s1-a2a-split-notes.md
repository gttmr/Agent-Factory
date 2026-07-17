# Campaign 3 Phase S - A2A panel split notes

> Main-session postscript (2026-07-17): the `test:analyzer` README-hash failure recorded below was the pre-existing env-dependent SHA-256 baseline defect fixed by PR #72; after rebasing this branch onto post-#72 main, the full analyzer suite passed 132/132. Landed as PR #73. Browser smoke (Design 검토 Remote A2A tab, scenario-i fixture) was done by the main session.

## Scope and baseline

- Branch/worktree: `codex/a2a-panel-split` in `/home/ilmaswsl/work/af-wt-s1`.
- Requested scope: behavior-preserving split of `packages/web/src/design/A2AContractPanel.tsx`; no commit and no dev server.
- Initial panel size: 810 lines.
- Pre-existing untracked paths left untouched: `.agent-factory/runtime`, `artifacts`, `packages/mock-lab/node_modules`, `packages/web/node_modules`.
- Read `packages/web/src/design/AGENTS.md`, the UI design-system notes in `CLAUDE.md`, and `docs/visualization/design-system.md` before source edits.
- Public import/export path, prop contract, Korean copy, CSS classes, and the existing `a2aContractValidator.ts` boundary must remain unchanged.
- Documentation impact: none expected because this is an internal module split with no behavior, taxonomy, schema, contract, copy, CSS, or workflow change.

## Progress

- [x] Confirmed branch and clean relevant source baseline.
- [x] Read local instructions and sibling view/model precedent.
- [x] Mapped panel consumers, state/derivation logic, and view subsections.
- [x] Preserved `A2AContractPanel.tsx` as the stable three-export facade.
- [x] Extracted pure model logic and focused sidebar/inspector/editor section modules.
- [x] Added `A2AContractPanelModel.test.ts` and wired it into the explicit `test:analyzer` chain.
- [x] Confirmed all split source files are below 400 lines (largest: `A2AContractEditorFields.tsx`, 308 lines).
- [x] Early typecheck initially found one test fixture cast incompatibility; corrected it with the established `unknown` bridge.
- [x] Mechanical parity check confirmed all 220 runtime/UI/CSS literals from the original panel are preserved across the split files.
- [x] Confirmed the stable facade still exports `buildA2AReviewRows`, `A2AContractSidebar`, and `A2AContractInspector` to all existing consumers.
- [x] Run requested verification and record results.

## Verification

- `cd packages/web && npx tsc --noEmit`: PASS (exit 0).
- Focused `A2AContractPanelModel.test.ts`: PASS (exit 0).
- `cd packages/web && npm run test:analyzer`: FAIL (exit 1) in the unchanged final generator test area. All preceding scripts, including the new model test and existing `a2aContractValidator.test.ts`, passed. The final Node suite reported 130/131 passing; only `PR-A keeps canonical smoke and static runnable bundles byte-identical` failed because generated `README.md` and `req_gen_test_adk/README.md` hashes differ from the committed manifest. No `scripts/**` or generator snapshot path is changed by this slice, so no out-of-scope snapshot repair was attempted.
- `cd packages/web && npm run build -- --configLoader runner`: PASS (exit 0; 693 modules transformed).
- Runtime/UI/CSS literal multiset comparison against `HEAD:A2AContractPanel.tsx`: PASS (220 literals preserved).
- File-size check: PASS (all extracted source files below 400 lines; maximum 308).
- `git diff --check`: PASS (exit 0); extracted files also have no trailing whitespace.

## Review

- Consumer-facing import path and three public exports remain stable.
- No Korean copy, CSS class, stylesheet, category rendering, validator behavior, or save/revert contract was changed.
- No docs or decision-log update is needed for this internal behavior-preserving module split.
- No dev server or browser was started; browser screenshot smoke remains for the main session as requested.
