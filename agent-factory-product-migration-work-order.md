# Agent Factory 잔여 작업 인수인계 지시서 (Product Target-Contract 마이그레이션 외)

> **대상 저장소**: `https://github.com/gttmr/Agent-Factory` · 기준 브랜치 `main`
> **작성 시점**: 2026-07-19, commit `0cdcb82` 직후
> **전제**: 이전 대화 기억이 전혀 없는 새 세션. 강력한 모델이 진행하므로 이 문서는 세부 구현을 지시하지 않는다 — **확정된 것/알게 된 것/집중할 것**을 넘기고, 설계 판단은 새 세션이 한다.
> **이 문서 자체의 위상**: 사용자 소유 작업지시서(미추적 파일). 저장소 규칙 문서가 아니다.
>
> **2026-07-19 최신화 주의**: 아래 1~6절은 strict cutover 결정 전의 역사적 인수인계 스냅샷이다. 특히 Compatibility Layer·legacy shim 유지 지시는 더 이상 실행 기준이 아니다. 현재 작업은 기존 artifact를 저장소 밖에 백업한 뒤 Target Contract v2만 읽고 쓰도록 전환했으며, 이후 세션은 **7절과 활성 canonical 문서·migration status**를 최신 기준으로 사용한다.

---

# 1. 지금까지 landed된 것 (재작업 금지)

origin/main 4커밋. 각 커밋 메시지에 상세 요약이 있다.

| Commit | 내용 |
|---|---|
| `0ee7784` | **docs vNext** — Agent/Workflow/Tool 택소노미 정본 3문서(taxonomy/graph-ir/operating-model), source-backed Handbook(stage 8·register 20·L3 51), 구 문서 archive 스냅샷, `docs/migration/taxonomy-vnext-status.md`(legacy→Target 매핑 17종, gap 8영역) |
| `b3911fd` | **skills vNext** — `af-workflow`+4 work skill, `_shared` 20파일(ADK 패턴 카드 9종), legacy shim 4개, `scripts/validate-skills.mjs`, 시나리오 S01–S16 fixture, forward test 증거 |
| `a4f55a0` | **코드 수정 3건** — 생성기 route-수렴 병합 lowering(회귀 scenario-l 포함), Stage Runner canonical skill ID 이행, Design 필수 proposal 완전성 강제 |
| `0cdcb82` | 커밋 후 문서 재동기화 + 시나리오 forward 전수 증거 |

**확정되어 재논의하지 않는 것**: Agent/Workflow/Tool 3자산 택소노미, Invocation Control=Workflow|Agent, Binding/Transport 분리, Domain Scope/Owner/`reuse_status` 분리, 5-스킬 구조, 전략 B shim. 근거와 정의는 전부 저장소 문서에 있다.

# 2. 시작 절차 (새 세션 최초 30분)

저장소 문서가 자기 기술적이다. 이 순서로 읽으면 외부 기억 없이 현재 상태를 복원할 수 있다:

1. `STATUS.md` → `docs/README.md` (읽기 경로 안내)
2. `docs/migration/taxonomy-vnext-status.md` — **문서↔코드 gap의 단일 원장** (gap 8영역 + 매핑표가 이번 마이그레이션의 요구사항 명세다)
3. `docs/migration/skill-vnext-status.md` — 스킬 계층 상태, **Blocker 목록(§4)**, shim 제거 기준(§8), 시나리오 결과(§6)
4. `docs/workbench/taxonomy.md`·`graph-ir.md`의 **Current Implementation 대응표** — legacy enum ↔ Target 해석의 정본
5. `docs/handbook/index.md` → 작업할 영역의 stage 문서 (L3 locator는 사용 전 실제 소스로 재검증 — Handbook 자체 규칙)
6. `.agents/skills/AGENTS.md` + `_shared/compatibility-current-schema.md` — 스킬이 현행 직렬화를 어떻게 출력하는지
7. `tests/skills/evidence/research/` — 조사 원장 4건 (특히 `r1-adk-package-check.md`: 설치 ADK 2.3.0 실제 signature와 **미존재 API 목록**)
8. Git 안전 확인: 워크트리에 **사용자 소유 미커밋 변경**이 남아 있다(§4 참조). reset/checkout/clean 금지.

# 3. 이번 캠페인에서 얻은 비자명한 지식 (문서에 없거나 흩어져 있는 것)

