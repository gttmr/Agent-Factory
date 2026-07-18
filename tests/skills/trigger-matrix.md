# Agent Factory Skill Trigger Matrix

각 행은 독립 fresh session에서 실행한다. test agent에는 `prompt` 열만 제공하고 `expected`와 `비고`는 사후 평가에만 사용한다.

## `af-workflow`

| prompt | expected | 비고 |
| --- | --- | --- |
| Agent Factory로 고객 문의 자동화를 만들고 싶은데 처음부터 같이 진행해줘. | `af-workflow` | should-trigger 1 |
| 어제 멈춘 Agent Factory 작업을 현재 상태부터 확인해서 이어서 진행해줘. | `af-workflow` | should-trigger 2 |
| 이 작업 폴더가 어느 단계까지 왔는지 보고 다음에 할 일을 정해줘. | `af-workflow` | should-trigger 3 |
| 이 요구에서 실제로 만들 구성요소 후보를 나눠줘. | `af-discover-assets` | should-not-trigger 1: 특정 단계 직접 선택 |
| 검토가 끝난 후보들을 실행 흐름으로 묶어줘. | `af-compose-solution` | should-not-trigger 2: 특정 단계 직접 선택 |
| README의 오탈자 두 곳만 고쳐줘. | AF skill 자동 선택 없음 | should-not-trigger 3: 일반 저장소 작업 |
| 이어서 해줘. | 확인 질문 후 필요할 때 `af-workflow` | ambiguous: root와 중단 지점이 없음 |
| `$af-workflow`를 사용해서 이 저장소의 현재 단계와 다음 작업을 판단해줘. | `af-workflow` | explicit invocation |
| 방금 대화가 요약됐어. 앞 단계 산출물이 남아 있는지 다시 확인하고 원래 하던 Agent Factory 작업의 다음 단계부터 계속해줘. | `af-workflow` | continuation-after-compaction |

## `af-discover-assets`

| prompt | expected | 비고 |
| --- | --- | --- |
| 상담 기록을 읽어 후속 조치가 필요한지 판단하는 기능을 만들려 해. 어떤 구성요소가 필요한지 요구부터 나눠줘. | `af-discover-assets` | should-trigger 1 |
| 업로드한 서류의 누락 항목을 확인하려면 무엇을 만들고 무엇을 외부 기능으로 봐야 하는지 정리해줘. | `af-discover-assets` | should-trigger 2 |
| 두 시스템 사이의 수작업을 자동화하려고 해. 요구사항에서 후보와 아직 물어봐야 할 내용을 뽑아줘. | `af-discover-assets` | should-trigger 3 |
| 검토된 후보들의 분기와 합류를 실행 구조로 설계해줘. | `af-compose-solution` | should-not-trigger 1 |
| 승인된 설계대로 로컬에서 실행할 프로젝트를 만들어줘. | `af-scaffold-runtime` | should-not-trigger 2 |
| 생성된 연결이 timeout 때 안전하게 실패하는지 검증해줘. | `af-verify-runtime` | should-not-trigger 3 |
| 이 요구를 정리해줘. | 확인 질문 또는 AF skill 자동 선택 없음 | ambiguous: Agent Factory 목적이 불명확 |
| `$af-discover-assets`를 사용해서 이 요청에서 만들 후보와 부족한 정보를 찾아줘. | `af-discover-assets` | explicit invocation |
| 대화가 압축되기 전에 요구 원문 확인까지만 끝났어. 현재 파일을 다시 읽고 후보 도출부터 계속해줘. | `af-discover-assets` | continuation-after-compaction |

## `af-compose-solution`

