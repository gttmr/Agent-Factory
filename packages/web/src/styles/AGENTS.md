# Web Styles

## Scope

This directory is the workbench design system implementation: tokens, base
rules, primitives, category visuals, feature CSS, and route CSS.

Target asset terminology is canonical in [Taxonomy](../../../../docs/workbench/taxonomy.md); category tokens and selectors currently mirror Current Implementation (`legacy`) `agent`/`workflow`/`adapter`/`remote_a2a` enums.

## Structure

- `index.css`: only import order and cascade layer wiring.
- `tokens.css`: color, type, spacing, radius, z-index, and motion tokens.
- `base.css`: element defaults.
- `primitives.css`: shared `.ui-*` surfaces and legacy aliases.
- `category.css`: category/subtype visual rules paired with `CategoryBadge.tsx`.
- `features/*`: component-specific blocks.
- `router/*`: route and shell CSS.

## Local Rules

- Preserve cascade layer order: `tokens`, `base`, `primitives`, `components`, `features`, `router`, `utilities`.
- Add new tokens in `tokens.css`; avoid route-local color/type literals.
- Current Implementation (`legacy`) category visuals must stay aligned with `CategoryBadge.tsx` and analyzer enums.
- Red category styling is for the `legacy` Remote A2A category; use status tokens for errors.
- Broad descendant selectors can break badges. Prefer direct-child selectors for tables/lists.

## Anti-Patterns

- Do not create one-off page palettes outside the token system.
- Do not use CSS specificity fights where layer placement solves the conflict.
- Do not reintroduce marketing-style hero/card layouts into the operational workbench.

## Verification

```bash
cd packages/web
npm run build
```

CSS changes require screenshot checks on the affected route and narrow/mobile widths when layout is touched.