## 3.1 아키텍처 판단의 핵심 원리
- **Compatibility Layer 철학**: 스킬은 Target으로 "판단"하고 현행 artifact에는 legacy로 "직렬화"한다. 이것은 임시 타협이 아니라 문서화된 계층이다. Product 마이그레이션이 끝나야 이 계층이 얇아진다. 매핑 불가 사례를 억지 enum으로 채우지 않고 Blocker로 기록하는 규율이 전체 체계의 정직성을 지탱한다.
- **legacy enum은 4중+α로 중복 정의**되어 있다: `packages/web/src/analyzer/types.ts` / `schemas/*.json` / `scripts/artifact-validation/constants.mjs` / `scripts/adk-source/dispatch/*`(registry key) + `catalog/*.yaml`(파일명 `adapters.yaml` 포함) + UI 라벨 + `templates/` fixture. **한 표면만 바꾸면 validator agreement 테스트들이 갈라진 상태를 잡아낸다** — 이것이 위험이자 안전망이다.
- **Stage Runner의 스킬 호출은 평문**이다: `stageRunner.ts`가 프롬프트에 `Read ${skillPath} and execute the ${stage} stage`를 넣을 뿐, 스킬 로더가 없다. proposal은 `validateAnalysisResult`(legacy 스키마)를 통과해야 apply 가능. SDK sandbox는 workspace-write라 기술적으로 어디든 쓸 수 있고 **지시문이 안전 계약의 일부**다(Blocker 5의 배경).
- **게이트 불변식**: `manifest.approvals.*`는 사람 토글 + `PATCH /manifest/approvals`의 projection만이 바꾼다. 생성/동기화/검증은 절대 게이트를 자동 전환하지 않는다. 마이그레이션 중에도 이 불변식을 깨면 안 된다.

## 3.2 생성기(generator)를 안전하게 바꾸는 법 (a4f55a0에서 실증)
- 순서: **RED 회귀 먼저**(`templates/regression-scenarios/scenario-*` + `scripts/adk-source-test/*.test.mjs`) → 수정 → 전체 스위트(`node scripts/generate-adk-source.test.mjs`, 현재 107+) → **byte-identity manifest 테스트**(무관 fixture는 바이트 불변이어야 함) → **generator-neutrality 스캔**(새 literal은 allowlist에 정렬·출처 주석과 함께) → 실제 승인 루트 재생성 + venv import + 생성 pytest.
- compileall은 문법만 잡는다. **import(그래프 구성)까지 가야 실런타임 결함이 보인다** — route-수렴 결함이 그렇게 발견됐다(검증 Level 3 vs 4의 차이).
- 설치 ADK와 공식 문서가 다르다. `r1-adk-package-check.md`의 "not present" 목록(예: `RemoteA2aAgent` 해당 import 경로, `to_a2a`, `ResumabilityConfig` 미확인)을 코드 방출 전 반드시 재확인.

## 3.3 오케스트레이션·도구 운용
- **codex 위임**: 기본 모델(gpt-5.6) + `--effort xhigh`. 장시간 작업은 companion을 메인 세션 **백그라운드 Bash**로 직접 실행(rescue 포워더는 10분 컷). 병렬 job은 스레드 격리로 안전하나 **파일 소유권을 서로 겹치지 않게** 분할할 것. codex 샌드박스는 `.agents/` **쓰기를 거부** — 스킬 파일은 `skills-staging/` 미러로 받아 메인 세션이 이동한다.
- **스킬 테스트 규약**: 신선 세션, 기대 정답·rubric 비누설, 경량 모델(Codex `gpt-5.6-luna --effort low`, Claude `sonnet`; effort 지정 불가 시 기본값 폴백 기록). Claude Code는 `.agents/skills`를 자동 발견하지 않으므로 위치만 알리는 부트스트랩 사용. **교훈**: fixture가 repo 안(templates/skill-scenarios/)에 있어 탐색형 에이전트가 rubric에 스스로 도달해 오염된 사례(Claude S05) 발생 — 클린 실행은 fixture 제외 worktree에서.
- **커밋 규율**: 사용자 소유 워크트리 변경이 섞여 있으므로 `git add -A` 금지, **명시적 경로 스테이징** + 스테이징 후 오염 검사(`git diff --cached --name-only | grep -E '^docs/handoff/|^docs/onboarding/|package(-lock)?\.json$|^\.evidence-reviews/|work-order'`). 커밋 시리즈 내 전방 참조는 허용했으되 커밋 메시지에 명시했다. 푸시는 사용자 지시로 수행했다 — 새 세션은 **사용자에게 커밋/푸시 의사를 확인**하고 진행하라.
- **문서 동기화는 같은 change set**: 소스가 바뀌면 Handbook locator·operating-model Current Implementation 절·원장·decision-log를 함께 갱신한다. 커밋이 생기면 Handbook의 Verified commit 표기를 재검증과 함께 올린다(이번에 두 번 수행 — 절차는 `docs/handbook/maintenance.md`).