| prompt | expected | 비고 |
| --- | --- | --- |
| 검토가 끝난 상담 판단 기능과 조회 기능을 실제 실행 순서로 조합해줘. | `af-compose-solution` | should-trigger 1 |
| 확정된 후보들이 어떤 주체의 판단으로 호출되고 서로 무엇을 주고받을지 설계해줘. | `af-compose-solution` | should-trigger 2 |
| 외부 팀이 운영하는 Agent를 원격으로 쓸지 로컬 구성으로 둘지 비교해서 승인 가능한 연결 구조를 잡아줘. | `af-compose-solution` | should-trigger 3 |
| 원문 요구에서 어떤 후보가 필요한지 먼저 찾아줘. | `af-discover-assets` | should-not-trigger 1 |
| 승인된 실행 설계를 실제 ADK 파일로 생성해줘. | `af-scaffold-runtime` | should-not-trigger 2 |
| 이미 생성된 callback과 상태 저장 동작을 시험해줘. | `af-verify-runtime` | should-not-trigger 3 |
| 이 기능의 구조를 잡아줘. | predecessor 확인 후 선택 | ambiguous: reviewed 후보 여부가 없음 |
| `$af-compose-solution`을 사용해서 검토된 후보의 실행 구조와 연결 계약을 정리해줘. | `af-compose-solution` | explicit invocation |
| 대화 요약 전에 후보 검토까지 끝났어. 현재 설계 입력을 다시 읽고 실행 구조를 만드는 단계부터 재개해줘. | `af-compose-solution` | continuation-after-compaction |

## `af-scaffold-runtime`

| prompt | expected | 비고 |
| --- | --- | --- |
| 승인된 설계와 생성 계획이 준비됐어. 지정한 출력 폴더에 로컬 실행 프로젝트를 만들어줘. | `af-scaffold-runtime` | should-trigger 1 |
| 승인 artifact가 바뀌었으니 기존 runtime handoff를 현재 계약에 맞춰 다시 생성해줘. | `af-scaffold-runtime` | should-trigger 2 |
| 검토가 끝난 실행 전 검사 규칙을 포함해서 합성 입력으로 돌릴 수 있는 코드를 만들어줘. | `af-scaffold-runtime` | should-trigger 3 |
| 이 아이디어에서 어떤 구성요소가 필요한지 설명해줘. | `af-discover-assets` | should-not-trigger 1 |
| 후보들의 호출 순서와 연결 방식을 먼저 결정해줘. | `af-compose-solution` | should-not-trigger 2 |
| 만들어진 프로젝트의 import와 원격 연결을 검증해줘. | `af-verify-runtime` | should-not-trigger 3 |
| ADK로 만들어줘. | 승인 artifact와 출력 root 확인 후 선택 | ambiguous: generation gate가 없음 |
| `$af-scaffold-runtime`을 사용해줘. 다만 승인된 산출물이 없다면 파일을 만들지 말고 필요한 선행 조건을 알려줘. | `af-scaffold-runtime` 선택 후 STOP | explicit invocation과 stop condition |
| 대화가 요약되기 전에 설계 승인과 출력 경로를 확인했어. 현재 산출물을 다시 읽고 생성 단계부터 계속해줘. | `af-scaffold-runtime` | continuation-after-compaction |

## `af-verify-runtime`

| prompt | expected | 비고 |
| --- | --- | --- |
| 생성된 프로젝트의 import와 로컬 실행이 실제로 되는지 새로 확인해줘. | `af-verify-runtime` | should-trigger 1 |
| 외부 도구가 응답하지 않을 때 timeout과 정리 동작이 계약대로인지 검증해줘. | `af-verify-runtime` | should-trigger 2 |
| 현재 revision의 validation report를 실행 증거와 함께 작성해줘. | `af-verify-runtime` | should-trigger 3 |
| 새 요구에서 필요한 구성요소 후보를 뽑아줘. | `af-discover-assets` | should-not-trigger 1 |
| 승인 설계를 바탕으로 runtime 파일을 생성해줘. | `af-scaffold-runtime` | should-not-trigger 2 |
| README 링크만 최신 경로로 바꿔줘. | AF skill 자동 선택 없음 | should-not-trigger 3 |
| 이거 제대로 됐는지 봐줘. | 대상 root와 claim 확인 후 선택 | ambiguous: 검증 대상이 없음 |
| `$af-verify-runtime`을 사용해서 현재 출력의 상태 저장과 재개 동작을 fresh evidence로 검증해줘. | `af-verify-runtime` | explicit invocation |
| 대화 요약 전에 검증 대상과 claim을 정했어. 현재 revision과 출력 root를 다시 확인하고 중단된 검증을 이어서 실행해줘. | `af-verify-runtime` | continuation-after-compaction |

