# Spec-Driven Execution

Convert a requirement into artifacts in this order:

1. Evidence summary
2. Incremental shared-context summary
3. Boundary classification
4. Commonization notes
5. Implementation handoff
6. Optional scaffold-plan and implementation-handoff artifacts

Do not start by writing application code. First make the boundary, reuse, workflow, and A2A decisions explicit.

## Evidence

Capture:

- goal
- candidate agent name
- owner or domain hints
- input contract
- output contract
- parent context
- candidate shared dependencies
- missing information

Keep evidence factual. Put guesses in `assumptions` or `todo`.