## 3.4 사용자 소유 워크트리 상태 (건드리지 말 것)
- 삭제 상태: `docs/handoff/claude-home/**`, `docs/onboarding/**` (사용자가 의도적으로 삭제, 미커밋)
- 수정 상태: `packages/{web,mock-lab}/package.json` + lockfile (본 캠페인과 무관)
- 미추적: `.evidence-reviews/`, `.omo/`, `skills-staging/`(빈 흔적 가능), 작업지시서 2개(`agent-factory-skills-vnext-work-order.md`, 본 파일)
- gitignored 로컬 데이터: `artifacts/**`(스킬 시나리오 실행 잔여물 `artifacts/skill-scenario-runs/` 포함), `generated/**`

# 4. 남은 작업 — 우선순위와 집중 지점

## A. (대형·최우선) Target Product 스키마 마이그레이션 — 원장 Blocker 1
**목표**: schemas/analyzer/validator/generator/catalog/UI가 Target Contract(`asset_type`, `invocation_control`, `binding`+`transport`, `workflow_profile`, `domain_scope`/`owner`, `reuse_status`)를 직렬화·소비하게 하고, 스킬 Compatibility Layer를 축소한다.

**요구사항 명세는 이미 있다**: `taxonomy-vnext-status.md` §3 매핑표(17종) + §4 gap(8영역), `graph-ir.md`·`taxonomy.md`의 Current Implementation 대응표. 이것이 "무엇을"이다.

**새 세션이 설계·결정해야 할 것** (내가 결정하지 않았고, 하면 안 되는 것):
- 전환 전략: additive dual-serialization(신·구 병행 기입 후 컷오버) vs 버전드 스키마 vs 단계별 표면 교체 — 기존 로컬 artifact root들과 saved-analysis fixture 호환을 어떻게 다룰지 포함
- `catalog/adapters.yaml` 등 파일명·category 전환과 Reuse Hub publish 경로·버전 메타데이터의 이행 방식
- Graph IR 직렬화 전환 범위(node_kind 16종을 Target 8종+제어로 재편할지, legacy 호환 읽기를 언제까지 유지할지)
- UI 라벨·CategoryBadge·design-system 시각 계약 전환(스크린샷 검증 포함 — WSL 게이트 절차는 root `AGENTS.md`)
- Stage Runner proposal validator를 Target 스키마로 바꾸는 시점(스킬 Compatibility Layer 축소와 동기화 필요 — **스킬 파일도 같은 캠페인에서 갱신**해야 함: `_shared/compatibility-current-schema.md`가 얇아진다)
- 마이그레이션 완료 판정 기준과 taxonomy-vnext-status/skill-vnext-status 원장의 종결 방식

**지켜야 할 불변식**: raw→code 금지, 게이트 자동 전환 금지, catalog 직접 편집 금지, byte-identity·neutrality 테스트 계약, 합성 데이터만. **권장 진행 방식**: 영역 간 결합이 크므로 착수 전에 이 A 항목만의 상세 작업지시서(이전 두 지시서 수준)를 사용자와 함께 확정하는 것을 제안하라 — 사용자도 그 방식을 선호해 왔다.

## B. (소형·의미 결정 필요) Verify apply 게이트 — 원장 Blocker 4
실패한 Verify command 후에도 proposal apply가 가능하다(`stageRunner.ts` apply gate가 `validation.ok`를 안 봄). **결정 지점**: 실패를 기록한 validation-report의 apply는 정당한가(기록 목적) vs catalog-delta apply만 차단할까. 직전 세션의 권고는 "report 허용·delta 차단"이었으나 **사용자·새 세션이 결정**하라. 결정 후 구현은 RED→GREEN 소형 작업이다.

## C. (소형) SDK sandbox 쓰기 감지 — 원장 Blocker 5
Stage Runner run 후 `proposed-artifacts/` 밖 워크트리 변화를 diff-스캔해 경고/실패 처리하는 안전망. 설계 자유도 높음(사후 git-diff 스캔이 가장 단순). 우선순위는 A보다 낮다.

