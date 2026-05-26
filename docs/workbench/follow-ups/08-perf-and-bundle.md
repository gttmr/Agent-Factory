# 08 — Bundle & runtime perf 정리

## 왜 필요한가

PR6 후 가장 큰 청크는 `DesignWorkbench-*.js` (275 kB) 와 `index-*.js` (267 kB). DesignWorkbench 가 큰 이유는 ReactFlow 전체와 graph 의 nodeTypes/edgeTypes/containerOverlay 를 한 번에 import 하기 때문. 페이지 첫 로드 시 약 540 kB 가 즉시 다운로드된다.

초기 로딩 시간이 사용자 협업 흐름 (개발자 ↔ 업무 담당자) 에 직접 영향을 주므로 분리할 가치가 있다.

## 현재 상태

- `react-router-dom` 의 `lazy()` 로 각 route 가 분리 청크에 들어감 — 이미 PR2 에 포함.
- `ReactFlow` + 의존 자산은 `GraphCanvas.tsx` 가 import 하고, `DesignWorkbench` 와 `LegacyWizard`(PR6 에서 제거됨) 가 사용했다. 현재 사용처는 DesignWorkbench 하나.
- 청크 분할 메트릭 (`packages/web/` 에서 `npm run build` 결과):
  - `DesignWorkbench-*.js` 275 kB
  - `index-*.js` 267 kB
  - `BuildWorkbench-*.js` 74 kB (catalog seed 포함 추정)
  - `LandingPage-*.js` 5 kB
  - 기타 stage 5–10 kB
- `seed-*.js` (63 kB) 는 catalog 의 yaml 인라인 데이터를 import — Build/Reuse Hub 가 함께 의존. 1.5–2 MB 의 catalog yaml 을 동기 import 하는 구조.

## 작업 정의 (Done means)

1. DesignWorkbench 초기 청크가 300 kB 이하 (gzip 95 kB 이하) 로 떨어진다.
   - ReactFlow / GraphCanvas 를 dynamic import 로 분리.
   - 또는 GraphCanvas 자체에 lazy boundary 도입.
2. catalog seed 가 BuildWorkbench/ReuseHub 진입 직전에만 로드된다.
3. 다른 stage 진입 시간이 측정 가능하게 lighthouse audit 결과 기록 (또는 vite build 결과 `--mode production --analyse` 옵션 활용).
4. 정량 결과를 `docs/workbench/follow-ups/_perf-notes.md` (신규 가능) 에 남긴다.

## 파일 / 디렉터리

- 수정
  - `packages/web/src/routes/router.tsx` — 이미 lazy 적용. 추가로 child-level lazy 필요 시 새 컴포넌트 분리.
  - `packages/web/src/routes/DesignWorkbench.tsx` — `GraphCanvas` 와 `Inspector` 의 import 를 `React.lazy` 로 감싸고 `<Suspense fallback={...}>` 로 둘러쌈.
  - `packages/web/src/routes/BuildWorkbench.tsx` — `loadSeedCatalog()` 호출을 `useQuery` queryFn 으로 옮겨 (이미 그렇긴 함) chunk 분리. seed yaml import 가 BuildWorkbench 진입 시점에만 발생하는지 확인.
- 신규
  - `packages/web/src/routes/_perf-notes.md` 같은 메모는 필요 없음. 결과는 `docs/workbench/follow-ups/_perf-notes.md` 한 곳에만.

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
