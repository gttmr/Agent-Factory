# Skill Rewrite Notes

## Decisions

- Wrote the full replacement tree under `skills-staging/` because the Codex sandbox protects `.agents/` from modification in this worktree.
- Kept the four triggerable skill directory names and `SKILL.md` filenames unchanged for the eventual move into `.agents/skills/`.
- Kept frontmatter minimal with only `name` and `description`.
- Replaced the monolithic ADK note with ADK 2.3 topic references grounded in the evidence pack, repo generator/validator code, and installed venv source.
- Made Stage Runner proposed-first mode the primary Analyze/Design path and standalone canonical mode the secondary path.
- Made Build teach `POST /api/af/:reqId/artifact-sync/run` as the primary Workbench path and direct `scripts/generate-adk-source.mjs` as the manual lower-level path after synced artifacts exist.
- Removed `a2a-contracts.json` from standard artifact lists. Embedded `analysis-result.json.a2aContracts[]` is canonical.
- Kept approval/status writes out of skills. Skills report readiness; human review endpoints own `manifest.approvals.*` and projected stage statuses.
- Preserved existing `agents/openai.yaml` metadata unchanged in staging so the coordinator can move a complete tree into place.

## Deviations From Gap-Analysis Section 3

- `skills-staging/` is the actual write target instead of `.agents/skills/`; this follows the coordinator workaround for sandbox-protected `.agents/`.
- Did not create `af-build-runtime-stub/references/feature-topic-router.md`. The build `SKILL.md` uses separate conditional numbered steps for each ADK topic reference, preserving the one-reference-per-step rule without an extra file.
- Did not create a separate analyze reference for split artifacts. Stage Runner Analyze now writes only proposed `analysis-result.json`; split artifacts are derived by artifact sync, so the content is covered by `stage-runner-analyze-output.md` and `analysis-result-shape.md`.
- Did not include deployment, publish, or observability lifecycle content from google-agents-cli skills.
- Did not include freehand ADK coding instructions; ADK topic files are for generator-output review and Graph IR mapping only.

## Deletions

Remove these old files when staging is moved into `.agents/skills/`:

- `.agents/skills/_shared/adk-2.md`
- `.agents/skills/_shared/agent-factory-dlc.md`
- `.agents/skills/_shared/artifact-contracts.md`
- `.agents/skills/_shared/boundary-rules.md`
- `.agents/skills/_shared/runtime-support-rules.md`
- `.agents/skills/af-analyze-requirement/references/analysis-artifacts.md`
- `.agents/skills/af-design-boundaries/references/design-review.md`
- `.agents/skills/af-build-runtime-stub/references/runtime-stub.md`
- `.agents/skills/af-verify-feedback/references/verification-feedback.md`

## Left Unverified

- I did not run a live ADK human-input resume scenario. The human-input reference states current generator behavior and installed symbol signatures only.
- I did not run a live Remote A2A request. The Remote A2A reference is grounded in current generator/validator behavior and installed `RemoteA2aAgent`/config signatures.
- I did not move staging into `.agents/skills/`; the coordinator will do that outside this sandbox.