## D. (소형) 시나리오 fixture 보강
S07·S11(및 scaffold형 전반)의 context가 `approved-scaffold-plan.json` 단일 파일이라 스킬의 선행 승인 게이트에 걸려 STOP이 정답이 된다(게이트 검증으로는 유효). "프로토타입 생성"까지 검증하려면 완전한 합성 승인 artifact 세트가 필요. + fixture 격리 worktree 실행 규약을 `tests/skills/README.md`에 명문화.

## E. (판정만) Legacy shim 제거 — skill-vnext-status §8
Product 측 이행(a4f55a0)으로 조건 대부분 충족. 남은 판정: 외부 문서·자동화의 legacy 호출자 존재 확인, canonical 경로 S16 재검증, 기존 run history 호환. 제거 시 `.agents/skills/AGENTS.md`·Handbook·원장 동기화 필수.

## F. (부채 1건) Stage Runner 라벨 시각 검증
canonical 라벨 전환의 스크린샷 검증이 WSL debug endpoint 부재로 미수행(원장 Blocker 2 잔여 기록). 5173 dev server + headless Chrome 절차는 root `AGENTS.md`에 있다.

## G. (별개 백로그) Campaign 3 Phase S
GraphCanvas/GraphElementEditor 후속은 이번 캠페인과 무관한 기존 백로그다 — `docs/workbench/follow-ups/STATUS.md` 참조. 혼동하지 말 것.

# 5. 검증·완료 기준
새로 만들지 마라 — 이미 저장소가 소유한다: 문서는 `docs/workbench/validation.md`, 스킬은 `scripts/validate-skills.mjs`+`tests/skills/README.md`, artifact는 `scripts/validate-artifacts.mjs`, 코드/생성기는 §3.2의 순서, 운영 Done 기준은 `docs/workbench/operating-model.md` §10. Handbook 유지 규칙은 `docs/handbook/maintenance.md`.

# 6. 하지 말 것
1. 확정 택소노미·5-스킬 구조·전략 B 재논의
2. 사용자 소유 워크트리 변경(§3.4) reset/복원/스테이징
3. `docs/archive/**`·`docs/handoff/**`를 현재 기준으로 사용하거나 수정
4. legacy enum의 문자열 일괄 치환(각 값은 문맥 재판별 — 매핑표가 기준)
5. 게이트 자동 전환, raw→code, catalog 직접 편집, 실데이터/credential
6. 기억으로 ADK API 작성 (설치 패키지 + 공식 문서 재확인 필수)
7. 검증 없는 완료 선언 — 미검증 항목은 항목명과 이유를 명시

# 7. 2026-07-19 후속 조사·구현 지시 — ADK 2.x Workflow 정책과 잔여 결함

> **상태**: strict Target v2 전환 뒤 후속 구현 기준. 이 절은 이후 세션이 `parallel|loop`라는 이름만 보고 폐기 예정 ADK Template Workflow를 다시 도입하거나, Graph/Dynamic 선택을 암묵적으로 바꾸지 않도록 남긴다.

## 7.1 조사 결론

- ADK 2.x의 `SequentialAgent`, `ParallelAgent`, `LoopAgent` Template Workflow 계열은 deprecated이며 제거 예정 경고를 낸다. 새 생성 코드는 이 클래스를 import하거나 dispatch하지 않는다.
- ADK 2.x의 기본 실행 표면은 `google.adk.workflow.Workflow`다. 정적으로 검토 가능한 실행은 Graph Workflow의 Node·Edge·route·fan-out/fan-in·`JoinNode`로, 런타임 반복·동적 Node 선택·재귀가 핵심인 실행은 Dynamic Workflow의 `@node`와 `ctx.run_node()`로 표현한다.
- Agent Factory Graph IR의 `parallel|loop` Region은 Node membership과 검토 범위를 나타내는 구조 metadata다. ADK `ParallelAgent`·`LoopAgent` 클래스 또는 별도 Workflow subtype을 뜻하지 않으며 generator mode를 단독으로 결정하지 않는다.
- 실행 표현의 단일 결정권자는 Workflow 자산의 `workflow_profile.representation`이다.
  - `graph`: 검토된 정적 Node·Edge가 실행 구조를 소유한다. 병렬은 Graph fan-out/fan-in과 Join으로 낮춘다. routed back-edge 반복도 ADK Graph가 표현할 수 있지만 generator가 route·종료 조건을 검증하고 실행 회귀 테스트를 통과한 경우에만 낮춘다.
  - `dynamic`: 런타임 코드가 반복, Node 선택 또는 재귀 경로를 결정한다. 생성기는 `Workflow` 안의 dynamic node로 낮춘다.
  - `unresolved`: runnable 생성 금지다.
