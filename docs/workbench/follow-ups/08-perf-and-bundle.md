# 08 — Bundle & runtime perf 정리

상태: 완료. Route-level `React.lazy`와 route/style split에 더해 GraphCanvas child-level lazy boundary 를 적용했고, 최신 Vite build 정량 결과를 `_perf-notes.md`에 기록했다.

## 왜 필요한가

PR6 후 가장 큰 청크는 `DesignWorkbench-*.js` (275 kB) 와 `index-*.js` (267 kB). DesignWorkbench 가 큰 이유는 ReactFlow 전체와 graph 의 nodeTypes/edgeTypes/containerOverlay 를 한 번에 import 하기 때문. 페이지 첫 로드 시 약 540 kB 가 즉시 다운로드된다.

초기 로딩 시간이 사용자 협업 흐름 (개발자 ↔ 업무 담당자) 에 직접 영향을 주므로 분리할 가치가 있다.

## 현재 상태

- `react-router-dom` 의 `lazy()` 로 각 route 가 분리 청크에 들어감 — 이미 PR2 에 포함.
- `ReactFlow` + 의존 자산은 `GraphCanvas.tsx` 가 import 하고, `DesignWorkbench` 와 `LegacyWizard`(PR6 에서 제거됨) 가 사용했다. 현재 사용처는 DesignWorkbench 하나.
- 청크 분할 메트릭 (2026-05-27 `packages/web/` 에서 `npm run build` 결과):
  - `DesignWorkbench-*.js` 48.83 kB / gzip 13.40 kB
  - `GraphCanvas-*.js` 261.38 kB / gzip 87.27 kB
  - `index-*.js` 269.04 kB / gzip 85.47 kB
  - `BuildWorkbench-*.js` 75.14 kB / gzip 24.28 kB
  - `AnalyzeWorkbench-*.js` 13.95 kB / gzip 5.28 kB
  - `VerifyWorkbench-*.js` 6.83 kB / gzip 2.77 kB
- catalog seed는 BuildWorkbench에서 `useQuery`로 읽지만 `loadSeedCatalog` import 자체는 BuildWorkbench chunk에 남아 있다. Reuse Hub는 `/api/catalog` 경로를 사용한다.

## 구현 결과

1. DesignWorkbench 초기 청크가 48.83 kB / gzip 13.40 kB 로 떨어졌다.
2. ReactFlow / GraphCanvas 는 별도 `GraphCanvas-*.js` child chunk 로 분리됐다.
3. catalog seed 는 BuildWorkbench route chunk 진입 시점에만 포함되고 Reuse Hub 는 `/api/catalog` 를 사용한다.
4. Vite build 정량 결과를 `docs/workbench/follow-ups/_perf-notes.md` 에 남겼다.

## 파일 / 디렉터리

- 수정
  - `packages/web/src/routes/DesignWorkbench.tsx` — `GraphCanvas` import 를 `React.lazy` 로 감싸고 `<Suspense fallback={...}>` 로 둘러쌈.
  - `packages/web/src/styles/router/design.css` — GraphCanvas lazy fallback style.
- 신규
  - `docs/workbench/follow-ups/_perf-notes.md`.

## 측정 방법

```bash
cd packages/web
npm run build
ls -lh dist/assets/*.js
```

`vite-bundle-visualizer` 같은 도구를 사용해도 좋다 (devDependency 추가 OK 면).

MCP lighthouse:
1. dev 서버 띄움.
2. chrome-devtools MCP 의 `lighthouse_audit` → 카테고리 = performance.
3. 결과 점수와 LCP / TBT / TTI 를 메모.

## Out of scope

- 의존성 (ReactFlow, dagre 등) 자체를 다른 라이브러리로 교체 — 별도 결정.
- 서버 측 최적화 (SSR 등) — 워크벤치는 local-first 라 SSR 불필요.

## 위험 / 메모

- React.lazy + Suspense 는 hooks 의 stale-closure 문제를 일으킬 수 있다. selection / collaboration / catalog 같은 cross-cutting state 가 react-query 로 잘 격리돼 있어서 영향은 적음.
- 너무 잘게 쪼개면 navigation 시 spinner 가 자주 보여 UX 가 손상.
- Lighthouse 측정은 brower extension / MCP 환경에 따라 점수가 흔들린다. 같은 환경에서 before/after 만 비교.
