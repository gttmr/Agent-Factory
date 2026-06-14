# Follow-up 08 perf notes

측정일: 2026-05-27 KST

명령:

```bash
cd packages/web
npm run build
```

결과:

| chunk | size | gzip |
|---|---:|---:|
| `DesignWorkbench-*.js` | 48.83 kB | 13.40 kB |
| `GraphCanvas-*.js` | 261.38 kB | 87.27 kB |
| `index-*.js` | 269.04 kB | 85.47 kB |
| `BuildWorkbench-*.js` | 75.14 kB | 24.28 kB |
| `AnalyzeWorkbench-*.js` | 13.95 kB | 5.28 kB |
| `VerifyWorkbench-*.js` | 6.83 kB | 2.77 kB |
| `LandingPage-*.js` | 5.04 kB | 2.20 kB |

판단:

- DesignWorkbench 초기 JS chunk 는 목표치인 300 kB / gzip 95 kB 이하를 충족한다.
- ReactFlow 를 포함한 GraphCanvas 는 별도 child chunk 로 분리됐다.
- BuildWorkbench는 `/api/catalog` hydrated catalog index를 사용한다. `loadSeedCatalog` 정적 import가 route chunk에 다시 포함되지 않는지 확인한다.
- Lighthouse 는 이번 검증에서 별도로 실행하지 않았다. 이 브리프의 정량 기록은 Vite production build artifact 기준으로 남긴다.