- Region 존재를 근거로 `graph`를 `dynamic`으로 조용히 덮어쓰지 않는다. 명시한 representation과 현재 lowering capability가 맞지 않으면 actionable error로 fail-closed한다.
- `workflow_profile.template_ref`는 검토된 구현 패턴·사내 template artifact를 가리키는 일반 참조다. deprecated ADK Template Workflow 클래스 선택기가 아니며, 이 이름만으로 제거하거나 runtime dispatch에 사용하지 않는다.

근거:

- 공식 ADK Workflow 안내: <https://adk.dev/agents/workflow-agents/>
- Graph Workflow: <https://adk.dev/graphs/>
- Graph routes와 routed cycle: <https://adk.dev/graphs/routes/>
- Dynamic Workflow: <https://adk.dev/graphs/dynamic/>
- 설치된 `google-adk 2.3.0`의 `sequential_agent.py`, `parallel_agent.py`, `loop_agent.py` deprecation decorator와 실제 인스턴스 생성 경고

## 7.2 구현 체크리스트

1. generator의 runnable mode 선택을 `workflow_profile.representation`과 일치시키고 `loop` Region만으로 dynamic을 강제하는 경로를 제거한다.
2. `graph` representation의 loop를 지원하지 못하는 경우 조용한 mode 변경 대신 명시적으로 거부한다. 지원할 경우 routed back-edge, exit route, terminal 도달을 실제 생성 Python 실행으로 검증한다.
3. Design 편집기의 Region 선택·membership 문구를 `병렬 실행 범위`와 `반복 실행 범위`로 표시하고, Region이 Workflow 유형이나 ADK Template Agent 선택이 아님을 설명한다. 직렬화 값 `parallel|loop`는 유지한다.
4. canonical `workflow-decision-guide.md`, `graph-ir.md`, `taxonomy.md`, visualization 문서와 decision log에 같은 경계를 반영한다.
5. 다음 독립 review 결함도 strict cutover 잔여 작업으로 함께 닫는다.
   - Stage Runner apply 직전 proposal hash·스키마 재검증으로 proposal TOCTOU 차단
   - ignored 기존 파일을 포함하도록 workspace write-set 감지 보강
   - web/root validator/generator의 duplicate Graph Node ID와 Region reference 검증 parity 확보
   - web Target validator에서 candidate·Graph `source_requirement_id` 일치 강제
   - split `a2a-contracts.json` API allowlist 제거
   - generator 문자열 검사 위주 테스트를 route·loop·channel·terminal의 생성 Python 실행 회귀로 보강

## 7.3 완료 증거

- schema·web validator·root validator·generator가 같은 Graph 불변식을 거부하는 RED/GREEN 회귀
- graph/dynamic representation별 생성 Python compile·import·실행 결과
- Stage Runner proposal 변조와 ignored-file mutation 재현 테스트
- `packages/web` analyzer test와 build, root artifact validator와 generator 전체 suite
- 고정 포트 `5173`의 실제 Design 편집기 확인 및 screenshot
- `git diff --check`, 활성 문서 상대 링크·anchor·source locator 재검증

## 7.4 2026-07-19 구현 결과와 다음 작업 경계

### 완료한 코드 작업

