---
name: codex-companion-long-runs
description: codex 장기 실행은 rescue 포워더(10분 컷) 대신 메인 세션 백그라운드 Bash에서 companion 직접 실행 + 증분 저장
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 18ecc8b1-bce3-4872-a21a-094e41ddaf43
---

codex:codex-rescue 포워더 경유 실행은 서브에이전트 Bash의 10분 한도에 걸려 장기(xhigh) 실행이 반복적으로 죽는다 (2026-07-08 세션에서 3회). 또한 companion `--background` 출력에 `| head`를 물리면 SIGPIPE로 런처가 죽어 잡 레지스트리가 고아 "running" 상태로 남고 결과 회수가 불가능해진다 (`| tail`은 안전).

**Why:** 포워더는 단일 포그라운드 Bash 호출 계약이라 타임아웃 제어가 불가능; companion의 detached 잡도 런처 프로세스그룹 kill에 같이 죽는다.

**How to apply:** 10분 넘을 만한 codex 작업(전면 재작성, 클러스터 리뷰, 빌드 포함 구현)은 메인 세션이 `codex-companion.mjs task --write --model gpt-5.5 --effort xhigh "<프롬프트>"`를 run_in_background Bash로 직접 실행한다(파이프 없음 또는 tail만). 프롬프트에 반드시 "보고서/노트를 파일에 증분 저장" 지시를 넣어 컷오프에도 진행분이 남게 한다. 고아 "running" 잡은 `codex-companion.mjs cancel <job-id>`로 정리해야 다음 resume이 풀린다. review는 `review --wait --scope working-tree`를 같은 방식으로. 관련: [[codex-agents-dir-sandbox]]
