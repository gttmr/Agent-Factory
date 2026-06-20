# 13 — scaffold-plan 워닝 문구 정확화 (카테고리/모드 인식)

상태: **미구현.** `collectWarnings`(`packages/web/src/analyzer/scaffoldPlan.ts`)가 catalog binding 없는 **모든** 모듈에 동일 문구를 단다: `"<name>: 선택된 catalog binding이 없어 새 코드 TODO boundary로 생성됩니다."`

## 왜 필요한가

이 문구는 카테고리·output_mode 와 무관한 일괄 메시지라 오해를 준다(테스트 중 사용자 혼동 발생):

- **runnable + remote_a2a**: 실제로는 동작하는 `RemoteA2aAgent`(계약 agent_card 로 호출)가 생성된다 — "TODO boundary" 아님.
- **runnable + agent**: 실제로는 동작하는 Gemini `LlmAgent` 가 생성된다(instruction 은 검토 placeholder) — inert TODO 아님.
- **smoke** 또는 **unconnected adapter**: 이때만 "TODO/스텁" 표현이 정확.

즉 "catalog 재사용 안 함"(정보)과 "런타임에 동작 안 함"(오해)을 구분해야 한다.

## 무엇을 해야 하는가

1. `collectWarnings` 를 `output_mode` + `module_category`(+ adapter 연결 여부) 인식형으로 분기:
   - runnable + agent → "LlmAgent 로 생성됩니다. instruction 은 검토 placeholder 입니다."
   - runnable + remote_a2a → "RemoteA2aAgent 로 생성되어 승인된 계약의 agent_card 로 호출합니다."
   - runnable + connected adapter → (현 런타임 MCP 안내와 일관) "실행 시 Mock Lab MCP tool 을 호출합니다."
   - runnable + unconnected adapter / workflow stub, 또는 smoke → 현 "TODO boundary/스텁" 표현 유지.
   - catalog_binding 있는 경우는 현행 메시지 유지.
2. `buildScaffoldPlan` 에 `output_mode` 는 이미 전달됨 — `collectWarnings` 시그니처에 mode 전달.
3. 회귀: `packages/web/src/analyzer/scaffoldPlan.test.ts` 에 카테고리/모드별 워닝 문구 단언 추가.

## 건드릴 파일

- `packages/web/src/analyzer/scaffoldPlan.ts` (`collectWarnings`, 호출부)
- `packages/web/src/analyzer/scaffoldPlan.test.ts`
- (문구가 UI 계약이면) `docs/workbench/validation.md` 또는 `agent-factory-harness.md` 에 워닝 의미 한 줄, `docs/decision-log.md`

## 검증

`cd packages/web && npm run test:analyzer`(scaffoldPlan.test 포함) + `npm run build`; 워크벤치 Build 화면에서 remote/agent 모듈의 워닝 문구가 모드에 맞게 표시되는지 chrome-devtools 확인.

## 규모/주의

작은 UX 정확화. 기존 `정보 필요 후보`/`Runtime 계약 포함` 워닝은 건드리지 않는다. scaffold-plan 워닝은 hard gate 가 아니라 안내이므로 동작(can_generate_source) 에는 영향 없어야 한다.