- generator mode 선택은 owning Workflow의 `workflow_profile.representation`만 사용한다. `parallel|loop` Region, non-owning child Workflow, deprecated Template Agent 이름은 mode 선택 근거가 아니다.
- `graph`는 지원 가능한 정적 Graph로, `dynamic`은 ADK `Workflow` 안의 dynamic node로 생성한다. `unresolved`와 현재 지원하지 않는 graph routed cycle은 자동 전환하지 않고 actionable error로 중단한다.
- generator 내부의 `loopControl*`, `loop_control`, `loop_region`, `parallel_region` 경로와 메시지를 제거했다. 생성 소스는 `SequentialAgent`, `ParallelAgent`, `LoopAgent`를 import·emit하지 않는다.
- 생성한 Python을 설치된 `google-adk 2.3.0`에서 실제 실행하는 회귀를 추가했다. dynamic loop는 반복 횟수·bounded exit·state·terminal을, static Graph는 route·default·state channel·terminal을 검증한다.
- web Target validator, Graph editor validator, root artifact validator, generator input validator가 duplicate Asset/Runtime/A2A/Node/Edge/Region ID, dangling endpoint/ref, A2A 계약 소유 관계, Region membership·parent cycle, typed asset ref, candidate·Graph `source_requirement_id` 일치를 같은 방향으로 거부한다. `normalized-requirement.json`, `asset-candidates.json`, `graph-ir.json` split은 embedded canonical 값과 같아야 한다.
- split `a2a-contracts.json` API/store 경로를 제거했다. A2A 계약은 `analysis-result.json.a2aContracts`에만 남고 `agent_ref`로 A2A Agent를 참조한다.
- Stage Runner apply는 같은 Node 프로세스의 모든 store 인스턴스가 공유하는 artifact-root+reqId lock 안에서 proposal을 다시 읽어 recorded ETag와 strict schema를 재검증하고 모든 canonical ETag를 쓰기 전에 확인한다. proposal 변조나 concurrent API base conflict가 있으면 canonical 파일을 하나도 쓰지 않는다.
- Stage Runner workspace snapshot은 tracked, non-ignored untracked, `.env.local` 같은 개별 ignored 파일, active artifact root 전체를 실행 전후 비교한다. 위반은 add/modify/delete 경로를 기록하고 run을 실패시키며 자동 rollback은 하지 않는다.
- Design UI의 직렬화 값은 `parallel|loop`로 유지하되 사용자 표시는 `병렬 실행 범위`, `반복 실행 범위`로 바꿨다. 편집기의 8개 Target node kind와 두 Region 선택지는 실행 mode 선택기가 아니라 Graph 구조 편집 표면이다.
- 기존 repository `artifacts/**`는 외부 백업 후 비웠다. tar 백업은 `/home/ilmaswsl/work/Agent-Factory-artifact-backups/artifacts-before-target-only-20260719T204700+0900.tar.gz`이며 SHA-256은 `6774aff9dd8d5f0550badcccda0fb689c4ae2b21c91a2753d01b06aec14e6aaa`다. 원본 directory 백업은 같은 상위 경로의 `artifacts-retired-20260719T204700+0900`이다.

### 재검증 결과

- `packages/web`: 최종 `npm run test:analyzer` 성공. 이 묶음의 root validator 22건과 generator 18건, 합계 Node test 40건이 전부 통과했다.
- generated runtime: ADK 2.3.0에서 dynamic/static 실행 회귀 성공.
- `packages/web`: `npm run build` 성공, Vite 686 modules 변환.
- `packages/mock-lab`: `npm test && npm run build` 성공.
- repository root: `node scripts/validate-artifacts.mjs` 성공.
- repository root: `node scripts/validate-skills.mjs` errors 0, 기존 구조 경고 5, PASS.
- 활성 변경 Markdown 95개에서 상대 링크·anchor 619개를 검사해 실패 0.
- `git diff --check` 성공.
- `http://127.0.0.1:5173/` 실제 Design 화면에서 콘솔 오류 0, 8개 Target node kind, 두 실행 범위 label과 parallel/loop overlay를 확인했다. 캡처는 `.playwright-cli/adk-region-policy-parallel.png`, `.playwright-cli/adk-region-policy-loop.png`에 남겼고 검사용 artifact root와 브라우저·서버는 종료·정리했다.

### 의도적으로 남긴 제한과 별도 후속

1. **Static Graph routed cycle lowering**: ADK 2.x Graph 자체는 route cycle을 표현할 수 있지만 현재 generator는 그 shape를 지원하지 않는다. `representation: graph`의 cycle은 dynamic으로 몰래 바꾸지 않고 fail-closed한다. 이 기능이 필요하면 route condition, exit/default, terminal reachability를 계약화하고 실제 생성 Python 실행 회귀와 함께 별도 구현한다.
2. **디스크 transaction 경계**: canonical write lock은 한 Node 프로세스 안의 API/store 동시 쓰기를 직렬화한다. process crash, filesystem failure, 별도 process·직접 filesystem writer가 순차 write 중 개입한 경우까지 rollback하는 crash-safe transaction은 아니다. 그 수준이 필요하면 directory generation 교체나 journal/recovery를 별도 설계한다.
3. **ignored directory tree 감시**: Stage Runner는 개별 ignored 파일과 active artifact root는 감시하지만, active root 밖에서 디렉터리 전체가 ignored인 tree는 재귀 fingerprint하지 않는다. `.git`, `node_modules`, runtime venv·generated cache 같은 대형 tree를 매 run 전부 hash하지 않기 위한 현재 경계다. 이런 tree 내부 쓰기까지 금지 증거가 필요하면 저비용 filesystem watcher 또는 명시적 허용 경계 기반 감시를 별도 설계해야 한다.
4. **커밋·푸시**: 이번 세션은 사용자 작업과 섞인 큰 dirty worktree를 보존했으며 commit/push하지 않았다. 이후 publish 작업은 사용자 소유 삭제·package 변경·미추적 evidence를 분리해 명시적 경로만 stage해야 한다.

