# Result summary

- Overall fresh-session verdict: **FAIL**
- Product/runtime sub-verdict for AFV2-031: **PASS**
- Expected primary Skill: `af-scaffold-runtime`
- Actual routing: `af-workflow` then `af-scaffold-runtime`
- Artifact boundary: repository source and approvals unchanged; one transient probe escaped the scenario output root
- Deterministic evaluator: PASS, 11/11
- Installed ADK 2.3 runtime: PASS

The original AFV2-031 runtime defects are no longer reproduced. Generated code preserves the approved stable interrupt ID, per-invocation pending/completed record, 60-second expiry policy, restart replay, conflicting-response rejection, and a session-state at-most-once ledger around the synthetic Tool side effect.

The full behavior run remains failed for AFV2-014/Skill discipline reasons: explicit scaffold routing still consults `af-workflow`, a transient probe was written outside the output root, and complete mandatory-reference loading was not independently retained. These are separated from the now-passing Human Input runtime contract and do not reopen AFV2-031.

No approval mutation, private data, credential value, production endpoint, unsupported UI claim, retired field, or source-fixture mutation was observed.
