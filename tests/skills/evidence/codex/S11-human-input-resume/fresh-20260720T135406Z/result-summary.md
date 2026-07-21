# Result summary

- Verdict: **FAIL**
- Expected primary Skill: `af-scaffold-runtime`
- Actual routing: `af-workflow` then `af-scaffold-runtime`
- Artifact boundary: PASS
- Deterministic commands: PASS (9/9)
- Full hidden rubric: FAIL

The complete approved fixture now generates and basic pause/resume behavior works, improving on the 2026-07-18 historical blocked run. Completion is still not supportable because the generated ADK path loses the approved stable interrupt ID, does not implement timeout/abandoned policy, leaves the side-effect Tool as a TODO separate from the added idempotency API, skips required pattern references, and does not route directly to the explicit Work Skill.

No forbidden approval mutation, private data, credential value, unsupported UI claim, retired field, or out-of-bound write was observed.
