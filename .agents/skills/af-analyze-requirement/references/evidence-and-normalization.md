# Evidence And Normalization

Extract evidence before classification.

## Normalize Requirement

Capture:

- stable requirement id
- raw text
- requester team and role when available
- business goal
- current process steps
- inputs and outputs
- systems mentioned
- risk signals
- contradictions
- missing information
- status

Keep unknowns explicit. Do not fill private endpoints, credentials, customer data, or deployment details.

## Evidence Summary

Separate:

- `requested_goal`
- `business_domain_hint`
- `user_role`
- `input_data`
- `output_data`
- `systems_mentioned`
- `decisions_implied`
- `risk_signals`
- `missing_information`
- `contradictions`
- `assumptions`

Requirement-level `evidence.missing_information` is a soft gate; assumptions must remain visible.

## Source Discipline

Use only user-supplied text, cited files, current catalog facts, and direct inspection. Do not present inferred facts as verified.

## Verification

Use a JSON parse check while drafting:

```bash
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' <analysis-result-path>
```

## Grounding

- `packages/web/src/analyzer/types.ts`
- `schemas/analysis-result.schema.json`
- `schemas/normalized-requirement.schema.json`
