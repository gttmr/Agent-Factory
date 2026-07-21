# Web Styles

## Scope

This directory implements the workbench design system: tokens, base rules,
primitives, Agent/Workflow/Tool category visuals, protocol visuals, feature CSS,
and route CSS.

Asset terminology is canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md).

## Structure

- `index.css`: import order and cascade-layer wiring only.
- `tokens.css`: color, type, spacing, radius, z-index, motion, category, and protocol tokens.
- `base.css`: element defaults.
- `primitives.css`: shared `.ui-*` surfaces.
- `category.css`: three asset-category visuals and separate MCP/A2A protocol badges paired with `CategoryBadge.tsx`.
- `features/*`: component-specific blocks, including Graph rendering.
- `router/*`: route and shell CSS.

## Local Rules

- Preserve cascade-layer order: `tokens`, `base`, `primitives`, `components`, `features`, `router`, `utilities`.
- Add new tokens in `tokens.css`; avoid route-local color or type literals.
- Keep category visuals limited to Agent, Workflow, and Tool and aligned with `CategoryBadge.tsx`.
- Style MCP and A2A as protocol badges or boundary states, never as asset categories.
- Keep `parallel` and `loop` region styling aligned with Graph render components.
- Broad descendant selectors can break badges. Prefer direct-child selectors for tables and lists.

## Anti-Patterns

- Do not add retired category selectors or alias them to Target categories.
- Do not create one-off page palettes outside the token system.
- Do not use CSS specificity fights where layer placement solves the conflict.
- Do not reintroduce marketing-style hero or card layouts into the operational workbench.

## Verification

```bash
cd packages/web
npm run build
```

CSS changes require screenshot checks on the affected route and at narrow/mobile widths when layout is touched.