# 8. 2026-07-20 수동 웹 테스트 준비와 피드백 인계

## 8.1 시작 방법

- repository root의 단순 `npm run dev`는 root `package.json`이 없으므로 `ENOENT`로 실패한다.
- 어느 작업 디렉터리에서든 `/home/ilmaswsl/work/Agent-Factory/scripts/start-manual-web-test.sh`를 실행한다. 저장소 안에서는 `./scripts/start-manual-web-test.sh`로 충분하다.
- launcher는 `packages/web`으로 이동해 `npm run dev -- --configLoader runner --host 0.0.0.0 --port 5173 --strictPort`를 실행한다. `runner`는 일부 worktree에서 발생하는 Vite `.vite-temp` config write 오류도 피한다.
- 서버는 foreground로 실행되며 `Ctrl+C`로 종료한다. 이미 정상 Agent Factory가 5173에서 응답하면 중복 실행하지 않고 준비 URL만 출력한다. 다른 프로세스가 5173을 점유하면 임의 종료하거나 다른 port로 이동하지 않고 blocker를 출력한다.
- launcher는 artifact root를 만들거나 초기화하거나 삭제하지 않는다. 사용자가 만든 현재 artifact만 Workbench에서 읽는다.

## 8.2 수동 테스트에서 확인한 Design 승인 버그

- 증상: Compose 실행과 경계 승인을 끝냈지만 `Runtime/A2A 계약 승인` 버튼이 비활성화되어 Build로 넘어가지 못했다.
- 원인: A2A 계약이 `adk_runtime_policy.auth.mode: "none"`이라고 명시했는데도 Design readiness 검사가 `security_schemes`와 `security_requirements`에 항목이 하나 이상 있어야 한다고 잘못 판단했다. strict v2 schema와 기본 계약은 무인증 계약에서 두 배열을 빈 배열로 허용한다.
- 수정: 무인증 계약에서는 빈 보안 배열을 허용하고, `bearer_env`와 `metadata_env` 계약에서는 기존 검사를 유지한다. 배열에 항목이 있으면 인증 방식과 관계없이 각 항목의 필수 필드를 계속 검사한다.
- 회귀 확인: focused test에서 수정 전 두 readiness 오류를 재현했고 수정 후 통과했다. 실제 브라우저에서 계약 승인 저장, Design 완료, Build 진입, compound scaffold/runtime-stub 생성, artifact validation 성공까지 확인했다.
- 테스트에 사용한 `req-scenario-d`, `req-scenario-e`, `req-scenario-k` root와 자동 생성 helper는 보존 가치가 없어 삭제했다.

## 8.3 테스트 의견 전달 형식과 후속 실행 준비

각 문제는 아래 다섯 항목이면 바로 재현·수정 작업으로 전환할 수 있다.

1. 사용한 artifact root와 URL
2. 클릭·입력 순서
3. 기대한 결과와 실제 결과
4. 화면 메시지 또는 브라우저 console/network 오류
5. fixture 변경을 보존할지 초기화해도 되는지

후속 세션은 먼저 해당 root를 백업하고 현재 artifact JSON과 manifest ETag를 확인한 뒤 같은 URL에서 재현한다. 원인 확인 전 artifact를 초기화하거나 추측성 수정을 적용하지 않는다. 재현 후에는 관련 test를 RED로 추가하고, 수정 뒤 `npm run test:analyzer`, `npm run build`, artifact validator와 같은 수동 URL을 다시 검증한다.

## 8.4 2026-07-20 Compose 승인 결함 수정과 lifecycle gate 종결

### Compose 승인 결함

- 무인증 A2A 계약(`adk_runtime_policy.auth.mode: "none"`)도 보안 배열의 항목을 강제하던 readiness 검사가 직접 원인이었다. `none`에서는 빈 `security_schemes`·`security_requirements`를 허용하고, 배열에 값이 있거나 `bearer_env|metadata_env`를 쓰는 계약에는 기존 필드 검사를 유지한다.
- focused RED/GREEN 뒤 실제 Design 화면에서 두 승인 저장, Design 완료, Build 진입, compound scaffold/runtime-stub 생성과 artifact validation까지 확인했다. 확인 후 단순 시나리오 root와 fixture 생성 helper는 삭제했다.

