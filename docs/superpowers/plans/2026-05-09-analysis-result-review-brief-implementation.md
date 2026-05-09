# Analysis Result Review Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `분석 결과` page into a review-start screen that asks whether the analyzer understood the requirement before sending the user to module review.

**Architecture:** Keep the behavior inside the existing React wizard. `AnalysisResult.tsx` will derive compact display rows from the current `AnalysisResult` shape, and `styles.css` will provide the review-brief layout and evidence drawer. No schema, analyzer, or state-machine behavior changes are required.

**Tech Stack:** React, TypeScript, existing Vite app, existing CSS design tokens.

---

## File Structure

- Modify `packages/web/src/components/AnalysisResult.tsx`
  - Replace the evidence-grid/report layout with a `분석 이해 확인` review brief.
  - Show five core contract rows: `목표`, `도메인`, `입력`, `출력`, `시스템`.
  - Move assumptions, missing information, contradictions, risk signals, and JSON into low-priority `<details>` evidence sections.
  - Keep `다시 분석` and `모듈 검토로 이동`; remove missing-information checkboxes from the main path.
- Modify `packages/web/src/styles.css`
  - Add review-brief layout classes.
  - Preserve existing classes used by other screens.
  - Keep responsive behavior for desktop and mobile.

## Task 1: Replace Analysis Result Content Model

**Files:**
- Modify: `packages/web/src/components/AnalysisResult.tsx`

- [ ] **Step 1: Replace the current evidence-grid JSX with a review brief**

Use the existing props and keep `onToggleAcceptedMissing` in the prop contract for now, because `App.tsx` still passes it and the state hook owns that action. Do not call it in the new UI.

The component must render:

```tsx
<section className="panel analysis-brief">
  <div className="analysis-brief-hero">
    <div>
      <p className="eyebrow">이해 확인</p>
      <h2>분석 이해 확인</h2>
      <p className="analysis-brief-copy">
        아래 계약이 요구사항과 맞으면 모듈 검토로 이동합니다. 위험 신호와 가정은 보조 근거에서 확인할 수 있습니다.
      </p>
    </div>
    <div className="analysis-brief-actions">
      <button type="button" onClick={onRerun}>다시 분석</button>
      <button type="button" className="primary" onClick={onContinue}>모듈 검토로 이동</button>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add compact status metrics**

Compute these values inside the component:

```ts
const remoteA2ACount = analysis.moduleCandidates.filter((candidate) => candidate.module_category === "remote_a2a").length;
const metrics = [
  { label: "후보 모듈", value: `${analysis.moduleCandidates.length}개` },
  { label: "Remote A2A", value: `${remoteA2ACount}개` },
  { label: "누락 정보", value: `${evidence.missing_information.length}개` }
];
```

Render them as quiet supporting numbers, not warning banners.

- [ ] **Step 3: Add five core contract rows**

Render these rows in order:

```ts
const contractRows = [
  {
    label: "목표",
    values: [evidence.requested_goal, normalizedRequirement.business_goal],
    source: "요청 목표 + 정규화 목표"
  },
  {
    label: "도메인",
    values: [normalizedRequirement.domain, evidence.business_domain_hint],
    source: "정규화 도메인 + 분석 힌트"
  },
  {
    label: "입력",
    values: [...evidence.input_data, ...normalizedRequirement.inputs.map((field) => field.name)],
    source: "입력 데이터"
  },
  {
    label: "출력",
    values: [...evidence.output_data, ...normalizedRequirement.outputs.map((field) => field.name)],
    source: "출력 데이터"
  },
  {
    label: "시스템",
    values: [...evidence.systems_mentioned, ...normalizedRequirement.systems.map((system) => system.name)],
    source: "언급 시스템"
  }
];
```

Deduplicate and format values before rendering. Show at most three visible values and a `+N` overflow chip.

- [ ] **Step 4: Add evidence drawer sections**

Render five `<details>` sections in this exact order:

1. `가정`
2. `누락 정보`
3. `모순`
4. `위험 신호`
5. `정규화 JSON`

`정규화 JSON` must be closed by default and placed last. All sections should display a count in the summary.

- [ ] **Step 5: Keep helper functions small and local**

Use local helpers:

```ts
function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean).map(formatDisplayValue)));
}

function previewValues(values: string[], limit = 3) {
  const formatted = uniqueValues(values);
  return { visible: formatted.slice(0, limit), overflow: Math.max(formatted.length - limit, 0), total: formatted.length };
}
```

## Task 2: Add Review Brief Styles

**Files:**
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Add layout classes near the existing AnalysisResult styles**

Add styles for:

```css
.analysis-brief
.analysis-brief-hero
.analysis-brief-copy
.analysis-brief-actions
.analysis-brief-metrics
.analysis-brief-metric
.contract-list
.contract-row
.contract-label
.contract-values
.contract-source
.value-chip
.value-overflow
.evidence-drawer
.evidence-detail
.evidence-detail summary
.evidence-detail-body
```

- [ ] **Step 2: Add responsive rules**

At `max-width: 900px`, stack the hero and contract rows. At `max-width: 640px`, make action buttons and metrics full-width-friendly without text overflow.

## Task 3: Verify And Commit

**Files:**
- Modified files from tasks 1 and 2.

- [ ] **Step 1: Run build**

Run:

```bash
cd packages/web
npm run build
```

Expected: TypeScript and Vite build pass. Existing Vite chunk-size warning is acceptable.

- [ ] **Step 2: Browser smoke**

Run the dev server reachable from WSL/Windows:

```bash
cd packages/web
npm run dev -- --host 0.0.0.0
```

Open the reported Vite URL and verify the `분석 이해 확인` screen shows the five contract rows, evidence drawer, and closed JSON section.

- [ ] **Step 3: Commit UI implementation**

Run:

```bash
git add packages/web/src/components/AnalysisResult.tsx packages/web/src/styles.css docs/superpowers/plans/2026-05-09-analysis-result-review-brief-implementation.md
git commit -m "Refine analysis result review brief"
```

The branch should then contain the existing docs/runtime contract commit, the design spec commit, the implementation plan, and the UI implementation commit, ready for one PR.