### 서버가 소유하는 단계 gate

- `af-run-manifest.json`은 identity, 네 stage/status, 네 approval, validation이 모두 있는 strict schema만 허용한다. Approval은 Analyze → 경계 → Runtime 계약 → Handoff 순서를 건너뛸 수 없고, 상위 승인을 취소하면 하위 승인과 stale validation이 함께 무효화된다. Handoff 승인은 실제 non-empty `runtime-stub/`을 요구한다.
- artifact sync, direct runtime-stub API, Build Stage Runner와 `scaffold-plan.json` 저장은 process/write 전에 Analyze와 두 Compose 승인을 다시 검사한다. Verify direct API와 Stage Runner는 여기에 Build complete, Handoff 승인, 실제 stub 존재까지 요구한다.
- `scaffold-plan.json` 저장은 strict schema, requirement identity, canonical analysis·Graph·runtime contract·Catalog projection을 재검증한다. approved Tool의 명시적 Mock Lab MCP binding만 허용되는 projection 차이다.
- `normalized-requirement.json`, `asset-candidates.json`, `graph-ir.json`은 canonical analysis에서 만드는 파생 파일이므로 외부 PUT을 405로 거부한다. Manifest validation은 public PATCH가 아니라 server-owned validation/Verify process만 기록한다.
- static `representation: graph`의 cycle 또는 dynamic-only control은 자동으로 dynamic으로 바꾸지 않고 scaffold readiness에서 막는다.

### Skill·legacy 제거 확인

- 활성 skill directory는 `_shared`, `af-workflow`, `af-discover-assets`, `af-compose-solution`, `af-scaffold-runtime`, `af-verify-runtime`뿐이다. 다섯 skill은 complete manifest와 같은 predecessor gate를 사용하며 Build 계획의 순환 선행 조건과 Verify의 잘못된 server ownership 설명도 바로잡았다.
- Catalog의 `runtime_mock`은 publish round-trip에서 보존한다. Workflow composition은 `subworkflow`, generated runtime manifest의 A2A-bound Agent 목록은 `runtime.a2a_agents`를 사용한다.
- 별도 canonical 의미가 없던 `commonization-notes.json`은 schema, API, store, skill artifact inventory에서 삭제했다. Root validator, generator와 skill validator가 이 파일이 다시 들어오면 실패한다.
- `catalog/`의 활성 bucket은 `agents.yaml`, `workflows.yaml`, `tools.yaml`뿐이고 active `artifacts/af/`는 비어 있다. 과거 용어는 migration/decision history, analyzer 금지 지시와 rejection test에만 남으며 읽기·쓰기·lowering 호환 표면이 아니다.

### 최종 자동 검증

- `cd packages/web && npm run test:analyzer`: PASS. 순차 TypeScript analyzer/UI/server 회귀 전체가 성공했고 마지막 Node 묶음은 generator 22건 + root validator 23건, 합계 45건 전부 통과했다.
- `cd packages/web && npm run build`: PASS, Vite 686 modules.
- `cd packages/mock-lab && npm test`: PASS.
- `cd packages/mock-lab && npm run build`: PASS, Vite 42 modules.
- `node scripts/validate-artifacts.mjs`: `Artifact validation OK`.
- `node scripts/validate-skills.mjs`: files 42, Markdown 37, skills 5, errors 0, warnings 0, PASS.
- S16 canonical-direct의 expected JSON parse, canonical frontmatter, 네 retired directory 부재, 16개 scenario inventory 검사를 각각 다시 실행해 모두 exit 0을 확인했다.
- 변경된 활성 Markdown 98개에서 상대 링크·anchor 631개를 검사해 실패 0. `git diff --check`도 통과했다.
- 최종 소스에서 launcher로 5173 서버를 다시 기동했다. `/`와 `/api/af`가 200으로 응답하고 root 목록은 `[]`이며, `commonization-notes.json` 요청은 지원하지 않는 경로로 404를 반환한다. 서버 시작만으로 test artifact는 생기지 않았다.

### 다음 범위

- 대규모 UI·전체 사용성 개편은 사용자 지시에 따라 이번 작업에 포함하지 않는다.
- ADK Graph 자체가 지원하는 routed cycle의 generator lowering은 별도 기능이다. 현재는 오해를 만드는 암묵적 mode 전환 없이 명시적으로 fail-closed한다.
